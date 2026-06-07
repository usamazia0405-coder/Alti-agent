import { useState, useEffect } from 'react';
import { C, Fld, Loader } from './shared';

export default function BanksTab({ user }) {
  const [banks, setBanks] = useState([]);
  const [sel, setSel] = useState(null);
  const [bname, setBname] = useState('');
  const [guidelines, setGuidelines] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const isAdmin = user.role === 'admin';

  async function load() {
    const res = await fetch('/api/banks');
    const data = await res.json();
    setBanks(data.banks || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setSel('new'); setBname(''); setGuidelines(''); }
  function openEdit(b) { setSel(b.id); setBname(b.name); setGuidelines(b.guidelines); }
  function cancel() { setSel(null); setBname(''); setGuidelines(''); }

  async function save() {
    if (!bname.trim() || !guidelines.trim()) return;
    setSaving(true);
    try {
      if (sel === 'new') {
        await fetch('/api/banks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: bname, guidelines }) });
      } else {
        await fetch('/api/banks?id=' + sel, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: bname, guidelines }) });
      }
      await load();
      cancel();
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function remove(id) {
    if (!confirm('Slett denne banken?')) return;
    await fetch('/api/banks?id=' + id, { method: 'DELETE' });
    await load();
    if (sel === id) cancel();
  }

  if (loading) return <Loader />;

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex' }}>
      <div style={{ width: 250, borderRight: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', background: C.surface, flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Banker ({banks.length})</span>
          {isAdmin && (
            <button onClick={openNew} style={{ background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', border: 'none', color: C.bg, padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 'bold', fontFamily: 'inherit' }}>+ Ny</button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {banks.length === 0 && (
            <div style={{ padding: 18, textAlign: 'center', color: C.muted, fontSize: 11, lineHeight: 1.8 }}>
              {isAdmin ? 'Klikk + Ny for å legge inn banker.' : 'Admin legger inn banker.'}
            </div>
          )}
          {banks.map(b => {
            const active = sel === b.id;
            return (
              <div
                key={b.id}
                onClick={() => openEdit(b)}
                style={{ padding: '10px 13px', borderBottom: '1px solid ' + C.border, cursor: 'pointer', background: active ? 'rgba(201,168,76,0.1)' : 'transparent', borderLeft: '3px solid ' + (active ? C.gold : 'transparent') }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: active ? C.gold : C.text }}>{b.name}</span>
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); remove(b.id); }} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>×</button>
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
            <p style={{ color: C.muted, fontSize: 12, maxWidth: 320, lineHeight: 1.85 }}>
              Legg inn retningslinjer for hver bank. Jo mer detaljert, jo bedre matcher agenten.
            </p>
          </div>
        ) : (
          <div style={{ maxWidth: 620 }}>
            <h3 style={{ color: C.gold, fontWeight: 'normal', fontSize: 16, marginBottom: 20 }}>
              {sel === 'new' ? 'Ny bank' : 'Rediger: ' + bname}
            </h3>
            <Fld label="Banknavn" value={bname} onChange={setBname} placeholder="f.eks. Monobank, Bank Norwegian" disabled={!isAdmin} />
            <div style={{ marginBottom: 6 }}>
              <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Retningslinjer</label>
              <textarea
                value={guidelines}
                onChange={e => setGuidelines(e.target.value)}
                rows={14}
                disabled={!isAdmin}
                placeholder={'Maks gjeldsgrad: 500%\nMaks LTV: 85%\nAksepterer betalingsanmerkninger: Nei\n...'}
                style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, padding: '10px 12px', color: C.text, fontSize: 12, fontFamily: 'inherit', lineHeight: 1.75, resize: 'vertical', outline: 'none', opacity: isAdmin ? 1 : 0.65 }}
              />
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 9 }}>
                <button onClick={save} disabled={saving || !bname.trim() || !guidelines.trim()} style={{ background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', border: 'none', color: C.bg, padding: '9px 24px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', fontFamily: 'inherit' }}>
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
