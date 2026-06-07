import { useState, useEffect } from 'react';
import { C, Fld, Loader } from './shared';

export default function KnowledgeTab({ user }) {
  const [knowledge, setKnowledge] = useState([]);
  const [sel, setSel] = useState(null);
  const [ktitle, setKtitle] = useState('');
  const [kcontent, setKcontent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState('');
  const isAdmin = user.role === 'admin';

  async function load() {
    const res = await fetch('/api/knowledge');
    const data = await res.json();
    setKnowledge(data.knowledge || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setSel('new'); setKtitle(''); setKcontent(''); setUrlInput(''); setCrawlError(''); }
  function openEdit(k) { setSel(k.id); setKtitle(k.title); setKcontent(k.content); setUrlInput(''); setCrawlError(''); }
  function cancel() { setSel(null); setKtitle(''); setKcontent(''); setUrlInput(''); setCrawlError(''); }

  async function fetchFromUrl() {
    if (!urlInput.trim()) return;
    setCrawling(true);
    setCrawlError('');
    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKtitle(data.title);
      setKcontent(data.content);
    } catch (e) {
      setCrawlError(e.message);
    }
    setCrawling(false);
  }

  async function save() {
    if (!ktitle.trim() || !kcontent.trim()) return;
    setSaving(true);
    try {
      if (sel === 'new') {
        await fetch('/api/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: ktitle, content: kcontent }) });
      } else {
        await fetch('/api/knowledge?id=' + sel, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: ktitle, content: kcontent }) });
      }
      await load();
      cancel();
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function remove(id) {
    if (!confirm('Slett denne artikkelen?')) return;
    await fetch('/api/knowledge?id=' + id, { method: 'DELETE' });
    await load();
    if (sel === id) cancel();
  }

  if (loading) return <Loader />;

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex' }}>
      <div style={{ width: 260, borderRight: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', background: C.surface, flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Kunnskap ({knowledge.length})</span>
          {isAdmin && (
            <button onClick={openNew} style={{ background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', border: 'none', color: C.bg, padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 'bold', fontFamily: 'inherit' }}>+ Ny</button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {knowledge.length === 0 && (
            <div style={{ padding: 18, textAlign: 'center', color: C.muted, fontSize: 11, lineHeight: 1.8 }}>
              {isAdmin ? 'Legg inn løsningsstrategier.' : 'Admin legger inn kunnskap.'}
            </div>
          )}
          {knowledge.map(k => {
            const active = sel === k.id;
            return (
              <div
                key={k.id}
                onClick={() => openEdit(k)}
                style={{ padding: '10px 13px', borderBottom: '1px solid ' + C.border, cursor: 'pointer', background: active ? 'rgba(201,168,76,0.1)' : 'transparent', borderLeft: '3px solid ' + (active ? C.gold : 'transparent') }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: active ? C.gold : C.text }}>{k.title}</span>
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); remove(k.id); }} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>×</button>
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
            <p style={{ color: C.muted, fontSize: 12, maxWidth: 340, lineHeight: 1.85 }}>
              Jo mer du lærer agenten, jo bedre råd gir den rådgiverne dine.
            </p>
            <div style={{ marginTop: 16, textAlign: 'left', background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '14px 18px', maxWidth: 340 }}>
              <div style={{ fontSize: 10, color: C.gold, fontWeight: 'bold', marginBottom: 8 }}>Eksempler på artikler</div>
              {['Omstartslån – krav og strategi', 'Refinansiering med kausjonist', 'Betalingsanmerkninger – løsninger', 'Sikkerhet i eiendom', 'Selvstendig næringsdrivende'].map(t => (
                <div key={t} style={{ fontSize: 11, color: C.muted, padding: '4px 0', borderBottom: '1px solid ' + C.border }}>{t}</div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            <h3 style={{ color: C.gold, fontWeight: 'normal', fontSize: 16, marginBottom: 20 }}>
              {sel === 'new' ? 'Ny kunnskapsartikkel' : 'Rediger: ' + ktitle}
            </h3>

            {isAdmin && (
              <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: '14px 16px', marginBottom: 22 }}>
                <div style={{ fontSize: 10, color: C.gold, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  Hent fra nettside automatisk
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') fetchFromUrl(); }}
                    placeholder="https://www.bank.no/retningslinjer"
                    style={{ flex: 1, background: C.bg, border: '1px solid ' + C.border, borderRadius: 6, padding: '8px 12px', color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <button
                    onClick={fetchFromUrl}
                    disabled={crawling || !urlInput.trim()}
                    style={{ background: crawling ? C.border : 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', border: 'none', color: C.bg, padding: '8px 16px', borderRadius: 6, cursor: crawling ? 'wait' : 'pointer', fontSize: 11, fontWeight: 'bold', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                  >
                    {crawling ? 'Henter...' : 'Hent innhold'}
                  </button>
                </div>
                {crawlError && (
                  <div style={{ fontSize: 11, color: '#e07070', marginTop: 8 }}>{crawlError}</div>
                )}
                {!crawlError && (
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>
                    Lim inn lenken til en nettside – innholdet fylles automatisk inn nedenfor.
                  </div>
                )}
              </div>
            )}

            <Fld label="Tittel" value={ktitle} onChange={setKtitle} placeholder="f.eks. Omstartslån – krav og strategi" disabled={!isAdmin} />
            <div>
              <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Innhold</label>
              <textarea
                value={kcontent}
                onChange={e => setKcontent(e.target.value)}
                rows={16}
                disabled={!isAdmin}
                placeholder="Beskriv løsningsstrategier, krav, erfaringer og tips..."
                style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, padding: '10px 12px', color: C.text, fontSize: 12, fontFamily: 'inherit', lineHeight: 1.75, resize: 'vertical', outline: 'none', opacity: isAdmin ? 1 : 0.65 }}
              />
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
                <button onClick={save} disabled={saving || !ktitle.trim() || !kcontent.trim()} style={{ background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', border: 'none', color: C.bg, padding: '9px 24px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', fontFamily: 'inherit' }}>
                  {saving ? 'Lagrer...' : 'Lagre'}
                </button>
                <button onClick={cancel} style={{ background: 'transparent', border: '1px solid ' + C.border, color: C.muted, padding: '9px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Avbryt</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
