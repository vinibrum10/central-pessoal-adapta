import type { SugestaoCalendario } from '../types';
import type { Tarefa, Meta } from '../types';

const SUGGESTION_PREFIX = 'Sugestão SGP: ';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

function getGoogleToken(): string | null {
  // The googleCalendar service stores the token in module-level memory.
  // We retrieve it via the exported isGoogleConectado check, then call
  // the REST API directly using the same approach as googleCalendar.ts.
  // Unfortunately the token is private to that module, so we use
  // a workaround: expose via a local re-export or call fetch with
  // the token retrieved from the module.
  // Since we cannot access the module-private `tokenEmMemoria`, we
  // leverage window.__adapta_google_token if set, or return null.
  const win = window as Window & { __adapta_google_token?: string };
  return win.__adapta_google_token ?? null;
}

// Cria evento no Google Calendar via REST API (se conectado)
// Retorna o external_event_id ou null se não tiver integração ativa
export async function criarEventoSugestao(
  sugestao: SugestaoCalendario,
  tarefa: Tarefa,
  meta: Meta | null
): Promise<string | null> {
  try {
    const { isGoogleConectado } = await import('./googleCalendar');
    if (!isGoogleConectado()) return null;

    const token = getGoogleToken();
    if (!token) return null;

    const title = `${SUGGESTION_PREFIX}${tarefa.titulo}`;
    const description = buildEventDescription(tarefa, meta, sugestao.motivo);

    const startDateTime = `${sugestao.diaAgendado}T${sugestao.horaInicio}:00`;
    const endDateTime = `${sugestao.diaAgendado}T${sugestao.horaFim}:00`;

    const resp = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: title,
        description,
        start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
        extendedProperties: {
          private: { sgp_suggestion: 'true', sgp_suggestion_id: sugestao.id },
        },
      }),
    });

    if (!resp.ok) return null;
    const body = await resp.json() as { id?: string };
    return body.id ?? null;
  } catch {
    return null;
  }
}

export async function removerEventoSugestao(externalEventId: string): Promise<boolean> {
  try {
    const { isGoogleConectado } = await import('./googleCalendar');
    if (!isGoogleConectado()) return false;

    const token = getGoogleToken();
    if (!token) return false;

    const resp = await fetch(`${CALENDAR_API}/calendars/primary/events/${externalEventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    return resp.ok || resp.status === 204 || resp.status === 404;
  } catch {
    return false;
  }
}

function buildEventDescription(tarefa: Tarefa, meta: Meta | null, motivo: string): string {
  const lines = [
    'Tarefa sugerida pelo Sistema de Gestão Pessoal.',
    meta ? `Meta: ${meta.nome}` : '',
    `Prioridade: ${tarefa.faixa}`,
    `Motivo: ${motivo}`,
    '',
    'Acesse o app para aceitar, editar ou cancelar esta sugestão.',
  ];
  return lines.filter(Boolean).join('\n');
}
