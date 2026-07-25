import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Mesma limitação de infraestrutura do src/App.test.ts: sem
// @testing-library/react, este teste verifica o array de navegação por texto
// -fonte. A aparição real do item no menu (desktop colapsado/expandido, gaveta
// mobile) foi conferida manualmente no navegador de preview, já que os três
// pontos de renderização (linhas ~250, ~486 e a gaveta mobile) usam o mesmo
// array `estudoNavItems.map(...)` — ver relatório da entrega.
const layoutSource = readFileSync(resolve(process.cwd(), 'src/layouts/Layout.tsx'), 'utf-8');

describe('Layout — navegação do Inglês', () => {
  it('adiciona o item "Inglês Diário" apontando para /estudo/ingles-diario', () => {
    expect(layoutSource).toMatch(/\{\s*to:\s*'\/estudo\/ingles-diario',\s*label:\s*'Inglês Diário'/);
  });

  it('preserva o item "Inglês — Entrevista" apontando para /estudo/ingles', () => {
    expect(layoutSource).toMatch(/\{\s*to:\s*'\/estudo\/ingles',\s*label:\s*'Inglês — Entrevista'/);
  });

  it('os dois itens vivem no mesmo grupo estudoNavItems (mesma estrutura/ícones/responsividade já existentes)', () => {
    const estudoBlockMatch = layoutSource.match(/const estudoNavItems: NavItem\[\] = \[([\s\S]*?)\];/);
    expect(estudoBlockMatch).not.toBeNull();
    const estudoBlock = estudoBlockMatch?.[1] ?? '';
    expect(estudoBlock).toContain("'/estudo/ingles'");
    expect(estudoBlock).toContain("'/estudo/ingles-diario'");
  });

  it('não cria um segundo sistema de navegação — só um array estudoNavItems existe no arquivo', () => {
    const occurrences = layoutSource.match(/const estudoNavItems/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});
