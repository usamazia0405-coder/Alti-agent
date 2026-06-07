export async function parseExcelBuffer(buffer) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const lines = [];
  for (const sheetName of wb.SheetNames) {
    lines.push(`=== ${sheetName} ===`);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
    for (const row of rows) {
      const cells = row.filter(c => c !== '').join('\t');
      if (cells) lines.push(cells);
    }
  }
  return lines.join('\n');
}

export async function parseWordBuffer(buffer) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
