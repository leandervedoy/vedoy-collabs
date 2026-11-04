import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserId, jsonError, signState, validateShop } from "@/lib/shopify";

export const runtime="nodejs";
export async function POST(req:NextRequest){
  try{
    const user=await getUserId(req);
    const {shop:raw}=await req.json() as {shop?:string};
    const shop=validateShop(raw||"");
    if(!process.env.SHOPIFY_API_KEY||!process.env.SHOPIFY_API_SECRET||!process.env.COLLABS_TOKEN_ENCRYPTION_KEY)
      throw new Error("Shopify er ikke konfigurert på serveren.");
    const nonce=randomBytes(24).toString("hex");
    const state=signState({user,shop,nonce,exp:Date.now()+600000});
    const redirect=process.env.SHOPIFY_REDIRECT_URI;
    if(!redirect || !redirect.startsWith("https://"))throw new Error("SHOPIFY_REDIRECT_URI må være en HTTPS-adresse.");
    const url=new URL("https://"+shop+"/admin/oauth/authorize");
    url.searchParams.set("client_id",process.env.SHOPIFY_API_KEY);
    url.searchParams.set("scope","read_products");
    url.searchParams.set("redirect_uri",redirect);
    url.searchParams.set("state",state);
    const response=NextResponse.json({url:url.toString()});
    response.cookies.set("collabs_shopify_oauth",nonce,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:600});
    return response;
  }catch(e){return jsonError(e,400);}
}
