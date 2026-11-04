import { NextRequest } from "next/server";
import { admin,getUserId,jsonError } from "@/lib/shopify";
export const runtime="nodejs";

async function requireOwner(request:NextRequest,id:string){
  const owner=await getUserId(request);
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error("Ugyldig kampanje.");
  const db=admin();
  const {data,error}=await db.from("collabs_product_campaigns").select("id,owner_id").eq("id",id).eq("owner_id",owner).maybeSingle();
  if(error||!data)throw new Error("Kampanjen finnes ikke på din konto.");
  return db;
}
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;const db=await requireOwner(request,id);
    const {data,error}=await db.from("collabs_campaign_applications")
      .select("id,creator_id,pitch,status,created_at").eq("campaign_id",id).order("created_at",{ascending:false}).limit(100);
    if(error)throw error;
    return Response.json({applications:data||[]});
  }catch(e){return jsonError(e,403);}
}
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;const db=await requireOwner(request,id);
    const body=await request.json();const applicationId=String(body.application_id||"");
    const status=String(body.status||"");
    if(!/^[0-9a-f-]{36}$/i.test(applicationId)||!["shortlisted","declined"].includes(status))throw new Error("Ugyldig status.");
    const {data,error}=await db.from("collabs_campaign_applications").update({status})
      .eq("id",applicationId).eq("campaign_id",id).select("id,status").single();
    if(error)throw error;
    return Response.json({application:data});
  }catch(e){return jsonError(e,403);}
}
