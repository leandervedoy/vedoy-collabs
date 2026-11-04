"use client";
import { useEffect, useMemo, useState } from "react";
import { getDb } from "@/lib/supabase";\nimport "./media.css";
import type { User } from "@supabase/supabase-js";
type Network={name:string;handle:string;followers:string;url:string};
type Package={name:string;price:string;description:string};
type Kit={user_id:string;slug:string;tagline:string;about:string;niches:string[];platforms:Network[];packages:Package[];highlights:string[];published:boolean};
const empty:Kit={user_id:"",slug:"",tagline:"",about:"",niches:[],platforms:[],packages:[],highlights:[],published:false};
function safeNetwork(value:unknown):Network[]{return Array.isArray(value)?value.slice(0,8).filter(x=>x&&typeof x==="object").map(x=>({name:String(x.name||"").slice(0,40),handle:String(x.handle||"").slice(0,70),followers:String(x.followers||"").slice(0,30),url:String(x.url||"").slice(0,200)})):[];}
function safePackages(value:unknown):Package[]{return Array.isArray(value)?value.slice(0,8).filter(x=>x&&typeof x==="object").map(x=>({name:String(x.name||"").slice(0,80),price:String(x.price||"").slice(0,60),description:String(x.description||"").slice(0,500)})):[];}
function slugify(x:string){return x.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,50);}
export default function MediaKitEditor(){
  const db=useMemo(()=>getDb(),[]);
  const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false);
  const [kit,setKit]=useState<Kit>(empty),[displayName,setDisplayName]=useState(""),[avatar,setAvatar]=useState("");
  const [niches,setNiches]=useState(""),[highlights,setHighlights]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  useEffect(()=>{if(!db){setReady(true);return;}db.auth.getUser().then(({data})=>{setUser(data.user);setReady(true);});const {data:{subscription}}=db.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null));return()=>subscription.unsubscribe();},[db]);
  useEffect(()=>{if(!user||!db)return;void Promise.all([
    db.from("collabs_media_kits").select("*").eq("user_id",user.id).maybeSingle(),
    db.from("collabs_profiles").select("display_name,avatar_url").eq("user_id",user.id).maybeSingle()
  ]).then(([a,b])=>{if(a.error)setError(a.error.message);if(a.data){const x=a.data;setKit({...empty,...x,platforms:safeNetwork(x.platforms),packages:safePackages(x.packages),highlights:Array.isArray(x.highlights)?x.highlights:[]});setNiches((x.niches||[]).join(", "));setHighlights((x.highlights||[]).join("\n"))}else setKit(v=>({...v,user_id:user.id}));if(b.data){setDisplayName(b.data.display_name||"");setAvatar(b.data.avatar_url||"");}});},[db,user]);
  async function save(e:React.FormEvent){e.preventDefault();if(!db||!user)return;setBusy(true);setError("");setSuccess("");
    try{
      const slug=slugify(kit.slug);if(slug.length<3)throw new Error("Lenken må ha minst 3 tegn.");
      const platforms=kit.platforms.filter(x=>x.name.trim()).map(x=>({name:x.name.trim().slice(0,40),handle:x.handle.trim().slice(0,70),followers:x.followers.trim().slice(0,30),url:x.url.trim().slice(0,200)}));
      const packages=kit.packages.filter(x=>x.name.trim()).map(x=>({name:x.name.trim().slice(0,80),price:x.price.trim().slice(0,60),description:x.description.trim().slice(0,500)}));
      const next={user_id:user.id,slug,tagline:kit.tagline.slice(0,180),about:kit.about.slice(0,2400),niches:niches.split(",").map(x=>x.trim()).filter(Boolean).slice(0,12),highlights:highlights.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,12),platforms,packages,published:kit.published,updated_at:new Date().toISOString()};
      const {error:err}=await db.from("collabs_media_kits").upsert(next,{onConflict:"user_id"});if(err)throw err;
      setKit({...kit,...next});setSuccess("Mediekitet er lagret.");}
    catch(err){setError(err instanceof Error?err.message:String(err));}finally{setBusy(false);}
  }
  const url=typeof window==="undefined"?"":window.location.origin+"/kit/"+slugify(kit.slug);
  if(!ready)return <main className="content">Laster…</main>;
  if(!db||!user)return <main className="content"><a href="/">← Til Collabs</a><h1>Logg inn først</h1><p>Du må logge inn for å lage ditt Media Kit.</p></main>;
  return <main className="content media-layout">
    <div className="section-head"><div><a href="/">← Vedoy Collabs</a><span className="eyebrow">CREATOR TOOLKIT</span><h1>Creator Media Kit</h1><p className="subtle">Din profesjonelle presentasjon til bedrifter. Du velger hva som publiseres.</p></div><a className="secondary" href="/shopify">Shopify-kampanjer ↗</a></div>
    {error&&<p className="alert error" role="alert">{error}</p>}{success&&<p className="alert success" role="status">{success}</p>}
    <div className="media-grid"><form onSubmit={save} className="profileform media-form">
      <h2>Din presentasjon</h2>
      <label>Delingsadresse <input required pattern="[a-zA-Z0-9-]{3,50}" maxLength={50} value={kit.slug} onChange={e=>setKit(v=>({...v,slug:slugify(e.target.value)}))} placeholder="ditt-navn"/></label>
      <label>Tagline <input maxLength={180} value={kit.tagline} onChange={e=>setKit(v=>({...v,tagline:e.target.value}))} placeholder="UGC-skaper · Foto · Mote"/></label>
      <label>Om deg <textarea rows={5} maxLength={2400} value={kit.about} onChange={e=>setKit(v=>({...v,about:e.target.value}))} placeholder="Hva kan du hjelpe bedrifter med?"/></label>
      <label>Nisjer, kommaseparert <input value={niches} onChange={e=>setNiches(e.target.value)} placeholder="Mote, interiør, livsstil"/></label>
      <label>Prosjekthøydepunkter, én per linje<textarea rows={4} value={highlights} onChange={e=>setHighlights(e.target.value)} placeholder="Produktfoto for lokal butikk"/></label>
      <div className="section-head"><h2>Plattformer</h2><button type="button" className="secondary" onClick={()=>setKit(v=>({...v,platforms:[...v.platforms,{name:"Instagram",handle:"",followers:"",url:""}].slice(0,8)}))}>+ Legg til</button></div>
      <p className="subtle">Tallene er selvrapporterte og ikke bekreftet av Instagram, TikTok eller andre.</p>
      {kit.platforms.map((p,i)=><div className="media-entry" key={i}>
        <label>Plattform<input value={p.name} onChange={e=>setKit(v=>({...v,platforms:v.platforms.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))}/></label>
        <label>Brukernavn<input value={p.handle} onChange={e=>setKit(v=>({...v,platforms:v.platforms.map((x,j)=>j===i?{...x,handle:e.target.value}:x)}))}/></label>
        <label>Følgere (selvrapportert)<input value={p.followers} onChange={e=>setKit(v=>({...v,platforms:v.platforms.map((x,j)=>j===i?{...x,followers:e.target.value}:x)}))}/></label>
        <label>Profiladresse<input type="url" value={p.url} onChange={e=>setKit(v=>({...v,platforms:v.platforms.map((x,j)=>j===i?{...x,url:e.target.value}:x)}))}/></label>
        <button type="button" className="tiny" onClick={()=>setKit(v=>({...v,platforms:v.platforms.filter((_,j)=>j!==i)}))}>Fjern</button>
      </div>)}
      <div className="section-head"><h2>Tjenestepakker</h2><button type="button" className="secondary" onClick={()=>setKit(v=>({...v,packages:[...v.packages,{name:"UGC video",price:"Fra 1 500 kr",description:""}].slice(0,8)}))}>+ Legg til</button></div>
      {kit.packages.map((p,i)=><div className="media-entry" key={i}>
        <label>Tjeneste<input value={p.name} onChange={e=>setKit(v=>({...v,packages:v.packages.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))}/></label>
        <label>Veiledende pris<input value={p.price} onChange={e=>setKit(v=>({...v,packages:v.packages.map((x,j)=>j===i?{...x,price:e.target.value}:x)}))}/></label>
        <label>Inkludert<textarea value={p.description} onChange={e=>setKit(v=>({...v,packages:v.packages.map((x,j)=>j===i?{...x,description:e.target.value}:x)}))}/></label>
        <button type="button" className="tiny" onClick={()=>setKit(v=>({...v,packages:v.packages.filter((_,j)=>j!==i)}))}>Fjern</button>
      </div>)}
      <label className="toggle"><input type="checkbox" checked={kit.published} onChange={e=>setKit(v=>({...v,published:e.target.checked}))}/><span>Publiser mediekitet (krever også offentlig Collabs-profil)</span></label>
      <button className="primary" type="submit" disabled={busy}>{busy?"Lagrer…":"Lagre Media Kit"}</button>
      {kit.published&&kit.slug&&<div className="inline"><a className="secondary" target="_blank" rel="noopener noreferrer" href={url}>Åpne offentlig lenke ↗</a><button className="secondary" type="button" onClick={()=>void navigator.clipboard.writeText(url)}>Kopier lenke</button></div>}
    </form>
    <aside className="profileform media-preview"><span className="eyebrow">FORHÅNDSVISNING</span><div className="media-banner">VEDOY <strong>COLLABS</strong> ✳</div><div className="media-preview-head">{avatar&&<img alt="" src={avatar}/>}<div><h2>{displayName||"Ditt navn"}</h2><p>{kit.tagline||"Kreativ samarbeidspartner"}</p></div></div><p>{kit.about||"Her kan du fortelle bedrifter hvem du er og hva du kan tilby."}</p><h3>Fokusområder</h3><div className="tags">{niches.split(",").filter(Boolean).map(x=><span key={x}>{x.trim()}</span>)}</div><h3>Plattformer</h3>{kit.platforms.map((p,i)=><div className="media-stat" key={i}><b>{p.name||"Plattform"}</b><span>{p.handle}</span><strong>{p.followers||"—"}</strong></div>)}<small>Følgertall er selvrapporterte.</small><h3>Tjenester</h3>{kit.packages.map((p,i)=><div className="media-package" key={i}><b>{p.name}</b><span>{p.price}</span><p>{p.description}</p></div>)}<h3>Høydepunkter</h3>{highlights.split("\n").filter(Boolean).map((x,i)=><p key={i}>✦ {x}</p>)}<p className="subtle">Dette er en lokal forhåndsvisning. Offentlig visning bruker lagrede data.</p></aside>
    </div>
  </main>;
}
