import { getIronSession } from 'iron-session';
import { sessionOptions } from '../../../lib/session';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getIronSession(req, res, sessionOptions);
  session.destroy();
  return res.status(200).json({ ok: true });
}
