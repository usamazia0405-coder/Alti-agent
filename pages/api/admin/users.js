import { withAuth } from '../../../lib/auth';
import { db } from '../../../lib/db';

async function handler(req, res) {
  if (req.method === 'GET') {
    const { data: users } = await db
      .from('af_users')
      .select('id, name, email, role, created_at')
      .order('created_at');
    return res.status(200).json({ users: users || [] });
  }

  if (req.method === 'PATCH') {
    const { id, role } = req.body || {};
    if (!id || !['admin', 'advisor'].includes(role)) {
      return res.status(400).json({ error: 'Ugyldig forespørsel.' });
    }
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    const { data: target } = await db.from('af_users').select('email').eq('id', id).single();
    if (ownerEmail && target?.email === ownerEmail) {
      return res.status(403).json({ error: 'Kan ikke endre eierens rolle.' });
    }
    await db.from('af_users').update({ role }).eq('id', id);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Mangler bruker-ID.' });
    if (id === req.user.id) {
      return res.status(403).json({ error: 'Kan ikke slette din egen konto.' });
    }
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    const { data: target } = await db.from('af_users').select('email').eq('id', id).single();
    if (ownerEmail && target?.email === ownerEmail) {
      return res.status(403).json({ error: 'Kan ikke slette eieren.' });
    }
    await db.from('af_users').delete().eq('id', id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}

export default withAuth(handler, { adminOnly: true });
