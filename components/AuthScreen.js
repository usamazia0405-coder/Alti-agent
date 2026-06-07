import { useState } from 'react';
import { C, Fld, ErrorBox } from './shared';

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { name, email, password };
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Noe gikk galt.');
      onLogin(data.user);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter') submit();
  }

  const tabBtn = active => ({
    flex: 1,
    background: active ? 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')' : 'transparent',
    border: '1px solid ' + (active ? C.gold : C.border),
    color: active ? C.bg : C.muted,
    padding: '7px', borderRadius: 4, cursor: 'pointer',
    fontSize: 11, fontFamily: 'inherit', fontWeight: active ? 'bold' : 'normal',
  });

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "Georgia,'Times New Roman',serif" }}>
      <div style={{ width: 400, background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: C.bg, fontSize: 21, margin: '0 auto 12px' }}>
            A
          </div>
          <div style={{ color: C.gold, fontWeight: 'bold', fontSize: 17, letterSpacing: '0.07em' }}>ALTI FINANS</div>
          <div style={{ color: C.muted, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 3 }}>Intelligence System</div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 22 }}>
          <button onClick={() => { setMode('login'); setError(''); }} style={tabBtn(mode === 'login')}>Logg inn</button>
          <button onClick={() => { setMode('register'); setError(''); }} style={tabBtn(mode === 'register')}>Registrer deg</button>
        </div>

        {mode === 'register' && (
          <Fld label="Fullt navn" value={name} onChange={setName} placeholder="Ola Nordmann" />
        )}
        <Fld label="E-post" value={email} onChange={setEmail} placeholder="ola@altifinans.no" type="email" />
        <div onKeyDown={handleKey}>
          <Fld label="Passord" value={password} onChange={setPassword} placeholder="Minimum 8 tegn" type="password" />
        </div>

        <ErrorBox message={error} />

        <button
          onClick={submit}
          disabled={loading}
          style={{ width: '100%', background: 'linear-gradient(135deg,' + C.gold + ',' + C.goldL + ')', border: 'none', color: C.bg, padding: '11px', borderRadius: 6, cursor: loading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 'bold', fontFamily: 'inherit', marginBottom: 12 }}
        >
          {loading ? 'Vennligst vent...' : mode === 'login' ? 'Logg inn' : 'Opprett konto'}
        </button>

        {mode === 'register' && (
          <p style={{ color: C.muted, fontSize: 10, textAlign: 'center', margin: 0, lineHeight: 1.7 }}>
            Admin-tilgang tildeles av systemets eier.
          </p>
        )}
      </div>
    </div>
  );
}
