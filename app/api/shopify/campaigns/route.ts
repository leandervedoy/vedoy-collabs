import { NextRequest } from "next/server";
import { admin,getShopToken,getUserId,jsonError,validateShop } from "@/lib/shopify";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 try{
  const owner=await getUserId(req);
  const db=admin();
  const {data,error}=await db.from("collabs_product_campaigns").select(
    "id,shop_domain,product_gid,product_title,product_handle,product_image_url,brief,deliverables,budget_nok,status,created_at"
  ).eq("owner_id",owner).order("created_at",{ascending:false}).limit(100);
  if(error)throw error;
  return Response.json({campaigns:data||[]});
 }catch(e){return jsonError(e,401);}
}
export async function POST(req:NextRequest){
 try{
  const owner=await getUserId(req);
  const body=await req.json();
  const shop=validateShop(String(body.shop_domain||""));
  await getShopToken(owner,shop);
  const product=String(body.product_gid||"");
  if(!/^gid:\/\/shopify\/Product\/[0-9]+$/.test(product))throw new Error("Ugyldig Shopify-produkt.");
  const title=String(body.product_title||"").trim().slice(0,200);
  const brief=String(body.brief||"").trim().slice(0,4000);
  const budget=Number(body.budget_nok);
  if(!title || brief.length<20 || !Number.isInteger(budget) || budget<0 || budget>10000000)
    throw new Error("Oppgi produkt, kampanjebeskrivelse og gyldig budsjett.");
  const status=body.publish===true?"open":"draft";
  const {data,error}=await admin().from("collabs_product_campaigns").insert({
    owner_id:owner,shop_domain:shop,product_gid:product,product_title:title,
    product_handle:String(body.product_handle||"").slice(0,255),
    product_image_url:typeof body.product_image_url==="string"?body.product_image_url.slice(0,1000):null,
    brief,deliverables:Array.isArray(body.deliverables)?body.deliverables.filter((x:unknown)=>typeof x==="string").slice(0,10):[],
    budget_nok:budget,status
  }).select("id,status").single();
  if(error)throw error;
  return Response.json({campaign:data},{status:201});
 }catch(e){return jsonError(e);}
}
