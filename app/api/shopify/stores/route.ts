import { NextRequest } from "next/server";
import { admin,getUserId,jsonError } from "@/lib/shopify";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 try{
   const owner=await getUserId(req);
   const {data,error}=await admin().from("collabs_shopify_connections")
     .select("id,shop_domain,status,scopes,connected_at,updated_at")
     .eq("owner_id",owner).order("connected_at",{ascending:false});
   if(error)throw error;
   return Response.json({stores:data||[]});
 }catch(e){return jsonError(e,401);}
}
