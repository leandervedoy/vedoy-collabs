"use client";
import { useEffect, useMemo, useState } from "react";
import { getDb } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import "../media-kit/media.css";
type Store={id:string;shop_domain:string;status:string;scopes:string;connected_at:string};
type Product={id:string;title:string;handle:string;image?:string|null};
type Campaign={id:string;shop_domain:string;product_title:string;brief:string;budget_nok:number;status:string;created_at:string};
function queryParam(key:string){return typeof window==="undefined"?"":new URLSearchParams(window.location.search).get(key)||"";}
export default function ShopifyCampaigns(){
 const db=useMemo(()=>getDb(),[]);
 const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false);
 const [stores,setStores]=useState<Store[]>([]),[shop,setShop]=useState(""),[newShop,setNewShop]=useState("");
 const [products,setProducts]=useState<Product[]>([]),[q,setQ]=useState(""),[selected,setSelected]=useState<Product|null>(null);
 const [brief,setBrief]=useState(""),[deliverables,setDeliverables]=useState("1 produktvideo, 3 produktbilder"),[budget,setBudget]=useState("1500"),[publish,setPublish]=useState(false);
 const [campaigns,setCampaigns]=useState<Campaign[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{if(!db){setReady(true);return;}db.auth.getSession().then(({data})=>{setSession(data.session);setReady(true);});const {data:{subscription}}=db.auth.onAuthStateChange((_ev,s)=>setSession(s));return()=>subscription.unsubscribe();},[db]);
 async function api(path:string,init?:RequestInit){
  if(!db)throw new Error("Supabase mangler.");
  const {data:{session:s}}=await db.auth.getSession();
  if(!s?.access_token)throw new Error("Logg inn på nytt.");
  const response=await fetch(path,{...init,headers:{"Authorization":"Bearer "+s.access_token,...init?.headers},cache:"no-store"});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||"Tilkobling feilet.");
  return result;
 }
 async function loadStores(){try{const result=await api("/api/shopify/stores");setStores(result.stores);setShop(x=>x||result.stores[0]?.shop_domain||"");}catch(e){setError(e instanceof Error?e.message:String(e));}}
 async function loadCampaigns(){try{const data=await api("/api/shopify/campaigns");setCampaigns(data.campaigns);}catch(e){setError(e instanceof Error?e.message:String(e));}}
 useEffect(()=>{if(session){void loadStores();void loadCampaigns();const connected=queryParam("connected");const reason=queryParam("error");if(connected)setNotice("Butikken "+connected+" er koblet til.");if(reason)setError(reason);}},[session]);
 async function connect(e:React.FormEvent){e.preventDefault();setError("");setLoading(true);try{
  const data=await api("/api/shopify/connect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shop:newShop})});
  window.location.assign(data.url);
 }catch(e){setError(e instanceof Error?e.message:String(e));setLoading(false);}}
 async function search(e?:React.FormEvent){e?.preventDefault();if(!shop)return;setError("");setLoading(true);try{
  const data=await api("/api/shopify/products?shop="+encodeURIComponent(shop)+"&q="+encodeURIComponent(q));
  setProducts(data.products);setSelected(null);
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}}
 async function createCampaign(e:React.FormEvent){e.preventDefault();if(!shop||!selected)return;setError("");setNotice("");setLoading(true);try{
  const data=await api("/api/shopify/campaigns",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   shop_domain:shop,product_gid:selected.id,product_title:selected.title,product_handle:selected.handle,product_image_url:selected.image,
   brief,deliverables:deliverables.split(",").map(x=>x.trim()).filter(Boolean),budget_nok:Number(budget),publish
  })});
  setNotice("Kampanjen er lagret som "+(data.campaign.status==="open"?"åpen":"utkast")+".");setBrief("");setSelected(null);await loadCampaigns();
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}}
 if(!ready)return <main className="content">Laster Shopify…</main>;
 if(!db||!session)return <main className="content"><a href="/">← Til Collabs</a><h1>Logg inn for å bruke Shopify</h1><p>Butikker er knyttet til en identifisert Collabs-konto.</p></main>;
 return <main className="content shop-layout">
  <div className="section-head"><div><a href="/">← Vedoy Collabs</a><span className="eyebrow">VEDOY COLLABS FOR BRANDS</span><h1>Shopify × Creators</h1><p className="subtle">Finn skapere som kan presentere produktene dine, og lag kampanjer fra produktkatalogen.</p></div><a className="secondary" href="/media-kit">Creator Media Kit ↗</a></div>
  {error&&<div className="shop-error" role="alert">{error}</div>}{notice&&<div className="shop-notice" role="status">{notice}</div>}
  <div className="shop-grid"><aside className="shop-panel"><h2>1. Koble til nettbutikk</h2><p className="shop-help">Shopify gir tilgang kun til produktkatalogen. Collabs får ikke tillatelse til å endre produkter, ordre eller priser.</p>
    {stores.length>0&&<><h3>Dine butikker</h3><div className="shop-list">{stores.map(s=><button type="button" key={s.id} className={shop===s.shop_domain?"shop-store active":"shop-store"} onClick={()=>{setShop(s.shop_domain);setProducts([]);setSelected(null);}}>🛍 {s.shop_domain}<br/><small>{s.status==="connected"?"Tilkoblet":"Frakoblet"}</small></button>)}</div></>}
    <form onSubmit={connect}><label>Butikkadresse<input type="text" required value={newShop} onChange={e=>setNewShop(e.target.value)} placeholder="butikk.myshopify.com"/></label><button className="primary" disabled={loading}>{loading?"Sender videre…":"Koble til Shopify ↗"}</button></form>
    <p className="shop-help">Du må godkjenne tilgangen i Shopify. Tilkoblingen må settes opp med Shopifys appnøkler og en godkjent callback-adresse på serveren.</p>
    <div className="shop-help">Når kampanjen er opprettet, kan skapere finne den i Collabs og sende søknad.</div>
  </aside>
  <section className="shop-panel"><h2>2. Velg et produkt</h2>
   {!shop?<div className="shop-empty">Koble til en butikk for å hente produkter.</div>:<>
    <form onSubmit={search}><label>Produktsøk<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Søk produkter i din Shopify-butikk"/></label><button type="submit" className="secondary" disabled={loading}>{loading?"Henter…":"Hent produkter"}</button></form>
    <div className="product-results">{products.map(p=><button className={selected?.id===p.id?"product-option active":"product-option"} type="button" key={p.id} onClick={()=>setSelected(p)}>{p.image&&<img src={p.image} alt=""/>}<div><strong>{p.title}</strong><p className="subtle">{p.handle}</p></div></button>)}</div>
    {products.length===0&&<div className="shop-empty">Trykk «Hent produkter» for å se produktkatalogen din.</div>}
    {selected&&<form className="campaign-brief" onSubmit={createCampaign}><h2>3. Opprett creator-kampanje</h2><p>Produkt: <strong>{selected.title}</strong></p><label>Beskriv oppdraget<textarea required minLength={20} maxLength={4000} rows={5} value={brief} onChange={e=>setBrief(e.target.value)} placeholder="Hva trenger du? Hvilken målgruppe og stil ønsker du?"/></label>
      <label>Leveranser, kommaseparert<input value={deliverables} onChange={e=>setDeliverables(e.target.value)} placeholder="1 video, 3 bilder"/></label>
      <label>Budsjett (NOK)<input required type="number" min="0" max="10000000" step="1" value={budget} onChange={e=>setBudget(e.target.value)}/></label>
      <label className="toggle"><input type="checkbox" checked={publish} onChange={e=>setPublish(e.target.checked)}/>Vis kampanjen for skapere nå</label><button className="primary" disabled={loading}>Opprett kampanje</button></form>}
   </>}
   <div className="campaign-items"><h2>Mine kampanjer</h2>{campaigns.length===0&&<p className="subtle">Ingen kampanjer er opprettet.</p>}{campaigns.map(c=><article className="campaign-card" key={c.id}><small>{c.status==="open"?"Publisert":c.status==="draft"?"Utkast":"Avsluttet"} · {c.shop_domain}</small><strong>{c.product_title}</strong><p>{c.brief.slice(0,180)}</p><small>Budsjett: {c.budget_nok.toLocaleString("nb-NO")} kr</small></article>)}</div>
  </section></div>
 </main>;
}
