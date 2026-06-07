import { useState, useEffect } from 'react';
import { C, Loader, IRow, DocBlock } from './shared';

export default function CasesTab({ user }) {
  const [cases, setCases] = useState([]);
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch('/api/cases');
    const data = await res.json();
    setCases(data.cases || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleExample(c) {
    await fetch('/api/cases?id=' + c.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_example: !c.is_example }),
    });
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, is_example: !x.is_example } : x));
    setSel(s => s?.id === c.id ? { ...s, is_example: !s.is_example } : s);
  }

  async function deleteCase(c) {
    if (!confirm('Slett saken?\nDette kan ikke angres.')) return;
    await fetch('/api/cases?id=' + c.id, { method: 'DELETE' });
    setCases(prev => prev.filter(x => x.id !== c.id));
    if (sel?.id === c.id) setSel(null);
  }

  if (loading) return <Loader />;

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex' }}>
      <div style={{ width: 290, borderRight: '1px solid ' + C.border, overflowY: 'auto', background: C.surface, flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid ' + C.border, fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {cases.length} saker {user.role === 'admin' ? '(alle rådgivere)' : ''}
        </div>
        {cases.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 12, lineHeight: 1.7 }}>Ingen saker ennå.</div>
        )}
        {cases.map(c => {
          const active = sel?.id === c.id;
          return (
            <div
              key={c.id}
              onClick={() => setSel(c)}
              style={{ padding: '10px 14px', borderBottom: '1px solid ' + C.border, cursor: 'pointer', background: active ? 'rgba(201,168,76,0.08)' : 'transparent', borderLeft: '3px solid ' + (c.is_example ? C.gold : 'transparent') }}
            >
              <div style={{ fontSize: 11, color: active ? C.gold : C.text, marginBottom: 3, lineHeight: 1.4 }}>
                {(c.summary || 'Ukjent').slice(0, 55)}...
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {c.bank && <span style={{ fontSize: 9, color: C.blue }}>{c.bank}</span>}
                {c.is_example && <span style={{ fontSize: 9, color: C.gold }}>Eksempel</span>}
                <span style={{ fontSize: 9, color: C.muted, marginLeft: 'auto' }}>
                  {new Date(c.created_at).toLocaleDateString('no-NO')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!sel ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontSize: 13 }}>
            Velg en sak fra listen
          </div>
        ) : (
          <div style={{ maxWidth: 660 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ color: C.gold, fontWeight: 'normal', fontSize: 15, margin: 0 }}>Saksdetaljer</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggleExample(sel)}
                  style={{ background: sel.is_example ? 'rgba(201,168,76,0.15)' : 'transparent', border: '1px solid ' + (sel.is_example ? C.gold : C.border), color: sel.is_example ? C.gold : C.muted, padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}
                >
                  {sel.is_example ? 'Fjern eksempel' : 'Merk som eksempel'}
                </button>
                {user.role === 'admin' && (
                  <button
                    onClick={() => deleteCase(sel)}
                    style={{ background: 'rgba(168,72,72,0.1)', border: '1px solid rgba(168,72,72,0.3)', color: '#e07070', padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}
                  >
                    Slett sak
                  </button>
                )}
              </div>
            </div>
            {sel.bank && <IRow label="Bank" value={sel.bank} />}
            {sel.solution && <IRow label="Strategi" value={sel.solution} />}
            {user.role === 'admin' && sel.advisor_name && <IRow label="Rådgiver" value={sel.advisor_name} />}
            {sel.crm_note && <DocBlock title="CRM-NOTAT" content={sel.crm_note} accent={C.green} />}
            {sel.loan_app && <DocBlock title="LÅNESØKNAD" content={sel.loan_app} accent={C.gold} />}
          </div>
        )}
      </div>
    </div>
  );
}
