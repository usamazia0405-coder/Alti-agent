import { useState, useEffect } from 'react';
import Head from 'next/head';
import AuthScreen from '../components/AuthScreen';
import AgentTab from '../components/AgentTab';
import CasesTab from '../components/CasesTab';
import BanksTab from '../components/BanksTab';
import KnowledgeTab from '../components/KnowledgeTab';
import StatsTab from '../components/StatsTab';
import AdminTab from '../components/AdminTab';
import { C } from '../components/shared';

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('agent');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { setUser(d.user || null); setReady(true); })
      .catch(() => setReady(true));
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setTab('agent');
  }

  if (!ready) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.gold, fontFamily: 'Georgia,serif', fontSize: 16 }}>Laster...</div>
      </div>
    );
  }

  if (!user) return <AuthScreen onLogin={setUser} />;

  const tabs = [
    { id: 'agent', label: 'Agent' },
    { id: 'cases', label: 'Saker' },
    { id: 'banks', label: 'Banker' },
    { id: 'knowledge', label: 'Kunnskap' },
    { id: 'stats', label: 'Statistikk' },
    ...(user.role === 'admin' ? [{ id: 'admin', label: 'Admin' }] : []),
  ];

  return (
    <>
      <Head>
        <title>Alti Finans – Intelligence System</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "Georgia,'Times New Roman',serif", color: C.text, display: 'flex', flexDirection: 'column' }}>

        <header style={{ borderBottom: '1px solid ' + C.border, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.surface, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: C.bg, fontSize: 13 }}>A</div>
            <div>
              <div style={{ color: C.gold, fontWeight: 'bold', fontSize: 13, letterSpacing: '0.07em' }}>ALTI FINANS</div>
              <div style={{ color: C.muted, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Intelligence System</div>
            </div>
          </div>

          <nav style={{ display: 'flex', gap: 3 }}>
            {tabs.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
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
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: C.muted }}>{user.name}</span>
            {user.role === 'admin' && (
              <span style={{ fontSize: 9, color: C.gold, border: '1px solid ' + C.gold, borderRadius: 3, padding: '1px 5px', letterSpacing: '0.08em' }}>ADMIN</span>
            )}
            <button
              onClick={logout}
              style={{ background: 'transparent', border: '1px solid ' + C.border, color: C.muted, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit' }}
            >
              Logg ut
            </button>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'hidden' }}>
          {tab === 'agent' && <AgentTab user={user} />}
          {tab === 'cases' && <CasesTab user={user} />}
          {tab === 'banks' && <BanksTab user={user} />}
          {tab === 'knowledge' && <KnowledgeTab user={user} />}
          {tab === 'stats' && <StatsTab user={user} />}
          {tab === 'admin' && user.role === 'admin' && <AdminTab user={user} />}
        </main>

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
