import { getIronSession } from 'iron-session';
import { sessionOptions } from '../../../lib/session';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const session = await getIronSession(req, res, sessionOptions);
  if (!session.user) return res.status(200).json({ user: null });
  return res.status(200).json({ user: session.user });
}
