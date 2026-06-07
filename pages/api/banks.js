import { withAuth } from '../../lib/auth';
import { db, newId } from '../../lib/db';

async function handler(req, res) {
  if (req.method === 'GET') {
    const { data } = await db.from('af_banks').select('*').order('name');
    return res.status(200).json({ banks: data || [] });
  }

  if (req.method === 'POST') {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Kun admin.' });
    const { name, guidelines } = req.body || {};
    if (!name?.trim() || !guidelines?.trim()) {
      return res.status(400).json({ error: 'Navn og retningslinjer er påkrevd.' });
    }
    const { data, error } = await db
      .from('af_banks')
      .insert({ id: newId(), name: name.trim(), guidelines: guidelines.trim(), created_by: req.user.id, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'Kunne ikke lagre.' });
    return res.status(201).json({ bank: data });
  }

  if (req.method === 'PATCH') {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Kun admin.' });
    const { id } = req.query;
    const { name, guidelines } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Mangler ID.' });
    await db.from('af_banks').update({ name: name?.trim(), guidelines: guidelines?.trim(), updated_at: new Date().toISOString() }).eq('id', id);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Kun admin.' });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Mangler ID.' });
    await db.from('af_banks').delete().eq('id', id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}

export default withAuth(handler);
