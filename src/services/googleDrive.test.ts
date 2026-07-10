import { describe, expect, it } from 'vitest';
import { extrairUrlOriginal, importarArquivoComoLeitura, type DriveFile } from './googleDrive';

function makeFile(overrides: Partial<DriveFile> = {}): DriveFile {
  return {
    id: 'file-1',
    name: '[2026-07-07] - RELATORIO - Procurar Emprego',
    mimeType: 'text/plain',
    modifiedTime: '2026-07-07T10:00:00.000Z',
    webViewLink: 'https://drive.google.com/file/d/file-1/view',
    ...overrides,
  };
}

describe('extrairUrlOriginal', () => {
  it('extrai a URL da linha "URL original:" do cabeçalho padrão do SGP', () => {
    const conteudo = [
      'Módulo: Relatórios Automáticos',
      'Categoria: Procurar Emprego',
      'URL original: https://www.linkedin.com/jobs/view/123456',
      'Tags: vaga, engenharia',
    ].join('\n');

    expect(extrairUrlOriginal(conteudo)).toBe('https://www.linkedin.com/jobs/view/123456');
  });

  it('é tolerante a maiúsculas/minúsculas e espaços extras no rótulo', () => {
    const conteudo = 'url   ORIGINAL :   https://empresa.com/carreiras/vaga-1  ';
    expect(extrairUrlOriginal(conteudo)).toBe('https://empresa.com/carreiras/vaga-1');
  });

  it('cai para a primeira URL http(s) do corpo quando não há a linha "URL original:"', () => {
    const conteudo = [
      'Resumo: nova vaga encontrada.',
      'Candidate-se em: https://www.gupy.io/vaga/9999',
      'Boa sorte!',
    ].join('\n');

    expect(extrairUrlOriginal(conteudo)).toBe('https://www.gupy.io/vaga/9999');
  });

  it('ignora links do próprio Google Drive/Docs ao usar o fallback de primeira URL', () => {
    const conteudo = [
      'Documento gerado a partir de https://docs.google.com/document/d/abc/edit',
      'Vaga real: https://www.indeed.com/viewjob?jk=abc123',
    ].join('\n');

    expect(extrairUrlOriginal(conteudo)).toBe('https://www.indeed.com/viewjob?jk=abc123');
  });

  it('retorna undefined quando não há nenhuma URL no conteúdo', () => {
    expect(extrairUrlOriginal('Só um resumo em texto, sem links.')).toBeUndefined();
  });

  it('ignora um valor não-http capturado após "URL original:" (proteção contra injeção de javascript:)', () => {
    const conteudo = 'URL original: javascript:alert(document.cookie)';
    expect(extrairUrlOriginal(conteudo)).toBeUndefined();
  });

  it('ignora o valor não-http do label mas ainda encontra uma URL http válida mais adiante no corpo', () => {
    const conteudo = [
      'URL original: javascript:alert(1)',
      'Vaga real: https://www.indeed.com/viewjob?jk=abc123',
    ].join('\n');
    expect(extrairUrlOriginal(conteudo)).toBe('https://www.indeed.com/viewjob?jk=abc123');
  });

  it('retorna undefined quando o conteúdo é undefined', () => {
    expect(extrairUrlOriginal(undefined)).toBeUndefined();
  });
});

describe('importarArquivoComoLeitura — link da vaga', () => {
  it('usa a URL original extraída do conteúdo como url do item quando disponível', () => {
    const file = makeFile({
      contentText: 'URL original: https://www.linkedin.com/jobs/view/123456',
    });

    const leitura = importarArquivoComoLeitura(file);

    expect(leitura.url).toBe('https://www.linkedin.com/jobs/view/123456');
    expect(leitura.driveFileId).toBe('file-1');
  });

  it('cai para o link de visualização do Drive quando o conteúdo não tem nenhuma URL', () => {
    const file = makeFile({ contentText: 'Relatório sem link nenhum.' });

    const leitura = importarArquivoComoLeitura(file);

    expect(leitura.url).toBe('https://drive.google.com/file/d/file-1/view');
  });

  it('cai para o link de visualização do Drive quando não há conteúdo carregado', () => {
    const file = makeFile({ contentText: undefined });

    const leitura = importarArquivoComoLeitura(file);

    expect(leitura.url).toBe('https://drive.google.com/file/d/file-1/view');
  });
});
