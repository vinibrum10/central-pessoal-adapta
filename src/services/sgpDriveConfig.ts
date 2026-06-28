/// <reference types="vite/client" />

export type SgpDriveModule = 'Leitura Diária' | 'Procurar Emprego' | 'Relatórios Automáticos' | 'Config';

export interface SgpDriveFolder {
  key: string;
  nome: string;
  modulo: SgpDriveModule;
  categoria: string;
  id: string;
  tipoArquivoEsperado: string;
}

function env(name: string, fallback: string): string {
  const values = import.meta.env as Record<string, string | undefined>;
  return (values[name] || fallback).trim();
}

export const SGP_DRIVE_ROOT_ID = env('VITE_SGP_DRIVE_ROOT_FOLDER_ID', '146Xbn1G3icqxjie2gBVbm_kdYoWSN1nO');

export const SGP_DRIVE_FOLDERS = {
  leituraDiaria: {
    key: 'leitura-diaria',
    nome: '01_LEITURA_DIARIA',
    modulo: 'Leitura Diária',
    categoria: 'Raiz',
    id: env('VITE_GOOGLE_DRIVE_FOLDER_ID', '1HIoT04CrKP_UzwbhivUpkEb6w7245Gvl'),
    tipoArquivoEsperado: 'LEITURA',
  },
  leituraTecnologia: {
    key: 'leitura-tecnologia',
    nome: '01_LEITURA_DIARIA/Tecnologia',
    modulo: 'Leitura Diária',
    categoria: 'Tecnologia',
    id: env('VITE_SGP_DRIVE_LEITURA_TECNOLOGIA_FOLDER_ID', '1shhLeRDHDVVTy-GqFAHh5AK6n61A3TgG'),
    tipoArquivoEsperado: 'LEITURA',
  },
  leituraIa: {
    key: 'leitura-ia',
    nome: '01_LEITURA_DIARIA/Inteligência Artificial',
    modulo: 'Leitura Diária',
    categoria: 'Inteligência Artificial',
    id: env('VITE_SGP_DRIVE_LEITURA_IA_FOLDER_ID', '1IQ5oRv2wvNqlQihhsCjiP4MIJAntmHHK'),
    tipoArquivoEsperado: 'LEITURA',
  },
  leituraEngenhariaDados: {
    key: 'leitura-engenharia-dados',
    nome: '01_LEITURA_DIARIA/Engenharia de Dados',
    modulo: 'Leitura Diária',
    categoria: 'Engenharia de Dados',
    id: env('VITE_SGP_DRIVE_LEITURA_ENG_DADOS_FOLDER_ID', '17RHSNHPsvIlBpGlLHc4a71kav7ddJD3c'),
    tipoArquivoEsperado: 'LEITURA',
  },
  procurarEmprego: {
    key: 'procurar-emprego',
    nome: '02_PROCURAR_EMPREGO',
    modulo: 'Procurar Emprego',
    categoria: 'Raiz',
    id: env('VITE_SGP_DRIVE_EMPREGO_FOLDER_ID', '1V1Xf2T0LveVlWjj2Z8UJzTB-XfBZIiN0'),
    tipoArquivoEsperado: 'EMPREGO',
  },
  vagasEncontradas: {
    key: 'vagas-encontradas',
    nome: '02_PROCURAR_EMPREGO/Vagas Encontradas',
    modulo: 'Procurar Emprego',
    categoria: 'Vagas Encontradas',
    id: env('VITE_SGP_DRIVE_VAGAS_FOLDER_ID', '1XrZ8zl10Z6j_-zLmK2D-68bx3_qqaG6I'),
    tipoArquivoEsperado: 'VAGA',
  },
  empresasAlvo: {
    key: 'empresas-alvo',
    nome: '02_PROCURAR_EMPREGO/Empresas Alvo',
    modulo: 'Procurar Emprego',
    categoria: 'Empresas Alvo',
    id: env('VITE_SGP_DRIVE_EMPRESAS_ALVO_FOLDER_ID', '1muvbWCeyGAFvw7ukuoNmWDkYNkrh_3wJ'),
    tipoArquivoEsperado: 'EMPRESA',
  },
  candidaturasRealizadas: {
    key: 'candidaturas-realizadas',
    nome: '02_PROCURAR_EMPREGO/Candidaturas Realizadas',
    modulo: 'Procurar Emprego',
    categoria: 'Candidaturas Realizadas',
    id: env('VITE_SGP_DRIVE_CANDIDATURAS_FOLDER_ID', '1Nab4BBz4n0-3Op-lQvq_I8WZXlE-lUhd'),
    tipoArquivoEsperado: 'CANDIDATURA',
  },
  relatoriosAutomaticos: {
    key: 'relatorios-automaticos',
    nome: '03_RELATORIOS_AUTOMATICOS',
    modulo: 'Relatórios Automáticos',
    categoria: 'Raiz',
    id: env('VITE_SGP_DRIVE_RELATORIOS_FOLDER_ID', '1LUGLjPEx9Fo9nap6DquAT6d9QmgRhZLf'),
    tipoArquivoEsperado: 'RELATORIO',
  },
  relatorioDailyTechNews: {
    key: 'relatorio-daily-tech-news',
    nome: '03_RELATORIOS_AUTOMATICOS/Daily Tech News',
    modulo: 'Relatórios Automáticos',
    categoria: 'Daily Tech News',
    id: env('VITE_SGP_DRIVE_REL_DAILY_TECH_FOLDER_ID', '1PGE7KY7trmuhsovS3Sx2rOfhcU-dMPhF'),
    tipoArquivoEsperado: 'RELATORIO',
  },
  relatorioProcurarEmprego: {
    key: 'relatorio-procurar-emprego',
    nome: '03_RELATORIOS_AUTOMATICOS/Procurar Emprego',
    modulo: 'Relatórios Automáticos',
    categoria: 'Procurar Emprego',
    id: env('VITE_SGP_DRIVE_REL_EMPREGO_FOLDER_ID', '1kVFcgUUK1ZxaErq7EuQ3CTcAPNwKnGHa'),
    tipoArquivoEsperado: 'RELATORIO',
  },
  config: {
    key: 'config',
    nome: '00_CONFIG',
    modulo: 'Config',
    categoria: 'Índice',
    id: env('VITE_SGP_DRIVE_CONFIG_FOLDER_ID', '1ftSfXxwhi2Lvs8eVfB9ATH53OAlJRVMh'),
    tipoArquivoEsperado: 'INDICE',
  },
} satisfies Record<string, SgpDriveFolder>;

export const SGP_LEITURA_SYNC_FOLDERS: SgpDriveFolder[] = [
  SGP_DRIVE_FOLDERS.leituraTecnologia,
  SGP_DRIVE_FOLDERS.leituraIa,
  SGP_DRIVE_FOLDERS.leituraEngenhariaDados,
];

export function getSgpDocumentHeader(params: {
  modulo: SgpDriveModule;
  categoria: string;
  data: string;
  status: string;
  prioridade?: string;
  fonte?: string;
  urlOriginal?: string;
  tags?: string[];
  proximaRevisao?: string;
}): string {
  return [
    `Módulo: ${params.modulo}`,
    `Categoria: ${params.categoria}`,
    `Data: ${params.data}`,
    `Status: ${params.status}`,
    `Prioridade: ${params.prioridade ?? ''}`,
    `Fonte: ${params.fonte ?? ''}`,
    `URL original: ${params.urlOriginal ?? ''}`,
    `Tags: ${(params.tags ?? []).join(', ')}`,
    `Próxima revisão: ${params.proximaRevisao ?? ''}`,
    '',
    'Resumo:',
    'Principais pontos:',
    'Ação recomendada:',
    'Por que isso importa:',
    'Como isso entra no SGP:',
  ].join('\n');
}
