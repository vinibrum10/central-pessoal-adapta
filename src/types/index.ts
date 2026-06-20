// ============================================================
// TIPOS CENTRAIS DO APP CENTRAL PESSOAL ADAPTA
// ============================================================

export type Categoria =
  | 'Profissão'
  | 'Estudos'
  | 'Finanças'
  | 'Projetos'
  | 'Desenvolvimento Pessoal';

export type Prioridade = 'baixa' | 'média' | 'alta' | 'crítica';

// ---- META ----
export type StatusMeta = 'ativa' | 'pausada' | 'concluída' | 'cancelada';

export interface Meta {
  id: string;
  nome: string;
  categoria: Categoria;
  descricao: string;
  prazoFinal: string; // ISO date string
  prioridade: Prioridade;
  status: StatusMeta;
  progresso: number; // 0-100
  resultadoEsperado: string;
  motivo: string;
  dataCriacao: string;
  dataUltimaAcao: string | null;
}

// ---- TAREFA ----
export type TipoTarefa = 'diária' | 'semanal' | 'mensal' | 'avulsa';
export type StatusTarefa =
  | 'pendente'
  | 'em andamento'
  | 'concluída'
  | 'reagendada'
  | 'cancelada';
export type NivelEnergia = 'baixa' | 'média' | 'alta';

export interface Tarefa {
  id: string;
  titulo: string;
  metaId: string | null;
  categoria: Categoria;
  tipo: TipoTarefa;
  prazo: string; // ISO date string
  tempoEstimado: number; // em minutos
  prioridade: Prioridade;
  status: StatusTarefa;
  energiaNecessaria: NivelEnergia;
  observacoes: string;
  dataCriacao: string;
  dataConclusao: string | null;
}

// ---- TEMPO DISPONÍVEL ----
export type DiaSemana =
  | 'Segunda'
  | 'Terça'
  | 'Quarta'
  | 'Quinta'
  | 'Sexta'
  | 'Sábado'
  | 'Domingo';

export type Periodo = 'manhã' | 'tarde' | 'noite';

export interface BlocoTempo {
  id: string;
  data: string; // ISO date string
  diaSemana: DiaSemana;
  periodo: Periodo;
  horasDisponiveis: number;
  compromissos: string;
  nivelEnergia: NivelEnergia;
  observacoes: string;
}

// ---- FINANÇAS ----
export type CategoriaFinanceira =
  | 'Salário'
  | 'Freelance'
  | 'Investimentos'
  | 'Outros'
  | 'Moradia'
  | 'Alimentação'
  | 'Transporte'
  | 'Saúde'
  | 'Educação'
  | 'Lazer'
  | 'Dívidas'
  | 'Cartão'
  | 'Reserva';

export type FormaPagamento = 'Dinheiro' | 'Cartão de crédito' | 'Débito' | 'PIX' | 'Boleto' | 'Transferência';

export interface Receita {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: CategoriaFinanceira;
  recorrente: boolean;
  dataCriacao: string;
}

export interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: CategoriaFinanceira;
  formaPagamento: FormaPagamento;
  recorrente: boolean;
  essencial: boolean;
  dataCriacao: string;
}

export type StatusCartao = 'ativo' | 'bloqueado' | 'cancelado';

export interface Cartao {
  id: string;
  nome: string;
  limite: number;
  faturaAtual: number;
  vencimento: number; // dia do mês
  status: StatusCartao;
  dataCriacao: string;
}

export type PrioridadeQuitacao = 'baixa' | 'média' | 'alta' | 'urgente';

export interface Divida {
  id: string;
  nome: string;
  valorTotal: number;
  valorParcela: number;
  totalParcelas: number;
  parcelasPagas: number;
  taxaJuros: number; // percentual anual
  prioridadeQuitacao: PrioridadeQuitacao;
  dataCriacao: string;
}

export interface Reserva {
  id: string;
  nome: string;
  metaReserva: number;
  valorAtual: number;
  prazoDesejado: string;
  dataCriacao: string;
}

export type StatusBem = 'manter' | 'avaliar venda' | 'à venda' | 'vendido';
export type TipoBem = 'Casa' | 'Carro' | 'Eletrônico' | 'Móvel' | 'Outro';

export interface Bem {
  id: string;
  nome: string;
  tipo: TipoBem;
  valorEstimado: number;
  status: StatusBem;
  observacoes: string;
  dataCriacao: string;
}

// ---- DIÁRIO DE EVOLUÇÃO ----
export interface DiarioEvolucao {
  id: string;
  data: string; // ISO date string
  energia: number; // 1-5
  foco: number; // 1-5
  humor: number; // 1-5
  principalVitoria: string;
  principalDificuldade: string;
  gatilhos: string;
  aprendizado: string;
  ajusteAmanha: string;
  dataCriacao: string;
}

export interface RevisaoSemanal {
  id: string;
  semanaInicio: string; // ISO date string
  semanaFim: string; // ISO date string
  oqueavancou: string;
  oqueFicouParado: string;
  metaNegligenciada: string;
  ondePerdeuTempo: string;
  ondeMelhorou: string;
  focoProximaSemana: string;
  dataCriacao: string;
}

// ---- CONFIGURAÇÕES ----
export type Tema = 'claro' | 'escuro' | 'sistema';

export interface Configuracoes {
  nomeUsuario: string;
  tema: Tema;
  visualizacaoPadrao: 'hoje' | 'semana' | 'mes';
}

// ---- STORE GLOBAL (LocalStorage) ----
export interface AppData {
  metas: Meta[];
  tarefas: Tarefa[];
  blocosTempo: BlocoTempo[];
  receitas: Receita[];
  despesas: Despesa[];
  cartoes: Cartao[];
  dividas: Divida[];
  reservas: Reserva[];
  bens: Bem[];
  diarioEvolucao: DiarioEvolucao[];
  revisoesSemana: RevisaoSemanal[];
  configuracoes: Configuracoes;
}
