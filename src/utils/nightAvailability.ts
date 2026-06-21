import type { EventoAgenda } from '../types';

// Janela noturna: 19:00–22:00, seg–sex
export const NIGHT_START = 19;
export const NIGHT_END = 22;

export function getWeekDays(referenceDate: Date): Date[] {
  const d = new Date(referenceDate);
  const dow = d.getDay(); // 0=dom
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  return Array.from({ length: 5 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    day.setHours(0, 0, 0, 0);
    return day;
  });
}

export function getNightWindow(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(NIGHT_START, 0, 0, 0);
  const end = new Date(date);
  end.setHours(NIGHT_END, 0, 0, 0);
  return { start, end };
}

// Um evento invade a janela se (inicioEvento < fimJanela) AND (fimEvento > inicioJanela)
export function hasAnyEventAtNight(date: Date, events: EventoAgenda[]): boolean {
  const { start, end } = getNightWindow(date);
  const dateStr = date.toISOString().slice(0, 10);
  return events.some(ev => {
    if (ev.ignorado || !ev.bloqueiaTempo) return false;
    if (!ev.inicio.startsWith(dateStr)) {
      return false;
    }
    const evStart = new Date(ev.inicio);
    const evEnd = new Date(ev.fim);
    return evStart < end && evEnd > start;
  });
}

export type NightStatus = 'livre' | 'ocupada';

export function classifyNight(date: Date, events: EventoAgenda[]): NightStatus {
  return hasAnyEventAtNight(date, events) ? 'ocupada' : 'livre';
}

export type WeekClassification = 'leve' | 'mediana' | 'pesada';

export function classifyWeek(events: EventoAgenda[], referenceDate: Date): WeekClassification {
  const days = getWeekDays(referenceDate);
  const occupied = days.filter(d => classifyNight(d, events) === 'ocupada').length;
  if (occupied === 0 || occupied <= 1) return 'leve';
  if (occupied <= 3) return 'mediana';
  return 'pesada';
}

export function getFreeWeekNights(events: EventoAgenda[], referenceDate: Date): Date[] {
  const days = getWeekDays(referenceDate);
  return days.filter(d => classifyNight(d, events) === 'livre');
}
