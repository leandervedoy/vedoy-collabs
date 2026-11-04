"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Creator = {
  user_id:string;display_name:string;headline:string;bio:string;location:string;
  roles:string[];skills:string[];interests:string[];availability:string;
  experience_level:string|null;avatar_url:string|null;banner_url:string|null;
  portfolio:unknown;social_links:unknown;verified:boolean;
};
type Profile = Creator & {is_public?:boolean;show_experience_level?:boolean};
type Request = {id:string;requester_id:string;target_id:string;note:string;status:string;created_at:string};
type Project = {id:string;owner_id:string;title:string;description:string;category:string;budget:string;deadline:string|null;status:string;created_at:string;requirements?:string};
type Match = {id:string;user_a:string;user_b:string;created_at:string};
type Message = {id:string;match_id:string;sender_id:string;body:string;created_at:string};
type Page = "discover"|"saved"|"projects"|"requests"|"messages"|"profile";
type FormKey = "display_name"|"headline"|"bio"|"location"|"roles"|"skills"|"interests"|"availability"|"avatar_url"|"banner_url"|"portfolio"|"social_links";
type ProfileForm = Record<FormKey,string> & {is_public:boolean};
const empty:ProfileForm={display_name:"",headline:"",bio:"",location:"",roles:"",skills:"",interests:"",availability:"Åpen for samarbeid",avatar_url:"",banner_url:"",portfolio:"",social_links:"",is_public:true};
function array(value:string){return value.split(",").map(s=>s.trim()).filter(Boolean).slice(0,25);}
function safeUrl(value:string|undefined|null){if(!value)return "";try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)?u.href:"";}catch{return "";}}
function obj(value:unknown):Record<string,unknown>{return typeof value==="object"&&value!==null&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function toForm(p:Profile|null):ProfileForm {return p?{display_name:p.display_name,headline:p.headline,bio:p.bio,location:p.location,roles:(p.roles||[]).join(", "),skills:(p.skills||[]).join(", "),interests:(p.interests||[]).join(", "),availability:p.availability||"Åpen for samarbeid",avatar_url:p.avatar_url||"",banner_url:p.banner_url||"",portfolio:Array.isArray(p.portfolio)?p.portfolio.map(x=>String(obj(x).url||"")).filter(Boolean).join("\n"):"",social_links:Object.entries(obj(p.social_links)).map(([k,v])=>k+": "+v).join("\n"),is_public:p.is_public!==false}:empty;}
function parseLinks(value:string){return Object.fromEntries(value.split("\n").map(s=>s.trim()).filter(Boolean).map(line=>{const n=line.indexOf(": ");return [line.slice(0,n),line.slice(n+2)];}).filter(x=>x[0]&&safeUrl(x[1])));}
function humanError(e:unknown){const msg=e instanceof Error?e.message:String(e);if(/duplicate key|already exists|unique constraint/i.test(msg))return "Denne forespørselen finnes allerede.";return msg;}
function Avatar({creator,large=false}:{creator:Pick<Creator,"avatar_url"|"display_name">,large?:boolean}){
  const src=safeUrl(creator.avatar_url);
  return src?<img className={"avatar"+(large?" large":"")} src={src} alt={"Profilbilde for "+creator.display_name} />:
  <div aria-hidden className={"avatar"+(large?" large":"")}>{(creator.display_name||"?").slice(0,2).toUpperCase()}</div>;
}
export default function Home(){
 const [user,setUser]=useState<string|null>(null);
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [authMode,setAuthMode]=useState<"login"|"register">("login");
 const [authReady,setAuthReady]=useState(false);const [page,setPage]=useState<Page>("discover");
 const [error,setError]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(false);
 const [creators,setCreators]=useState<Creator[]>([]);const [selected,setSelected]=useState<Creator|null>(null);
 const [profile,setProfile]=useState<Profile|null>(null);const [form,setForm]=useState<ProfileForm>(empty);
 const [query,setQuery]=useState("");const [role,setRole]=useState("");const [skill,setSkill]=useState("");const [location,setLocation]=useState("");
 const [saved,setSaved]=useState<string[]>([]);const [requests,setRequests]=useState<Request[]>([]);
 const [projects,setProjects]=useState<Project[]>([]);const [matches,setMatches]=useState<Match[]>([]);
 const [activeMatch,setActiveMatch]=useState<string|null>(null);const [messages,setMessages]=useState<Message[]>([]);
 const [newMessage,setNewMessage]=useState("");const [contactNote,setContactNote]=useState("");
 const [projectForm,setProjectForm]=useState({title:"",description:"",category:"Kreativt",budget:"",requirements:"",deadline:""});
 const [projectFilter,setProjectFilter]=useState("");
 const [more,setMore]=useState(false);const [offset,setOffset]=useState(0);

 const fail=(e:unknown)=>{setError(humanError(e));setNotice("");};
 const success=(text:string)=>{setNotice(text);setError("");};
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError("");try{await fn();}catch(e){fail(e);}finally{setBusy(false);}};
 const reloadCreators=useCallback(async(nextOffset=0,append=false)=>{
  setLoading(true);
  try{
   const {data,error}=await supabase().rpc("collabs_find_creators",{p_query:query.trim(),p_role:role.trim(),p_skill:skill.trim(),p_location:location.trim(),p_limit:24,p_offset:nextOffset});
   if(error)throw error;
   setCreators(prev=>append?[...prev,...(data||[])]:data||[]);
   setMore((data||[]).length===24);setOffset(nextOffset);
  }catch(e){fail(e);}finally{setLoading(false);}
 },[query,role,skill,location]);
 const loadSaved=useCallback(async(id:string)=>{
  const {data,error}=await supabase().from("collabs_saved_creators").select("creator_id").eq("user_id",id);
  if(error)throw error;setSaved((data||[]).map(x=>x.creator_id));
 },[]);
 const loadRequests=useCallback(async(id:string)=>{
  const {data,error}=await supabase().from("collabs_contact_requests").select("*").or("requester_id.eq."+id+",target_id.eq."+id).order("created_at",{ascending:false}).limit(120);
  if(error)throw error;setRequests(data||[]);
 },[]);
 const loadProjects=useCallback(async()=>{
  const {data,error}=await supabase().from("collabs_projects").select("id,owner_id,title,description,category,budget,deadline,status,created_at,requirements").order("created_at",{ascending:false}).limit(100);
  if(error)throw error;setProjects(data||[]);
 },[]);
 const loadMatches=useCallback(async(id:string)=>{
  const {data,error}=await supabase().from("collabs_matches").select("*").or("user_a.eq."+id+",user_b.eq."+id).order("created_at",{ascending:false}).limit(100);
  if(error)throw error;setMatches(data||[]);
 },[]);
 const loadProfile=useCallback(async(id:string)=>{
  const {data,error}=await supabase().from("collabs_profiles").select("*").eq("user_id",id).maybeSingle();
  if(error)throw error;setProfile(data);setForm(toForm(data));
 },[]);
 const refresh=useCallback(async(id:string)=>{
  try{await Promise.all([loadProfile(id),loadSaved(id),loadRequests(id),loadProjects(),loadMatches(id)]);}
  catch(e){fail(e);}
 },[loadProfile,loadSaved,loadRequests,loadProjects,loadMatches]);
 useEffect(()=>{
  try{
   const s=supabase();
   s.auth.getUser().then(({data,error})=>{if(error)fail(error);const id=data.user?.id||null;setUser(id);if(id)void refresh(id);}).catch(fail).finally(()=>setAuthReady(true));
   const {data:{subscription}}=s.auth.onAuthStateChange((_event,session)=>{const id=session?.user?.id||null;setUser(id);if(id)void refresh(id);else{setProfile(null);setSaved([]);setMatches([]);setRequests([]);}});
   return ()=>subscription.unsubscribe();
  }catch(e){fail(e);setAuthReady(true);}
 },[refresh]);
 useEffect(()=>{if(user)void reloadCreators();},[user,reloadCreators]);
 useEffect(()=>{
  if(!activeMatch)return;
  let alive=true;
  const read=async()=>{
    const {data,error}=await supabase().from("collabs_messages").select("*").eq("match_id",activeMatch).order("created_at",{ascending:true}).limit(200);
    if(alive){if(error)fail(error);else setMessages(data||[]);}
  };
  void read();
  const channel=supabase().channel("collabs-messages-"+activeMatch)
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"collabs_messages",filter:"match_id=eq."+activeMatch},()=>{void read();})
   .subscribe();
  return ()=>{alive=false;void supabase().removeChannel(channel);};
 },[activeMatch]);

 const names=useMemo(()=>Object.fromEntries(creators.map(c=>[c.user_id,c.display_name])),[creators]);
 const filtered=useMemo(()=>creators.filter(c=>!user||c.user_id!==user),[creators,user]);
 const visible=page==="saved"?filtered.filter(c=>saved.includes(c.user_id)):filtered;
 const filteredProjects=projects.filter(p=>!projectFilter||[p.category,p.title,p.description].join(" ").toLowerCase().includes(projectFilter.toLowerCase()));
 const ownRequests=requests.filter(r=>r.requester_id===user);
 const inbox=requests.filter(r=>r.target_id===user&&r.status==="pending");

 async function authenticate(e:React.FormEvent){e.preventDefault();await run(async()=>{
  if(password.length<8)throw new Error("Passordet må være minst 8 tegn.");
  const a=supabase().auth;
  const {data,error}=authMode==="login"?await a.signInWithPassword({email,password}):await a.signUp({email,password});
  if(error)throw error;setPassword("");
  success(authMode==="register"&&!data.session?"Sjekk e-posten din for bekreftelse.":"Du er logget inn.");
 });}
 async function saveProfile(e:React.FormEvent){e.preventDefault();if(!user)return;await run(async()=>{
  if(form.display_name.trim().length<2)throw new Error("Navn må ha minst to tegn.");
  for(const url of [form.avatar_url,form.banner_url,...form.portfolio.split("\n").filter(Boolean)]){
   if(url&&!safeUrl(url))throw new Error("Bruk gyldige https-lenker for bilder og portefølje.");
  }
  const payload={user_id:user,display_name:form.display_name.trim().slice(0,90),headline:form.headline.trim().slice(0,140),
   bio:form.bio.trim().slice(0,1800),location:form.location.trim().slice(0,120),roles:array(form.roles),
   skills:array(form.skills),interests:array(form.interests),availability:form.availability,is_public:form.is_public,
   avatar_url:form.avatar_url||null,banner_url:form.banner_url||null,
   portfolio:form.portfolio.split("\n").map(x=>safeUrl(x.trim())).filter(Boolean).map(url=>({url})),
   social_links:parseLinks(form.social_links)};
  const {error}=await supabase().from("collabs_profiles").upsert(payload,{onConflict:"user_id"});
  if(error)throw error;await loadProfile(user);await reloadCreators();success("Profilen er oppdatert.");
 });}
 async function toggleSaved(id:string){if(!user)return;await run(async()=>{
  if(saved.includes(id)){const {error}=await supabase().from("collabs_saved_creators").delete().eq("user_id",user).eq("creator_id",id);if(error)throw error;setSaved(s=>s.filter(x=>x!==id));}
  else{const {error}=await supabase().from("collabs_saved_creators").insert({user_id:user,creator_id:id});if(error)throw error;setSaved(s=>[...s,id]);}
 });}
 async function requestContact(){if(!user||!selected)return;await run(async()=>{
  if(contactNote.trim().length<10)throw new Error("Skriv en personlig melding på minst 10 tegn.");
  const {error}=await supabase().from("collabs_contact_requests").insert({requester_id:user,target_id:selected.user_id,note:contactNote.trim()});
  if(error)throw error;await loadRequests(user);setSelected(null);setContactNote("");success("Forespørselen er sendt. Skaperen bestemmer om den skal godtas.");
 });}
 async function respond(request:Request,accept:boolean){if(!user)return;await run(async()=>{
  const {data,error}=await supabase().rpc("collabs_respond_to_contact",{p_request_id:request.id,p_accept:accept});
  if(error)throw error;await Promise.all([loadRequests(user),loadMatches(user)]);
  if(data){setActiveMatch(data);setPage("messages");}
  success(accept?"Kontakt godkjent – dere kan nå skrive sammen.":"Forespørselen er avslått.");
 });}
 async function sendMessage(e:React.FormEvent){e.preventDefault();if(!user||!activeMatch)return;await run(async()=>{
  const body=newMessage.trim();if(!body||body.length>3000)throw new Error("Meldinger må inneholde 1–3000 tegn.");
  const {error}=await supabase().from("collabs_messages").insert({match_id:activeMatch,sender_id:user,body});if(error)throw error;
  setNewMessage("");const {data,error:readErr}=await supabase().from("collabs_messages").select("*").eq("match_id",activeMatch).order("created_at",{ascending:true}).limit(200);
  if(readErr)throw readErr;setMessages(data||[]);
 });}
 async function createProject(e:React.FormEvent){e.preventDefault();if(!user)return;await run(async()=>{
  if(projectForm.title.trim().length<4)throw new Error("Skriv en tydelig prosjekttittel.");
  const {error}=await supabase().from("collabs_projects").insert({owner_id:user,title:projectForm.title.trim(),description:projectForm.description.trim(),category:projectForm.category,budget:projectForm.budget.trim(),requirements:projectForm.requirements.trim(),deadline:projectForm.deadline||null});
  if(error)throw error;setProjectForm({title:"",description:"",category:"Kreativt",budget:"",requirements:"",deadline:""});
  await loadProjects();success("Oppdraget er publisert.");
 });}
 async function apply(project:Project){if(!user)return;await run(async()=>{
  if(project.owner_id===user)throw new Error("Du kan ikke søke på eget oppdrag.");
  const message=window.prompt("Skriv en kort søknad til prosjektet:", "Hei! Jeg er interessert i et samarbeid.");
  if(message===null)return;
  const {error}=await supabase().from("collabs_applications").insert({project_id:project.id,applicant_id:user,message:message.trim().slice(0,2000)});
  if(error)throw error;success("Søknaden er sendt.");
 });}
 async function blockCreator(id:string){if(!user)return;await run(async()=>{
  if(!window.confirm("Blokkere denne brukeren? Dere vil ikke kunne kontakte hverandre."))return;
  const {error}=await supabase().from("collabs_blocks").insert({blocker_id:user,blocked_id:id});if(error)throw error;
  setSelected(null);await reloadCreators();success("Brukeren er blokkert.");
 });}
 async function reportCreator(id:string){if(!user)return;await run(async()=>{
  const reason=window.prompt("Årsak: spam, harassment, impersonation, fraud eller other","spam");
  if(!reason)return;
  if(!["spam","harassment","impersonation","fraud","other"].includes(reason))throw new Error("Velg en gyldig årsak.");
  const {error}=await supabase().from("collabs_creator_reports").insert({reporter_id:user,creator_id:id,reason,details:""});
  if(error)throw error;setSelected(null);success("Rapporten er mottatt.");
 });}
 const tab=(key:Page,label:string)=><button className={page===key?"active":""} onClick={()=>{setPage(key);setError("");setNotice("");}}>{label}{key==="requests"&&inbox.length>0?" ("+inbox.length+")":""}</button>;
 if(!authReady)return <main className="container"><div className="pane">Laster Vedoy Collabs …</div></main>;
 return <>
 <header className="header"><a className="brand" href="/"><span className="mark">V</span> VEDOY <small>COLLABS</small></a>
 {user?<><nav aria-label="Hovednavigasjon">{tab("discover","Oppdag")}{tab("saved","Lagret")}{tab("projects","Oppdrag")}{tab("requests","Forespørsler")}{tab("messages","Meldinger")}{tab("profile","Min profil")}</nav><div className="header-actions"><button className="ghost" onClick={()=>void supabase().auth.signOut()}>Logg ut</button></div></>:<span className="tiny">Skap. Koble. Samarbeid.</span>}
 </header>
 {!user?<main className="container"><section className="hero"><div className="hero-copy"><div className="eyebrow">En plattform for skapere og bedrifter</div><h1>Finn folkene bak din neste store idé.</h1><p>Oppdag kreative talenter, finn oppdrag og skap samarbeid. Alle kontaktforespørsler krever godkjenning fra mottakeren.</p></div><div className="hero-card"><span className="eyebrow">VEDOY COLLABS</span><strong>Din portefølje. Dine prosjekter. Dine muligheter.</strong><span className="big">✳</span></div></section><div className="pane auth"><h2>{authMode==="login"?"Logg inn":"Opprett konto"}</h2><p className="muted">Bruk Vedøys sikre innlogging for å oppdage og kontakte skapere.</p><form className="stack" onSubmit={authenticate}><label>E-post<input className="field" required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Passord<input className="field" required minLength={8} type="password" autoComplete={authMode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?"Arbeider …":authMode==="login"?"Logg inn":"Registrer"}</button><button className="ghost" type="button" onClick={()=>setAuthMode(authMode==="login"?"register":"login")}>{authMode==="login"?"Ny her? Opprett konto":"Har du konto? Logg inn"}</button></form></div>{error&&<div className="notice error">{error}</div>}{notice&&<div className="notice">{notice}</div>}</main>:
 <main className="container">
 {(page==="discover"||page==="saved")&&<><div className="hero"><div className="hero-copy"><div className="eyebrow">DISCOVER · CREATE · CONNECT</div><h1>Finn din neste samarbeidspartner.</h1><p>Søk etter skapere, ferdigheter og steder. Ta kontakt med en personlig forespørsel, og start samtalen når begge ønsker det.</p></div><div className="hero-card"><span className="eyebrow">ET NETTVERK MED MULIGHETER</span><strong>Et godt samarbeid starter med de riktige menneskene.</strong><button className="secondary" onClick={()=>setPage("profile")}>Gjør profilen din synlig ↗</button></div></div><div className="section-header"><h2>{page==="saved"?"Lagrede skapere":"Utforsk skapere"}</h2><span className="tiny">{visible.length} profiler vist</span></div>
 <div className="toolbar"><input className="field" aria-label="Søk" placeholder="Søk navn, fagfelt eller interesser" value={query} onChange={e=>setQuery(e.target.value)} /><input className="field" aria-label="Rolle" placeholder="Rolle, f.eks. fotograf" value={role} onChange={e=>setRole(e.target.value)} /><input className="field" aria-label="Ferdighet" placeholder="Ferdighet" value={skill} onChange={e=>setSkill(e.target.value)} /><input className="field" aria-label="Sted" placeholder="Sted / by" value={location} onChange={e=>setLocation(e.target.value)} /></div>
 <div className="cards">{visible.map(c=><article className="card creator" key={c.user_id}><div className="profile-head"><Avatar creator={c}/><div><div className="name">{c.display_name||"Skaper"} {c.verified&&<span className="verified" title="Identitet verifisert">● Verifisert</span>}</div><div className="meta">{c.location||"Sted ikke oppgitt"}</div></div></div><div><strong>{c.headline||"Åpen for kreative samarbeid"}</strong><p className="muted" style={{marginTop:5}}>{(c.bio||"Utforsk profilen for å lære mer.").slice(0,160)}</p></div><div className="chips">{(c.roles||[]).slice(0,3).map(x=><span key={x} className="chip green">{x}</span>)}{(c.skills||[]).slice(0,3).map(x=><span key={x} className="chip">{x}</span>)}</div><span className="tiny">{c.availability}</span><div className="actions"><button className="primary grow" onClick={()=>{setSelected(c);setContactNote("");}}>Se profil / Kontakt</button><button aria-label={saved.includes(c.user_id)?"Fjern lagring":"Lagre"} className="secondary" onClick={()=>void toggleSaved(c.user_id)}>{saved.includes(c.user_id)?"♥":"♡"}</button></div></article>)}
 {!loading&&visible.length===0&&<div className="empty"><h3>Ingen skapere funnet ennå</h3><p>Prøv et annet søk, eller bli den første som oppretter en offentlig creator-profil.</p><button className="secondary" onClick={()=>setPage("profile")}>Lag creator-profil</button></div>}</div>
 <div className="section-header">{loading?<span className="muted">Henter skapere …</span>:page==="discover"&&more?<button className="secondary" onClick={()=>void reloadCreators(offset+24,true)}>Vis flere skapere</button>:null}</div></>}
 {page==="profile"&&<><div className="section-header"><h2>Din creator-profil</h2><span className="badge">{profile?"Profil opprettet":"Kom i gang"}</span></div><div className="hero-mini">Vis frem hvem du er, hva du kan og hvilke samarbeid du ønsker. Bare det du markerer som offentlig, vises i søket.</div><form className="pane stack profile-form" onSubmit={saveProfile}><label>Visningsnavn<input className="field" required maxLength={90} value={form.display_name} onChange={e=>setForm({...form,display_name:e.target.value})}/></label><label>Kort overskrift<input className="field" maxLength={140} placeholder="Fotograf og innholdsskaper" value={form.headline} onChange={e=>setForm({...form,headline:e.target.value})}/></label><label>Om deg<textarea className="field" maxLength={1800} value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/></label><label>Sted<input className="field" maxLength={120} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>Roller (kommadelt)<input className="field" placeholder="Fotograf, designer, musiker" value={form.roles} onChange={e=>setForm({...form,roles:e.target.value})}/></label><label>Ferdigheter (kommadelt)<input className="field" placeholder="Photoshop, video, markedsføring" value={form.skills} onChange={e=>setForm({...form,skills:e.target.value})}/></label><label>Interesser (kommadelt)<input className="field" value={form.interests} onChange={e=>setForm({...form,interests:e.target.value})}/></label><label>Tilgjengelighet<select className="field" value={form.availability} onChange={e=>setForm({...form,availability:e.target.value})}><option>Åpen for samarbeid</option><option>Åpen for oppdrag</option><option>Ikke tilgjengelig</option></select></label><label>Profilbilde (https-URL)<input className="field" type="url" value={form.avatar_url} onChange={e=>setForm({...form,avatar_url:e.target.value})}/></label><label>Banner (https-URL)<input className="field" type="url" value={form.banner_url} onChange={e=>setForm({...form,banner_url:e.target.value})}/></label><label>Portefølje – én https-lenke per linje<textarea className="field" placeholder="https://eksempel.no/prosjekt" value={form.portfolio} onChange={e=>setForm({...form,portfolio:e.target.value})}/></label><label>Sosiale lenker – én per linje, f.eks. Instagram: https://...<textarea className="field" value={form.social_links} onChange={e=>setForm({...form,social_links:e.target.value})}/></label><label style={{display:"flex",gap:9,alignItems:"center"}}><input type="checkbox" checked={form.is_public} onChange={e=>setForm({...form,is_public:e.target.checked})}/> Vis profilen i creator-søket</label><button disabled={busy} className="primary">Lagre profil</button></form></>}
 {page==="requests"&&<><div className="section-header"><h2>Kontaktforespørsler</h2></div><div className="layout-two"><section className="pane"><h3>Innkommende ({inbox.length})</h3><div className="list" style={{marginTop:16}}>{inbox.map(r=><article className="list-item" key={r.id}><div><strong>{names[r.requester_id]||"En skaper"}</strong><p>{r.note}</p><span className="tiny">{new Date(r.created_at).toLocaleDateString("no-NO")}</span></div><div className="stack"><button disabled={busy} className="primary" onClick={()=>void respond(r,true)}>Godta</button><button disabled={busy} className="secondary" onClick={()=>void respond(r,false)}>Avslå</button></div></article>)}{inbox.length===0&&<p className="muted">Ingen ventende forespørsler.</p>}</div></section><section className="pane"><h3>Sendte forespørsler</h3><div className="list" style={{marginTop:16}}>{ownRequests.map(r=><div className="list-item" key={r.id}><div><strong>{names[r.target_id]||"Creator"}</strong><p>{r.note}</p><span className="tiny">Status: {r.status==="pending"?"Venter":r.status==="accepted"?"Godkjent":"Avslått"}</span></div></div>)}{ownRequests.length===0&&<p className="muted">Du har ikke sendt noen forespørsler.</p>}</div></section></div></>}
 {page==="messages"&&<><div className="section-header"><h2>Meldinger</h2></div><div className="split-chat"><aside className="pane stack"><h3>Samtaler</h3>{matches.map(m=><button key={m.id} className={"inbox-button"+(activeMatch===m.id?" active":"")} onClick={()=>setActiveMatch(m.id)}><span className="avatar" style={{width:34,height:34,borderRadius:10}}>✳</span><span>{names[m.user_a===user?m.user_b:m.user_a]||"Samarbeidspartner"}</span></button>)}{matches.length===0&&<p className="muted">Ingen samtaler ennå. Du kan starte å skrive etter at en kontaktforespørsel er godtatt.</p>}</aside><section className="pane stack"><h3>{activeMatch?"Samtale":"Velg en samtale"}</h3>{activeMatch?<><div aria-live="polite" className="chat-window">{messages.map(m=><div className={"bubble"+(m.sender_id===user?" mine":"")} key={m.id}>{m.body}<div className="tiny">{new Date(m.created_at).toLocaleString("no-NO")}</div></div>)}{messages.length===0&&<p className="muted">Ingen meldinger. Si hei!</p>}</div><form onSubmit={sendMessage} className="stack"><textarea aria-label="Melding" maxLength={3000} className="field" placeholder="Skriv en hyggelig melding …" value={newMessage} onChange={e=>setNewMessage(e.target.value)}/><button disabled={busy||!newMessage.trim()} className="primary">Send melding</button></form></>:<p className="muted">Åpne en eksisterende samtale i listen.</p>}</section></div></>}
 {page==="projects"&&<><div className="section-header"><h2>Oppdrag og samarbeid</h2></div><div className="layout-two"><section className="pane"><h3>Publiser et oppdrag</h3><p className="muted">Beskriv hva du trenger, rammer og ønskede ferdigheter.</p><form className="stack" onSubmit={createProject}><label>Tittel<input className="field" required value={projectForm.title} onChange={e=>setProjectForm({...projectForm,title:e.target.value})}/></label><label>Beskrivelse<textarea className="field" value={projectForm.description} onChange={e=>setProjectForm({...projectForm,description:e.target.value})}/></label><label>Kategori<select className="field" value={projectForm.category} onChange={e=>setProjectForm({...projectForm,category:e.target.value})}><option>Kreativt</option><option>Foto og video</option><option>Design</option><option>Musikk</option><option>Teknologi</option><option>Markedsføring</option><option>Salg</option><option>Annet</option></select></label><label>Budsjett / kompensasjon<input className="field" placeholder="F.eks. 2000 NOK eller avtales" value={projectForm.budget} onChange={e=>setProjectForm({...projectForm,budget:e.target.value})}/></label><label>Ønskede ferdigheter<input className="field" value={projectForm.requirements} onChange={e=>setProjectForm({...projectForm,requirements:e.target.value})}/></label><label>Frist<input type="date" className="field" value={projectForm.deadline} onChange={e=>setProjectForm({...projectForm,deadline:e.target.value})}/></label><button disabled={busy} className="primary">Publiser prosjekt</button></form></section><section className="pane"><h3>Finn oppdrag</h3><input style={{margin:"14px 0"}} className="field" placeholder="Søk oppdrag" value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}/><div className="list">{filteredProjects.filter(p=>p.status==="open").map(p=><article className="card project" key={p.id}><span className="eyebrow">{p.category}</span><h3>{p.title}</h3><p>{p.description}</p><div className="chips">{p.budget&&<span className="chip green">{p.budget}</span>}{p.deadline&&<span className="chip">Frist: {p.deadline}</span>}</div><span className="tiny">{p.requirements}</span><button disabled={busy||p.owner_id===user} onClick={()=>void apply(p)} className="secondary">{p.owner_id===user?"Ditt oppdrag":"Søk på prosjektet"}</button></article>)}{filteredProjects.length===0&&<p className="muted">Ingen oppdrag funnet ennå.</p>}</div></section></div></>}
 {error&&<div role="alert" className="notice error">{error}</div>}{notice&&<div role="status" className="notice">{notice}</div>}
 </main>}
 {selected&&<div className="overlay" onClick={()=>setSelected(null)} role="presentation"><div role="dialog" aria-modal="true" aria-label={"Profil "+selected.display_name} className="modal" onClick={e=>e.stopPropagation()}><button aria-label="Lukk" className="close" onClick={()=>setSelected(null)}>×</button><div className="profile-banner">{safeUrl(selected.banner_url)&&<img src={safeUrl(selected.banner_url)} alt="Profilbanner"/>}</div><div className="profile-overlay-avatar"><Avatar creator={selected} large/></div><div className="profile-details"><h2>{selected.display_name} {selected.verified&&<span className="verified">● Verifisert</span>}</h2><strong>{selected.headline}</strong><p className="muted">{selected.location} · {selected.availability}</p><p>{selected.bio}</p><div className="chips">{[...selected.roles,...selected.skills].map(x=><span className="chip" key={x}>{x}</span>)}</div>{selected.experience_level&&<p className="tiny">Erfaring: {selected.experience_level}</p>}{Array.isArray(selected.portfolio)&&selected.portfolio.length>0&&<><h3 style={{marginTop:19}}>Portefølje</h3><div className="stack">{selected.portfolio.slice(0,8).map((entry,i)=>safeUrl(String(obj(entry).url||""))?<a key={i} className="link" href={safeUrl(String(obj(entry).url||""))} target="_blank" rel="noopener noreferrer">Se arbeid {i+1} ↗</a>:null)}</div></>}{Object.entries(obj(selected.social_links)).length>0&&<><h3 style={{marginTop:19}}>Lenker</h3><div className="chips">{Object.entries(obj(selected.social_links)).map(([name,value])=>safeUrl(String(value))?<a className="link" key={name} href={safeUrl(String(value))} target="_blank" rel="noopener noreferrer">{name} ↗</a>:null)}</div></>}<div className="stack" style={{marginTop:18}}><label>Send kontaktforespørsel<textarea className="field" placeholder="Hei! Jeg likte porteføljen din og vil gjerne diskutere …" minLength={10} maxLength={800} value={contactNote} onChange={e=>setContactNote(e.target.value)} /></label><button className="primary" disabled={busy||selected.user_id===user||requests.some(r=>r.requester_id===user&&r.target_id===selected.user_id)} onClick={()=>void requestContact()}>{requests.some(r=>r.requester_id===user&&r.target_id===selected.user_id)?"Forespørsel allerede sendt":"Send forespørsel"}</button><div className="actions"><button className="ghost" onClick={()=>void toggleSaved(selected.user_id)}>{saved.includes(selected.user_id)?"♥ Fjern lagring":"♡ Lagre profil"}</button><button className="ghost" onClick={()=>void reportCreator(selected.user_id)}>Rapporter</button><button className="ghost" onClick={()=>void blockCreator(selected.user_id)}>Blokker</button></div></div></div></div></div>}
 <footer className="foot">© Vedoy Collabs · Skap. Koble. Samarbeid. · Kontakt er alltid frivillig.</footer>
 </>;
}
