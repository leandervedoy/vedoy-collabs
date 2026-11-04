import { NextRequest } from "next/server";
import { getUserId,graphql,jsonError,validateShop } from "@/lib/shopify";
export const runtime="nodejs";
const QUERY=`query CollabsProducts($first: Int!, $query: String) {
  products(first: $first, query: $query) {
    nodes { id title handle featuredImage { url altText } }
  }
}`;
export async function GET(req:NextRequest){
 try{
   const owner=await getUserId(req);
   const shop=validateShop(req.nextUrl.searchParams.get("shop")||"");
   const filter=(req.nextUrl.searchParams.get("q")||"").slice(0,100);
   const data=await graphql(owner,shop,QUERY,{first:25,query:filter||null});
   const products=(data?.products?.nodes||[]).map((p:{id:string,title:string,handle:string,featuredImage?:{url:string,altText?:string}})=>({
     id:p.id,title:p.title,handle:p.handle,image:p.featuredImage?.url||null
   }));
   return Response.json({products});
 }catch(e){return jsonError(e);}
}
