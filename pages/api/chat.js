import { withAuth } from '../../lib/auth';
import { db } from '../../lib/db';
import { rateLimit } from '../../lib/rateLimit';

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

async function buildSystemPrompt(userName) {
  const [banksRes, knowledgeRes, examplesRes] = await Promise.all([
    db.from('af_banks').select('name, guidelines').order('name'),
    db.from('af_knowledge').select('title, content').order('title'),
    db.from('af_cases')
      .select('summary, solution, bank')
      .eq('is_example', true)
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  const banks = banksRes.data || [];
  const knowledge = knowledgeRes.data || [];
  const examples = examplesRes.data || [];

  const bankSec = banks.length
    ? banks.map(b => `### ${b.name}\n${b.guidelines}`).join('\n\n')
    : 'Ingen banker registrert ennå.';

  const knowledgeSec = knowledge.length
    ? knowledge.map(k => `### ${k.title}\n${k.content}`).join('\n\n')
    : 'Ingen løsningsstrategier lagt inn ennå.';

  const exampleSec = examples.length
    ? 'Disse sakene har fungert godt:\n\n' +
      examples
        .map(ex => `SAK: ${ex.summary}\nLØSNING: ${ex.solution || 'ikke oppgitt'}\nBANK: ${ex.bank || 'ikke oppgitt'}`)
        .join('\n---\n')
    : 'Ingen eksempelsaker ennå.';

  return `Du er ekspert finansrådgiver-assistent for Alti Finans (Finanstilsynet-lisensiert). Du hjelper rådgiver ${userName}.

## BANKRETNINGSLINJER
${bankSec}

## LØSNINGSSTRATEGIER
${knowledgeSec}

## EKSEMPELSAKER
${exampleSec}

Still strukturerte spørsmål ett eller to av gangen. Dekk: navn, inntekt, gjeld, formål, sikkerhet, betalingsanmerkninger, sivilstatus, barn.
Bruk kalkulatortallene og match mot bankretningslinjene.

Når du har nok info, skriv KLAR TIL UTFYLLING og presenter:
**CRM-NOTAT:**
[sammendrag]
**LÅNESØKNAD - BANKRAPPORT:**
[ferdig til bank]
**ANBEFALT BANK:** [navn]
**LØSNINGSSTRATEGI:** [kort beskrivelse]

Snakk alltid norsk. Vær direkte og profesjonell.`;
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!rateLimit(`chat:${req.user.id}`, { limit: 30, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'For mange forespørsler. Vent litt og prøv igjen.' });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Meldinger mangler.' });
  }

  const systemPrompt = await buildSystemPrompt(req.user.name);

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      }),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Kunne ikke nå AI-tjenesten.' });
  }

  const data = await response.json();
  if (!response.ok) {
    return res.status(response.status).json({ error: data.error?.message || 'AI-feil.' });
  }

  return res.status(200).json(data);
}

export default withAuth(handler);
