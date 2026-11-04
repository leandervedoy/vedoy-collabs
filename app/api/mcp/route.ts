import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { admin } from "@/lib/shopify";
export const runtime="nodejs";
export const dynamic="force-dynamic";

const allowedOrigin=process.env.COLLABS_MCP_ORIGIN || "";
function authorize(req:NextRequest){
 const secret=process.env.COLLABS_MCP_ACCESS_TOKEN;
 if(!secret || secret.length<32)return false;
 const value=req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1]||"";
 const expected=createHash("sha256").update(secret).digest();
 const actual=createHash("sha256").update(value).digest();
 return !!value&&timingSafeEqual(expected,actual);
}
function respond(payload:unknown,status=200){
 return new Response(JSON.stringify(payload),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":allowedOrigin||"null"}});
}
function toolResult(data:unknown){return {content:[{type:"text",text:JSON.stringify(data)}]};}
const tools=[
 {name:"find_creators",description:"Search opt-in public Vedoy Collabs creator profiles by skill, role, location or keyword. Results are public professional summaries and never private contact details.",inputSchema:{type:"object",properties:{query:{type:"string"},skill:{type:"string"},location:{type:"string"},limit:{type:"integer",minimum:1,maximum:15}},additionalProperties:false}},
 {name:"find_creator_campaigns",description:"List publicly open creator collaboration campaigns posted by Shopify-connected businesses on Vedoy Collabs.",inputSchema:{type:"object",properties:{query:{type:"string"},limit:{type:"integer",minimum:1,maximum:15}},additionalProperties:false}},
 {name:"get_public_media_kit",description:"Read a creator's explicitly published Media Kit by its public slug.",inputSchema:{type:"object",properties:{slug:{type:"string"}},required:["slug"],additionalProperties:false}}
];
async function callTool(name:string,args:Record<string,unknown>){
 const db=admin();
 if(name==="find_creators"){
  const query=String(args.query||"").slice(0,80).trim().toLowerCase(),skill=String(args.skill||"").slice(0,60).trim().toLowerCase(),location=String(args.location||"").slice(0,60).trim().toLowerCase();
  const limit=Math.max(1,Math.min(Number(args.limit)||8,15));
  const {data,error}=await db.from("collabs_profiles").select("user_id,display_name,headline,roles,skills,location,availability,bio,portfolio").eq("is_public",true).order("updated_at",{ascending:false}).limit(120);
  if(error)throw error;
  const eligible=(data||[]).filter(c=>{
    const text=[c.display_name,c.headline,(c.roles||[]).join(" "),(c.skills||[]).join(" "),c.bio].join(" ").toLowerCase();
    return (!query||text.includes(query))&&(!skill||(c.skills||[]).some((x:string)=>x.toLowerCase().includes(skill)))&&(!location||String(c.location||"").toLowerCase().includes(location));
  }).slice(0,limit).map(c=>({id:c.user_id,name:c.display_name,headline:c.headline,roles:c.roles,skills:c.skills,location:c.location,availability:c.availability,bio:String(c.bio||"").slice(0,300),portfolio:Array.isArray(c.portfolio)?c.portfolio.slice(0,4):[]}));
  return {creators:eligible,show_more:"Logg inn i Vedoy Collabs for profilvisning og godkjente kontaktforespørsler.",read_only:true};
 }
 if(name==="find_creator_campaigns"){
  const query=String(args.query||"").slice(0,100).toLowerCase();
  const limit=Math.max(1,Math.min(Number(args.limit)||8,15));
  const {data,error}=await db.from("collabs_product_campaigns").select("id,product_title,brief,budget_nok,deliverables,created_at,shop_domain").eq("status","open").order("created_at",{ascending:false}).limit(80);
  if(error)throw error;
  const campaigns=(data||[]).filter(c=>[c.product_title,c.brief,c.shop_domain].join(" ").toLowerCase().includes(query)).slice(0,limit);
  return {campaigns,read_only:true};
 }
 if(name==="get_public_media_kit"){
  const slug=String(args.slug||"").trim().toLowerCase();
  if(!/^[a-z0-9-]{3,50}$/.test(slug))throw new Error("Ugyldig mediekit-adresse.");
  const {data,error}=await db.from("collabs_media_kits").select("user_id,slug,tagline,about,niches,platforms,packages,highlights,published").eq("slug",slug).eq("published",true).maybeSingle();
  if(error)throw error;
  if(!data)return {found:false};
  const {data:profile,error:pe}=await db.from("collabs_profiles").select("display_name,headline,location,skills,portfolio,is_public").eq("user_id",data.user_id).eq("is_public",true).maybeSingle();
  if(pe)throw pe;
  if(!profile)return {found:false};
  const {user_id:ignore,published:ignored,...kit}=data;
  return {found:true,kit:{...kit,creator:profile,statistics_note:"Social metrics are self-reported unless independently verified."}};
 }
 throw new Error("Ukjent MCP-verktøy.");
}
export async function POST(req:NextRequest){
 if(!authorize(req))return respond({error:"Unauthorized"},401);
 const raw=await req.text();if(raw.length>12000)return respond({error:"Request too large"},413);
 let payload:any;
 try{payload=JSON.parse(raw);}catch{return respond({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Invalid JSON"}},400);}
 if(Array.isArray(payload))return respond({jsonrpc:"2.0",id:null,error:{code:-32600,message:"Batch requests unsupported"}},400);
 const id=payload.id??null;
 if(payload.method==="notifications/initialized")return new Response(null,{status:202});
 if(payload.method==="initialize")return respond({jsonrpc:"2.0",id,result:{protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"vedoy-collabs",version:"0.1.0"}}});
 if(payload.method==="ping")return respond({jsonrpc:"2.0",id,result:{}});
 if(payload.method==="tools/list")return respond({jsonrpc:"2.0",id,result:{tools}});
 if(payload.method==="tools/call"){
  const name=String(payload.params?.name||"");
  if(!tools.some(x=>x.name===name))return respond({jsonrpc:"2.0",id,error:{code:-32602,message:"Unknown tool"}},400);
  try{
    const result=await callTool(name,payload.params?.arguments||{});
    return respond({jsonrpc:"2.0",id,result:toolResult(result)});
  }catch(error){
    // Do not reveal database errors or private infrastructure details to clients.
    console.error("Collabs MCP tool error",name,error);
    return respond({jsonrpc:"2.0",id,result:{isError:true,content:[{type:"text",text:"Verktøyet er midlertidig utilgjengelig."}]}});
  }
 }
 return respond({jsonrpc:"2.0",id,error:{code:-32601,message:"Method not found"}},400);
}
export async function GET(){return respond({error:"MCP requires authenticated POST requests."},405);}
