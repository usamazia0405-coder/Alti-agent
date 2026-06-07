import { withAuth } from '../../lib/auth';
import { parseExcelBuffer, parseWordBuffer } from '../../lib/parseFile';

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { fileName, fileType, data } = req.body || {};
  if (!data || !fileName) {
    return res.status(400).json({ error: 'Mangler fildata.' });
  }

  const ext = fileName.split('.').pop().toLowerCase();
  let buffer;
  try {
    buffer = Buffer.from(data, 'base64');
  } catch {
    return res.status(400).json({ error: 'Ugyldig fildata.' });
  }

  try {
    if (ext === 'pdf') {
      return res.status(200).json({ type: 'document', mediaType: 'application/pdf', data, name: fileName });
    }

    if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) {
      const text = await parseExcelBuffer(buffer);
      return res.status(200).json({ type: 'text', content: text, name: fileName });
    }

    if (ext === 'docx') {
      const text = await parseWordBuffer(buffer);
      return res.status(200).json({ type: 'text', content: text, name: fileName });
    }

    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      const mediaTypeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
      return res.status(200).json({ type: 'image', mediaType: mediaTypeMap[ext], data, name: fileName });
    }

    return res.status(400).json({ error: `Filtype .${ext} støttes ikke. Støttede typer: PDF, Word, Excel, CSV, PNG, JPG, WEBP.` });
  } catch (err) {
    return res.status(500).json({ error: 'Kunne ikke lese filen: ' + err.message });
  }
}

export default withAuth(handler);
