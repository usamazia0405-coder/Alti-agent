import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const SB_URL = process.env.NEXT_PUBLIC_SB_URL || 'https://noknpaopqfqblxovzihi.supabase.co';
const SB_KEY = process.env.NEXT_PUBLIC_SB_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va25wYW9wcWZxYmx4b3Z6aWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDc4NjQsImV4cCI6MjA5NjE4Mzg2NH0.WFIrlzDvcifmfDRXXvO9MVemZAKi7nX3241fDVrUQpU';
const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || 'altifinans2026';

const C = {
  bg:'#05080f',surface:'#090e1a',surface2:'#0d1526',border:'#131f33',
  gold:'#c9a84c',goldLight:'#e8c96d',text:'#ddd5c8',muted:'#4a6080',
  green:'#3a9e6a',red:'#a84848',blue:'#2e6db8',amber:'#b87830'
};

// ── SUPABASE ──────────────────────────────────────────────────────────────────
const sb = async (path, method='GET', body=null, extra={}) => {
  const headers = {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':`Bearer ${SB_KEY}`,...extra};
  if(method==='POST') headers['Prefer']='return=representation';
  if(method==='PATCH') headers['Prefer']='return=minimal';
  let res;
  try { res = await fetch(`${SB_URL}/rest/v1/${path}`,{method,headers,body:body?JSON.stringify(body):undefined}); }
  catch(e){ throw new Error('Nettverksfeil: '+e.message); }
  if(!res.ok){ let t=''; try{t=await res.text();}catch{} throw new Error(`HTTP ${res.status}: ${t}`); }
  const t=await res.text(); return t?JSON.parse(t):[];
};

const uid = () => Math.random().toString(36).slice(2)+Date.now().toString(36);

// ── EXCEL PARSER ──────────────────────────────────────────────────────────────
async function parseExcel(file) {
  const XLSX = await import('xlsx');
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=(e)=>{
      try{
        const wb=XLSX.read(e.target.result,{type:'array'});
        const cells=[];
        wb.SheetNames.forEach(sn=>{
          XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:''})
            .forEach(row=>row.forEach(cell=>{if(cell!=='')cells.push({value:cell});}));
        });
        const kw={
          gjeldsgrad:['gjeldsgrad','gjeld/inntekt','gjeldsbelastning'],
          likviditet:['likviditet','likviditetsoverskudd','kontantstrøm'],
          ltv:['ltv','belåningsgrad','loan to value'],
        };
        const res={gjeldsgrad:null,likviditet:null,ltv:null,other:[]};
        for(let i=0;i<cells.length;i++){
          const cv=String(cells[i].value).toLowerCase().trim();
          for(const [key,terms] of Object.entries(kw)){
            if(!res[key]&&terms.some(t=>cv.includes(t))){
              for(let j=i+1;j<Math.min(i+6,cells.length);j++){
                const v=cells[j].value;
                if(v!==''&&(typeof v==='number'||!isNaN(parseFloat(String(v).replace(',','.').replace('%',''))))){
                  res[key]=typeof v==='number'?(v<=10?`${(v*100).toFixed(1)}%`:`${v}`):String(v);break;
                }
              }
            }
          }
        }
        const otherKw=['inntekt','gjeld','egenkapital','lånebehov','netto','brutto'];
        const seen=new Set();
        for(let i=0;i<cells.length-1;i++){
          const cv=String(cells[i].value).toLowerCase().trim();
          if(otherKw.some(k=>cv.includes(k))&&!seen.has(cv)){
            const nxt=cells[i+1];
            if(nxt?.value!==''&&(typeof nxt.value==='number'||!isNaN(parseFloat(String(nxt.value).replace(',','.'))))) {
              seen.add(cv);
              res.other.push({label:cells[i].value,value:typeof nxt.value==='number'?nxt.value.toLocaleString('no-NO'):nxt.value});
            }
          }
        }
        resolve(res);
      }catch(err){reject(err);}
    };
    reader.onerror=reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
function buildPrompt(banks,knowledge,examples,calcData,userName){
  const bankSec=banks.length>0?banks.map(b=>`### ${b.name}\n${b.guidelines}`).join('\n\n'):'Ingen banker registrert. Be admin legge inn bankretningslinjer.';
  const knowledgeSec=knowledge.length>0?knowledge.map(k=>`### ${k.title}\n${k.content}`).join('\n\n'):'Ingen løsningsstrategier lagt inn ennå.';
  const exSec=examples.length>0?'Disse sakene har fungert godt:\n\n'+examples.slice(0,8).map(ex=>`SAK: ${ex.summary}\nLØSNING: ${ex.solution||'ikke oppgitt'}\nBANK: ${ex.bank||'ikke oppgitt'}`).join('\n---\n'):'Ingen eksempelsaker ennå.';
  const calcSec=calcData?`Gjeldsgrad: ${calcData.gjeldsgrad??'ukjent'} | Likviditet: ${calcData.likviditet??'ukjent'} | LTV: ${calcData.ltv??'ukjent'}`+(calcData.other?.length?'\n'+calcData.other.map(o=>`${o.label}: ${o.value}`).join(' | '):''):'Ingen kalkulator lastet.';
  return `Du er ekspert finansrådgiver-assistent for Alti Finans (Finanstilsynet-lisensiert). Du hjelper rådgiver ${userName}.

## BANKRETNINGSLINJER
${bankSec}

## LØSNINGSSTRATEGIER OG KUNNSKAP
${knowledgeSec}

## KALKULATORRESULTATER (SIFO 2026, stresstest 3%)
${calcSec}

## EKSEMPELSAKER
${exSec}

Still strukturerte spørsmål om kunden – ett eller to av gangen. Dekk: navn, inntekt, gjeld, formål, sikkerhet, betalingsanmerkninger, sivilstatus, barn.
Bruk kalkulatortallene og match mot bankretningslinjene.

Når du har nok info, skriv "KLAR TIL UTFYLLING":
**CRM-NOTAT:**
[sammendrag]
**LÅNESØKNAD – BANKRAPPORT:**
[ferdig til bank]
**ANBEFALT BANK:** [navn]
**LØSNINGSSTRATEGI:** [kort beskrivelse]

Snakk alltid norsk. Vær direkte og profesjonell.`;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState('agent');
  const [banks,setBanks]=useState([]);
  const [knowledge,setKnowledge]=useState([]);
  const [examples,setExamples]=useState([]);
  const [calcData,setCalcData]=useState(null);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    try{ const s=localStorage.getItem('af-user'); if(s)setUser(JSON.parse(s)); }catch{}
    setReady(true);
  },[]);

  useEffect(()=>{ if(user)loadShared(); },[user]);

  const loadShared=async()=>{
    try{
      const [b,k,c]=await Promise.all([
        sb('af_banks?order=name'),
        sb('af_knowledge?order=title'),
        sb('af_cases?is_example=eq.true&order=created_at.desc&limit=20')
      ]);
      setBanks(b);setKnowledge(k);setExamples(c);
    }catch(e){console.error(e);}
  };

  const login=u=>{ setUser(u); try{localStorage.setItem('af-user',JSON.stringify(u));}catch{} };
  const logout=()=>{ setUser(null); try{localStorage.removeItem('af-user');}catch{} };

  if(!ready) return <Splash/>;
  if(!user) return <AuthScreen onLogin={login}/>;

  const tabs=[
    {id:'agent',label:'🤖 Agent'},
    {id:'cases',label:'📁 Saker'},
    {id:'banks',label:'🏦 Banker'},
    {id:'knowledge',label:'🧠 Kunnskap'},
    {id:'stats',label:'📈 Statistikk'},
  ];

  return(
    <>
    <Head><title>Alti Finans – Intelligence System</title></Head>
    <div style={{background:C.bg,minHeight:'100vh',fontFamily:"Georgia,'Times New Roman',serif",color:C.text,display:'flex',flexDirection:'column'}}>
      <div style={{borderBottom:`1px solid ${C.border}`,padding:'10px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',background:C.surface,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:30,height:30,borderRadius:'50%',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'bold',color:C.bg,fontSize:13}}>A</div>
          <div>
            <div style={{color:C.gold,fontWeight:'bold',fontSize:13,letterSpacing:'0.07em'}}>ALTI FINANS</div>
            <div style={{color:C.muted,fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase'}}>Intelligence System</div>
          </div>
        </div>
        <div style={{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center'}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background:tab===t.id?`linear-gradient(135deg,${C.gold},${C.goldLight})`:'transparent',
              border:`1px solid ${tab===t.id?C.gold:C.border}`,
              color:tab===t.id?C.bg:C.muted,
              padding:'4px 11px',borderRadius:4,cursor:'pointer',
              fontSize:10,fontFamily:'inherit',fontWeight:tab===t.id?'bold':'normal'
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:10,color:C.muted}}>{user.name}</span>
          {user.role==='admin'&&<span style={{fontSize:9,color:C.gold,border:`1px solid ${C.gold}55`,borderRadius:3,padding:'1px 5px'}}>ADMIN</span>}
          <button onClick={logout} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.muted,padding:'3px 9px',borderRadius:4,cursor:'pointer',fontSize:9,fontFamily:'inherit'}}>Logg ut</button>
        </div>
      </div>
      <div style={{flex:1,overflow:'hidden'}}>
        {tab==='agent'&&<AgentTab banks={banks} knowledge={knowledge} examples={examples} calcData={calcData} setCalcData={setCalcData} user={user} onCaseSaved={loadShared}/>}
        {tab==='cases'&&<CasesTab user={user} onToggle={loadShared}/>}
        {tab==='banks'&&<BanksTab banks={banks} user={user} onSave={async b=>{await sb('af_banks?id=eq.-1','DELETE');setBanks(b);}}/>}
        {tab==='knowledge'&&<KnowledgeTab knowledge={knowledge} user={user} onSave={async k=>{setKnowledge(k);}}/>}
        {tab==='stats'&&<StatsTab user={user}/>}
      </div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1a2d48;border-radius:2px}
        textarea,input{caret-color:#c9a84c}
      `}</style>
    </div>
    </>
  );
}

function Splash(){
  return(
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Georgia,serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:52,height:52,borderRadius:'50%',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'bold',color:C.bg,fontSize:22,margin:'0 auto 14px'}}>A</div>
        <div style={{color:C.gold,fontSize:14,letterSpacing:'0.1em'}}>Laster...</div>
      </div>
    </div>
  );
}

function AuthScreen({onLogin}){
  const [mode,setMode]=useState('login');
  const [form,setForm]=useState({name:'',email:'',password:'',adminCode:''});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  const submit=async()=>{
    setError('');setLoading(true);
    try{
      const users=await sb('af_users');
      if(mode==='login'){
        const found=users.find(u=>u.email===form.email.trim().toLowerCase()&&u.password===form.password);
        if(!found) throw new Error('Feil e-post eller passord');
        onLogin(found);
      } else {
        if(!form.name.trim()) throw new Error('Fyll inn navn');
        if(!form.email.trim()) throw new Error('Fyll inn e-post');
        if(form.password.length<4) throw new Error('Passord må være minst 4 tegn');
        if(users.find(u=>u.email===form.email.trim().toLowerCase())) throw new Error('E-post er allerede registrert');
        const role=form.adminCode.trim()===ADMIN_CODE?'admin':'advisor';
        const result=await sb('af_users','POST',{id:uid(),name:form.name.trim(),email:form.email.trim().toLowerCase(),password:form.password,role,created_at:new Date().toISOString()});
        const newUser=Array.isArray(result)?result[0]:result;
        if(!newUser?.id) throw new Error('Feil ved opprettelse – prøv igjen');
        onLogin(newUser);
      }
    }catch(e){setError(e.message);}
    setLoading(false);
  };

  return(
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Georgia,serif'}}>
      <div style={{width:400,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:36}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:50,height:50,borderRadius:'50%',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'bold',color:C.bg,fontSize:21,margin:'0 auto 12px'}}>A</div>
          <div style={{color:C.gold,fontWeight:'bold',fontSize:17,letterSpacing:'0.07em'}}>ALTI FINANS</div>
          <div style={{color:C.muted,fontSize:10,letterSpacing:'0.14em',textTransform:'uppercase',marginTop:3}}>Intelligence System</div>
        </div>
        <div style={{display:'flex',gap:4,marginBottom:22}}>
          {['login','register'].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setError('');}} style={{flex:1,background:mode===m?`linear-gradient(135deg,${C.gold},${C.goldLight})`:'transparent',border:`1px solid ${mode===m?C.gold:C.border}`,color:mode===m?C.bg:C.muted,padding:'7px',borderRadius:4,cursor:'pointer',fontSize:11,fontFamily:'inherit',fontWeight:mode===m?'bold':'normal'}}>
              {m==='login'?'Logg inn':'Registrer deg'}
            </button>
          ))}
        </div>
        {mode==='register'&&<Fld label="Fullt navn" value={form.name} set={v=>setForm(f=>({...f,name:v}))} placeholder="Ola Nordmann"/>}
        <Fld label="E-post" value={form.email} set={v=>setForm(f=>({...f,email:v}))} placeholder="ola@altifinans.no" type="email"/>
        <Fld label="Passord" value={form.password} set={v=>setForm(f=>({...f,password:v}))} placeholder="••••••••" type="password"/>
        {mode==='register'&&<Fld label="Admin-kode (valgfritt)" value={form.adminCode} set={v=>setForm(f=>({...f,adminCode:v}))} placeholder="Kun for administratorer" type="password"/>}
        {error&&<div style={{fontSize:12,marginBottom:12,padding:'8px 12px',background:`${C.red}18`,border:`1px solid ${C.red}44`,borderRadius:4,color:'#e08080'}}>{error}</div>}
        <button onClick={submit} disabled={loading} style={{width:'100%',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,border:'none',color:C.bg,padding:'11px',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:'bold',fontFamily:'inherit',marginBottom:12}}>
          {loading?'Vennligst vent...':mode==='login'?'Logg inn':'Opprett konto'}
        </button>
        <div style={{padding:'11px 14px',background:`${C.gold}10`,border:`1px solid ${C.gold}33`,borderRadius:6,fontSize:11,color:C.muted,lineHeight:1.7}}>
          <strong style={{color:C.gold}}>Admin-kode:</strong> <span style={{color:C.text}}>{ADMIN_CODE}</span> – gir full tilgang til å administrere systemet.
        </div>
      </div>
    </div>
  );
}

function Fld({label,value,set,placeholder,type='text'}){
  return(
    <div style={{marginBottom:14}}>
      <label style={{display:'block',fontSize:10,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:5}}>{label}</label>
      <input type={type} value={value} onChange={e=>set(e.target.value)} placeholder={placeholder}
        style={{width:'100%',background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:'9px 12px',color:C.text,fontSize:13,fontFamily:'inherit',outline:'none'}}/>
    </div>
  );
}

function AgentTab({banks,knowledge,examples,calcData,setCalcData,user,onCaseSaved}){
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState('');
  const [loading,setLoading]=useState(false);
  const [phase,setPhase]=useState('idle');
  const [crm,setCrm]=useState('');
  const [loan,setLoan]=useState('');
  const [recBank,setRecBank]=useState('');
  const [recStrat,setRecStrat]=useState('');
  const [xlLoading,setXlLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);
  const fileRef=useRef(null);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'});},[msgs,loading]);

  const handleXl=async(e)=>{
    const file=e.target.files[0];if(!file)return;
    setXlLoading(true);
    try{setCalcData(await parseExcel(file));}catch{alert('Kunne ikke lese Excel-filen.');}
    setXlLoading(false);e.target.value='';
  };

  const start=()=>{
    setPhase('chat');
    setMsgs([{role:'assistant',content:`Hei ${user.name}! Klar til ny sak. Fortell meg om kunden – navn og hva de trenger hjelp med.`}]);
    setTimeout(()=>inputRef.current?.focus(),100);
  };

  const send=async()=>{
    if(!input.trim()||loading)return;
    const txt=input.trim();setInput('');
    const newMsgs=[...msgs,{role:'user',content:txt}];
    setMsgs(newMsgs);setLoading(true);
    try{
      const res=await fetch('/api/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({system:buildPrompt(banks,knowledge,examples,calcData,user.name),messages:newMsgs})
      });
      const data=await res.json();
      const reply=data.content?.[0]?.text||'Noe gikk galt.';
      setMsgs(prev=>[...prev,{role:'assistant',content:reply}]);
      if(reply.includes('KLAR TIL UTFYLLING')){
        const crmM=reply.match(/\*\*CRM-NOTAT:\*\*([\s\S]*?)(?=\*\*LÅNESØKNAD|$)/);
        const loanM=reply.match(/\*\*LÅNESØKNAD[\s\S]*?:\*\*([\s\S]*?)(?=\*\*ANBEFALT|$)/);
        const bankM=reply.match(/\*\*ANBEFALT BANK:\*\*\s*(.+)/);
        const stratM=reply.match(/\*\*LØSNINGSSTRATEGI:\*\*\s*(.+)/);
        if(crmM)setCrm(crmM[1].trim());
        if(loanM)setLoan(loanM[1].trim());
        if(bankM)setRecBank(bankM[1].trim());
        if(stratM)setRecStrat(stratM[1].trim());
        setPhase('done');
      }
    }catch{setMsgs(prev=>[...prev,{role:'assistant',content:'Tilkoblingsfeil. Prøv igjen.'}]);}
    setLoading(false);
  };

  const saveCase=async(asEx)=>{
    setSaving(true);
    const summary=msgs.find(m=>m.role==='user')?.content?.slice(0,150)||'Ukjent';
    try{
      await sb('af_cases','POST',{id:uid(),advisor_id:user.id,advisor_name:user.name,summary,solution:recStrat,bank:recBank,outcome:'Sendt til bank',crm_note:crm,loan_app:loan,is_example:asEx,created_at:new Date().toISOString()});
      setSaved(true);onCaseSaved();
    }catch(e){alert('Kunne ikke lagre: '+e.message);}
    setSaving(false);
  };

  const reset=()=>{setMsgs([]);setInput('');setPhase('idle');setCrm('');setLoan('');setRecBank('');setRecStrat('');setSaved(false);};
  const H='calc(100vh - 54px)';

  return(
    <div style={{height:H,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'6px 18px',borderBottom:`1px solid ${C.border}`,background:C.surface,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',flexShrink:0}}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleXl} style={{display:'none'}}/>
        <button onClick={()=>fileRef.current.click()} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.muted,padding:'3px 10px',borderRadius:4,cursor:'pointer',fontSize:10,fontFamily:'inherit'}}>
          {xlLoading?'⏳ Leser...':'📊 Last opp kalkulator'}
        </button>
        {calcData&&(
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            {[{l:'Gjeldsgrad',v:calcData.gjeldsgrad,w:parseFloat(calcData.gjeldsgrad)>500},{l:'Likviditet',v:calcData.likviditet,w:false},{l:'LTV',v:calcData.ltv,w:parseFloat(calcData.ltv)>85}].filter(x=>x.v).map(x=>(
              <span key={x.l} style={{background:x.w?`${C.red}20`:`${C.green}20`,border:`1px solid ${x.w?C.red:C.green}44`,borderRadius:4,padding:'2px 8px',fontSize:10,color:x.w?'#e07070':'#5ebd8e'}}>{x.l}: <strong>{x.v}</strong></span>
            ))}
            <button onClick={()=>setCalcData(null)} style={{background:'transparent',border:'none',color:C.muted,cursor:'pointer',fontSize:13}}>✕</button>
          </div>
        )}
        <div style={{marginLeft:'auto',fontSize:9,color:C.muted}}>{banks.length} banker · {knowledge.length} artikler · {examples.length} eksempler</div>
      </div>
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        <div style={{flex:phase==='done'?'0 0 44%':1,display:'flex',flexDirection:'column',borderRight:phase==='done'?`1px solid ${C.border}`:'none',transition:'flex 0.3s'}}>
          {phase==='idle'?(
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:40,textAlign:'center'}}>
              <div style={{fontSize:46,marginBottom:16}}>💼</div>
              <h2 style={{color:C.gold,fontWeight:'normal',fontSize:19,marginBottom:10}}>Klar til ny kundesak</h2>
              <p style={{color:C.muted,fontSize:12,maxWidth:290,lineHeight:1.9,marginBottom:8}}>
                {banks.length===0?'⚠️ Legg inn banker i Banker-fanen.':`${banks.length} banker og ${knowledge.length} løsningsstrategier lastet.`}
              </p>
              <p style={{color:C.muted,fontSize:11,marginBottom:24}}>{calcData?'✓ Kalkulator klar':'Tips: last opp Excel-kalkulator øverst'}</p>
              <button onClick={start} style={{background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,border:'none',color:C.bg,padding:'11px 32px',borderRadius:4,cursor:'pointer',fontSize:13,fontWeight:'bold',fontFamily:'inherit'}}>Start samtale</button>
            </div>
          ):(
            <>
              <div style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:11}}>
                {msgs.map((m,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start',animation:'fadeUp 0.2s ease'}}>
                    {m.role==='assistant'&&<div style={{width:22,height:22,borderRadius:'50%',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:C.bg,fontWeight:'bold',flexShrink:0,marginRight:7,marginTop:2}}>A</div>}
                    <div style={{maxWidth:'80%',background:m.role==='user'?'linear-gradient(135deg,#122040,#0c1830)':'linear-gradient(135deg,#0d1520,#080e18)',border:`1px solid ${m.role==='user'?'#1e3060':C.border}`,borderRadius:m.role==='user'?'12px 12px 3px 12px':'12px 12px 12px 3px',padding:'8px 12px',fontSize:12,lineHeight:1.7,color:C.text}}
                      dangerouslySetInnerHTML={{__html:m.content.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br/>')}}/>
                  </div>
                ))}
                {loading&&(
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <div style={{width:22,height:22,borderRadius:'50%',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:C.bg,fontWeight:'bold'}}>A</div>
                    <div style={{display:'flex',gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:'50%',background:C.gold,animation:`pulse 1.2s ${i*0.2}s infinite`}}/>)}</div>
                  </div>
                )}
                <div ref={bottomRef}/>
              </div>
              <div style={{padding:'10px 14px',borderTop:`1px solid ${C.border}`,display:'flex',gap:7,alignItems:'flex-end',flexShrink:0}}>
                {phase==='done'?(
                  <div style={{flex:1,display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}>
                    <span style={{fontSize:11,color:C.green}}>✅ Sak fullført</span>
                    {!saved&&(
                      <>
                        <button onClick={()=>saveCase(false)} disabled={saving} style={{background:`${C.blue}30`,border:`1px solid ${C.blue}55`,color:'#6a9de0',padding:'5px 11px',borderRadius:4,cursor:'pointer',fontSize:10,fontFamily:'inherit'}}>{saving?'...':'💾 Lagre sak'}</button>
                        <button onClick={()=>saveCase(true)} disabled={saving} style={{background:`${C.gold}20`,border:`1px solid ${C.gold}55`,color:C.gold,padding:'5px 11px',borderRadius:4,cursor:'pointer',fontSize:10,fontFamily:'inherit'}}>⭐ Lagre som eksempel</button>
                      </>
                    )}
                    {saved&&<span style={{fontSize:10,color:C.gold}}>✓ Lagret – agenten lærer av denne saken</span>}
                  </div>
                ):(
                  <>
                    <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
                      placeholder="Skriv her... (Enter sender)" rows={2}
                      style={{flex:1,background:'#070c14',border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 10px',color:C.text,fontSize:12,resize:'none',fontFamily:'inherit',lineHeight:1.5,outline:'none'}}/>
                    <button onClick={send} disabled={loading||!input.trim()} style={{background:input.trim()?`linear-gradient(135deg,${C.gold},${C.goldLight})`:C.border,border:'none',borderRadius:6,padding:'7px 13px',cursor:input.trim()?'pointer':'default',color:input.trim()?C.bg:C.muted,fontSize:15,fontWeight:'bold'}}>↑</button>
                  </>
                )}
                <button onClick={reset} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.muted,padding:'7px 10px',borderRadius:6,cursor:'pointer',fontSize:9,fontFamily:'inherit'}}>Ny sak</button>
              </div>
            </>
          )}
        </div>
        {phase==='done'&&(
          <div style={{flex:'0 0 56%',overflowY:'auto',padding:16,display:'flex',flexDirection:'column',gap:12}}>
            {recBank&&(
              <div style={{background:`${C.gold}12`,border:`1px solid ${C.gold}44`,borderRadius:8,padding:'11px 14px',display:'flex',gap:16,flexWrap:'wrap'}}>
                <div><div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.1em'}}>Anbefalt bank</div><div style={{color:C.gold,fontWeight:'bold',fontSize:15,marginTop:2}}>{recBank}</div></div>
                {recStrat&&<div style={{flex:1}}><div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.1em'}}>Løsningsstrategi</div><div style={{color:C.text,fontSize:12,marginTop:2}}>{recStrat}</div></div>}
              </div>
            )}
            <OutCard title="CRM-NOTAT" icon="🗂️" content={crm} accent={C.green}/>
            <OutCard title="LÅNESØKNAD – BANKRAPPORT" icon="📄" content={loan} accent={C.gold}/>
          </div>
        )}
      </div>
    </div>
  );
}

function CasesTab({user,onToggle}){
  const [cases,setCases]=useState([]);
  const [sel,setSel]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const filter=user.role==='admin'?'':'advisor_id=eq.'+user.id+'&';
    sb(`af_cases?${filter}order=created_at.desc`).then(c=>{setCases(c);setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  const toggleEx=async(c)=>{
    await sb(`af_cases?id=eq.${c.id}`,'PATCH',{is_example:!c.is_example});
    setCases(prev=>prev.map(x=>x.id===c.id?{...x,is_example:!x.is_example}:x));
    setSel(s=>s?.id===c.id?{...s,is_example:!s.is_example}:s);
    onToggle();
  };

  if(loading)return<Loader/>;
  return(
    <div style={{height:'calc(100vh - 54px)',display:'flex'}}>
      <div style={{width:280,borderRight:`1px solid ${C.border}`,overflowY:'auto',background:C.surface,flexShrink:0}}>
        <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.border}`,fontSize:10,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase'}}>{cases.length} saker {user.role==='admin'?'· alle rådgivere':''}</div>
        {cases.length===0&&<div style={{padding:20,textAlign:'center',color:C.muted,fontSize:12,lineHeight:1.7}}>Ingen saker ennå.<br/>Fullfør en sak i Agent-fanen.</div>}
        {cases.map(c=>(
          <div key={c.id} onClick={()=>setSel(c)} style={{padding:'10px 14px',borderBottom:`1px solid ${C.border}`,cursor:'pointer',background:sel?.id===c.id?`${C.gold}10`:'transparent',borderLeft:`3px solid ${c.is_example?C.gold:'transparent'}`}}>
            <div style={{fontSize:11,color:sel?.id===c.id?C.gold:C.text,marginBottom:3,lineHeight:1.4}}>{(c.summary||'Ukjent').slice(0,55)}...</div>
            <div style={{display:'flex',gap:5,alignItems:'center'}}>
              {c.bank&&<span style={{fontSize:9,color:C.blue}}>🏦 {c.bank}</span>}
              {c.is_example&&<span style={{fontSize:9,color:C.gold}}>⭐</span>}
              <span style={{fontSize:9,color:C.muted,marginLeft:'auto'}}>{new Date(c.created_at).toLocaleDateString('no-NO')}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{flex:1,overflowY:'auto',padding:24}}>
        {!sel?<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:C.muted,fontSize:13}}>Velg en sak fra listen</div>:(
          <div style={{maxWidth:640}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <h3 style={{color:C.gold,fontWeight:'normal',fontSize:15,margin:0}}>Saksdetaljer</h3>
              <button onClick={()=>toggleEx(sel)} style={{background:sel.is_example?`${C.gold}22`:'transparent',border:`1px solid ${sel.is_example?C.gold:C.border}`,color:sel.is_example?C.gold:C.muted,padding:'5px 12px',borderRadius:4,cursor:'pointer',fontSize:10,fontFamily:'inherit'}}>
                {sel.is_example?'⭐ Fjern eksempel':'☆ Merk som eksempel'}
              </button>
            </div>
            {sel.bank&&<IRow label="Anbefalt bank" value={sel.bank}/>}
            {sel.solution&&<IRow label="Løsningsstrategi" value={sel.solution}/>}
            {user.role==='admin'&&sel.advisor_name&&<IRow label="Rådgiver" value={sel.advisor_name}/>}
            <IRow label="Dato" value={new Date(sel.created_at).toLocaleString('no-NO')}/>
            {sel.crm_note&&<DocBlock title="CRM-NOTAT" content={sel.crm_note} accent={C.green}/>}
            {sel.loan_app&&<DocBlock title="LÅNESØKNAD" content={sel.loan_app} accent={C.gold}/>}
          </div>
        )}
      </div>
    </div>
  );
}

function BanksTab({banks,user,onSave}){
  const [sel,setSel]=useState(null);
  const [form,setForm]=useState({name:'',guidelines:''});
  const [saving,setSaving]=useState(false);
  const isAdmin=user.role==='admin';

  const save=async()=>{
    if(!form.name.trim()||!form.guidelines.trim())return;
    setSaving(true);
    try{
      if(sel==='new'){
        await sb('af_banks','POST',{id:uid(),name:form.name.trim(),guidelines:form.guidelines.trim(),created_by:user.id,updated_at:new Date().toISOString()});
      } else {
        await sb(`af_banks?id=eq.${sel}`,'PATCH',{name:form.name.trim(),guidelines:form.guidelines.trim(),updated_at:new Date().toISOString()});
      }
      const b=await sb('af_banks?order=name');
      onSave(b);setSel(null);setForm({name:'',guidelines:''});
    }catch(e){alert(e.message);}
    setSaving(false);
  };

  const remove=async(id)=>{
    if(!confirm('Slett denne banken?'))return;
    await sb(`af_banks?id=eq.${id}`,'DELETE');
    const b=await sb('af_banks?order=name');onSave(b);
    if(sel===id)setSel(null);
  };

  return(
    <div style={{height:'calc(100vh - 54px)',display:'flex'}}>
      <div style={{width:250,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',background:C.surface,flexShrink:0}}>
        <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:10,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase'}}>Banker ({banks.length})</span>
          {isAdmin&&<button onClick={()=>{setSel('new');setForm({name:'',guidelines:''});}} style={{background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,border:'none',color:C.bg,padding:'3px 10px',borderRadius:4,cursor:'pointer',fontSize:10,fontWeight:'bold',fontFamily:'inherit'}}>+ Ny</button>}
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {banks.length===0&&<div style={{padding:18,textAlign:'center',color:C.muted,fontSize:11,lineHeight:1.8}}>{isAdmin?'Klikk + Ny for å legge inn banker.':'Admin legger inn banker.'}</div>}
          {banks.map(b=>(
            <div key={b.id} onClick={()=>{setSel(b.id);setForm({name:b.name,guidelines:b.guidelines});}}
              style={{padding:'10px 13px',borderBottom:`1px solid ${C.border}`,cursor:'pointer',background:sel===b.id?`${C.gold}12`:'transparent',borderLeft:`3px solid ${sel===b.id?C.gold:'transparent'}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:sel===b.id?C.gold:C.text}}>{b.name}</span>
                {isAdmin&&<button onClick={e=>{e.stopPropagation();remove(b.id);}} style={{background:'transparent',border:'none',color:C.muted,cursor:'pointer',fontSize:12}} onMouseOver={e=>e.target.style.color=C.red} onMouseOut={e=>e.target.style.color=C.muted}>✕</button>}
              </div>
              <div style={{fontSize:9,color:C.muted,marginTop:2}}>{b.guidelines.slice(0,45)}...</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{flex:1,padding:26,overflowY:'auto'}}>
        {!sel?(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:12}}>🏦</div>
            <h3 style={{color:C.gold,fontWeight:'normal',marginBottom:8}}>Bankretningslinjer</h3>
            <p style={{color:C.muted,fontSize:12,maxWidth:320,lineHeight:1.85}}>Legg inn retningslinjer for hver bank. Jo mer detaljert, jo bedre matcher agenten.</p>
            <p style={{color:C.muted,fontSize:11,marginTop:10}}>Tips: maks gjeldsgrad, LTV, betalingsanmerkninger, produkter, aldersgrenser, min/maks lån.</p>
          </div>
        ):(
          <div style={{maxWidth:600}}>
            <h3 style={{color:C.gold,fontWeight:'normal',fontSize:16,marginBottom:20}}>{sel==='new'?'Ny bank':`Rediger: ${form.name}`}</h3>
            <Fld label="Banknavn" value={form.name} set={v=>setForm(f=>({...f,name:v}))} placeholder="f.eks. Monobank, Bank Norwegian"/>
            <label style={{display:'block',fontSize:10,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:5}}>Retningslinjer (fritekst)</label>
            <textarea value={form.guidelines} onChange={e=>setForm(f=>({...f,guidelines:e.target.value}))} rows={14} disabled={!isAdmin}
              placeholder={"Maks gjeldsgrad: 500%\nMaks LTV: 85%\nAksepterer betalingsanmerkninger: Nei\nProdukter: Refinansiering uten sikkerhet\nMaks lån: 600 000 kr\nMin inntekt: 250 000 kr\nAlder: 23–70 år\n\nSpesielle betingelser..."}
              style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:'10px 12px',color:C.text,fontSize:12,fontFamily:'inherit',lineHeight:1.75,resize:'vertical',outline:'none',opacity:isAdmin?1:0.65}}/>
            {isAdmin&&(
              <div style={{display:'flex',gap:9,marginTop:14}}>
                <button onClick={save} disabled={saving} style={{background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,border:'none',color:C.bg,padding:'9px 24px',borderRadius:4,cursor:'pointer',fontSize:12,fontWeight:'bold',fontFamily:'inherit'}}>{saving?'Lagrer...':'💾 Lagre'}</button>
                <button onClick={()=>{setSel(null);setForm({name:'',guidelines:''});}} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.muted,padding:'9px 16px',borderRadius:4,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Avbryt</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgeTab({knowledge,user,onSave}){
  const [sel,setSel]=useState(null);
  const [form,setForm]=useState({title:'',content:''});
  const [saving,setSaving]=useState(false);
  const isAdmin=user.role==='admin';

  const save=async()=>{
    if(!form.title.trim()||!form.content.trim())return;
    setSaving(true);
    try{
      if(sel==='new'){
        await sb('af_knowledge','POST',{id:uid(),title:form.title.trim(),content:form.content.trim(),created_by:user.id,updated_at:new Date().toISOString()});
      } else {
        await sb(`af_knowledge?id=eq.${sel}`,'PATCH',{title:form.title.trim(),content:form.content.trim(),updated_at:new Date().toISOString()});
      }
      const k=await sb('af_knowledge?order=title');
      onSave(k);setSel(null);setForm({title:'',content:''});
    }catch(e){alert(e.message);}
    setSaving(false);
  };

  const remove=async(id)=>{
    if(!confirm('Slett?'))return;
    await sb(`af_knowledge?id=eq.${id}`,'DELETE');
    const k=await sb('af_knowledge?order=title');onSave(k);
    if(sel===id)setSel(null);
  };

  return(
    <div style={{height:'calc(100vh - 54px)',display:'flex'}}>
      <div style={{width:250,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',background:C.surface,flexShrink:0}}>
        <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:10,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase'}}>Kunnskap ({knowledge.length})</span>
          {isAdmin&&<button onClick={()=>{setSel('new');setForm({title:'',content:''});}} style={{background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,border:'none',color:C.bg,padding:'3px 10px',borderRadius:4,cursor:'pointer',fontSize:10,fontWeight:'bold',fontFamily:'inherit'}}>+ Ny</button>}
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {knowledge.length===0&&<div style={{padding:18,textAlign:'center',color:C.muted,fontSize:11,lineHeight:1.8}}>{isAdmin?'Legg inn løsningsstrategier og produktkunnskap.':'Admin legger inn kunnskap.'}</div>}
          {knowledge.map(k=>(
            <div key={k.id} onClick={()=>{setSel(k.id);setForm({title:k.title,content:k.content});}}
              style={{padding:'10px 13px',borderBottom:`1px solid ${C.border}`,cursor:'pointer',background:sel===k.id?`${C.gold}12`:'transparent',borderLeft:`3px solid ${sel===k.id?C.gold:'transparent'}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:11,color:sel===k.id?C.gold:C.text}}>{k.title}</span>
                {isAdmin&&<button onClick={e=>{e.stopPropagation();remove(k.id);}} style={{background:'transparent',border:'none',color:C.muted,cursor:'pointer',fontSize:12}} onMouseOver={e=>e.target.style.color=C.red} onMouseOut={e=>e.target.style.color=C.muted}>✕</button>}
              </div>
              <div style={{fontSize:9,color:C.muted,marginTop:2}}>{k.content.slice(0,45)}...</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{flex:1,padding:26,overflowY:'auto'}}>
        {!sel?(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:12}}>🧠</div>
            <h3 style={{color:C.gold,fontWeight:'normal',marginBottom:8}}>Kunnskapsbase</h3>
            <p style={{color:C.muted,fontSize:12,maxWidth:340,lineHeight:1.85}}>Jo mer du lærer agenten, jo bedre råd gir den rådgiverne dine.</p>
            <div style={{marginTop:16,textAlign:'left',background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:'14px 18px',maxWidth:340}}>
              <div style={{fontSize:10,color:C.gold,fontWeight:'bold',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.1em'}}>Eksempler på artikler</div>
              {['Omstartslån – krav og strategi','Refinansiering med kausjonist','Betalingsanmerkninger – løsninger','Sikkerhet i eiendom – fremgangsmåte','Selvstendige næringsdrivende – dokumentasjon'].map(t=>(
                <div key={t} style={{fontSize:11,color:C.muted,padding:'4px 0',borderBottom:`1px solid ${C.border}`}}>→ {t}</div>
              ))}
            </div>
          </div>
        ):(
          <div style={{maxWidth:600}}>
            <h3 style={{color:C.gold,fontWeight:'normal',fontSize:16,marginBottom:20}}>{sel==='new'?'Ny kunnskapsartikkel':`Rediger: ${form.title}`}</h3>
            <Fld label="Tittel" value={form.title} set={v=>setForm(f=>({...f,title:v}))} placeholder="f.eks. Omstartslån – krav og strategi"/>
            <label style={{display:'block',fontSize:10,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:5}}>Innhold</label>
            <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={16} disabled={!isAdmin}
              placeholder={"Beskriv løsningsstrategi, krav, erfaringer og tips..."}
              style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:'10px 12px',color:C.text,fontSize:12,fontFamily:'inherit',lineHeight:1.75,resize:'vertical',outline:'none',opacity:isAdmin?1:0.65}}/>
            {isAdmin&&(
              <div style={{display:'flex',gap:9,marginTop:14}}>
                <button onClick={save} disabled={saving} style={{background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,border:'none',color:C.bg,padding:'9px 24px',borderRadius:4,cursor:'pointer',fontSize:12,fontWeight:'bold',fontFamily:'inherit'}}>{saving?'Lagrer...':'💾 Lagre'}</button>
                <button onClick={()=>{setSel(null);setForm({title:'',content:''});}} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.muted,padding:'9px 16px',borderRadius:4,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Avbryt</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsTab({user}){
  const [cases,setCases]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{sb('af_cases?order=created_at.desc').then(c=>{setCases(c);setLoading(false);}).catch(()=>setLoading(false));},[]);
  if(loading)return<Loader/>;
  const total=cases.length;
  const exCount=cases.filter(c=>c.is_example).length;
  const thisMonth=cases.filter(c=>new Date(c.created_at).getMonth()===new Date().getMonth()).length;
  const bankMap=cases.reduce((a,c)=>{if(c.bank)a[c.bank]=(a[c.bank]||0)+1;return a;},{});
  const advMap=cases.reduce((a,c)=>{if(c.advisor_name)a[c.advisor_name]=(a[c.advisor_name]||0)+1;return a;},{});
  return(
    <div style={{padding:26,overflowY:'auto',height:'calc(100vh - 54px)'}}>
      <h2 style={{color:C.gold,fontWeight:'normal',fontSize:17,marginBottom:22}}>Statistikk</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:26}}>
        {[{l:'Totale saker',v:total,c:C.blue},{l:'Denne måneden',v:thisMonth,c:C.green},{l:'Eksempelsaker',v:exCount,c:C.gold},{l:'Banker brukt',v:Object.keys(bankMap).length,c:C.amber}].map(s=>(
          <div key={s.l} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:'15px 17px'}}>
            <div style={{fontSize:28,fontWeight:'bold',color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:'0.1em',marginTop:4}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <BChart title="Saker per bank" data={bankMap} color={C.gold}/>
        <BChart title="Saker per rådgiver" data={advMap} color={C.blue}/>
      </div>
      {exCount>0&&(
        <div style={{marginTop:16,background:`${C.gold}10`,border:`1px solid ${C.gold}33`,borderRadius:8,padding:'12px 16px'}}>
          <div style={{fontSize:10,color:C.gold,fontWeight:'bold',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>🧠 Agentens læring</div>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.7}}>Agenten bruker {exCount} eksempelsak{exCount!==1?'er':''} som referanse. Merk flere saker med ⭐ for å gjøre agenten enda bedre over tid.</div>
        </div>
      )}
    </div>
  );
}

function BChart({title,data,color}){
  const entries=Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const max=Math.max(...entries.map(e=>e[1]),1);
  return(
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:18}}>
      <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14}}>{title}</div>
      {entries.length===0?<div style={{color:C.muted,fontSize:12}}>Ingen data ennå</div>:
        entries.map(([name,count])=>(
          <div key={name} style={{display:'flex',alignItems:'center',gap:9,marginBottom:10}}>
            <div style={{fontSize:11,color:C.text,width:110,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</div>
            <div style={{flex:1,background:C.bg,borderRadius:3,height:5}}>
              <div style={{width:`${(count/max)*100}%`,background:`linear-gradient(90deg,${color},${color}99)`,height:'100%',borderRadius:3}}/>
            </div>
            <div style={{fontSize:10,color,width:18,textAlign:'right',fontWeight:'bold'}}>{count}</div>
          </div>
        ))}
    </div>
  );
}

function Loader(){return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'calc(100vh - 54px)',color:C.muted,fontSize:13}}>Laster...</div>;}
function IRow({label,value}){return(<div style={{marginBottom:10,background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 13px'}}><div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>{label}</div><div style={{fontSize:12,color:C.text}}>{value}</div></div>);}
function DocBlock({title,content,accent}){
  const [cp,setCp]=useState(false);
  return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden',marginBottom:12}}><div style={{padding:'8px 13px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:9,color:accent,fontWeight:'bold',textTransform:'uppercase',letterSpacing:'0.12em'}}>{title}</span><button onClick={()=>{navigator.clipboard.writeText(content);setCp(true);setTimeout(()=>setCp(false),2000);}} style={{background:'transparent',border:`1px solid ${C.border}`,color:cp?accent:C.muted,padding:'2px 9px',borderRadius:4,cursor:'pointer',fontSize:9,fontFamily:'inherit'}}>{cp?'✓':'Kopier'}</button></div><div style={{padding:'11px 13px',fontSize:11,lineHeight:1.8,color:'#b8b0a8',whiteSpace:'pre-wrap',fontFamily:"'Courier New',monospace"}}>{content}</div></div>);
}
function OutCard({title,icon,content,accent}){
  const [cp,setCp]=useState(false);
  return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden'}}><div style={{padding:'9px 14px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{display:'flex',gap:6,alignItems:'center'}}><span>{icon}</span><span style={{fontSize:9,color:accent,fontWeight:'bold',textTransform:'uppercase',letterSpacing:'0.13em'}}>{title}</span></div><button onClick={()=>{navigator.clipboard.writeText(content);setCp(true);setTimeout(()=>setCp(false),2000);}} style={{background:'transparent',border:`1px solid ${C.border}`,color:cp?accent:C.muted,padding:'3px 9px',borderRadius:4,cursor:'pointer',fontSize:9,fontFamily:'inherit'}}>{cp?'✓ Kopiert':'Kopier'}</button></div><div style={{padding:'12px 14px',fontSize:11,lineHeight:1.8,color:'#b8b0a8',whiteSpace:'pre-wrap',fontFamily:"'Courier New',monospace"}}>{content||'Genererer...'}</div></div>);
}
