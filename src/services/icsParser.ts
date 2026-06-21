import type { EventoAgenda } from '../types';

function parseICSDate(val: string): string {
  // YYYYMMDDTHHMMSSZ or YYYYMMDD
  const clean = val.replace(/[TZ]/g, '');
  if (clean.length >= 8) {
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    if (clean.length >= 14) {
      const h = clean.slice(8, 10);
      const min = clean.slice(10, 12);
      const s = clean.slice(12, 14);
      return `${y}-${m}-${d}T${h}:${min}:${s}`;
    }
    return `${y}-${m}-${d}`;
  }
  return val;
}

export function parseICS(icsText: string): EventoAgenda[] {
  const eventos: EventoAgenda[] = [];
  const lines = icsText.replace(/\r\n /g, '').replace(/\r\n/g, '\n').split('\n');

  let inEvent = false;
  let current: Record<string, string> = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; current = {}; continue; }
    if (line === 'END:VEVENT') {
      inEvent = false;
      if (current['DTSTART'] && current['DTEND']) {
        const inicio = parseICSDate(current['DTSTART'] ?? '');
        const fim = parseICSDate(current['DTEND'] ?? '');
        const diaInteiro = (current['DTSTART'] ?? '').length === 8 || (current['DTSTART'] ?? '').includes('VALUE=DATE');
        eventos.push({
          id: `ics-${current['UID'] ?? Math.random().toString(36).slice(2)}`,
          fonte: 'ics',
          titulo: current['SUMMARY'] ?? '(sem título)',
          descricao: current['DESCRIPTION'],
          inicio: diaInteiro ? `${inicio}T00:00:00` : inicio,
          fim: diaInteiro ? `${fim}T23:59:59` : fim,
          diaInteiro,
          local: current['LOCATION'],
          bloqueiaTempo: !diaInteiro,
          importadoEm: new Date().toISOString(),
          tarefaGeradaId: null,
          ignorado: false,
        });
      }
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).split(';')[0].toUpperCase();
    const value = line.slice(colonIdx + 1);
    current[key] = value;
  }

  return eventos;
}

export async function importarICSDeUrl(url: string): Promise<EventoAgenda[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao buscar calendário ICS: ${res.status}`);
  const text = await res.text();
  return parseICS(text);
}
