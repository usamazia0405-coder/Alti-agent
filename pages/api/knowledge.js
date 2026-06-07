import { withAuth } from '../../lib/auth';
import { db, newId } from '../../lib/db';

async function handler(req, res) {
  if (req.method === 'GET') {
    const { data } = await db.from('af_knowledge').select('*').order('title');
    return res.status(200).json({ knowledge: data || [] });
  }

  if (req.method === 'POST') {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Kun admin.' });
    const { title, content } = req.body || {};
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'Tittel og innhold er påkrevd.' });
    }
    const { data, error } = await db
      .from('af_knowledge')
      .insert({ id: newId(), title: title.trim(), content: content.trim(), created_by: req.user.id, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'Kunne ikke lagre.' });
    return res.status(201).json({ knowledge: data });
  }

  if (req.method === 'PATCH') {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Kun admin.' });
    const { id } = req.query;
    const { title, content } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Mangler ID.' });
    await db.from('af_knowledge').update({ title: title?.trim(), content: content?.trim(), updated_at: new Date().toISOString() }).eq('id', id);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Kun admin.' });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Mangler ID.' });
    await db.from('af_knowledge').delete().eq('id', id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}

export default withAuth(handler);
