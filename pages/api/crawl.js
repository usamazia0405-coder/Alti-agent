import { withAuth } from '../../lib/auth';
import { rateLimit } from '../../lib/rateLimit';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Kun admin.' });

  if (!rateLimit(`crawl:${req.user.id}`, { limit: 10, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'For mange forespørsler. Vent litt.' });
  }

  const { url } = req.body || {};
  if (!url?.trim()) return res.status(400).json({ error: 'URL mangler.' });

  let parsedUrl;
  try {
    parsedUrl = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Kun http og https støttes.');
    }
  } catch (e) {
    return res.status(400).json({ error: 'Ugyldig lenke: ' + e.message });
  }

  let html;
  try {
    const response = await fetch(parsedUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'no,nb;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error('Siden svarte med feil ' + response.status);
    html = await response.text();
  } catch (e) {
    return res.status(502).json({ error: 'Kunne ikke laste siden: ' + e.message });
  }

  const titleMatch = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/\s+/g, ' ').trim()
    : parsedUrl.hostname;

  const content = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 8000);

  if (!content || content.length < 80) {
    return res.status(422).json({ error: 'Fikk ikke hentet lesbart innhold fra denne siden. Prøv en annen lenke.' });
  }

  return res.status(200).json({ title, content, url: parsedUrl.href });
}

export default withAuth(handler);
