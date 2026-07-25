import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STUDY_STEP_ORDER } from './DailyStudyFlow';

describe('STUDY_STEP_ORDER', () => {
  it('segue exatamente a ordem pedida: Listening, Questionário, Shadowing, Revisão', () => {
    expect(STUDY_STEP_ORDER).toEqual(['listening', 'quiz', 'shadowing', 'review']);
  });
});

describe('DailyStudyFlow — fiação por texto-fonte (sem @testing-library/react)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/english/daily/DailyStudyFlow.tsx'), 'utf-8');

  it('a etapa Listening usa YoutubeEmbedPlayer e um botão "Concluir Listening e continuar"', () => {
    expect(source).toMatch(/step === 'listening'[\s\S]*?<YoutubeEmbedPlayer/);
    expect(source).toMatch(/Concluir Listening e continuar/);
  });

  it('o cabeçalho da área de estudo é "Estudo de hoje" com o título do vídeo como subtítulo', () => {
    expect(source).toMatch(/title="Estudo de hoje"\s+subtitle=\{video\.title\}/);
  });

  it('quiz avança para shadowing, e shadowing avança para review', () => {
    expect(source).toMatch(/onClick=\{\(\) => onGoToStep\('shadowing'\)\}/);
    expect(source).toMatch(/onClick=\{\(\) => onGoToStep\('review'\)\}/);
  });
});
