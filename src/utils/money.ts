// Remove R$, pontos de milhar, troca vírgula por ponto e converte para number
// NUNCA divide por 100 automaticamente
export function parseBRLMoney(input: string): number {
  if (!input) return 0;
  const cleaned = input
    .replace(/R\$\s?/g, '')   // remove R$
    .replace(/\s/g, '')        // remove espaços
    .replace(/\./g, '')        // remove pontos de milhar (1.000 → 1000)
    .replace(',', '.');        // troca vírgula decimal por ponto (101,10 → 101.10)
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Formata number para exibição em pt-BR
export function formatBRLMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Converte number para string de edição em pt-BR (sem R$, com vírgula)
// Usado para preencher o input ao abrir modal de edição
export function moneyToInputBR(value: number): string {
  if (!value && value !== 0) return '';
  return value.toFixed(2).replace('.', ',');
}
