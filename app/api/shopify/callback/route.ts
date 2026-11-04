import { NextRequest, NextResponse } from "next/server";
import { admin, encrypt, tokenGrant, validateShop, verifyShopifyHmac, verifyState } from "@/lib/shopify";
export const runtime="nodejs";
export async function GET(req:NextRequest){
  const base=process.env.COLLABS_PUBLIC_URL || req.nextUrl.origin;
  const destination=new URL("/shopify",base);
  try{
    const params=req.nextUrl.searchParams;
    if(!verifyShopifyHmac(params))throw new Error("Shopify-signaturen ble avvist.");
    const state=verifyState(params.get("state")||"");
    if(state.nonce!==req.cookies.get("collabs_shopify_oauth")?.value)throw new Error("OAuth-sesjonen stemmer ikke.");
    const shop=validateShop(params.get("shop")||"");
    if(shop!==state.shop)throw new Error("Butikkadressen ble endret.");
    const code=params.get("code");
    if(!code)throw new Error("Shopify sendte ingen autorisasjonskode.");
    const tokens=await tokenGrant(shop,{code,expiring:"1"});
    if(!tokens.refresh_token || !tokens.expires_in)throw new Error("Shopify returnerte ikke en tidsbegrenset tokenpakke.");
    const db=admin();
    const {data:existing,error:readError}=await db.from("collabs_shopify_connections").select("owner_id")
      .eq("shop_domain",shop).maybeSingle();
    if(readError)throw readError;
    if(existing && existing.owner_id!==state.user)throw new Error("Denne butikken er allerede koblet til en annen konto.");
    const values={
      owner_id:state.user,shop_domain:shop,encrypted_access_token:encrypt(tokens.access_token),
      encrypted_refresh_token:encrypt(tokens.refresh_token),
      access_expires_at:new Date(Date.now()+tokens.expires_in*1000).toISOString(),
      refresh_expires_at:tokens.refresh_token_expires_in?new Date(Date.now()+tokens.refresh_token_expires_in*1000).toISOString():null,
      scopes:tokens.scope||"read_products",status:"connected",updated_at:new Date().toISOString()
    };
    const {error}=await db.from("collabs_shopify_connections").upsert(values,{onConflict:"shop_domain"});
    if(error)throw error;
    destination.searchParams.set("connected",shop);
  }catch(e){
    destination.searchParams.set("error",e instanceof Error?e.message:"Tilkobling feilet");
  }
  const res=NextResponse.redirect(destination);
  res.cookies.set("collabs_shopify_oauth","",{path:"/",maxAge:0});
  return res;
}
