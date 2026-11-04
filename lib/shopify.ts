import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const API_VERSION = "2026-10";
const DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function validateShop(raw: string): string {
  const shop = raw.trim().toLowerCase();
  if (!DOMAIN.test(shop)) throw new Error("Bruk adressen butikk.myshopify.com.");
  return shop;
}
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Serverens Supabase-integrasjon er ikke konfigurert.");
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
}
export async function getUserId(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!jwt) throw new Error("Du må logge inn.");
  const {data, error} = await admin().auth.getUser(jwt);
  if (error || !data.user) throw new Error("Ugyldig eller utløpt innlogging.");
  return data.user.id;
}
function key() {
  const secret = process.env.COLLABS_TOKEN_ENCRYPTION_KEY;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw new Error("COLLABS_TOKEN_ENCRYPTION_KEY må være 64 hex-tegn.");
  return Buffer.from(secret, "hex");
}
export function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}
export function decrypt(value: string): string {
  const [a,b,c] = value.split(".");
  if (!a || !b || !c) throw new Error("Ugyldig kryptert token.");
  const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(a,"base64url"));
  cipher.setAuthTag(Buffer.from(b,"base64url"));
  return Buffer.concat([cipher.update(Buffer.from(c,"base64url")),cipher.final()]).toString("utf8");
}
export function signState(value: Record<string,unknown>) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const mac = createHmac("sha256", process.env.SHOPIFY_API_SECRET || "").update(payload).digest("base64url");
  return payload + "." + mac;
}
export function verifyState(input: string): {user: string, shop: string, nonce: string, exp: number} {
  const [payload,mac] = input.split(".");
  if (!payload || !mac) throw new Error("Ugyldig OAuth-tilstand.");
  const expected = createHmac("sha256", process.env.SHOPIFY_API_SECRET || "").update(payload).digest();
  const actual = Buffer.from(mac,"base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual,expected)) throw new Error("OAuth-signaturen stemmer ikke.");
  const obj = JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
  if (!obj.user || !obj.shop || !obj.nonce || !Number.isFinite(obj.exp) || obj.exp < Date.now()) throw new Error("OAuth-tilstanden er utløpt.");
  return obj;
}
export function verifyShopifyHmac(params: URLSearchParams) {
  const hmac = params.get("hmac");
  if (!hmac || !/^[0-9a-f]{64}$/i.test(hmac)) return false;
  const entries = [...params.entries()].filter(([key])=>key!=="hmac"&&key!=="signature")
    .sort(([a],[b])=>a.localeCompare(b));
  const message = entries.map(([k,v])=>k+"="+v).join("&");
  const expected = createHmac("sha256",process.env.SHOPIFY_API_SECRET || "").update(message).digest();
  const supplied = Buffer.from(hmac,"hex");
  return supplied.length===expected.length && timingSafeEqual(supplied,expected);
}
type TokenResponse = {access_token:string;refresh_token?:string;expires_in?:number;refresh_token_expires_in?:number;scope?:string};
export async function tokenGrant(shop: string, form: Record<string,string>): Promise<TokenResponse> {
  const response = await fetch("https://"+validateShop(shop)+"/admin/oauth/access_token",{
    method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:process.env.SHOPIFY_API_KEY || "",client_secret:process.env.SHOPIFY_API_SECRET || "",...form}),
    cache:"no-store",signal:AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("Shopify godkjente ikke tilkoblingen ("+response.status+").");
  const data=await response.json() as TokenResponse;
  if (!data.access_token) throw new Error("Shopify returnerte ingen tilgangsnøkkel.");
  return data;
}
export async function getShopToken(owner: string, domain: string): Promise<string> {
  const db=admin();
  const {data:shop,error}=await db.from("collabs_shopify_connections").select("*")
    .eq("owner_id",owner).eq("shop_domain",validateShop(domain)).eq("status","connected").maybeSingle();
  if (error || !shop) throw new Error("Butikken er ikke koblet til kontoen din.");
  if (shop.access_expires_at && new Date(shop.access_expires_at).getTime() < Date.now()+120000) {
    if (!shop.encrypted_refresh_token || (shop.refresh_expires_at && new Date(shop.refresh_expires_at).getTime()<Date.now())) throw new Error("Shopify-tilkoblingen er utløpt. Koble til på nytt.");
    const tokens = await tokenGrant(domain, {grant_type:"refresh_token",refresh_token:decrypt(shop.encrypted_refresh_token)});
    const {error:saveError}=await db.from("collabs_shopify_connections").update({
      encrypted_access_token:encrypt(tokens.access_token),
      encrypted_refresh_token:tokens.refresh_token?encrypt(tokens.refresh_token):shop.encrypted_refresh_token,
      access_expires_at:tokens.expires_in?new Date(Date.now()+tokens.expires_in*1000).toISOString():null,
      refresh_expires_at:tokens.refresh_token_expires_in?new Date(Date.now()+tokens.refresh_token_expires_in*1000).toISOString():shop.refresh_expires_at,
      updated_at:new Date().toISOString()
    }).eq("id",shop.id).eq("owner_id",owner);
    if(saveError)throw saveError;
    return tokens.access_token;
  }
  return decrypt(shop.encrypted_access_token);
}
export async function graphql(owner:string,shop:string,query:string,variables:Record<string,unknown>={}) {
  const token=await getShopToken(owner,shop);
  const response=await fetch("https://"+validateShop(shop)+"/admin/api/"+API_VERSION+"/graphql.json",{
    method:"POST",headers:{"X-Shopify-Access-Token":token,"Content-Type":"application/json"},
    body:JSON.stringify({query,variables}),cache:"no-store",signal:AbortSignal.timeout(15000)
  });
  if(!response.ok) throw new Error("Shopify kunne ikke hente data ("+response.status+").");
  const result=await response.json();
  if(result.errors?.length)throw new Error("Shopify API: "+String(result.errors[0]?.message || "ukjent feil"));
  return result.data;
}
export function jsonError(err:unknown,status=400) {
  return Response.json({error:err instanceof Error?err.message:"Ukjent feil."},{status});
}
