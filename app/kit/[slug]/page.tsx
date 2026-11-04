import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import "../../media-kit/media.css";
type Network={name?:string;handle?:string;followers?:string;url?:string};
type Service={name?:string;price?:string;description?:string};
type Kit={slug:string;display_name:string;headline:string;location:string;avatar_url?:string;banner_url?:string;tagline:string;about:string;niches:string[];platforms:Network[];packages:Service[];highlights:string[];roles:string[];skills:string[];portfolio:Array<{title?:string;url?:string}>;social_links:Record<string,string>;verified_identity:boolean};
function validUrl(raw:string|undefined){if(!raw)return null;try{const u=new URL(raw);return ["https:","http:"].includes(u.protocol)?u.toString():null;}catch{return null;}}
async function findKit(slug:string):Promise<Kit|null>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key||!/^[a-z0-9-]{3,50}$/.test(slug))return null;
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("collabs_public_media_kit",{p_slug:slug});
  if(error||!data)return null;
  return data as Kit;
}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;const kit=await findKit(slug);
 return {title:kit?kit.display_name+" | Creator Media Kit | Vedoy Collabs":"Media Kit | Vedoy Collabs",description:kit?.tagline||"Creator Media Kit"};
}
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const kit=await findKit(slug);
 if(!kit)notFound();
 return <main className="public-kit"><nav className="public-nav"><Link href="/">V<span>✦</span> COLLABS</Link></nav>
  <article className="kit-document"><div className="media-banner">CREATOR <strong>MEDIA KIT</strong> ✳</div><div className="kit-identity">{validUrl(kit.avatar_url)&&<img src={validUrl(kit.avatar_url)||""} alt="Profilbilde"/>}<div><span className="eyebrow">CREATOR · VEDOY COLLABS</span><h1>{kit.display_name} {kit.verified_identity&&<span aria-label="Identitet verifisert">✓</span>}</h1><p>{kit.tagline||kit.headline}</p><small>{kit.location}</small></div></div><div className="kit-columns"><section><h2>Om meg</h2><p>{kit.about||kit.headline}</p><div className="tags">{(kit.niches||[]).map(x=><span key={x}>{x}</span>)}</div><h2>Arbeid og høydepunkter</h2>{(kit.highlights||[]).map((x,i)=><p key={i}>✦ {x}</p>)}{Array.isArray(kit.portfolio)&&kit.portfolio.length>0&&<><h2>Portefølje</h2>{kit.portfolio.map((x,i)=>validUrl(x.url)&&<p key={i}><a href={validUrl(x.url)||"#"} rel="noopener noreferrer" target="_blank">{x.title||new URL(x.url!).hostname} ↗</a></p>)}</>}</section><section><h2>Kanaler og publikum</h2>{(kit.platforms||[]).map((x,i)=><div className="media-stat" key={i}><b>{x.name}</b><span>{x.handle}</span><strong>{x.followers||"—"}</strong>{validUrl(x.url)&&<a href={validUrl(x.url)||"#"} target="_blank" rel="noopener noreferrer">Besøk profil ↗</a>}</div>)}<small>Oppgitte plattform- og følgertall er selvrapporterte, ikke verifisert av plattformene.</small><h2>Tilgjengelige tjenester</h2>{(kit.packages||[]).map((x,i)=><div className="media-package" key={i}><div className="inline"><b>{x.name}</b><strong>{x.price}</strong></div><p>{x.description}</p></div>)}</section></div><footer><div>Åpen for samarbeid? <strong>Ta kontakt gjennom Vedoy Collabs.</strong></div><Link className="primary" href="/">Utforsk Collabs ↗</Link></footer></article>
  <p className="public-footer">Laget med Vedoy Collabs · <a href="https://vedoy.com">Vedøy</a></p>
 </main>;
}
