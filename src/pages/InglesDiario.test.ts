import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// O projeto não tem infraestrutura para renderizar componentes React em
// teste (sem @testing-library/react). A lógica de negócio (quando confirmar
// a troca de vídeo) já é testada isoladamente em inglesDiarioVideoSwitch.test.ts.
// Este arquivo verifica por texto-fonte só a FIAÇÃO em torno dela, que não
// pode ser exercitada sem montar o componente.
const source = readFileSync(resolve(process.cwd(), 'src/pages/InglesDiario.tsx'), 'utf-8');

describe('InglesDiarioPage — área de estudo', () => {
  it('renderiza DailyStudyFlow somente quando há um vídeo selecionado', () => {
    expect(source).toMatch(/\{selectedVideo && \(\s*<DailyStudyFlow/);
  });

  it('RecentVideosPanel recebe handleSelectVideo (com checagem de confirmação), não connection.selectVideo diretamente', () => {
    expect(source).toMatch(/onSelectVideo=\{handleSelectVideo\}/);
    expect(source).not.toMatch(/onSelectVideo=\{connection\.selectVideo\}/);
  });

  it('handleSelectVideo usa shouldConfirmVideoSwitch para decidir se pede confirmação', () => {
    expect(source).toMatch(/shouldConfirmVideoSwitch\(/);
  });

  it('concluir o Listening avança o passo para "quiz" (Questionário)', () => {
    expect(source).toMatch(/onCompleteListening=\{\(\) => setStudyStep\('quiz'\)\}/);
  });

  it('o progresso de estudo sempre começa em "listening" ao montar a página (mesmo com vídeo restaurado da persistência)', () => {
    expect(source).toMatch(/useState<StudyStep>\('listening'\)/);
  });

  it('trocar de vídeo sempre reinicia o passo de estudo para "listening"', () => {
    const applySelectionMatch = source.match(/function applyVideoSelection\([^)]*\): void \{([\s\S]*?)\n  \}/);
    expect(applySelectionMatch).not.toBeNull();
    expect(applySelectionMatch?.[1]).toMatch(/setStudyStep\('listening'\)/);
  });
});
