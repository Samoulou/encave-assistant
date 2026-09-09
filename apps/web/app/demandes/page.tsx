'use client';

import { useCallback,useEffect,useRef,useState,type FormEvent } from 'react';

type Cave={id:string;name:string;role:'admin'|'operator'|'reader'};
type Session={identity:{id:string;name:string};csrf:string;activeCave:Cave|null;caves:Cave[];accessRevoked:boolean};
type Item={id:string;caveId:string;localReference:string;contactName:string;contactEmail:string|null;contactPhone:string|null;subject:string;channel:string;state:string;version:number;createdAt:string;origin:string|null;actorName:string|null;actorId:string|null;requestedDate:string|null;participants:number|null;budgetMinor:number|null;budgetBasis:string|null;currency:string;sourceMessageId:string|null;bucket:string;nextAction:string};
type Detail=Item&{messages:{id:string;direction:string;channel:string;body:string;author_observed:string;occurred_at:string}[];events:{from_state:string;to_state:string;to_version:number;created_at:string}[];truncated:boolean};
type Filters={q:string;filter:string;sort:string;page:number};
type List={caveId:string;items:Item[];counts:Record<string,number>;total:number;page:number;pageSize:number};
type Draft={contactName:string;contactEmail:string;contactPhone:string;subject:string;note:string;origin:string;requestedDate:string;participants:string;budgetMinor:string;budgetBasis:string};
type View={kind:'list'}|{kind:'new'}|{kind:'detail';id:string};
const emptyDraft:Draft={contactName:'',contactEmail:'',contactPhone:'',subject:'',note:'',origin:'',requestedDate:'',participants:'',budgetMinor:'',budgetBasis:''};
const defaultFilters:Filters={q:'',filter:'to_process',sort:'priority',page:1};
const filterLabels:Record<string,string>={to_process:'À traiter',waiting:'Attente client',reserve:'À réserver',recovery:'À reprendre',booked:'Réservées',archived:'Archivées',all:'Toutes'};
const originLabels:Record<string,string>={phone:'Téléphone',in_person:'En personne',other:'Autre saisie manuelle'};
const stateLabels:Record<string,string>={received:'Reçue',qualifying:'En qualification',waiting_customer:'Attente client',ready:'À examiner',processed:'Traitée',archived:'Archivée'};
const errors:Record<string,string>={cave_changed:'La cave active a changé dans un autre onglet. Actualisez pour retrouver son contexte.',role_forbidden:'Votre rôle ne permet pas cette action.',access_revoked:'Votre accès à cette cave a été révoqué.',session_required:'Votre session a expiré. Reconnectez-vous.',inquiry_unavailable:'Ce dossier est indisponible dans votre cave.',idempotency_conflict:'Cette commande a déjà été utilisée pour un autre contenu. Actualisez pour vérifier le dossier.'};
const time=(s:string)=>new Intl.DateTimeFormat('fr-CH',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Zurich'}).format(new Date(s));
const date=(s:string|null)=>s?new Intl.DateTimeFormat('fr-CH',{dateStyle:'long',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z')):'Date à préciser';
const age=(s:string)=>{const d=Math.max(0,Math.floor((Date.now()-Date.parse(s))/86400000));return d===0?'Aujourd’hui':`Il y a ${d} jour${d>1?'s':''}`;};
const viewFromUrl=():View=>{const q=new URLSearchParams(window.location.search);return q.has('nouvelle')?{kind:'new'}:q.has('id')?{kind:'detail',id:q.get('id')!}:{kind:'list'};};
const storageGet=(k:string)=>{try{return sessionStorage.getItem(k);}catch{return null;}};
const storageSet=(k:string,v:string|null)=>{try{if(v===null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v);}catch{/* Live page retains command; storage may be disabled by the browser. */}};
const scopeKey=(s:Session)=>`encave.inquiries.${s.identity.id}.${s.activeCave?.id}.`;

export default function Inquiries(){
  const [session,setSession]=useState<Session|null>(null),[contextLoading,setContextLoading]=useState(true),[view,setView]=useState<View>({kind:'list'});
  const [filters,setFilters]=useState<Filters>(defaultFilters),[list,setList]=useState<List|null>(null),[detail,setDetail]=useState<Detail|null>(null);
  const [loading,setLoading]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[reload,setReload]=useState(0);
  const [draft,setDraft]=useState<Draft>(emptyDraft),[fields,setFields]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
  const [pending,setPending]=useState<{kind:'switch';id:string}|{kind:'leave'}|null>(null);
  const current=useRef<Session|null>(null),generation=useRef(0),dataRequest=useRef(0),channel=useRef<BroadcastChannel|null>(null),submitLock=useRef(false);
  const lastCommand=useRef<{key:string;body:unknown}|null>(null),dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null),summary=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null),restoreScroll=useRef(false);
  const dirty=Object.values(draft).some(Boolean)||uncertain;
  const loadContext=useCallback(async()=>{
    const g=++generation.current;dataRequest.current++;setContextLoading(true);setList(null);setDetail(null);setError('');
    try{
      const response=await fetch('/api/session',{cache:'no-store'});if(g!==generation.current)return;
      if(!response.ok){setSession(null);current.current=null;setError(errors['session_required']!);return;}
      const s:Session=await response.json();if(g!==generation.current)return;
      const changed=current.current?.activeCave?.id!==s.activeCave?.id||current.current?.identity.id!==s.identity.id;
      if(changed){setDraft(emptyDraft);setFields({});setStatus('');setUncertain(false);lastCommand.current=null;setPending(null);
        let f=defaultFilters;try{const saved=JSON.parse(storageGet(scopeKey(s)+'list')??'null');if(saved&&typeof saved.q==='string'&&saved.q.length<=120&&filterLabels[saved.filter]&&['priority','oldest','newest'].includes(saved.sort)&&Number.isInteger(saved.page)&&saved.page>0)f=saved;}catch{}
        setFilters(f);
        if(current.current){history.replaceState(null,'','/demandes');setView({kind:'list'});}else setView(viewFromUrl());
      }
      current.current=s;setSession(s);setReload(n=>n+1);
    }catch{if(g===generation.current)setError('Votre espace est indisponible. Réessayez.');}
    finally{if(g===generation.current)setContextLoading(false);}
  },[]);
  useEffect(()=>{void loadContext();const c=new BroadcastChannel('encave-context');channel.current=c;
    c.onmessage=()=>{setDraft(emptyDraft);setFields({});setStatus('');setPending(null);setUncertain(false);lastCommand.current=null;void loadContext();};
    const visible=()=>{if(document.visibilityState==='visible')void loadContext();};const pop=()=>{setView(viewFromUrl());setError('');setStatus('');};
    document.addEventListener('visibilitychange',visible);window.addEventListener('popstate',pop);
    return()=>{generation.current++;dataRequest.current++;c.close();document.removeEventListener('visibilitychange',visible);window.removeEventListener('popstate',pop);};
  },[loadContext]);
  useEffect(()=>{const before=(e:BeforeUnloadEvent)=>{if(view.kind==='new'&&dirty){e.preventDefault();}};window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);},[view.kind,dirty]);
  useEffect(()=>{
    if(!session?.activeCave||contextLoading)return;storageSet(scopeKey(session)+'list',JSON.stringify(filters));
    if(view.kind==='new'){
      try{const saved=JSON.parse(storageGet(scopeKey(session)+'pending')??'null');if(saved?.key&&saved?.draft&&saved?.body){lastCommand.current={key:saved.key,body:saved.body};setDraft(saved.draft);setUncertain(true);}}catch{}
      return;
    }
    const g=generation.current,r=++dataRequest.current,cave=session.activeCave.id;const controller=new AbortController();setLoading(true);setError('');setList(null);setDetail(null);
    const path=view.kind==='detail'?`/api/inquiries/${encodeURIComponent(view.id)}/dossier`:'/api/inquiries?'+new URLSearchParams({...filters,page:String(filters.page)});
    void(async()=>{try{const response=await fetch(path,{headers:{'x-encave-cave':cave},cache:'no-store',signal:controller.signal});const result=await response.json();if(g!==generation.current||r!==dataRequest.current)return;
      if(!response.ok)throw new Error(result.error);if(result.caveId!==cave)throw new Error('cave_changed');
      if(view.kind==='detail')setDetail(result);else{setList(result);if(restoreScroll.current){restoreScroll.current=false;requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo(0,Number(storageGet(scopeKey(session)+'scroll')??0))));}}
    }catch(e){if(!controller.signal.aborted&&g===generation.current&&r===dataRequest.current)setError(errors[(e as Error).message]??'Les demandes sont indisponibles. Vos filtres sont conservés.');}
    finally{if(g===generation.current&&r===dataRequest.current)setLoading(false);}})();
    return()=>controller.abort();
  },[session,contextLoading,filters,view,reload]);
  useEffect(()=>{if(pending&&!dialog.current?.open)dialog.current?.showModal();else if(!pending&&dialog.current?.open){dialog.current.close();opener.current?.focus();}},[pending]);

  function navigate(v:View){dataRequest.current++;setLoading(false);setDetail(null);setList(null);setFields({});setError('');setStatus('');
    if(view.kind==='list'&&session)storageSet(scopeKey(session)+'scroll',String(window.scrollY));
    if(v.kind==='list')restoreScroll.current=true;
    history.pushState(null,'',v.kind==='list'?'/demandes':v.kind==='new'?'/demandes?nouvelle=1':'/demandes?id='+encodeURIComponent(v.id));setView(v);window.scrollTo(0,0);requestAnimationFrame(()=>heading.current?.focus());}
  async function changeCave(id:string){
    if(!session)return;const g=generation.current;setBusy(true);setError('');
    try{const response=await fetch('/api/caves/switch',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':session.csrf,'x-encave-cave':session.activeCave?.id??''},body:JSON.stringify({caveId:id})});const result=await response.json();if(g!==generation.current)return;if(!response.ok)throw new Error(result.error);
      setDraft(emptyDraft);setPending(null);channel.current?.postMessage('cave_changed');await loadContext();
    }catch(e){if(g===generation.current)setError(errors[(e as Error).message]??'Le changement de cave a échoué.');}finally{setBusy(false);}
  }
  async function submit(e:FormEvent){
    e.preventDefault();if(submitLock.current||!session?.activeCave)return;setFields({});setError('');setStatus('');
    let body:unknown;
    if(uncertain&&lastCommand.current)body=lastCommand.current.body;
    else{
      const numeric:Record<string,string>={};if(draft.participants&&!/^\d+$/.test(draft.participants))numeric['participants']='Indiquez un nombre entier positif.';
      if(draft.budgetMinor&&!/^\d+(?:[.,]\d{1,2})?$/.test(draft.budgetMinor))numeric['budgetMinor']='Indiquez un budget positif avec deux décimales maximum.';
      if(Object.keys(numeric).length){setFields(numeric);requestAnimationFrame(()=>summary.current?.focus());return;}
      const [francs,cents='']=draft.budgetMinor.replace(',','.').split('.');
      body={...draft,contactEmail:draft.contactEmail.trim()||null,contactPhone:draft.contactPhone.trim()||null,requestedDate:draft.requestedDate||null,
        participants:draft.participants?Number(draft.participants):null,budgetMinor:draft.budgetMinor?Number(francs)*100+Number(cents.padEnd(2,'0')):null,budgetBasis:draft.budgetBasis||null};
      lastCommand.current={key:crypto.randomUUID(),body};
    }
    const command=lastCommand.current!,g=generation.current,cave=session.activeCave.id;
    storageSet(scopeKey(session)+'pending',JSON.stringify({...command,draft}));submitLock.current=true;setBusy(true);
    try{const response=await fetch('/api/inquiries/manual',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':session.csrf,'x-encave-cave':cave,'idempotency-key':command.key},body:JSON.stringify(body)});const result=await response.json();if(g!==generation.current)return;
      if(!response.ok){if(response.status>=500)throw new Error('uncertain');
        // A refusal to inspect an earlier command says nothing about its initial
        // commit. Keep its key and payload until that result is actually known.
        if(uncertain){setError((errors[result.error]??'La vérification a été refusée.')+' Le résultat initial reste à vérifier avec cette même commande.');return;}
        storageSet(scopeKey(session)+'pending',null);setUncertain(false);lastCommand.current=null;
        if(result.fields){setFields(result.fields);requestAnimationFrame(()=>summary.current?.focus());}else setError(errors[result.error]??'L’enregistrement a été refusé. Vos informations sont conservées.');return;}
      if(result.caveId!==cave)throw new Error('uncertain');storageSet(scopeKey(session)+'pending',null);setDraft(emptyDraft);setUncertain(false);lastCommand.current=null;navigate({kind:'detail',id:result.id});setStatus('Demande enregistrée. Aucun message n’a été envoyé et aucune réservation n’a été créée.');
    }catch{if(g===generation.current){setUncertain(true);setError('L’enregistrement n’est pas confirmé. Vérifiez avec la même commande ; vos informations sont conservées.');}}
    finally{submitLock.current=false;setBusy(false);}
  }
  function abandon(){setPending(null);setDraft(emptyDraft);setFields({});setUncertain(false);lastCommand.current=null;navigate({kind:'list'});}
  const active=session?.activeCave,locked=busy||uncertain;
  const field=(name:keyof Draft,label:string,options:{type?:string;help?:string;max?:number}={})=><div><label htmlFor={'manual-'+name}>{label}</label><input id={'manual-'+name} type={options.type??'text'} value={draft[name]} maxLength={options.max} disabled={locked} onChange={e=>setDraft(d=>({...d,[name]:e.target.value}))} aria-invalid={Boolean(fields[name])} aria-describedby={fields[name]?'error-'+name:options.help?'help-'+name:undefined}/>{options.help&&<p id={'help-'+name} className="help">{options.help}</p>}{fields[name]&&<p id={'error-'+name} className="field-error">{fields[name]}</p>}</div>;
  const select=(name:'origin'|'budgetBasis',label:string,choices:Record<string,string>)=><div><label htmlFor={'manual-'+name}>{label}</label><select id={'manual-'+name} value={draft[name]} disabled={locked} onChange={e=>setDraft(d=>({...d,[name]:e.target.value}))} aria-invalid={Boolean(fields[name])} aria-describedby={fields[name]?'error-'+name:undefined}><option value="">Choisir…</option>{Object.entries(choices).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select>{fields[name]&&<p id={'error-'+name} className="field-error">{fields[name]}</p>}</div>;
  return <div className="workspace-shell inquiry-shell">
    <aside className="workspace-nav"><p className="brand">EnCave <span>Assistant</span></p><nav aria-label="Navigation principale"><a href="/demandes" aria-current="page" onClick={e=>{if(view.kind==='new'&&dirty){e.preventDefault();opener.current=e.currentTarget;setPending({kind:'leave'});}}}>Demandes</a><a href="/espace" onClick={e=>{if(view.kind==='new'&&dirty){e.preventDefault();setError('Terminez ou abandonnez la saisie avant d’ouvrir les paramètres.');}}}>Paramètres</a></nav><p className="nav-caption">Les prochaines actions de votre cave.</p></aside>
    <div className="workspace-content"><header className="workspace-header"><div><p className="eyebrow">Cave active</p><strong data-testid="active-cave">{contextLoading?'Chargement de votre cave…':active?.name??'Aucune cave active'}</strong>
      {session&&(session.caves.length>1||(!active&&session.caves.length>0))&&<label className="cave-picker">Changer de cave<select aria-label="Changer de cave" value={active?.id??''} disabled={busy||contextLoading} onChange={e=>{if(view.kind==='new'&&dirty){opener.current=e.currentTarget;setPending({kind:'switch',id:e.target.value});}else void changeCave(e.target.value);}}><option value="" disabled>Choisir une cave</option>{session.caves.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}</div>
      {session&&<div className="account"><span>{session.identity.name}</span><a className="button secondary" href="/espace">Compte et accès</a></div>}</header>
      <main id="contenu" className="workspace-main inquiries-main" tabIndex={-1}>
        <p className="eyebrow">Demandes{view.kind==='new'?' / Saisie manuelle':view.kind==='detail'?' / Dossier':''}</p>
        <div className="section-heading"><div><h1 ref={heading} tabIndex={-1}>{view.kind==='new'?'Nouvelle demande':view.kind==='detail'?'Le dossier de votre visiteur':'Les demandes de votre cave'}</h1>{view.kind==='list'&&<p className="muted">Retrouvez chaque besoin et sa prochaine action.</p>}</div>
          {view.kind==='list'&&active&&active.role!=='reader'&&!contextLoading&&<a className="button primary" href="/demandes?nouvelle=1" onClick={e=>{e.preventDefault();navigate({kind:'new'});}}>Nouvelle demande</a>}</div>
        {(contextLoading||loading)&&<div className="loading-state" role="status">{contextLoading?'Chargement de votre espace…':'Chargement des demandes…'}</div>}
        {error&&<div className="alert error" role="alert"><p>{error}</p>{!uncertain&&<button className="button secondary" onClick={()=>void loadContext()}>Actualiser l’espace</button>}<a className="button secondary" href="/connexion">Se reconnecter</a></div>}
        {status&&<div className="alert success" role="status">{status}</div>}
        {!contextLoading&&session&&!active&&<section className="empty-state"><h2>{session.accessRevoked?'Votre accès à cette cave a été révoqué':'Aucune cave disponible'}</h2><p>Choisissez une autre cave autorisée ou contactez son administrateur.</p></section>}
        {!contextLoading&&active&&view.kind==='list'&&<>
          <section className="inquiry-filters" aria-label="Filtrer les demandes"><div className="form-grid"><div><label htmlFor="inquiry-search">Rechercher un client ou un besoin</label><input id="inquiry-search" maxLength={120} value={filters.q} onChange={e=>setFilters(f=>({...f,q:e.target.value,page:1}))}/></div><div><label htmlFor="inquiry-sort">Trier les demandes</label><select id="inquiry-sort" value={filters.sort} onChange={e=>setFilters(f=>({...f,sort:e.target.value,page:1}))}><option value="priority">Priorité, date souhaitée, ancienneté</option><option value="oldest">Les plus anciennes</option><option value="newest">Les plus récentes</option></select></div></div>
            <div className="filter-buttons" aria-label="États des demandes">{Object.entries(filterLabels).map(([key,label])=><button type="button" key={key} className={'button '+(filters.filter===key?'primary':'secondary')} aria-pressed={filters.filter===key} onClick={()=>setFilters(f=>({...f,filter:key,page:1}))}>{label}{list?` (${list.counts[key]??0})`:''}</button>)}</div></section>
          {!loading&&list&&<>{list.total===0?<section className="empty-state"><h2>{list.counts.all===0&&!filters.q?'Votre première demande commence ici':'Aucune demande pour cette recherche'}</h2><p>{list.counts.all===0&&!filters.q?'Après un appel ou une visite, conservez le besoin et un moyen de réponse.':'Essayez un autre terme ou effacez les filtres.'}</p>{(filters.q||list.counts.all>0)&&<button className="button secondary" onClick={()=>setFilters({...defaultFilters,filter:'all'})}>Effacer les filtres</button>}</section>:<><p role="status">{list.total} demande{list.total>1?'s':''} · page {list.page}</p><ul className="inquiry-list">{list.items.map(item=><li key={item.id}><article className="inquiry-card"><div><p className="eyebrow">{originLabels[item.origin??'']??({manual:'Saisie manuelle',form:'Formulaire',email:'E-mail'}[item.channel]??item.channel)} · {age(item.createdAt)}</p><h2><a href={'/demandes?id='+item.id} onClick={e=>{e.preventDefault();navigate({kind:'detail',id:item.id});}}>{item.contactName}</a></h2><p>{item.subject}</p><p className="muted">{date(item.requestedDate)} · {item.participants===null?'Participants à préciser':`${item.participants} personnes`}</p><p className="help">Responsable : à attribuer</p></div><div className="inquiry-next"><span className={'inquiry-badge '+item.bucket}>{filterLabels[item.bucket]}</span><strong>{item.nextAction}</strong><a className="button secondary" href={'/demandes?id='+item.id} onClick={e=>{e.preventDefault();navigate({kind:'detail',id:item.id});}}>Ouvrir le dossier<span className="sr-only"> de {item.contactName}</span></a></div></article></li>)}</ul><div className="pagination"><button className="button secondary" disabled={filters.page===1} onClick={()=>setFilters(f=>({...f,page:f.page-1}))}>Page précédente</button><button className="button secondary" disabled={filters.page*50>=list.total} onClick={()=>setFilters(f=>({...f,page:f.page+1}))}>Page suivante</button></div></>}</>}
        </>}
        {!contextLoading&&active&&view.kind==='new'&&(active.role==='reader'?<div className="alert info">Votre accès est en lecture. Un opérateur peut saisir une demande.</div>:<section className="manual-panel" aria-labelledby="manual-title"><h2 id="manual-title">Conserver le besoin après votre échange</h2><p className="muted">Nom, moyen de réponse, besoin, origine et compte rendu sont requis. Les autres informations peuvent être précisées plus tard.</p>
          <form noValidate onSubmit={submit} aria-busy={busy}>{Object.keys(fields).length>0&&<div className="alert error" role="alert" ref={summary} tabIndex={-1}><strong>Vérifiez les informations</strong><ul>{Object.entries(fields).map(([k,v])=><li key={k}><a href={k==='form'?'#manual-title':'#manual-'+k}>{v}</a></li>)}</ul></div>}
            {uncertain&&<div className="alert warning" role="status">Vérification nécessaire. Le contenu est conservé pour retrouver le même enregistrement.</div>}
            <div className="form-grid">{field('contactName','Nom du client',{max:160})}{select('origin','Origine de la saisie',originLabels)}{field('contactEmail','Adresse e-mail',{type:'email',max:254,help:'Au moins un e-mail ou un téléphone est nécessaire.'})}{field('contactPhone','Téléphone',{type:'tel',max:40})}</div>
            {field('subject','Besoin du client',{max:240})}<div className="note-field"><label htmlFor="manual-note">Compte rendu de l’échange</label><textarea id="manual-note" maxLength={4000} value={draft.note} disabled={locked} onChange={e=>setDraft(d=>({...d,note:e.target.value}))} aria-invalid={Boolean(fields.note)} aria-describedby={fields.note?'error-note':'help-note'}/><p className="help" id="help-note">Conservez les mots utiles du visiteur. Ce compte rendu interne ne lui est pas envoyé.</p>{fields.note&&<p className="field-error" id="error-note">{fields.note}</p>}</div>
            <div className="form-grid">{field('requestedDate','Date souhaitée (facultatif)',{type:'date'})}{field('participants','Participants (facultatif)',{max:6})}{field('budgetMinor','Budget CHF (facultatif)',{max:14,help:'Montant déclaré, sans calcul de prix ni promesse commerciale.'})}{select('budgetBasis','Ce budget concerne (si renseigné)',{group:'Tout le groupe',person:'Une personne'})}</div>
            {busy&&<p role="status">Enregistrement en cours…</p>}<div className="form-actions"><button className="button primary" disabled={busy} type="submit">{busy?'Enregistrement en cours…':uncertain?'Vérifier l’enregistrement':'Enregistrer la demande'}</button><button className="button secondary" type="button" disabled={busy} onClick={e=>{if(dirty){opener.current=e.currentTarget;setPending({kind:'leave'});}else navigate({kind:'list'});}}>Retour à la liste</button></div>
          </form></section>)}
        {!contextLoading&&active&&view.kind==='detail'&&!loading&&detail&&<div className="dossier"><a className="button secondary" href="/demandes" onClick={e=>{e.preventDefault();navigate({kind:'list'});}}>Retour à la liste</a><section aria-labelledby="dossier-summary"><p className="eyebrow">{stateLabels[detail.state]??detail.state} · Version {detail.version}</p><h2 id="dossier-summary">{detail.contactName}</h2><p className="need">{detail.subject}</p><div className="alert info"><strong>Prochaine action : {detail.nextAction}</strong><p>La saisie d’une demande ne confirme aucune réservation.</p></div><p className="help">Responsable : à attribuer · Référence {detail.localReference}</p></section>
          <nav className="section-links" aria-label="Sections du dossier"><a className="button secondary" href="#dossier-facts">Informations</a><a className="button secondary" href="#dossier-messages">Échanges</a><a className="button secondary" href="#dossier-history">Historique</a></nav>
          <section aria-labelledby="dossier-facts"><h2 id="dossier-facts">Informations déclarées</h2><dl className="facts"><dt>Moyen de réponse</dt><dd>{detail.contactEmail??'E-mail à préciser'}<br/>{detail.contactPhone??'Téléphone à préciser'}</dd><dt>Date souhaitée</dt><dd>{date(detail.requestedDate)}</dd><dt>Participants</dt><dd>{detail.participants??'À préciser'}</dd><dt>Budget déclaré</dt><dd>{detail.budgetMinor===null?'À préciser':`${(detail.budgetMinor/100).toFixed(2)} CHF ${detail.budgetBasis==='group'?'pour le groupe':'par personne'}`}</dd><dt>Origine</dt><dd>{originLabels[detail.origin??'']??'Provenance manuelle détaillée non enregistrée'}</dd><dt>Saisi par</dt><dd>{detail.actorName??'Acteur non renseigné dans cette provenance'} · {time(detail.createdAt)} (Europe/Zurich)</dd></dl>{detail.sourceMessageId&&<a className="button secondary" href={'#message-'+detail.sourceMessageId}>Voir le compte rendu source</a>}</section>
          <section aria-labelledby="dossier-messages"><h2 id="dossier-messages">Échanges et compte rendu</h2>{detail.messages.length===0?<p className="muted">Aucun échange conservé.</p>:<ol className="message-list">{detail.messages.map(m=><li id={'message-'+m.id} key={m.id}><p className="eyebrow">{m.direction==='internal'?'Compte rendu interne':m.direction==='inbound'?'Message reçu':'Message sortant conservé'} · {time(m.occurred_at)} (Europe/Zurich)</p><strong>{m.author_observed}</strong><p className="message-body">{m.body}</p></li>)}</ol>}</section>
          <section aria-labelledby="dossier-history"><h2 id="dossier-history">Historique du dossier</h2><p>Demande créée le {time(detail.createdAt)} (Europe/Zurich){detail.actorName?' par '+detail.actorName:''}.</p><ol>{detail.events.map((e,i)=><li key={i}>{time(e.created_at)} · {stateLabels[e.from_state]??e.from_state} → {stateLabels[e.to_state]??e.to_state} · version {e.to_version}</li>)}</ol>{detail.truncated&&<div className="alert warning">L’historique affiché est limité aux 200 premiers éléments de chaque type.</div>}</section>
        </div>}
      </main>
      <dialog className="confirm-dialog" ref={dialog} aria-labelledby="discard-title" onCancel={e=>{if(busy)e.preventDefault();else setPending(null);}} onKeyDown={e=>{if(e.key!=='Tab')return;const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}>{pending&&<><p className="eyebrow">{active?.name}</p><h2 id="discard-title">Abandonner cette saisie ?</h2><p>{uncertain?'Une commande peut déjà avoir été enregistrée. Vous pourrez la vérifier en rouvrant une nouvelle saisie dans cette cave.':'Les informations non enregistrées seront effacées.'}</p><div className="dialog-actions"><button className="button secondary" autoFocus disabled={busy} onClick={()=>setPending(null)}>Rester sur la saisie</button><button className="button danger" disabled={busy} onClick={()=>pending.kind==='switch'?void changeCave(pending.id):abandon()}>{pending.kind==='switch'?'Abandonner et changer de cave':'Abandonner et revenir'}</button></div></>}</dialog>
    </div>
  </div>;
}
