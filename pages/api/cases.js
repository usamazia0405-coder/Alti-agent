import { withAuth } from '../../lib/auth';
import { db, newId } from '../../lib/db';

async function handler(req, res) {
  if (req.method === 'GET') {
    const isAdmin = req.user.role === 'admin';
    let query = db.from('af_cases').select('*').order('created_at', { ascending: false });
    if (!isAdmin) query = query.eq('advisor_id', req.user.id);
    const { data } = await query;
    return res.status(200).json({ cases: data || [] });
  }

  if (req.method === 'POST') {
    const { summary, solution, bank, outcome, crm_note, loan_app, is_example } = req.body || {};
    const { data, error } = await db
      .from('af_cases')
      .insert({
        id: newId(),
        advisor_id: req.user.id,
        advisor_name: req.user.name,
        summary: String(summary || '').slice(0, 200),
        solution: solution || null,
        bank: bank || null,
        outcome: outcome || null,
        crm_note: crm_note || null,
        loan_app: loan_app || null,
        is_example: Boolean(is_example),
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'Kunne ikke lagre saken.' });
    return res.status(201).json({ case: data });
  }

  if (req.method === 'PATCH') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Mangler sak-ID.' });
    const allowed = ['is_example', 'outcome', 'bank', 'solution'];
    const updates = {};
    for (const key of allowed) {
      if (key in (req.body || {})) updates[key] = req.body[key];
    }
    let query = db.from('af_cases').update(updates).eq('id', id);
    if (req.user.role !== 'admin') query = query.eq('advisor_id', req.user.id);
    await query;
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Mangler sak-ID.' });
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Kun admin kan slette saker.' });
    }
    await db.from('af_cases').delete().eq('id', id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}

export default withAuth(handler);
