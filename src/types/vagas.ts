export interface VagaCandidatura {
  id: string;
  dataPrep: string | null;
  vaga: string;
  empresa: string;
  local: string;
  fonte: string;
  score: number | null;
  status: string;
  dataEnvio: string | null;
  retorno: string;
  link: string;
  observacoes: string;
  createdAt: string;
  updatedAt: string;
}

export interface VagaRespostaBanco {
  id: string;
  pergunta: string;
  tipo: string;
  opcoes: string;
  resposta: string;
  sempreUsar: boolean;
  ultimaVaga: string;
  possivelDuplicataDe: string;
  createdAt: string;
  updatedAt: string;
}
