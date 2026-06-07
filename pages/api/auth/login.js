import bcrypt from 'bcryptjs';
import { getIronSession } from 'iron-session';
import { db } from '../../../lib/db';
import { sessionOptions } from '../../../lib/session';
import { rateLimit, getIp } from '../../../lib/rateLimit';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!rateLimit(`login:${getIp(req)}`, { limit: 10, windowMs: 15 * 60_000 })) {
    return res.status(429).json({ error: 'For mange forsøk. Prøv igjen om 15 minutter.' });
  }

  const { email, password } = req.body || {};
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'E-post og passord er påkrevd.' });
  }

  const { data: user } = await db
    .from('af_users')
    .select('id, name, email, role, password')
    .eq('email', email.trim().toLowerCase())
    .single();

  if (!user || !bcrypt.compareSync(password, user.password || '')) {
    return res.status(401).json({ error: 'Feil e-post eller passord.' });
  }

  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (ownerEmail && user.email === ownerEmail && user.role !== 'admin') {
    await db.from('af_users').update({ role: 'admin' }).eq('id', user.id);
    user.role = 'admin';
  }

  const session = await getIronSession(req, res, sessionOptions);
  session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  await session.save();

  return res.status(200).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
