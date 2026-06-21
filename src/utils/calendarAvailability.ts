import { format } from 'date-fns';
import type { EventoAgenda, DisponibilidadeDia, Tarefa } from '../types';
import { gerarId, hojeISO } from './index';

// ============================================================
// JANELA ÚTIL
// ============================================================

export interface JanelaUtil {
  inicio: string; // "HH:MM"
  fim: string;    // "HH:MM"
  minutosTotal: number;
}

export function obterJanelaUtil(data: string): JanelaUtil {
  const d = new Date(data + 'T12:00:00');
  const diaSemana = d.getDay(); // 0=Dom, 6=Sáb
  const fimDeSemana = diaSemana === 0 || diaSemana === 6;
  const inicio = fimDeSemana ? '08:00' : '07:30';
  const fim    = fimDeSemana ? '20:00' : '22:00';
  return { inicio, fim, minutosTotal: calcularMinutosEntre(inicio, fim) };
}

// ============================================================
// HELPERS DE TEMPO
// ============================================================

export function calcularMinutosEntre(inicio: string, fim: string): number {
  return horaParaMinutos(fim) - horaParaMinutos(inicio);
}

function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

// Extrai HH:MM de uma string ISO ou datetime
function extrairHora(datetimeStr: string): string {
  if (!datetimeStr) return '00:00';
  // ISO: "2024-06-15T14:30:00Z" ou "2024-06-15T14:30:00-03:00"
  const match = datetimeStr.match(/T(\d{2}:\d{2})/);
  if (match) return match[1];
  return '00:00';
}

// ============================================================
// NORMALIZAÇÃO DO EVENTO NA JANELA
// ============================================================

export interface EventoNormalizado {
  eventoId: string;
  titulo: string;
  inicioMin: number; // minutos desde meia-noite, clampado na janela
  fimMin: number;
  minutosOcupados: number;
}

export function normalizarEventoParaJanela(
  evento: EventoAgenda,
  janela: JanelaUtil
): EventoNormalizado | null {
  if (!evento.bloqueiaTempo || evento.ignorado) return null;

  const janelaInicioMin = horaParaMinutos(janela.inicio);
  const janelaFimMin    = horaParaMinutos(janela.fim);

  let eventoInicioMin: number;
  let eventoFimMin: number;

  if (evento.diaInteiro) {
    eventoInicioMin = janelaInicioMin;
    eventoFimMin    = janelaFimMin;
  } else {
    eventoInicioMin = horaParaMinutos(extrairHora(evento.inicio));
    eventoFimMin    = horaParaMinutos(extrairHora(evento.fim));
  }

  // Sem overlap com a janela
  if (eventoFimMin <= janelaInicioMin || eventoInicioMin >= janelaFimMin) return null;

  // Clamp
  const inicioClamp = Math.max(eventoInicioMin, janelaInicioMin);
  const fimClamp    = Math.min(eventoFimMin, janelaFimMin);
  const ocupados = fimClamp - inicioClamp;

  if (ocupados <= 0) return null;

  return {
    eventoId: evento.id,
    titulo: evento.titulo,
    inicioMin: inicioClamp,
    fimMin: fimClamp,
    minutosOcupados: ocupados,
  };
}

// ============================================================
// CÁLCULO POR DIA
// ============================================================

export function calcularDisponibilidadeDia(
  data: string,
  eventos: EventoAgenda[]
): DisponibilidadeDia {
  const janela = obterJanelaUtil(data);
  const eventosDoDia = eventos.filter(e => {
    const dataEvento = e.inicio.split('T')[0];
    return dataEvento === data;
  });

  let minutosOcupados = 0;
  for (const ev of eventosDoDia) {
    const norm = normalizarEventoParaJanela(ev, janela);
    if (norm) minutosOcupados += norm.minutosOcupados;
  }

  // Nunca ultrapassar a janela
  minutosOcupados = Math.min(minutosOcupados, janela.minutosTotal);

  return {
    data,
    inicioJanela: janela.inicio,
    fimJanela: janela.fim,
    minutosJanela: janela.minutosTotal,
    minutosOcupados,
    minutosDisponiveis: Math.max(0, janela.minutosTotal - minutosOcupados),
    eventos: eventosDoDia,
  };
}

// ============================================================
// CÁLCULO PARA UM PERÍODO (array de dias)
// ============================================================

export function calcularDisponibilidadePeriodo(
  dataInicio: string,
  dataFim: string,
  eventos: EventoAgenda[]
): DisponibilidadeDia[] {
  const resultado: DisponibilidadeDia[] = [];
  const start = new Date(dataInicio + 'T12:00:00');
  const end   = new Date(dataFim   + 'T12:00:00');
  const cur = new Date(start);

  while (cur <= end) {
    const dataStr = format(cur, 'yyyy-MM-dd');
    resultado.push(calcularDisponibilidadeDia(dataStr, eventos));
    cur.setDate(cur.getDate() + 1);
  }

  return resultado;
}

// ============================================================
// UTILITÁRIOS DE FIM DE SEMANA
// ============================================================

export function eventoOcorreNoFimDeSemana(evento: EventoAgenda): boolean {
  const data = evento.inicio.split('T')[0];
  const d = new Date(data + 'T12:00:00');
  const dia = d.getDay();
  return dia === 0 || dia === 6;
}

export function eventoPodeVirarTarefaAvulsa(evento: EventoAgenda): boolean {
  return (
    eventoOcorreNoFimDeSemana(evento) &&
    !evento.ignorado &&
    !evento.tarefaGeradaId
  );
}

// ============================================================
// GERAÇÃO DE TAREFA AVULSA A PARTIR DE EVENTO
// ============================================================

export function gerarTarefaAvulsaDeEvento(
  evento: EventoAgenda,
  metaId: string | null
): Tarefa {
  const duracaoMin = evento.diaInteiro
    ? 480 // 8h para dia inteiro
    : Math.max(
        15,
        horaParaMinutos(extrairHora(evento.fim)) -
        horaParaMinutos(extrairHora(evento.inicio))
      );

  return {
    id: gerarId(),
    titulo: evento.titulo || 'Compromisso importado',
    metaId,
    categoria: 'Projetos',
    prazo: evento.inicio.split('T')[0],
    tempoEstimado: duracaoMin,
    faixa: metaId ? 'médio impacto' : 'baixo impacto',
    status: 'não iniciado',
    energiaNecessaria: 'média',
    observacoes: metaId
      ? 'Gerada a partir da agenda externa.'
      : 'Tarefa avulsa gerada da agenda, sem classificação.',
    dataCriacao: hojeISO(),
    dataConclusao: null,
  };
}

// ============================================================
// PARSER DE ICS (iCalendar)
// ============================================================

interface IcsParsedEvent {
  uid: string;
  titulo: string;
  descricao: string;
  local: string;
  inicio: string;
  fim: string;
  diaInteiro: boolean;
}

function parseIcsDate(value: string): { iso: string; diaInteiro: boolean } {
  if (!value) return { iso: new Date().toISOString(), diaInteiro: false };

  // Dia inteiro: "20241215"
  if (/^\d{8}$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { iso: `${y}-${m}-${d}T00:00:00`, diaInteiro: true };
  }

  // Datetime: "20241215T140000Z" ou "20241215T140000"
  if (/^\d{8}T\d{6}/.test(value)) {
    const y = value.slice(0, 4);
    const mo = value.slice(4, 6);
    const d = value.slice(6, 8);
    const h = value.slice(9, 11);
    const mi = value.slice(11, 13);
    const s = value.slice(13, 15);
    const utc = value.endsWith('Z') ? 'Z' : '';
    return { iso: `${y}-${mo}-${d}T${h}:${mi}:${s}${utc}`, diaInteiro: false };
  }

  return { iso: new Date().toISOString(), diaInteiro: false };
}

export function parseIcsContent(content: string): IcsParsedEvent[] {
  const events: IcsParsedEvent[] = [];
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Unfold continuation lines (RFC 5545)
  const unfolded: string[] = [];
  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (unfolded.length > 0) {
        unfolded[unfolded.length - 1] += line.trimStart();
      }
    } else {
      unfolded.push(line);
    }
  }

  let inEvent = false;
  let current: Partial<IcsParsedEvent> & { diaInteiro?: boolean } = {};

  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current.inicio && current.fim) {
        events.push({
          uid: current.uid ?? gerarId(),
          titulo: current.titulo ?? '(Sem título)',
          descricao: current.descricao ?? '',
          local: current.local ?? '',
          inicio: current.inicio,
          fim: current.fim,
          diaInteiro: current.diaInteiro ?? false,
        });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;

    const key = line.slice(0, colonIdx).split(';')[0].trim().toUpperCase();
    const paramsPart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1).trim();

    switch (key) {
      case 'UID':
        current.uid = value;
        break;
      case 'SUMMARY':
        current.titulo = value;
        break;
      case 'DESCRIPTION':
        current.descricao = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
        break;
      case 'LOCATION':
        current.local = value;
        break;
      case 'DTSTART': {
        const isDateOnly = paramsPart.includes('VALUE=DATE') || /^\d{8}$/.test(value);
        const parsed = parseIcsDate(value);
        current.inicio = parsed.iso;
        if (isDateOnly || parsed.diaInteiro) current.diaInteiro = true;
        break;
      }
      case 'DTEND': {
        const parsed = parseIcsDate(value);
        current.fim = parsed.iso;
        break;
      }
    }
  }

  return events;
}

export function icsParaEventosAgenda(content: string): EventoAgenda[] {
  const parsed = parseIcsContent(content);
  return parsed.map(ev => ({
    id: `ics-${ev.uid}`,
    fonte: 'ics' as const,
    titulo: ev.titulo,
    descricao: ev.descricao,
    inicio: ev.inicio,
    fim: ev.fim,
    diaInteiro: ev.diaInteiro,
    local: ev.local,
    bloqueiaTempo: true,
    importadoEm: new Date().toISOString(),
    tarefaGeradaId: null,
    ignorado: false,
  }));
}

// ============================================================
// DISPONIBILIDADE USANDO EVENTOS DA AGENDA (fallback blocos)
// ============================================================

export function minutosDisponiveisHoje(
  eventos: EventoAgenda[],
  temBlocosTempo: boolean
): number {
  const hoje = hojeISO();
  const disp = calcularDisponibilidadeDia(hoje, eventos);

  // Se não há eventos de agenda mas tem blocos manuais, retorna 0
  // (o chamador usará calcularMinutosDisponiveis dos blocos como fallback)
  if (eventos.length === 0 && !temBlocosTempo) {
    return disp.minutosDisponiveis;
  }
  return disp.minutosDisponiveis;
}

// ============================================================
// VISÃO DA SEMANA
// ============================================================

export function obterSemanaAtual(): string[] {
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0=Dom
  // Segunda desta semana
  const seg = new Date(hoje);
  seg.setDate(hoje.getDate() - ((diaSemana + 6) % 7));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg);
    d.setDate(seg.getDate() + i);
    return format(d, 'yyyy-MM-dd');
  });
}

export const NOME_DIA: Record<number, string> = {
  1: 'Segunda', 2: 'Terça', 3: 'Quarta',
  4: 'Quinta', 5: 'Sexta', 6: 'Sábado', 0: 'Domingo',
};

export function nomeDia(dataStr: string): string {
  const d = new Date(dataStr + 'T12:00:00');
  return NOME_DIA[d.getDay()] ?? dataStr;
}

// ============================================================
// HELPERS DE EXIBIÇÃO
// ============================================================

export function formatarIntervaloEvento(evento: EventoAgenda): string {
  if (evento.diaInteiro) return 'Dia inteiro';
  const hi = extrairHora(evento.inicio);
  const hf = extrairHora(evento.fim);
  return `${hi} – ${hf}`;
}

export function labelFonteAgenda(fonte: string): string {
  switch (fonte) {
    case 'google': return 'Google Calendar';
    case 'microsoft': return 'Microsoft Outlook';
    case 'ics': return 'Arquivo ICS';
    case 'manual': return 'Bloqueio manual';
    default: return 'Outro';
  }
}

export function corCargaDia(minutosOcupados: number, minutosJanela: number): string {
  if (minutosJanela === 0) return 'bg-surface-200 dark:bg-surface-700';
  const pct = minutosOcupados / minutosJanela;
  if (pct >= 0.85) return 'bg-red-500';
  if (pct >= 0.6)  return 'bg-amber-500';
  if (pct >= 0.3)  return 'bg-emerald-500';
  return 'bg-blue-400';
}
