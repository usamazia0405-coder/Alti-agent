import { useState, useRef, useEffect } from 'react';
import { C, SafeText, DocBlock } from './shared';

const ACCEPTED_EXTENSIONS = '.pdf,.xlsx,.xls,.csv,.ods,.docx,.png,.jpg,.jpeg,.webp,.gif';

export default function AgentTab({ user }) {
  const [msgs, setMsgs] = useState([]);
  const [apiMsgs, setApiMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [crm, setCrm] = useState('');
  const [loan, setLoan] = useState('');
  const [recBank, setRecBank] = useState('');
  const [recStrat, setRecStrat] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, loading]);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }).catch(() => null);
      if (!base64) { alert('Kunne ikke lese ' + file.name); continue; }
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, fileType: file.type, data: base64 }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        setAttachments(prev => [...prev, { ...result, id: Math.random().toString(36).slice(2) }]);
      } catch (err) {
        alert('Feil med ' + file.name + ': ' + err.message);
      }
    }
    setUploading(false);
    e.target.value = '';
  }

  function removeAttachment(id) {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }

  function buildFileMessage() {
    if (!attachments.length) return null;
    const content = [];
    for (const att of attachments) {
      if (att.type === 'document') {
        content.push({ type: 'document', source: { type: 'base64', media_type: att.mediaType, data: att.data } });
        content.push({ type: 'text', text: `Dokument lastet opp: ${att.name}` });
      } else if (att.type === 'image') {
        content.push({ type: 'image', source: { type: 'base64', media_type: att.mediaType, data: att.data } });
        content.push({ type: 'text', text: `Bilde lastet opp: ${att.name}` });
      } else if (att.type === 'text') {
        content.push({ type: 'text', text: `=== ${att.name} ===\n${att.content}\n===` });
      }
    }
    content.push({ type: 'text', text: 'Analyser alle vedlagte filer. Trekk ut all relevant kundeinfo og vurder saken mot bankretningslinjene.' });
    return { role: 'user', content };
  }

  function extractResults(reply) {
    if (!reply.includes('KLAR TIL UTFYLLING')) return false;
    const crmM = reply.match(/\*\*CRM-NOTAT:\*\*([\s\S]*?)(?=\*\*LÅNESØKNAD|$)/);
    const loanM = reply.match(/\*\*LÅNESØKNAD[\s\S]*?:\*\*([\s\S]*?)(?=\*\*ANBEFALT|$)/);
    const bankM = reply.match(/\*\*ANBEFALT BANK:\*\*\s*(.+)/);
    const stratM = reply.match(/\*\*LØSNINGSSTRATEGI:\*\*\s*(.+)/);
    if (crmM) setCrm(crmM[1].trim());
    if (loanM) setLoan(loanM[1].trim());
    if (bankM) setRecBank(bankM[1].trim());
    if (stratM) setRecStrat(stratM[1].trim());
    setPhase('done');
    return true;
  }

  async function callChat(msgs) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs }),
    });
    if (res.status === 401) { window.location.reload(); return null; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI-feil.');
    return data.content?.[0]?.text || '';
  }

  async function start() {
    setPhase('chat');
    setLoading(true);
    const fileMsg = buildFileMessage();
    if (fileMsg) {
      setMsgs([{ role: 'assistant', content: 'Analyserer vedlagte filer...' }]);
      try {
        const initMsgs = [fileMsg];
        const reply = await callChat(initMsgs);
        if (reply === null) return;
        const assistantMsg = { role: 'assistant', content: reply };
        setMsgs([assistantMsg]);
        setApiMsgs([fileMsg, assistantMsg]);
        extractResults(reply);
      } catch (err) {
        setMsgs([{ role: 'assistant', content: 'Feil: ' + err.message }]);
      }
    } else {
      const welcome = { role: 'assistant', content: 'Hei ' + user.name + '! Klar til ny sak. Fortell meg om kunden.' };
      setMsgs([welcome]);
      setApiMsgs([welcome]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    setLoading(false);
  }

  async function send() {
    if (!input.trim() || loading) return;
    const txt = input.trim();
    setInput('');
    const userMsg = { role: 'user', content: txt };
    const newApiMsgs = [...apiMsgs, userMsg];
    setMsgs(prev => [...prev, userMsg]);
    setApiMsgs(newApiMsgs);
    setLoading(true);
    try {
      const reply = await callChat(newApiMsgs);
      if (reply === null) return;
      const assistantMsg = { role: 'assistant', content: reply };
      setMsgs(prev => [...prev, assistantMsg]);
      setApiMsgs(prev => [...prev, assistantMsg]);
      extractResults(reply);
    } catch (err) {
      setMsgs(prev => [...prev, { role: 'assistant', content: 'Feil: ' + err.message }]);
    }
    setLoading(false);
  }

  async function saveCase(asExample) {
    setSaving(true);
    const firstUserMsg = msgs.find(m => m.role === 'user' && typeof m.content === 'string');
    const summary = firstUserMsg?.content || 'Ukjent';
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: summary.slice(0, 200), solution: recStrat, bank: recBank, outcome: 'Sendt til bank', crm_note: crm, loan_app: loan, is_example: asExample }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSaved(true);
    } catch (err) {
      alert('Kunne ikke lagre: ' + err.message);
    }
    setSaving(false);
  }

  function reset() {
    setMsgs([]); setApiMsgs([]); setInput(''); setPhase('idle');
    setCrm(''); setLoan(''); setRecBank(''); setRecStrat('');
    setSaved(false); setAttachments([]);
  }

  const H = 'calc(100vh - 54px)';

  return (
    <div style={{ height: H, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 18px', borderBottom: '1px solid ' + C.border, background: C.surface, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        <input ref={fileRef} type="file" accept={ACCEPTED_EXTENSIONS} multiple onChange={handleFiles} style={{ display: 'none' }} />
        <button
          onClick={() => fileRef.current?.click()}
          style={{ background: 'transparent', border: '1px solid ' + C.border, color: C.muted, padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}
        >
          {uploading ? 'Leser fil...' : '+ Last opp fil'}
        </button>
        {attachments.map(att => (
          <span key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: C.gold }}>
            {att.name?.slice(0, 22)}
            <button onClick={() => removeAttachment(att.id)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 9, color: C.muted }}>PDF · Word · Excel · CSV · Bilder</div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: phase === 'done' ? '0 0 44%' : 1, display: 'flex', flexDirection: 'column', borderRight: phase === 'done' ? '1px solid ' + C.border : 'none' }}>
          {phase === 'idle' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 46, marginBottom: 16 }}>💼</div>
              <h2 style={{ color: C.gold, fontWeight: 'normal', fontSize: 19, marginBottom: 10, margin: '0 0 10px' }}>Klar til ny kundesak</h2>
              <p style={{ color: C.muted, fontSize: 12, maxWidth: 300, lineHeight: 1.9, marginBottom: 8 }}>
                Last opp filer for automatisk analyse, eller start samtalen direkte.
              </p>
              {attachments.length > 0 && (
                <p style={{ color: C.gold, fontSize: 11, marginBottom: 16 }}>{attachments.length} fil(er) klar til analyse.</p>
              )}
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
                {msgs.map((m, i) => {
                  const isUser = m.role === 'user';
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                      {!isUser && (
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: C.bg, fontWeight: 'bold', flexShrink: 0, marginRight: 7, marginTop: 2 }}>A</div>
                      )}
                      <div style={{ maxWidth: '80%', background: isUser ? '#122040' : '#0d1520', border: '1px solid ' + (isUser ? '#1e3060' : C.border), borderRadius: isUser ? '12px 12px 3px 12px' : '12px 12px 12px 3px', padding: '8px 12px', fontSize: 12, lineHeight: 1.7, color: C.text }}>
                        <SafeText text={typeof m.content === 'string' ? m.content : '[Vedlegg analysert]'} />
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: C.bg, fontWeight: 'bold' }}>A</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: C.gold, animation: 'pulse 1.2s ' + (i * 0.2) + 's infinite' }} />)}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div style={{ padding: '10px 14px', borderTop: '1px solid ' + C.border, display: 'flex', gap: 7, alignItems: 'flex-end', flexShrink: 0 }}>
                {phase === 'done' ? (
                  <div style={{ flex: 1, display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: C.green }}>Sak fullført</span>
                    {!saved ? (
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button onClick={() => saveCase(false)} disabled={saving} style={{ background: 'rgba(46,109,184,0.2)', border: '1px solid rgba(46,109,184,0.4)', color: '#6a9de0', padding: '5px 11px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>
                          {saving ? '...' : 'Lagre sak'}
                        </button>
                        <button onClick={() => saveCase(true)} disabled={saving} style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: C.gold, padding: '5px 11px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>
                          Lagre som eksempel
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 10, color: C.gold }}>Lagret – agenten lærer av denne saken</span>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 7, flex: 1, alignItems: 'flex-end' }}>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder="Skriv her... (Enter sender, Shift+Enter ny linje)"
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
                <button onClick={reset} style={{ background: 'transparent', border: '1px solid ' + C.border, color: C.muted, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit' }}>
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
            <DocBlock title="CRM-NOTAT" content={crm} accent={C.green} />
            <DocBlock title="LÅNESØKNAD – BANKRAPPORT" content={loan} accent={C.gold} />
          </div>
        )}
      </div>
    </div>
  );
}
