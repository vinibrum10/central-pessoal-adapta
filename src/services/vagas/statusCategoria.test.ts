import { describe, expect, it } from 'vitest';
import { categoriaStatus } from './statusCategoria';

describe('categoriaStatus', () => {
  it('classifica envio confirmado', () => {
    expect(categoriaStatus('ENVIADA com sucesso.')).toBe('Enviada');
  });

  it('classifica dry-run', () => {
    expect(categoriaStatus('DRY-RUN: formulario preenchido e salvo em preview.png. Nada foi enviado.')).toBe('Dry-run');
  });

  it('classifica pendencia de campos customizados', () => {
    expect(categoriaStatus('INCOMPLETA: aguardando resposta em [País*, Escola*]')).toBe('Incompleta');
  });

  it('classifica sucesso incerto', () => {
    expect(categoriaStatus('INCERTA: verifique manualmente. Screenshot: confirmacao_envio.png')).toBe('Incerta');
  });

  it('classifica cancelamento pelo usuario', () => {
    expect(categoriaStatus('Cancelado pelo usuario.')).toBe('Cancelada');
  });

  it('classifica falha no envio', () => {
    expect(categoriaStatus('Falha no envio: timeout. Candidate-se manualmente pelo link.')).toBe('Falha no envio');
  });

  it('classifica fontes que exigem candidatura manual', () => {
    expect(categoriaStatus("Fonte 'greenhouse' exige login — candidatura manual:")).toBe('Candidatura manual');
  });

  it('cai em Outro para status desconhecido', () => {
    expect(categoriaStatus('texto qualquer nao mapeado')).toBe('Outro');
  });
});
