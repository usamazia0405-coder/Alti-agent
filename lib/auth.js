import { getIronSession } from 'iron-session';
import { sessionOptions } from './session';

export async function getSession(req, res) {
  return getIronSession(req, res, sessionOptions);
}

export function withAuth(handler, { adminOnly = false } = {}) {
  return async (req, res) => {
    let session;
    try {
      session = await getSession(req, res);
    } catch {
      return res.status(500).json({ error: 'Sesjonsfeil.' });
    }
    if (!session.user) {
      return res.status(401).json({ error: 'Innlogging kreves.' });
    }
    if (adminOnly && session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin-tilgang kreves.' });
    }
    req.user = session.user;
    return handler(req, res);
  };
}
