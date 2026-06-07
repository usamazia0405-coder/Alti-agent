import bcrypt from 'bcryptjs';
import { getIronSession } from 'iron-session';
import { db, newId } from '../../../lib/db';
import { sessionOptions } from '../../../lib/session';
import { rateLimit, getIp } from '../../../lib/rateLimit';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!rateLimit(`reg:${getIp(req)}`, { limit: 5, windowMs: 15 * 60_000 })) {
    return res.status(429).json({ error: 'For mange forsøk. Prøv igjen om 15 minutter.' });
  }

  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Navn, e-post og passord er påkrevd.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Passord må være minst 8 tegn.' });
  }

  const normalized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    return res.status(400).json({ error: 'Ugyldig e-postadresse.' });
  }

  const { data: existing } = await db
    .from('af_users')
    .select('id')
    .eq('email', normalized)
    .single();

  if (existing) {
    return res.status(409).json({ error: 'E-posten er allerede registrert.' });
  }

  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const role = ownerEmail && normalized === ownerEmail ? 'admin' : 'advisor';

  const hashedPassword = bcrypt.hashSync(password, 12);

  const { data: user, error } = await db
    .from('af_users')
    .insert({ id: newId(), name: name.trim(), email: normalized, password: hashedPassword, role })
    .select('id, name, email, role')
    .single();

  if (error || !user) {
    return res.status(500).json({ error: 'Kunne ikke opprette konto.' });
  }

  const session = await getIronSession(req, res, sessionOptions);
  session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  await session.save();

  return res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
