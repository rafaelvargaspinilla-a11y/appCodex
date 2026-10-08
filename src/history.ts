import type { Day } from './model';
export type HistoryFile = { name: string; text: string };
export type HistoryArchive = { format: 'beast-log-history'; version: 1; files: HistoryFile[] };
export type HistoricalSession = { id: string; block: number; week: number; day: Day; source: string; lines: { number: number; text: string; warning: string }[] };
export function parseHistory(value: unknown): HistoryArchive {
  const d = value as HistoryArchive;
  if (!d || d.format !== 'beast-log-history' || d.version !== 1 || !Array.isArray(d.files) || !d.files.length || d.files.length > 100 || d.files.some(f => !f || typeof f.name !== 'string' || f.name.length > 200 || typeof f.text !== 'string' || f.text.length > 2_000_000)) throw new Error('El archivo no tiene un formato válido de histórico.');
  const blocks = new Set<number>();
  for (const f of d.files) {
    const block = Number(f.text.match(/^\s*Bloque\s+(\d+)\s*$/mi)?.[1]);
    if (!block || blocks.has(block) || !historicalSessions({ ...d, files: [f] }).length) throw new Error('Cada archivo debe contener un bloque distinto con semanas y días reconocibles.');
    blocks.add(block);
  }
  return { format: d.format, version: 1, files: d.files.map(f => ({ name: f.name, text: f.text })) };
}
export function historicalSessions(archive?: HistoryArchive): HistoricalSession[] {
  const sessions: HistoricalSession[] = [];
  for (const file of archive?.files ?? []) {
    let block = 0, week = 0;
    let current: HistoricalSession | undefined;
    file.text.split(/\r?\n/).forEach((text, i) => {
      const line = text.trim();
      const b = line.match(/^Bloque\s+(\d+)$/i), w = line.match(/^Semana\s+(\d+)$/i);
      const day = line.match(/^(?:D[ií]a\s+([ABC])|(Brazos))\s*$/i);
      if (b) { block = Number(b[1]); current = undefined; }
      else if (w) { week = Number(w[1]); current = undefined; }
      else if (day && block && week) {
        const d = (day[2] ? 'Brazos' : day[1].toUpperCase()) as Day;
        current = { id: `archive-${block}-${week}-${d}-${i}`, block, week, day: d, source: file.name, lines: [] };
        sessions.push(current);
      } else if (line && current) {
        let warning = '';
        if (block === 7 && [3, 4].includes(week) && /prensa unilateral/i.test(line)) warning = 'Entrada copiada de búlgara: carga y resultados excluidos de comparaciones.';
        else if (/barra rara/i.test(line)) warning = 'Barra sin peso confirmado: carga excluida de comparaciones.';
        else if (/\bcluster\b|\bdropset\b|\bDS\b|\+x|sobrao|creo|por ah[ií]|EEUU/i.test(line)) warning = 'Anotación especial o incierta: consultar el original antes de comparar.';
        current.lines.push({ number: i + 1, text, warning });
      }
    });
  }
  return sessions.sort((a,b) => b.block-a.block || b.week-a.week || ['A','B','C','Brazos'].indexOf(b.day)-['A','B','C','Brazos'].indexOf(a.day));
}
export function mergeHistory(existing: HistoryArchive | undefined, incoming: HistoryArchive): HistoryArchive {
  const files = [...(existing?.files ?? [])];
  for (const file of incoming.files) {
    const block = file.text.match(/^\s*Bloque\s+(\d+)\s*$/mi)?.[1];
    const old = files.find(f => f.text.match(/^\s*Bloque\s+(\d+)\s*$/mi)?.[1] === block);
    if (old && old.text !== file.text) throw new Error(`El bloque ${block} ya existe con otro contenido. No se ha sobrescrito.`);
    if (!old) files.push(file);
  }
  return parseHistory({ format: 'beast-log-history', version: 1, files });
}
