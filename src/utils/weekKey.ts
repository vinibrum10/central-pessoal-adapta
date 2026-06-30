/**
 * ISO week key (ex.: "2026-W27") usado para particionar o histórico semanal
 * de vídeos do Inglês Diário. Implementação padrão ISO-8601: a semana 1 é a
 * que contém a primeira quinta-feira do ano; semanas começam na segunda.
 */
export function getISOWeekKey(date: Date = new Date()): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO: segunda=1 ... domingo=7
  const dayNumber = target.getUTCDay() === 0 ? 7 : target.getUTCDay();
  // Move para a quinta-feira da mesma semana ISO
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const isoYearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((target.getTime() - isoYearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

/** Chave da semana ISO atual (usa o relógio local do navegador). */
export function getCurrentWeekKey(): string {
  return getISOWeekKey(new Date());
}
