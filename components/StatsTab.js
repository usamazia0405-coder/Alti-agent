import { useState, useEffect } from 'react';
import { C, Loader } from './shared';

function BarChart({ title, data, color }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(...entries.map(e => e[1]), 1);
  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: 18 }}>
      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>{title}</div>
      {entries.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 12 }}>Ingen data ennå</div>
      ) : (
        entries.map(([name, count]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.text, width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ flex: 1, background: C.bg, borderRadius: 3, height: 5 }}>
              <div style={{ width: ((count / max) * 100) + '%', background: color, height: '100%', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 10, color: color, width: 20, textAlign: 'right', fontWeight: 'bold' }}>{count}</div>
          </div>
        ))
      )}
    </div>
  );
}

export default function StatsTab({ user }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !stats) return <Loader />;

  const tiles = [
    { label: 'Totale saker', value: stats.total, color: C.blue },
    { label: 'Denne måneden', value: stats.thisMonth, color: C.green },
    { label: 'Eksempelsaker', value: stats.examples, color: C.gold },
    { label: 'Banker brukt', value: stats.banksUsed, color: '#b87830' },
  ];

  return (
    <div style={{ padding: 26, overflowY: 'auto', height: 'calc(100vh - 54px)' }}>
      <h2 style={{ color: C.gold, fontWeight: 'normal', fontSize: 17, marginBottom: 22 }}>
        Statistikk {user.role !== 'admin' ? '(dine saker)' : '(alle rådgivere)'}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 26 }}>
        {tiles.map(t => (
          <div key={t.label} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '15px 17px' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: t.color }}>{t.value}</div>
            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{t.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <BarChart title="Saker per bank" data={stats.byBank || {}} color={C.gold} />
        <BarChart title="Saker per rådgiver" data={stats.byAdvisor || {}} color={C.blue} />
      </div>
    </div>
  );
}
