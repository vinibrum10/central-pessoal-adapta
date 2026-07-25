import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// O projeto não tem infraestrutura para renderizar componentes React em teste
// (sem @testing-library/react — ver nota na Etapa 3). Por isso este teste
// verifica a fiação real do roteador por texto-fonte, em vez de simular
// navegação. A verificação de navegação de fato (menu clicável, refresh direto
// na URL, ausência de erro no console) foi feita manualmente no navegador de
// preview durante esta correção — ver relatório da entrega.
const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf-8');

describe('App — roteamento do Inglês', () => {
  it('registra a rota /estudo/ingles-diario para InglesDiarioPage', () => {
    expect(appSource).toMatch(/<Route\s+path="\/estudo\/ingles-diario"\s+element=\{<InglesDiarioPage \/>\}\s*\/>/);
    expect(appSource).toMatch(/import \{ InglesDiarioPage \} from '\.\/pages\/InglesDiario';/);
  });

  it('preserva a rota /estudo/ingles para InglesPage (Modo Entrevista), sem substituição/redirecionamento', () => {
    expect(appSource).toMatch(/<Route\s+path="\/estudo\/ingles"\s+element=\{<InglesPage \/>\}\s*\/>/);
    expect(appSource).toMatch(/import \{ InglesPage \} from '\.\/pages\/Ingles';/);
    expect(appSource).not.toMatch(/estudo\/ingles.*Navigate/);
  });

  it('as duas rotas de Inglês são caminhos distintos (sem conflito/sobreposição)', () => {
    const matches = [...appSource.matchAll(/path="(\/estudo\/ingles[^"]*)"/g)].map(m => m[1]);
    expect(matches).toContain('/estudo/ingles');
    expect(matches).toContain('/estudo/ingles-diario');
    expect(new Set(matches).size).toBe(matches.length); // nenhum path duplicado
  });
});
