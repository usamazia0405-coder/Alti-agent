import { withAuth } from '../../lib/auth';
import { db } from '../../lib/db';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const isAdmin = req.user.role === 'admin';
  let query = db.from('af_cases').select('bank, advisor_name, is_example, created_at');
  if (!isAdmin) query = query.eq('advisor_id', req.user.id);

  const { data: cases } = await query;
  const all = cases || [];
  const now = new Date();

  const thisMonth = all.filter(c => {
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const byBank = {};
  const byAdvisor = {};
  for (const c of all) {
    if (c.bank) byBank[c.bank] = (byBank[c.bank] || 0) + 1;
    if (c.advisor_name) byAdvisor[c.advisor_name] = (byAdvisor[c.advisor_name] || 0) + 1;
  }

  return res.status(200).json({
    total: all.length,
    thisMonth: thisMonth.length,
    examples: all.filter(c => c.is_example).length,
    banksUsed: Object.keys(byBank).length,
    byBank,
    byAdvisor,
  });
}

export default withAuth(handler);
