import { NextRequest } from "next/server";
import { admin } from "@/lib/shopify";
export const runtime="nodejs";
export const dynamic="force-dynamic";

type Payload={jsonrpc?:string;id?:number|string|null;method?:string;params?:{name?:string;arguments?:Record<string,unknown>}};
const protocol="2025-06-18";
const tools=[
 {name:"search_creators",description:"Find creators who explicitly published a public Vedoy Collabs Media Kit. Read-only. Provides portfolio excerpts, roles, skills and links, never private contact details.",inputSchema:{type:"object",properties:{query:{type:"string",description:"Name, skill, industry or location to search"},limit:{type:"integer",minimum:1,maximum:12}},required:["query"]},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:"find_creator_campaigns",description:"Find public open campaigns for creators by product, brand or brief. Read-only.",inputSchema:{type:"object",properties:{query:{type:"string"},limit:{type:"integer",minimum:1,maximum:12}},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:"get_creator_media_kit",description:"Read a public and published Creator Media Kit by its public slug. Read-only.",inputSchema:{type:"object",properties:{slug:{type:"string"}},required:["slug"]},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}}
];
function answer(id:string|number|null|undefined,result:unknown){return Response.json({jsonrpc:"2.0",id:id??null,result},{headers:{"Cache-Control":"no-store"}});}
function fault(id:string|number|null|undefined,code:number,message:string){return Response.json({jsonrpc:"2.0",id:id??null,error:{code,message}},{headers:{"Cache-Control":"no-store"}});}
function limited(input:unknown,max:number){return String(input??"").trim().slice(0,max);}
async function safePublishedCreators(search:string,limit:number){
 const db=admin();
 const {data:kits,error:kitError}=await db.from("collabs_media_kits")
  .select("user_id,slug,tagline,niches,packages").eq("published",true).limit(100);
 if(kitError)throw kitError;
 const ids=(kits||[]).map(x=>x.user_id);
 if(!ids.length)return [];
 const {data:profiles,error:profileError}=await db.from("collabs_profiles")
  .select("user_id,display_name,headline,location,skills,roles,availability,bio")
  .eq("is_public",true).in("user_id",ids).limit(100);
 if(profileError)throw profileError;
 const lookup=new Map((profiles||[]).map(x=>[x.user_id,x]));
 return (kits||[]).map(k=>{
  const p=lookup.get(k.user_id);if(!p)return null;
  return {slug:k.slug,media_kit_url:(process.env.COLLABS_PUBLIC_URL||"").replace(/\/$/,"")+"/kit/"+k.slug,
   display_name:p.display_name,headline:p.headline,location:p.location,
   skills:p.skills,roles:p.roles,availability:p.availability,tagline:k.tagline,
   niches:k.niches,bio:limited(p.bio,300)};
 }).filter((x):x is NonNullable<typeof x>=>Boolean(x)).filter(c=>{
   if(!search)return true;
   const corpus=[c.display_name,c.headline,c.location,c.tagline,c.bio,...(c.skills||[]),...(c.roles||[]),...(c.niches||[])].join(" ").toLocaleLowerCase("nb");
   return corpus.includes(search.toLocaleLowerCase("nb"));
 }).slice(0,limit);
}
async function kitBySlug(slug:string){
 if(!/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug))return null;
 const db=admin();
 const {data:kit,error}=await db.from("collabs_media_kits").select("user_id,slug,tagline,about,niches,platforms,packages,highlights").eq("slug",slug).eq("published",true).maybeSingle();
 if(error)throw error;if(!kit)return null;
 const {data:profile,error:e}=await db.from("collabs_profiles").select("display_name,headline,location,roles,skills,availability,portfolio,social_links,avatar_url").eq("user_id",kit.user_id).eq("is_public",true).maybeSingle();
 if(e)throw e;if(!profile)return null;
 // Public presentation data only, and self-reported metrics stay clearly labeled.
 return {slug,public_url:(process.env.COLLABS_PUBLIC_URL||"").replace(/\/$/,"")+"/kit/"+slug,
  ...profile,tagline:kit.tagline,about:kit.about,niches:kit.niches,packages:kit.packages,
  platforms:kit.platforms,highlights:kit.highlights,follower_numbers_verified:false};
}
export async function GET(){return new Response("This MCP server uses stateless JSON responses over POST.",{status:405,headers:{"Allow":"POST, OPTIONS"}});}
export async function OPTIONS(){return new Response(null,{status:204,headers:{"Allow":"POST, OPTIONS"}});}
export async function POST(req:NextRequest){
 if(process.env.COLLABS_PUBLIC_MCP_ENABLED!=="true")return new Response("MCP is disabled.",{status:503});
 try{
  if(Number(req.headers.get("content-length")||0)>8000)return new Response("Request too large.",{status:413});
  const raw=await req.text();if(raw.length>8000)return new Response("Request too large.",{status:413});
  const input=JSON.parse(raw) as Payload;
  if(input.jsonrpc!=="2.0"||typeof input.method!=="string")return fault(input.id,-32600,"Invalid JSON-RPC request");
  if(input.method==="notifications/initialized")return new Response(null,{status:202});
  if(input.method==="initialize")return answer(input.id,{protocolVersion:protocol,capabilities:{tools:{}},serverInfo:{name:"vedoy-collabs-public",version:"0.1.0"}});
  if(input.method==="ping")return answer(input.id,{});
  if(input.method==="tools/list")return answer(input.id,{tools});
  if(input.method!=="tools/call")return fault(input.id,-32601,"Method not found");
  const name=input.params?.name,args=input.params?.arguments||{};
  if(name==="search_creators"){
   const query=limited(args.query,100);
   const limit=Math.max(1,Math.min(12,Number(args.limit)||8));
   const creators=await safePublishedCreators(query,limit);
   return answer(input.id,{content:[{type:"text",text:JSON.stringify({creators,count:creators.length})}],isError:false});
  }
  if(name==="find_creator_campaigns"){
   const q=limited(args.query,100).toLowerCase();
   const max=Math.max(1,Math.min(12,Number(args.limit)||8));
   const db=admin();
   const {data,error}=await db.from("collabs_product_campaigns").select("id,product_title,brief,deliverables,budget_nok,shop_domain,created_at").eq("status","open").order("created_at",{ascending:false}).limit(100);
   if(error)throw error;
   const campaigns=(data||[]).filter(c=>[c.product_title,c.brief,c.shop_domain].join(" ").toLowerCase().includes(q)).slice(0,max);
   return answer(input.id,{content:[{type:"text",text:JSON.stringify({campaigns,count:campaigns.length})}],isError:false});
  }
  if(name==="get_creator_media_kit"){
   const kit=await kitBySlug(limited(args.slug,50));
   return answer(input.id,{content:[{type:"text",text:JSON.stringify(kit?{media_kit:kit}:{error:"Creator Media Kit was not found or is not published."})}],isError:false});
  }
  return fault(input.id,-32602,"Unknown tool");
 }catch(e){console.error("Collabs MCP request error",e instanceof Error?e.message:"unknown");return fault(null,-32603,"MCP request failed");}
}
