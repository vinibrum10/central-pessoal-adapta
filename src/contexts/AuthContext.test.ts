import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// O projeto não tem infraestrutura para renderizar componentes/providers React
// em teste (sem @testing-library/react). A lógica de negócio do handler de
// onAuthStateChange já é testada isoladamente, sem renderizar nada, em
// authSessionLoader.test.ts (createAuthStateChangeHandler). Este arquivo
// verifica por texto-fonte só a FIAÇÃO em torno dela dentro do provider —
// que não pode ser exercitada sem montar um componente.
const source = readFileSync(resolve(process.cwd(), 'src/contexts/AuthContext.tsx'), 'utf-8');

describe('AuthContext — wiring do onAuthStateChange (sem deadlock)', () => {
  it('usa createAuthStateChangeHandler — não um callback inline async direto em onAuthStateChange', () => {
    expect(source).toMatch(/supabase\.auth\.onAuthStateChange\(\s*createAuthStateChangeHandler\(/);
    expect(source).not.toMatch(/onAuthStateChange\(async \(/);
  });

  it('existe só UMA inscrição em onAuthStateChange no arquivo inteiro (StrictMode não deve deixar múltiplas ativas)', () => {
    const occurrences = source.match(/\.onAuthStateChange\(/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  it('o efeito sempre desinscreve o listener na limpeza (cleanup do useEffect)', () => {
    expect(source).toMatch(/return \(\) => subscription\.unsubscribe\(\);/);
  });

  it('loadInitialAuthState() continua sendo a única fonte do estado "loading" — sempre resolve, garantindo que o spinner nunca fique preso', () => {
    expect(source).toMatch(/loadInitialAuthState\(\)\.then\(/);
    expect(source).toMatch(/setLoading\(false\)/);
  });
});
