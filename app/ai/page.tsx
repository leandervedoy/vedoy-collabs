"use client";
import { useEffect,useMemo,useState } from "react";
import { getDb } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import "../media-kit/media.css";

type Task="media_kit"|"creator_match"|"shopify_campaign"|"outreach";
type Suggestion={tagline?:string;about?:string;niches?:string[];highlights?:string[];matches?:Array<{creator_id:string;reason:string;fit_score:number}>;brief?:string;deliverables?:string[];outreach_message?:string;subject?:string;message?:string};
const actions:[Task,string,string][]=[
 ["media_kit","Lag mediekit","Formuler presentasjon av dine faktiske ferdigheter og erfaringer"],
 ["creator_match","Finn passende skapere","Sammenlign offentlige profiler mot et konkret oppdrag"],
 ["shopify_campaign","Shopify-kampanje","Lag forslag til brief fra ett produkt i din tilkoblede butikk"],
 ["outreach","Kontaktutkast","Skriv et personlig forslag til samarbeid uten automatisk sending"]
];
function outputText(s:Suggestion,mode:Task){if(mode==="creator_match")return (s.matches||[]).map(c=>c.creator_id+" – "+c.reason+" ("+c.fit_score+"/100)").join("\n\n");
if(mode==="media_kit")return [s.tagline,s.about,(s.niches||[]).join(", "),(s.highlights||[]).join("\n")].filter(Boolean).join("\n\n");
if(mode==="shopify_campaign")return [s.brief,(s.deliverables||[]).join("\n"),s.outreach_message].filter(Boolean).join("\n\n");
return [s.subject,s.message].filter(Boolean).join("\n\n");}
export default function CollabsAi(){
 const db=useMemo(()=>getDb(),[]),[session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false);
 const [task,setTask]=useState<Task>("creator_match"),[prompt,setPrompt]=useState(""),[shop,setShop]=useState(""),[productId,setProductId]=useState(""),[creatorId,setCreatorId]=useState("");
 const [result,setResult]=useState<Suggestion|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{if(!db){setReady(true);return;}db.auth.getSession().then(({data})=>{setSession(data.session);setReady(true);});const {data:{subscription}}=db.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe();},[db]);
 async function submit(e:React.FormEvent){e.preventDefault();if(!db)return;setBusy(true);setError("");setResult(null);
  try{
   const {data:{session:latest}}=await db.auth.getSession();if(!latest)throw Error("Logg inn igjen.");
   const res=await fetch("/api/ai",{method:"POST",headers:{"Authorization":"Bearer "+latest.access_token,"Content-Type":"application/json"},body:JSON.stringify({task,prompt,shop,product_id:productId,creator_id:creatorId}),cache:"no-store"});
   const body=await res.json();if(!res.ok)throw Error(body.error||"KI-forespørselen feilet.");
   setResult(body.suggestion as Suggestion);
  }catch(err){setError(err instanceof Error?err.message:String(err));}finally{setBusy(false);}
 }
 return <main className="content" style={{maxWidth:1060}}>
  <div className="section-head"><div><a href="/">← Til Collabs</a><span className="eyebrow">VEDOY COLLABS · AI STUDIO</span><h1>KI-assistent for creators</h1><p className="subtle">Få smartere forslag til samarbeid. Du bestemmer alltid hva du bruker.</p></div><a className="secondary" href="/media-kit">Media Kit ↗</a></div>
  {!ready&&<p>Laster…</p>}
  {ready&&!session&&<div className="shop-empty"><h2>Logg inn for å bruke KI</h2><a href="/" className="primary">Gå til innlogging</a></div>}
  {ready&&session&&<div className="shop-grid"><section className="shop-panel">
   <h2>Hva trenger du hjelp til?</h2>
   <div className="shop-list">{actions.map(([name,label,desc])=><button type="button" key={name} onClick={()=>{setTask(name);setResult(null);}} className={task===name?"shop-store active":"shop-store"}><strong>{label}</strong><br/><small>{desc}</small></button>)}</div>
   <form onSubmit={submit}><label>Beskriv oppgaven<textarea required minLength={10} maxLength={900} rows={5} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="F.eks. finn norske UGC-skapere innen mote for en produktkampanje på 2000 kr"/></label>
   {task==="shopify_campaign"&&<><label>Shopify-butikk<input required placeholder="butikk.myshopify.com" value={shop} onChange={e=>setShop(e.target.value)}/></label><label>Shopify produkt-GID<input required placeholder="gid://shopify/Product/123456" value={productId} onChange={e=>setProductId(e.target.value)}/></label><p className="shop-help">Produktet må tilhøre din autoriserte Shopify-butikk.</p></>}
   {task==="outreach"&&<label>Creator-ID<input required value={creatorId} onChange={e=>setCreatorId(e.target.value)} placeholder="ID for offentlig creator-profil"/></label>}
   <button className="primary" disabled={busy}>{busy?"Lager forslag…":"Generer forslag ✦"}</button></form>
   <p className="shop-help">KI-en bruker bare profilopplysninger du har gitt tilgang til eller offentlig delte creator-profiler. Ingen meldinger sendes automatisk.</p>
  </section><section className="shop-panel">
   <span className="eyebrow">FORHÅNDSVISNING</span><h2>Forslag du kan redigere</h2>
   {error&&<p className="shop-error" role="alert">{error}</p>}
   {!result?<div className="shop-empty">Velg en oppgave og beskriv hva du trenger. Resultatet vises her før du gjør noe med det.</div>:
    <><textarea rows={16} readOnly aria-label="KI-forslag" value={outputText(result,task)} style={{width:"100%",whiteSpace:"pre-wrap"}}/><div className="inline" style={{marginTop:16}}><button type="button" className="secondary" onClick={()=>void navigator.clipboard.writeText(outputText(result,task))}>Kopier forslag</button>{task==="media_kit"&&<a className="primary" href="/media-kit">Rediger mediekit ↗</a>}{task==="shopify_campaign"&&<a className="primary" href="/shopify">Rediger kampanje ↗</a>}{task==="creator_match"&&<a className="primary" href="/">Se creator-profiler ↗</a>}</div><p className="shop-help">Dette er forslag, ikke bekreftede resultater. Gå gjennom fakta og priser selv.</p></>}
  </section></div>}
 </main>;
}
