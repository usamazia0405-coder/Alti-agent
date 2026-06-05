import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const SB_URL = process.env.NEXT_PUBLIC_SB_URL || 'https://noknpaopqfqblxovzihi.supabase.co';
const SB_KEY = process.env.NEXT_PUBLIC_SB_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va25wYW9wcWZxYmx4b3Z6aWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDc4NjQsImV4cCI6MjA5NjE4Mzg2NH0.WFIrlzDvcifmfDRXXvO9MVemZAKi7nX3241fDVrUQpU';
const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || 'altifinans2026';

const C = {
  bg: '#05080f',
  surface: '#090e1a',
  border: '#131f33',
  gold: '#c9a84c',
  goldL: '#e8c96d',
  text: '#ddd5c8',
  muted: '#4a6080',
  green: '#3a9e6a',
  red: '#a84848',
  blue: '#2e6db8',
};

const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });

async function sb(path, method, body, extra) {
  method = method || 'GET';
  extra = extra || {};
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
  };
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  if (method === 'PATCH') headers['Prefer'] = 'return=minimal';
  Object.assign(headers, extra);
  let res;
  try {
    res = await fetch(SB_URL + '/rest/v1/' + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Nettverksfeil: ' + e.message);
  }
  if (!res.ok) {
    let t = '';
    try { t = await res.text(); } catch (e2) {}
    throw new Error('HTTP ' + res.status + ': ' + t);
  }
  const t = await res.text();
  return t ? JSON.parse(t) : [];
}

async function parseExcel(file) {
  const XLSX = await import('xlsx');
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const cells = [];
        wb.SheetNames.forEach(function(sn) {
          XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' })
            .forEach(function(row) {
              row.forEach(function(cell) {
                if (cell !== '') cells.push({ value: cell });
              });
            });
        });
        const kw = {
          gjeldsgrad: ['gjeldsgrad', 'gjeld/inntekt', 'gjeldsbelastning'],
          likviditet: ['likviditet', 'likviditetsoverskudd', 'kontantstrom'],
          ltv: ['ltv', 'belaningsgrad', 'loan to value'],
        };
        const result = { gjeldsgrad: null, likviditet: null, ltv: null, other: [] };
        for (let i = 0; i < cells.length; i++) {
          const cv = String(cells[i].value).toLowerCase().trim();
          for (const key in kw) {
            if (!result[key] && kw[key].some(function(t) { return cv.indexOf(t) >= 0; })) {
              for (let j = i + 1; j < Math.min(i + 6, cells.length); j++) {
                const v = cells[j].value;
                if (v !== '' && (typeof v === 'number' || !isNaN(parseFloat(String(v).replace(',', '.').replace('%', ''))))) {
                  result[key] = typeof v === 'number' ? (v <= 10 ? (v * 100).toFixed(1) + '%' : String(v)) : String(v);
                  break;
                }
              }
            }
          }
        }
        const otherKw = ['inntekt', 'gjeld', 'egenkapital', 'laanebehov', 'netto', 'brutto'];
        const seen = {};
        for (let i = 0; i < cells.length - 1; i++) {
          const cv = String(cells[i].value).toLowerCase().trim();
          if (otherKw.some(function(k) { return cv.indexOf(k) >= 0; }) && !seen[cv]) {
            const nxt = cells[i + 1];
            if (nxt && nxt.value !== '' && (typeof nxt.value === 'number' || !isNaN(parseFloat(String(nxt.value).replace(',', '.'))))) {
              seen[cv] = true;
              result.other.push({ label: String(cells[i].value), value: typeof nxt.value === 'number' ? nxt.value.toLocaleString('no-NO') : String(nxt.value) });
            }
          }
        }
        resolve(result);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function buildPrompt(banks, knowledge, examples, calc, userName) {
  const bankSec = banks.length > 0
    ? banks.map(function(b) { return '### ' + b.name + '\n' + b.guidelines; }).join('\n\n')
    : 'Ingen banker registrert enna.';
  const knowledgeSec = knowledge.length > 0
    ? knowledge.map(function(k) { return '### ' + k.title + '\n' + k.content; }).join('\n\n')
    : 'Ingen losningsstrategier lagt inn enna.';
  const exSec = examples.length > 0
    ? 'Disse sakene har fungert godt:\n\n' + examples.slice(0, 8).map(function(ex) {
        return 'SAK: ' + ex.summary + '\nLOSNING: ' + (ex.solution || 'ikke oppgitt') + '\nBANK: ' + (ex.bank || 'ikke oppgitt');
      }).join('\n---\n')
    : 'Ingen eksempelsaker enna.';
  const calcSec = calc
    ? 'Gjeldsgrad: ' + (calc.gjeldsgrad || 'ukjent') + ' | Likviditet: ' + (calc.likviditet || 'ukjent') + ' | LTV: ' + (calc.ltv || 'ukjent')
      + (calc.other && calc.other.length ? '\n' + calc.other.map(function(o) { return o.label + ': ' + o.value; }).join(' | ') : '')
    : 'Ingen kalkulator lastet.';
  return 'Du er ekspert finansradgiver-assistent for Alti Finans (Finanstilsynet-lisensiert). Du hjelper radgiver ' + userName + '.\n\n'
    + '## BANKRETNINGSLINJER\n' + bankSec + '\n\n'
    + '## LOSNINGSSTRATEGIER\n' + knowledgeSec + '\n\n'
    + '## KALKULATOR (SIFO 2026, stresstest 3%)\n' + calcSec + '\n\n'
    + '## EKSEMPELSAKER\n' + exSec + '\n\n'
    + 'Still strukturerte sporsmal ett eller to av gangen. Dekk: navn, inntekt, gjeld, formal, sikkerhet, betalingsanmerkninger, sivilstatus, barn.\n'
    + 'Bruk kalkulatortallene og match mot bankretningslinjene.\n\n'
    + 'Nar du har nok info, skriv KLAR TIL UTFYLLING og presenter:\n'
    + '**CRM-NOTAT:**\n[sammendrag]\n'
    + '**LANESOKNAD - BANKRAPPORT:**\n[ferdig til bank]\n'
    + '**ANBEFALT BANK:** [navn]\n'
    + '**LOSNINGSSTRATEGI:** [kort beskrivelse]\n\n'
    + 'Snakk alltid norsk. Vaer direkte og profesjonell.';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('agent');
  const [banks, setBanks] = useState([]);
  const [knowledge, setKnowledge] = useState([]);
  const [examples, setExamples] = useState([]);
  const [calc, setCalc] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(function() {
    try {
      const s = localStorage.getItem('af-user');
      if (s) setUser(JSON.parse(s));
    } catch (e) {}
    setReady(true);
  }, []);

  useEffect(function() {
    if (user) loadShared();
  }, [user]);

  async function loadShared() {
    try {
      const b = await sb('af_banks?order=name');
      const k = await sb('af_knowledge?order=title');
      const c = await sb('af_cases?is_example=eq.true&order=created_at.desc&limit=20');
      setBanks(b);
      setKnowledge(k);
      setExamples(c);
    } catch (e) {}
  }

  function login(u) {
    setUser(u);
    try { localStorage.setItem('af-user', JSON.stringify(u)); } catch (e) {}
  }

  function logout() {
    setUser(null);
    try { localStorage.removeItem('af-user'); } catch (e) {}
  }

  if (!ready) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.gold, fontFamily: 'Georgia,serif', fontSize: 16 }}>Laster...</div>
      </div>
    );
  }

  if (!user) return <AuthScreen onLogin={login} />;

  const tabs = [
    { id: 'agent', label: 'Agent' },
    { id: 'cases', label: 'Saker' },
    { id: 'banks', label: 'Banker' },
    { id: 'knowledge', label: 'Kunnskap' },
    { id: 'stats', label: 'Statistikk' },
  ];

  const headerStyle = {
    borderBottom: '1px solid ' + C.border,
    padding: '10px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: C.surface,
    flexShrink: 0,
  };

  const logoStyle = {
    width: 30, height: 30, borderRadius: '50%',
    background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 'bold', color: C.bg, fontSize: 13,
  };

  return (
    <>
      <Head><title>Alti Finans</title></Head>
      <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "Georgia,'Times New Roman',serif", color: C.text, display: 'flex', flexDirection: 'column' }}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={logoStyle}>A</div>
            <div>
              <div style={{ color: C.gold, fontWeight: 'bold', fontSize: 13, letterSpacing: '0.07em' }}>ALTI FINANS</div>
              <div style={{ color: C.muted, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Intelligence System</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {tabs.map(function(t) {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={function() { setTab(t.id); }}
                  style={{
                    background: active ? 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')' : 'transparent',
                    border: '1px solid ' + (active ? C.gold : C.border),
                    color: active ? C.bg : C.muted,
                    padding: '4px 11px', borderRadius: 4, cursor: 'pointer',
                    fontSize: 10, fontFamily: 'inherit', fontWeight: active ? 'bold' : 'normal',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: C.muted }}>{user.name}</span>
            {user.role === 'admin' && (
              <span style={{ fontSize: 9, color: C.gold, border: '1px solid ' + C.gold, borderRadius: 3, padding: '1px 5px' }}>ADMIN</span>
            )}
            <button
              onClick={logout}
              style={{ background: 'transparent', border: '1px solid ' + C.border, color: C.muted, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit' }}
            >
              Logg ut
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {tab === 'agent' && <AgentTab banks={banks} knowledge={knowledge} examples={examples} calc={calc} setCalc={setCalc} user={user} onSaved={loadShared} />}
          {tab === 'cases' && <CasesTab user={user} onToggle={loadShared} />}
          {tab === 'banks' && <BanksTab banks={banks} user={user} onSave={function(b) { setBanks(b); }} />}
          {tab === 'knowledge' && <KnowledgeTab knowledge={knowledge} user={user} onSave={function(k) { setKnowledge(k); }} />}
          {tab === 'stats' && <StatsTab />}
        </div>
        <style>{`
          @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.85)} 50%{opacity:1;transform:scale(1.15)} }
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-thumb { background: #1a2d48; border-radius: 2px; }
        `}</style>
      </div>
    </>
  );
}

function AuthScreen(props) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const users = await sb('af_users');
      if (mode === 'login') {
        const found = users.find(function(u) {
          return u.email === email.trim().toLowerCase() && u.password === password;
        });
        if (!found) throw new Error('Feil e-post eller passord');
        props.onLogin(found);
      } else {
        if (!name.trim()) throw new Error('Fyll inn navn');
        if (!email.trim()) throw new Error('Fyll inn e-post');
        if (password.length < 4) throw new Error('Passord ma vaere minst 4 tegn');
        const exists = users.find(function(u) { return u.email === email.trim().toLowerCase(); });
        if (exists) throw new Error('E-post er allerede registrert');
        const role = adminCode.trim() === ADMIN_CODE ? 'admin' : 'advisor';
        const result = await sb('af_users', 'POST', {
          id: uid(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password,
          role: role,
          created_at: new Date().toISOString(),
        });
        const newUser = Array.isArray(result) ? result[0] : result;
        if (!newUser || !newUser.id) throw new Error('Feil ved opprettelse - provv igjen');
        props.onLogin(newUser);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  const boxStyle = {
    width: 400, background: C.surface,
    border: '1px solid ' + C.border,
    borderRadius: 12, padding: 36,
  };

  const btnStyle = function(active) {
    return {
      flex: 1,
      background: active ? 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')' : 'transparent',
      border: '1px solid ' + (active ? C.gold : C.border),
      color: active ? C.bg : C.muted,
      padding: '7px', borderRadius: 4, cursor: 'pointer',
      fontSize: 11, fontFamily: 'inherit', fontWeight: active ? 'bold' : 'normal',
    };
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia,serif' }}>
      <div style={boxStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: C.bg, fontSize: 21, margin: '0 auto 12px' }}>A</div>
          <div style={{ color: C.gold, fontWeight: 'bold', fontSize: 17, letterSpacing: '0.07em' }}>ALTI FINANS</div>
          <div style={{ color: C.muted, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 3 }}>Intelligence System</div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 22 }}>
          <button onClick={function() { setMode('login'); setError(''); }} style={btnStyle(mode === 'login')}>Logg inn</button>
          <button onClick={function() { setMode('register'); setError(''); }} style={btnStyle(mode === 'register')}>Registrer deg</button>
        </div>
        {mode === 'register' && <Fld label="Fullt navn" value={name} onChange={setName} placeholder="Ola Nordmann" />}
        <Fld label="E-post" value={email} onChange={setEmail} placeholder="ola@altifinans.no" type="email" />
        <Fld label="Passord" value={password} onChange={setPassword} placeholder="Minimum 4 tegn" type="password" />
        {mode === 'register' && <Fld label="Admin-kode (valgfritt)" value={adminCode} onChange={setAdminCode} placeholder="Kun for administratorer" type="password" />}
        {error && (
          <div style={{ fontSize: 12, marginBottom: 12, padding: '8px 12px', background: 'rgba(168,72,72,0.1)', border: '1px solid rgba(168,72,72,0.4)', borderRadius: 4, color: '#e08080' }}>
            {error}
          </div>
        )}
        <button
          onClick={submit}
          disabled={loading}
          style={{ width: '100%', background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', border: 'none', color: C.bg, padding: '11px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold', fontFamily: 'inherit', marginBottom: 12 }}
        >
          {loading ? 'Vennligst vent...' : mode === 'login' ? 'Logg inn' : 'Opprett konto'}
        </button>
        <div style={{ padding: '11px 14px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 6, fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
          <strong style={{ color: C.gold }}>Admin-kode:</strong> <span style={{ color: C.text }}>{ADMIN_CODE}</span>
        </div>
      </div>
    </div>
  );
}

function Fld(props) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>{props.label}</label>
      <input
        type={props.type || 'text'}
        value={props.value}
        onChange={function(e) { props.onChange(e.target.value); }}
        placeholder={props.placeholder}
        style={{ width: '100%', background: C.bg, border: '1px solid ' + C.border, borderRadius: 6, padding: '9px 12px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
      />
    </div>
  );
}

function AgentTab(props) {
  const { banks, knowledge, examples, calc, setCalc, user, onSaved } = props;
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [crm, setCrm] = useState('');
  const [loan, setLoan] = useState('');
  const [recBank, setRecBank] = useState('');
  const [recStrat, setRecStrat] = useState('');
  const [xlLoading, setXlLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(function() {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, loading]);

  async function handleXl(e) {
    const file = e.target.files[0];
    if (!file) return;
    setXlLoading(true);
    try { setCalc(await parseExcel(file)); } catch (e2) { alert('Kunne ikke lese Excel-filen.'); }
    setXlLoading(false);
    e.target.value = '';
  }

  function start() {
    setPhase('chat');
    setMsgs([{ role: 'assistant', content: 'Hei ' + user.name + '! Klar til ny sak. Fortell meg om kunden.' }]);
    setTimeout(function() { if (inputRef.current) inputRef.current.focus(); }, 100);
  }

  async function send() {
    if (!input.trim() || loading) return;
    const txt = input.trim();
    setInput('');
    const newMsgs = msgs.concat([{ role: 'user', content: txt }]);
    setMsgs(newMsgs);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: buildPrompt(banks, knowledge, examples, calc, user.name), messages: newMsgs }),
      });
      const data = await res.json();
      const reply = (data.content && data.content[0] && data.content[0].text) || 'Noe gikk galt.';
      setMsgs(function(prev) { return prev.concat([{ role: 'assistant', content: reply }]); });
      if (reply.indexOf('KLAR TIL UTFYLLING') >= 0) {
        const crmM = reply.match(/\*\*CRM-NOTAT:\*\*([\s\S]*?)(?=\*\*LANESOKNAD|$)/);
        const loanM = reply.match(/\*\*LANESOKNAD[\s\S]*?:\*\*([\s\S]*?)(?=\*\*ANBEFALT|$)/);
        const bankM = reply.match(/\*\*ANBEFALT BANK:\*\*\s*(.+)/);
        const stratM = reply.match(/\*\*LOSNINGSSTRATEGI:\*\*\s*(.+)/);
        if (crmM) setCrm(crmM[1].trim());
        if (loanM) setLoan(loanM[1].trim());
        if (bankM) setRecBank(bankM[1].trim());
        if (stratM) setRecStrat(stratM[1].trim());
        setPhase('done');
      }
    } catch (e3) {
      setMsgs(function(prev) { return prev.concat([{ role: 'assistant', content: 'Tilkoblingsfeil. Provv igjen.' }]); });
    }
    setLoading(false);
  }

  async function saveCase(asEx) {
    setSaving(true);
    const summary = (msgs.find(function(m) { return m.role === 'user'; }) || {}).content || 'Ukjent';
    try {
      await sb('af_cases', 'POST', {
        id: uid(),
        advisor_id: user.id,
        advisor_name: user.name,
        summary: summary.slice(0, 150),
        solution: recStrat,
        bank: recBank,
        outcome: 'Sendt til bank',
        crm_note: crm,
        loan_app: loan,
        is_example: asEx,
        created_at: new Date().toISOString(),
      });
      setSaved(true);
      onSaved();
    } catch (e4) {
      alert('Kunne ikke lagre: ' + e4.message);
    }
    setSaving(false);
  }

  function reset() {
    setMsgs([]); setInput(''); setPhase('idle');
    setCrm(''); setLoan(''); setRecBank(''); setRecStrat(''); setSaved(false);
  }

  const H = 'calc(100vh - 54px)';

  return (
    <div style={{ height: H, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 18px', borderBottom: '1px solid ' + C.border, background: C.surface, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleXl} style={{ display: 'none' }} />
        <button
          onClick={function() { fileRef.current.click(); }}
          style={{ background: 'transparent', border: '1px solid ' + C.border, color: C.muted, padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}
        >
          {xlLoading ? 'Leser...' : 'Last opp kalkulator'}
        </button>
        {calc && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {calc.gjeldsgrad && <Pill label="Gjeldsgrad" value={calc.gjeldsgrad} warn={parseFloat(calc.gjeldsgrad) > 500} />}
            {calc.likviditet && <Pill label="Likviditet" value={calc.likviditet} warn={false} />}
            {calc.ltv && <Pill label="LTV" value={calc.ltv} warn={parseFloat(calc.ltv) > 85} />}
            <button onClick={function() { setCalc(null); }} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13 }}>x</button>
          </div>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 9, color: C.muted }}>{banks.length} banker / {knowledge.length} artikler / {examples.length} eksempler</div>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: phase === 'done' ? '0 0 44%' : 1, display: 'flex', flexDirection: 'column', borderRight: phase === 'done' ? '1px solid ' + C.border : 'none' }}>
          {phase === 'idle' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 46, marginBottom: 16 }}>💼</div>
              <h2 style={{ color: C.gold, fontWeight: 'normal', fontSize: 19, marginBottom: 10 }}>Klar til ny kundesak</h2>
              <p style={{ color: C.muted, fontSize: 12, maxWidth: 290, lineHeight: 1.9, marginBottom: 24 }}>
                {banks.length === 0 ? 'Legg inn banker i Banker-fanen forst.' : banks.length + ' banker og ' + knowledge.length + ' strategier lastet.'}
              </p>
              <button
                onClick={start}
                style={{ background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', border: 'none', color: C.bg, padding: '11px 32px', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 'bold', fontFamily: 'inherit' }}
              >
                Start samtale
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                {msgs.map(function(m, i) {
                  const isUser = m.role === 'user';
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                      {!isUser && (
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: C.bg, fontWeight: 'bold', flexShrink: 0, marginRight: 7, marginTop: 2 }}>A</div>
                      )}
                      <div
                        style={{ maxWidth: '80%', background: isUser ? '#122040' : '#0d1520', border: '1px solid ' + (isUser ? '#1e3060' : C.border), borderRadius: isUser ? '12px 12px 3px 12px' : '12px 12px 12px 3px', padding: '8px 12px', fontSize: 12, lineHeight: 1.7, color: C.text }}
                        dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }}
                      />
                    </div>
                  );
                })}
                {loading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: C.bg, fontWeight: 'bold' }}>A</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[0, 1, 2].map(function(i) {
                        return <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: C.gold, animation: 'pulse 1.2s ' + (i * 0.2) + 's infinite' }} />;
                      })}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: '10px 14px', borderTop: '1px solid ' + C.border, display: 'flex', gap: 7, alignItems: 'flex-end', flexShrink: 0 }}>
                {phase === 'done' ? (
                  <div style={{ flex: 1, display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: C.green }}>Sak fullfort</span>
                    {!saved && (
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button
                          onClick={function() { saveCase(false); }}
                          disabled={saving}
                          style={{ background: 'rgba(46,109,184,0.2)', border: '1px solid rgba(46,109,184,0.4)', color: '#6a9de0', padding: '5px 11px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}
                        >
                          {saving ? '...' : 'Lagre sak'}
                        </button>
                        <button
                          onClick={function() { saveCase(true); }}
                          disabled={saving}
                          style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: C.gold, padding: '5px 11px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}
                        >
                          Lagre som eksempel
                        </button>
                      </div>
                    )}
                    {saved && <span style={{ fontSize: 10, color: C.gold }}>Lagret - agenten laerer av denne saken</span>}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 7, flex: 1, alignItems: 'flex-end' }}>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={function(e) { setInput(e.target.value); }}
                      onKeyDown={function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder="Skriv her... (Enter sender)"
                      rows={2}
                      style={{ flex: 1, background: '#070c14', border: '1px solid ' + C.border, borderRadius: 6, padding: '7px 10px', color: C.text, fontSize: 12, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }}
                    />
                    <button
                      onClick={send}
                      disabled={loading || !input.trim()}
                      style={{ background: input.trim() ? 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')' : C.border, border: 'none', borderRadius: 6, padding: '7px 13px', cursor: input.trim() ? 'pointer' : 'default', color: input.trim() ? C.bg : C.muted, fontSize: 15, fontWeight: 'bold' }}
                    >
                      ↑
                    </button>
                  </div>
                )}
                <button
                  onClick={reset}
                  style={{ background: 'transparent', border: '1px solid ' + C.border, color: C.muted, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit' }}
                >
                  Ny sak
                </button>
              </div>
            </div>
          )}
        </div>
        {phase === 'done' && (
          <div style={{ flex: '0 0 56%', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recBank && (
              <div style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8, padding: '11px 14px' }}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Anbefalt bank</div>
                <div style={{ color: C.gold, fontWeight: 'bold', fontSize: 15, marginTop: 2 }}>{recBank}</div>
                {recStrat && <div style={{ color: C.text, fontSize: 12, marginTop: 6 }}>{recStrat}</div>}
              </div>
            )}
            <OutCard title="CRM-NOTAT" content={crm} accent={C.green} />
            <OutCard title="LANESOKNAD - BANKRAPPORT" content={loan} accent={C.gold} />
          </div>
        )}
      </div>
    </div>
  );
}

function CasesTab(props) {
  const { user, onToggle } = props;
  const [cases, setCases] = useState([]);
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    const filter = user.role === 'admin' ? '' : 'advisor_id=eq.' + user.id + '&';
    sb('af_cases?' + filter + 'order=created_at.desc')
      .then(function(c) { setCases(c); setLoading(false); })
      .catch(function() { setLoading(false); });
  }, []);

  async function toggleEx(c) {
    await sb('af_cases?id=eq.' + c.id, 'PATCH', { is_example: !c.is_example });
    setCases(function(prev) {
      return prev.map(function(x) { return x.id === c.id ? Object.assign({}, x, { is_example: !x.is_example }) : x; });
    });
    setSel(function(s) { return s && s.id === c.id ? Object.assign({}, s, { is_example: !s.is_example }) : s; });
    onToggle();
  }

  if (loading) return <Loader />;

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex' }}>
      <div style={{ width: 280, borderRight: '1px solid ' + C.border, overflowY: 'auto', background: C.surface, flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid ' + C.border, fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {cases.length} saker {user.role === 'admin' ? '(alle)' : ''}
        </div>
        {cases.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 12, lineHeight: 1.7 }}>Ingen saker enna.</div>}
        {cases.map(function(c) {
          const active = sel && sel.id === c.id;
          return (
            <div
              key={c.id}
              onClick={function() { setSel(c); }}
              style={{ padding: '10px 14px', borderBottom: '1px solid ' + C.border, cursor: 'pointer', background: active ? 'rgba(201,168,76,0.08)' : 'transparent', borderLeft: '3px solid ' + (c.is_example ? C.gold : 'transparent') }}
            >
              <div style={{ fontSize: 11, color: active ? C.gold : C.text, marginBottom: 3, lineHeight: 1.4 }}>{(c.summary || 'Ukjent').slice(0, 55)}...</div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {c.bank && <span style={{ fontSize: 9, color: C.blue }}>{c.bank}</span>}
                {c.is_example && <span style={{ fontSize: 9, color: C.gold }}>Eksempel</span>}
                <span style={{ fontSize: 9, color: C.muted, marginLeft: 'auto' }}>{new Date(c.created_at).toLocaleDateString('no-NO')}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!sel ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: 13 }}>Velg en sak fra listen</div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ color: C.gold, fontWeight: 'normal', fontSize: 15, margin: 0 }}>Saksdetaljer</h3>
              <button
                onClick={function() { toggleEx(sel); }}
                style={{ background: sel.is_example ? 'rgba(201,168,76,0.15)' : 'transparent', border: '1px solid ' + (sel.is_example ? C.gold : C.border), color: sel.is_example ? C.gold : C.muted, padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}
              >
                {sel.is_example ? 'Fjern eksempel' : 'Merk som eksempel'}
              </button>
            </div>
            {sel.bank && <IRow label="Bank" value={sel.bank} />}
            {sel.solution && <IRow label="Strategi" value={sel.solution} />}
            {user.role === 'admin' && sel.advisor_name && <IRow label="Radgiver" value={sel.advisor_name} />}
            {sel.crm_note && <DocBlock title="CRM-NOTAT" content={sel.crm_note} accent={C.green} />}
            {sel.loan_app && <DocBlock title="LANESOKNAD" content={sel.loan_app} accent={C.gold} />}
          </div>
        )}
      </div>
    </div>
  );
}

function BanksTab(props) {
  const { banks, user, onSave } = props;
  const [sel, setSel] = useState(null);
  const [bname, setBname] = useState('');
  const [guidelines, setGuidelines] = useState('');
  const [saving, setSaving] = useState(false);
  const isAdmin = user.role === 'admin';

  function openNew() {
    setSel('new');
    setBname('');
    setGuidelines('');
  }

  function openEdit(b) {
    setSel(b.id);
    setBname(b.name);
    setGuidelines(b.guidelines);
  }

  function cancel() {
    setSel(null);
    setBname('');
    setGuidelines('');
  }

  async function save() {
    if (!bname.trim() || !guidelines.trim()) return;
    setSaving(true);
    try {
      let updated;
      if (sel === 'new') {
        await sb('af_banks', 'POST', { id: uid(), name: bname.trim(), guidelines: guidelines.trim(), created_by: user.id, updated_at: new Date().toISOString() });
      } else {
        await sb('af_banks?id=eq.' + sel, 'PATCH', { name: bname.trim(), guidelines: guidelines.trim(), updated_at: new Date().toISOString() });
      }
      const b = await sb('af_banks?order=name');
      onSave(b);
      cancel();
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function remove(id) {
    if (!confirm('Slett denne banken?')) return;
    await sb('af_banks?id=eq.' + id, 'DELETE');
    const b = await sb('af_banks?order=name');
    onSave(b);
    if (sel === id) cancel();
  }

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex' }}>
      <div style={{ width: 250, borderRight: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', background: C.surface, flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Banker ({banks.length})</span>
          {isAdmin && (
            <button
              onClick={openNew}
              style={{ background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', border: 'none', color: C.bg, padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 'bold', fontFamily: 'inherit' }}
            >
              + Ny
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {banks.length === 0 && <div style={{ padding: 18, textAlign: 'center', color: C.muted, fontSize: 11, lineHeight: 1.8 }}>{isAdmin ? 'Klikk + Ny for aa legge inn banker.' : 'Admin legger inn banker.'}</div>}
          {banks.map(function(b) {
            const active = sel === b.id;
            return (
              <div
                key={b.id}
                onClick={function() { openEdit(b); }}
                style={{ padding: '10px 13px', borderBottom: '1px solid ' + C.border, cursor: 'pointer', background: active ? 'rgba(201,168,76,0.1)' : 'transparent', borderLeft: '3px solid ' + (active ? C.gold : 'transparent') }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: active ? C.gold : C.text }}>{b.name}</span>
                  {isAdmin && (
                    <button
                      onClick={function(e) { e.stopPropagation(); remove(b.id); }}
                      style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, padding: '0 2px' }}
                    >
                      x
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{b.guidelines.slice(0, 45)}...</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, padding: 26, overflowY: 'auto' }}>
        {!sel ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
            <h3 style={{ color: C.gold, fontWeight: 'normal', marginBottom: 8 }}>Bankretningslinjer</h3>
            <p style={{ color: C.muted, fontSize: 12, maxWidth: 320, lineHeight: 1.85 }}>Legg inn retningslinjer for hver bank. Jo mer detaljert, jo bedre matcher agenten.</p>
          </div>
        ) : (
          <div style={{ maxWidth: 600 }}>
            <h3 style={{ color: C.gold, fontWeight: 'normal', fontSize: 16, marginBottom: 20 }}>{sel === 'new' ? 'Ny bank' : 'Rediger: ' + bname}</h3>
            <Fld label="Banknavn" value={bname} onChange={setBname} placeholder="f.eks. Monobank, Bank Norwegian" />
            <div style={{ marginBottom: 6 }}>
              <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Retningslinjer (fritekst)</label>
              <textarea
                value={guidelines}
                onChange={function(e) { setGuidelines(e.target.value); }}
                rows={14}
                disabled={!isAdmin}
                placeholder="Maks gjeldsgrad: 500%\nMaks LTV: 85%\nAksepterer betalingsanmerkninger: Nei\n..."
                style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, padding: '10px 12px', color: C.text, fontSize: 12, fontFamily: 'inherit', lineHeight: 1.75, resize: 'vertical', outline: 'none', opacity: isAdmin ? 1 : 0.65 }}
              />
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 9 }}>
                <button
                  onClick={save}
                  disabled={saving || !bname.trim() || !guidelines.trim()}
                  style={{ background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', border: 'none', color: C.bg, padding: '9px 24px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', fontFamily: 'inherit' }}
                >
                  {saving ? 'Lagrer...' : 'Lagre'}
                </button>
                <button
                  onClick={cancel}
                  style={{ background: 'transparent', border: '1px solid ' + C.border, color: C.muted, padding: '9px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
                >
                  Avbryt
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgeTab(props) {
  const { knowledge, user, onSave } = props;
  const [sel, setSel] = useState(null);
  const [ktitle, setKtitle] = useState('');
  const [kcontent, setKcontent] = useState('');
  const [saving, setSaving] = useState(false);
  const isAdmin = user.role === 'admin';

  function openNew() {
    setSel('new');
    setKtitle('');
    setKcontent('');
  }

  function openEdit(k) {
    setSel(k.id);
    setKtitle(k.title);
    setKcontent(k.content);
  }

  function cancel() {
    setSel(null);
    setKtitle('');
    setKcontent('');
  }

  async function save() {
    if (!ktitle.trim() || !kcontent.trim()) return;
    setSaving(true);
    try {
      if (sel === 'new') {
        await sb('af_knowledge', 'POST', { id: uid(), title: ktitle.trim(), content: kcontent.trim(), created_by: user.id, updated_at: new Date().toISOString() });
      } else {
        await sb('af_knowledge?id=eq.' + sel, 'PATCH', { title: ktitle.trim(), content: kcontent.trim(), updated_at: new Date().toISOString() });
      }
      const k = await sb('af_knowledge?order=title');
      onSave(k);
      cancel();
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function remove(id) {
    if (!confirm('Slett?')) return;
    await sb('af_knowledge?id=eq.' + id, 'DELETE');
    const k = await sb('af_knowledge?order=title');
    onSave(k);
    if (sel === id) cancel();
  }

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex' }}>
      <div style={{ width: 250, borderRight: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', background: C.surface, flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Kunnskap ({knowledge.length})</span>
          {isAdmin && (
            <button
              onClick={openNew}
              style={{ background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', border: 'none', color: C.bg, padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 'bold', fontFamily: 'inherit' }}
            >
              + Ny
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {knowledge.length === 0 && <div style={{ padding: 18, textAlign: 'center', color: C.muted, fontSize: 11, lineHeight: 1.8 }}>{isAdmin ? 'Legg inn losningsstrategier.' : 'Admin legger inn kunnskap.'}</div>}
          {knowledge.map(function(k) {
            const active = sel === k.id;
            return (
              <div
                key={k.id}
                onClick={function() { openEdit(k); }}
                style={{ padding: '10px 13px', borderBottom: '1px solid ' + C.border, cursor: 'pointer', background: active ? 'rgba(201,168,76,0.1)' : 'transparent', borderLeft: '3px solid ' + (active ? C.gold : 'transparent') }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: active ? C.gold : C.text }}>{k.title}</span>
                  {isAdmin && (
                    <button
                      onClick={function(e) { e.stopPropagation(); remove(k.id); }}
                      style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, padding: '0 2px' }}
                    >
                      x
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{k.content.slice(0, 45)}...</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, padding: 26, overflowY: 'auto' }}>
        {!sel ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
            <h3 style={{ color: C.gold, fontWeight: 'normal', marginBottom: 8 }}>Kunnskapsbase</h3>
            <p style={{ color: C.muted, fontSize: 12, maxWidth: 340, lineHeight: 1.85 }}>Jo mer du laerer agenten, jo bedre rad gir den radgiverne dine.</p>
            <div style={{ marginTop: 16, textAlign: 'left', background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '14px 18px', maxWidth: 340 }}>
              <div style={{ fontSize: 10, color: C.gold, fontWeight: 'bold', marginBottom: 8 }}>Eksempler</div>
              {['Omstartslan - krav og strategi', 'Refinansiering med kausjonist', 'Betalingsanmerkninger - losninger', 'Sikkerhet i eiendom', 'Selvstendig naringsdrivende'].map(function(t) {
                return <div key={t} style={{ fontSize: 11, color: C.muted, padding: '4px 0', borderBottom: '1px solid ' + C.border }}>{t}</div>;
              })}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 600 }}>
            <h3 style={{ color: C.gold, fontWeight: 'normal', fontSize: 16, marginBottom: 20 }}>{sel === 'new' ? 'Ny kunnskapsartikkel' : 'Rediger: ' + ktitle}</h3>
            <Fld label="Tittel" value={ktitle} onChange={setKtitle} placeholder="f.eks. Omstartslan - krav og strategi" />
            <div>
              <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Innhold</label>
              <textarea
                value={kcontent}
                onChange={function(e) { setKcontent(e.target.value); }}
                rows={16}
                disabled={!isAdmin}
                placeholder="Beskriv losningsstrategier, krav, erfaringer og tips..."
                style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, padding: '10px 12px', color: C.text, fontSize: 12, fontFamily: 'inherit', lineHeight: 1.75, resize: 'vertical', outline: 'none', opacity: isAdmin ? 1 : 0.65 }}
              />
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
                <button
                  onClick={save}
                  disabled={saving || !ktitle.trim() || !kcontent.trim()}
                  style={{ background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', border: 'none', color: C.bg, padding: '9px 24px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', fontFamily: 'inherit' }}
                >
                  {saving ? 'Lagrer...' : 'Lagre'}
                </button>
                <button
                  onClick={cancel}
                  style={{ background: 'transparent', border: '1px solid ' + C.border, color: C.muted, padding: '9px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
                >
                  Avbryt
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsTab() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    sb('af_cases?order=created_at.desc')
      .then(function(c) { setCases(c); setLoading(false); })
      .catch(function() { setLoading(false); });
  }, []);

  if (loading) return <Loader />;

  const total = cases.length;
  const exCount = cases.filter(function(c) { return c.is_example; }).length;
  const thisMonth = cases.filter(function(c) { return new Date(c.created_at).getMonth() === new Date().getMonth(); }).length;
  const bankMap = {};
  const advMap = {};
  cases.forEach(function(c) {
    if (c.bank) bankMap[c.bank] = (bankMap[c.bank] || 0) + 1;
    if (c.advisor_name) advMap[c.advisor_name] = (advMap[c.advisor_name] || 0) + 1;
  });

  const stats = [
    { l: 'Totale saker', v: total, c: C.blue },
    { l: 'Denne maneden', v: thisMonth, c: C.green },
    { l: 'Eksempelsaker', v: exCount, c: C.gold },
    { l: 'Banker brukt', v: Object.keys(bankMap).length, c: '#b87830' },
  ];

  return (
    <div style={{ padding: 26, overflowY: 'auto', height: 'calc(100vh - 54px)' }}>
      <h2 style={{ color: C.gold, fontWeight: 'normal', fontSize: 17, marginBottom: 22 }}>Statistikk</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 26 }}>
        {stats.map(function(s) {
          return (
            <div key={s.l} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '15px 17px' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{s.l}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <BChart title="Saker per bank" data={bankMap} color={C.gold} />
        <BChart title="Saker per radgiver" data={advMap} color={C.blue} />
      </div>
    </div>
  );
}

function BChart(props) {
  const entries = Object.entries(props.data).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
  const max = Math.max.apply(null, entries.map(function(e) { return e[1]; }).concat([1]));
  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: 18 }}>
      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>{props.title}</div>
      {entries.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 12 }}>Ingen data enna</div>
      ) : (
        entries.map(function(entry) {
          const name = entry[0];
          const count = entry[1];
          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.text, width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ flex: 1, background: C.bg, borderRadius: 3, height: 5 }}>
                <div style={{ width: ((count / max) * 100) + '%', background: props.color, height: '100%', borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 10, color: props.color, width: 18, textAlign: 'right', fontWeight: 'bold' }}>{count}</div>
            </div>
          );
        })
      )}
    </div>
  );
}

function Loader() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 54px)', color: C.muted, fontSize: 13 }}>Laster...</div>;
}

function Pill(props) {
  const color = props.warn ? C.red : C.green;
  return (
    <span style={{ background: props.warn ? 'rgba(168,72,72,0.2)' : 'rgba(58,158,106,0.2)', border: '1px solid ' + color + '44', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: props.warn ? '#e07070' : '#5ebd8e' }}>
      {props.label}: <strong>{props.value}</strong>
    </span>
  );
}

function IRow(props) {
  return (
    <div style={{ marginBottom: 10, background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, padding: '8px 13px' }}>
      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{props.label}</div>
      <div style={{ fontSize: 12, color: C.text }}>{props.value}</div>
    </div>
  );
}

function DocBlock(props) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(props.content);
    setCopied(true);
    setTimeout(function() { setCopied(false); }, 2000);
  }
  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ padding: '8px 13px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: props.accent, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{props.title}</span>
        <button onClick={copy} style={{ background: 'transparent', border: '1px solid ' + C.border, color: copied ? props.accent : C.muted, padding: '2px 9px', borderRadius: 4, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit' }}>
          {copied ? 'Kopiert' : 'Kopier'}
        </button>
      </div>
      <div style={{ padding: '11px 13px', fontSize: 11, lineHeight: 1.8, color: '#b8b0a8', whiteSpace: 'pre-wrap', fontFamily: 'Courier New,monospace' }}>{props.content}</div>
    </div>
  );
}

function OutCard(props) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(props.content);
    setCopied(true);
    setTimeout(function() { setCopied(false); }, 2000);
  }
  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '9px 14px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: props.accent, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.13em' }}>{props.title}</span>
        <button onClick={copy} style={{ background: 'transparent', border: '1px solid ' + C.border, color: copied ? props.accent : C.muted, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit' }}>
          {copied ? 'Kopiert' : 'Kopier'}
        </button>
      </div>
      <div style={{ padding: '12px 14px', fontSize: 11, lineHeight: 1.8, color: '#b8b0a8', whiteSpace: 'pre-wrap', fontFamily: 'Courier New,monospace' }}>{props.content || 'Genererer...'}</div>
    </div>
  );
}
