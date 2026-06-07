import { useState, useEffect } from 'react';
import { C, Loader } from './shared';

export default function AdminTab({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleRole(u) {
    setBusy(u.id);
    setError('');
    const newRole = u.role === 'admin' ? 'advisor' : 'admin';
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, role: newRole }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else await load();
    setBusy(null);
  }

  async function deleteUser(u) {
    if (!confirm(`Slett ${u.name}?\n\nDette kan ikke angres. Alle brukerens saker vil fortsatt eksistere, men kontoen slettes.`)) return;
    setBusy(u.id);
    setError('');
    const res = await fetch('/api/admin/users?id=' + u.id, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else await load();
    setBusy(null);
  }

  if (loading) return <Loader />;

  const ownerEmail = '';

  return (
    <div style={{ padding: 26, overflowY: 'auto', height: 'calc(100vh - 54px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <h2 style={{ color: C.gold, fontWeight: 'normal', fontSize: 17, margin: 0 }}>Brukere ({users.length})</h2>
        <div style={{ fontSize: 10, color: C.muted }}>
          Kun admin kan gi/fjerne roller. Eieren kan aldri degraderes.
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 12, marginBottom: 16, padding: '8px 12px', background: 'rgba(168,72,72,0.1)', border: '1px solid rgba(168,72,72,0.4)', borderRadius: 4, color: '#e08080' }}>
          {error}
        </div>
      )}

      <div style={{ maxWidth: 720 }}>
        {users.map(u => {
          const isSelf = u.id === user.id;
          const isBusy = busy === u.id;
          return (
            <div
              key={u.id}
              style={{ background: C.surface, border: '1px solid ' + (isSelf ? C.gold + '44' : C.border), borderRadius: 8, padding: '14px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.text, fontWeight: isSelf ? 'bold' : 'normal' }}>
                  {u.name}
                  {isSelf && <span style={{ color: C.muted, fontSize: 10, fontWeight: 'normal' }}> (deg)</span>}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                  {u.email} · Registrert {new Date(u.created_at).toLocaleDateString('no-NO')}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{
                  fontSize: 9, color: u.role === 'admin' ? C.gold : C.muted,
                  border: '1px solid ' + (u.role === 'admin' ? C.gold : C.border),
                  borderRadius: 3, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {u.role === 'admin' ? 'Admin' : 'Rådgiver'}
                </span>

                {!isSelf && (
                  <>
                    <button
                      onClick={() => toggleRole(u)}
                      disabled={isBusy}
                      style={{ background: 'transparent', border: '1px solid ' + C.border, color: C.muted, padding: '4px 11px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}
                    >
                      {isBusy ? '...' : u.role === 'admin' ? 'Fjern admin' : 'Gi admin'}
                    </button>
                    <button
                      onClick={() => deleteUser(u)}
                      disabled={isBusy}
                      style={{ background: 'rgba(168,72,72,0.1)', border: '1px solid rgba(168,72,72,0.3)', color: '#e07070', padding: '4px 11px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}
                    >
                      Slett
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
