"use client";
import { useEffect,useMemo,useState } from "react";
import {getDb} from "@/lib/supabase";
import type {User} from "@supabase/supabase-js";
import "../media-kit/media.css";
type Campaign={id:string;owner_id:string;shop_domain:string;product_title:string;product_image_url:string|null;brief:string;budget_nok:number;deliverables:string[];created_at:string;status:string};
type Application={campaign_id:string;status:string};
export default function Opportunities(){
 const db=useMemo(()=>getDb(),[]),[user,setUser]=useState<User|null>(null);
 const [ready,setReady]=useState(false),[campaigns,setCampaigns]=useState<Campaign[]>([]),[applications,setApplications]=useState<Application[]>([]);
 const [search,setSearch]=useState(""),[onlyPaid,setOnlyPaid]=useState(false),[selected,setSelected]=useState<Campaign|null>(null),[pitch,setPitch]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{if(!db){setReady(true);return;}db.auth.getUser().then(({data})=>{setUser(data.user);setReady(true);}).catch(()=>setReady(true));const {data:{subscription}}=db.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null));return()=>subscription.unsubscribe();},[db]);
 async function load(){if(!db||!user)return;
  const [a,b]=await Promise.all([
   db.from("collabs_product_campaigns").select("id,owner_id,shop_domain,product_title,product_image_url,brief,budget_nok,deliverables,created_at,status").eq("status","open").order("created_at",{ascending:false}).limit(80),
   db.from("collabs_campaign_applications").select("campaign_id,status").eq("creator_id",user.id).limit(100)
  ]);
  if(a.error)setError(a.error.message);else setCampaigns(a.data as Campaign[]);
  if(b.error)setError(b.error.message);else setApplications(b.data as Application[]);
 }
 useEffect(()=>{if(user)void load();},[user]);
 async function apply(e:React.FormEvent){e.preventDefault();if(!db||!user||!selected)return;
  setBusy(true);setError("");setNotice("");
  const {error:err}=await db.from("collabs_campaign_applications").insert({campaign_id:selected.id,creator_id:user.id,pitch:pitch.trim()});
  if(err)setError(err.message);else{setNotice("Søknaden er sendt til bedriften.");setSelected(null);setPitch("");await load();}
  setBusy(false);
 }
 const shown=campaigns.filter(c=>(!search||[c.product_title,c.brief,c.shop_domain].join(" ").toLowerCase().includes(search.toLowerCase()))&&(!onlyPaid||c.budget_nok>0));
 return <main className="content shop-layout"><div className="section-head"><div><a href="/">← Vedoy Collabs</a><span className="eyebrow">NYE SAMARBEID</span><h1>Creator-oppdrag</h1><p className="subtle">Finn samarbeid med nettbutikker og send en søknad på prosjekter som passer deg.</p></div><a className="secondary" href="/media-kit">Lag ditt Media Kit ↗</a></div>
  {!ready&&<p>Laster…</p>}{ready&&!user&&<div className="shop-empty"><h2>Logg inn for å søke oppdrag</h2><a className="primary" href="/">Gå til Collabs</a></div>}
  {error&&<div className="shop-error" role="alert">{error}</div>}{notice&&<div className="shop-notice" role="status">{notice}</div>}
  {user&&<><div className="toolbar"><div className="filters"><input aria-label="Søk oppdrag" value={search} onChange={e=>setSearch(e.target.value)} placeholder="⌕  Søk butikker, produkter, oppdrag"/><label className="toggle"><input type="checkbox" checked={onlyPaid} onChange={e=>setOnlyPaid(e.target.checked)}/>Med budsjett</label></div></div>
  {shown.length===0?<div className="shop-empty">Ingen åpne Shopify-kampanjer passer dette søket akkurat nå.</div>:
  <div className="projectgrid">{shown.map(c=><article className="project" key={c.id}>{c.product_image_url?.startsWith("https://")&&<img src={c.product_image_url} alt="" style={{width:"100%",height:145,objectFit:"cover",borderRadius:12,marginBottom:12}}/>}<span className="eyebrow">SHOPIFY · {c.shop_domain}</span><h3>{c.product_title}</h3><p>{c.brief}</p><div className="tags">{(c.deliverables||[]).slice(0,5).map((x,i)=><span key={i}>{x}</span>)}</div><p><strong>{c.budget_nok>0?c.budget_nok.toLocaleString("nb-NO")+" kr":"Budsjett etter avtale"}</strong></p>{c.owner_id===user.id?<span className="label">Din kampanje</span>:applications.some(a=>a.campaign_id===c.id)?<span className="label">Søknad sendt</span>:<button className="primary" onClick={()=>{setSelected(c);setPitch("");}}>Søk samarbeid ↗</button>}</article>)}</div>}
  {selected&&<div className="overlay" onClick={()=>setSelected(null)}><section className="modal" role="dialog" aria-modal="true" aria-label="Søk kampanje" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)} aria-label="Lukk">×</button><div className="modalbody"><span className="eyebrow">CREATOR APPLICATION</span><h2>{selected.product_title}</h2><p>{selected.brief}</p><form onSubmit={apply} className="campaign-brief"><label>Hva kan du tilby?<textarea minLength={10} maxLength={1500} rows={7} required value={pitch} onChange={e=>setPitch(e.target.value)} placeholder="Fortell om erfaring, idéer og passende innhold"/></label><button className="primary" disabled={busy||pitch.trim().length<10}>{busy?"Sender…":"Send søknad"}</button></form></div></section></div>}
  </>}
 </main>;
}
