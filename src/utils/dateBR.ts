// ISO yyyy-MM-dd → dd/MM/yyyy
export function isoToBRDate(iso: string): string {
  if (!iso || iso.length < 10) return '';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

// dd/MM/yyyy → ISO yyyy-MM-dd
export function brDateToISO(br: string): string {
  if (!br || br.length < 10) return '';
  const parts = br.split('/');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
}

// Valida se string dd/MM/yyyy é uma data válida
export function isValidBRDate(br: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(br)) return false;
  const [d, m, y] = br.split('/').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
