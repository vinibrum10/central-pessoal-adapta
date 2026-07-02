export type LeitnerResult = 'acertou' | 'errou';

const BOX_INTERVAL_DAYS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

function parseDateOnly(dateISO: string): Date {
  const [year, month, day] = dateISO.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function toDateOnly(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysISO(dateISO: string, days: number): string {
  const date = parseDateOnly(dateISO);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calculateLeitnerReview(currentBox: number, result: LeitnerResult, todayISO = toDateOnly()) {
  const box = result === 'acertou'
    ? Math.min(5, Math.max(1, currentBox) + 1)
    : 1;
  return {
    box,
    next_review: addDaysISO(todayISO, BOX_INTERVAL_DAYS[box] ?? 1),
    last_result: result,
    reviewed_at: new Date().toISOString(),
  };
}
