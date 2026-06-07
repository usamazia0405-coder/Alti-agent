import { useState } from 'react';

export const C = {
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

export function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 54px)', color: C.muted, fontSize: 13, fontFamily: 'Georgia,serif' }}>
      Laster...
    </div>
  );
}

export function Fld({ label, value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'off'}
        style={{ width: '100%', background: C.bg, border: '1px solid ' + C.border, borderRadius: 6, padding: '9px 12px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', opacity: disabled ? 0.65 : 1 }}
      />
    </div>
  );
}

export function SafeText({ text }) {
  if (!text) return null;
  const lines = String(text).split('\n');
  return (
    <>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/);
        return (
          <span key={li}>
            {parts.map((part, pi) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={pi}>{part.slice(2, -2)}</strong>
                : part
            )}
            {li < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

export function Pill({ label, value, warn }) {
  const color = warn ? C.red : C.green;
  return (
    <span style={{ background: warn ? 'rgba(168,72,72,0.2)' : 'rgba(58,158,106,0.2)', border: '1px solid ' + color + '44', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: warn ? '#e07070' : '#5ebd8e' }}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

export function DocBlock({ title, content, accent }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ padding: '8px 13px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: accent, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{title}</span>
        <button onClick={copy} style={{ background: 'transparent', border: '1px solid ' + C.border, color: copied ? accent : C.muted, padding: '2px 9px', borderRadius: 4, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit' }}>
          {copied ? 'Kopiert' : 'Kopier'}
        </button>
      </div>
      <div style={{ padding: '11px 13px', fontSize: 11, lineHeight: 1.8, color: '#b8b0a8', whiteSpace: 'pre-wrap', fontFamily: 'Courier New,monospace' }}>
        {content || ''}
      </div>
    </div>
  );
}

export function IRow({ label, value }) {
  return (
    <div style={{ marginBottom: 10, background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, padding: '8px 13px' }}>
      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: C.text }}>{value}</div>
    </div>
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div style={{ fontSize: 12, marginBottom: 12, padding: '8px 12px', background: 'rgba(168,72,72,0.1)', border: '1px solid rgba(168,72,72,0.4)', borderRadius: 4, color: '#e08080' }}>
      {message}
    </div>
  );
}
