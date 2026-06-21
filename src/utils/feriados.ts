// Feriados nacionais fixos (MM-DD)
const FERIADOS_FIXOS = [
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '12-25', // Natal
];

// Feriados móveis para 2025 e 2026 (YYYY-MM-DD)
const FERIADOS_MOVEIS: string[] = [
  '2025-03-04', // Carnaval terça
  '2025-03-05', // Carnaval quarta cinzas
  '2025-04-18', // Sexta-feira Santa
  '2025-04-20', // Páscoa
  '2025-06-19', // Corpus Christi
  '2026-02-17', // Carnaval terça
  '2026-02-18', // Carnaval quarta cinzas
  '2026-04-03', // Sexta-feira Santa
  '2026-04-05', // Páscoa
  '2026-06-04', // Corpus Christi
];

export function isFeriado(data: Date, feriadosCustom: string[] = []): boolean {
  const mesdia = `${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
  const dataStr = data.toISOString().split('T')[0];
  return (
    FERIADOS_FIXOS.includes(mesdia) ||
    FERIADOS_MOVEIS.includes(dataStr) ||
    feriadosCustom.includes(dataStr)
  );
}

export function getFeriadosMoveis(): string[] {
  return FERIADOS_MOVEIS;
}

export function getFeriadosFixos(): string[] {
  return FERIADOS_FIXOS;
}

/** Verifica se uma data ISO (YYYY-MM-DD) é feriado */
export function isFeriadoISO(dataStr: string, feriadosCustom: string[] = []): boolean {
  const data = new Date(dataStr + 'T12:00:00');
  return isFeriado(data, feriadosCustom);
}
