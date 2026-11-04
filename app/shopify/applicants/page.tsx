"use client";
import { useEffect,useMemo,useState } from "react";
import { useSearchParams } from "next/navigation";
import {getDb} from "@/lib/supabase";
import type {Session} from "@supabase/supabase-js";
import "../../media-kit/media.css";
type Application={id:string;creator_id:string;pitch:string;status:string;created_at:string};
export default function Applicants(){
 const db=useMemo(()=>getDb(),[]),params=useSearchParams(),campaign=params.get("campaign")||"";
 const [session,setSession]=useState<Session|null>(null),[items,setItems]=useState<Application[]>([]);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{if(!db){setReady(true);return;}db.auth.getSession().then(({data})=>{setSession(data.session);setReady(true);});const {data:{subscription}}=db.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe();},[db]);
 async function request(method:"GET"|"PATCH",payload?:Record<string,string>){
  if(!db)throw new Error("Supabase mangler.");
  const {data:{session:s}}=await db.auth.getSession();
  if(!s)throw new Error("Logg inn først.");
  const r=await fetch("/api/shopify/campaigns/"+encodeURIComponent(campaign)+"/applications",{
   method,headers:{"Authorization":"Bearer "+s.access_token,"Content-Type":"application/json"},
   body:payload?JSON.stringify(payload):undefined,cache:"no-store"
  });const data=await r.json();if(!r.ok)throw new Error(data.error||"Kunne ikke behandle forespørselen.");
  return data;
 }
 async function load(){try{setBusy(true);const d=await request("GET");setItems(d.applications);setError("");}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 useEffect(()=>{if(session&&campaign)void load();},[session,campaign]);
 async function status(id:string,s:string){try{setBusy(true);await request("PATCH",{application_id:id,status:s});await load();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 return <main className="content shop-layout"><div className="section-head"><div><a href="/shopify">← Shopify-kampanjer</a><span className="eyebrow">VEDOY COLLABS FOR BRANDS</span><h1>Kampanjesøknader</h1><p className="subtle">Gjennomgå innsendte forslag og lag en kortliste.</p></div></div>
 {!ready&&<p>Laster…</p>}{ready&&!session&&<div className="shop-empty">Logg inn for å se søknader.</div>}{error&&<p className="shop-error" role="alert">{error}</p>}
 {items.length===0&&session&&!busy&&<div className="shop-empty">Ingen søknader på denne kampanjen ennå.</div>}
 <div className="campaign-items">{items.map(a=><article key={a.id} className="campaign-card"><span className="eyebrow">{a.status.toUpperCase()}</span><h3>Skaper {a.creator_id.slice(0,8)}…</h3><p style={{whiteSpace:"pre-wrap"}}>{a.pitch}</p><small>{new Date(a.created_at).toLocaleString("nb-NO")}</small><div className="inline" style={{marginTop:15}}><button className="primary" disabled={busy||a.status==="shortlisted"} onClick={()=>void status(a.id,"shortlisted")}>Legg på kortliste</button><button className="secondary" disabled={busy||a.status==="declined"} onClick={()=>void status(a.id,"declined")}>Avslå</button></div></article>)}</div>
 </main>;
}
