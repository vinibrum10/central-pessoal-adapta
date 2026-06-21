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
export type StatusMeta = 'ativa' | 'planejar futuro' | 'pausada' | 'concluída' | 'cancelada';
export type FrequenciaRevisao = 'semanal' | 'quinzenal' | 'mensal' | 'sob demanda';

export interface Meta {
  id: string;
  nome: string;
  categoria: Categoria;
  // grau obrigatório para metas ativas; pode ser 0 para "planejar futuro"
  grau: number;
  status: StatusMeta;
  motivo: string;
  resultadoEsperado: string;
  prazoFinal: string;
  frequenciaRevisao: FrequenciaRevisao;
  dataCriacao: string;
  dataUltimaRevisao: string | null;
  dataUltimaAcao: string | null;
  // campos legados opcionais (mantidos para compatibilidade)
  descricao?: string;
  progresso?: number;
  prioridade?: Prioridade;
}

// ---- TAREFA ----
export type FaixaTarefa = 'urgente' | 'alto impacto' | 'médio impacto' | 'baixo impacto';
export type StatusTarefa = 'não iniciado' | 'em andamento' | 'concluído';
export type NivelEnergia = 'baixa' | 'média' | 'alta';

export interface Tarefa {
  id: string;
  titulo: string;
  metaId: string | null;
  categoria: Categoria;
  prazo: string;
  tempoEstimado: number;
  faixa: FaixaTarefa;
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
  data: string;
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
  vencimento: number;
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
  taxaJuros: number;
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

// ---- CONFIGURAÇÕES ----
export type Tema = 'claro' | 'escuro' | 'sistema';

export interface Configuracoes {
  nomeUsuario: string;
  tema: Tema;
  visualizacaoPadrao: 'hoje' | 'semana' | 'mes';
}

// ---- ROTINA SEMANAL ----
export type CategoriaRotina =
  | 'Trabalho'
  | 'Inglês'
  | 'Programação'
  | 'Doutorado'
  | 'Elétrica 4.0'
  | 'Família'
  | 'Descanso'
  | 'Revisão Semanal'
  | 'Finanças'
  | 'Exercício'
  | 'Outro';

export interface BlocoRotina {
  id: string;
  diaSemana: DiaSemana;
  horarioInicio: string;
  horarioFim: string;
  categoria: CategoriaRotina;
  energiaEsperada: NivelEnergia;
  observacoes: string;
  ativo: boolean;
}

// ---- AGENDA EXTERNA ----

export type FonteAgenda = 'google' | 'microsoft' | 'manual' | 'ics' | 'outro';

export interface EventoAgenda {
  id: string;
  fonte: FonteAgenda;
  titulo: string;
  descricao?: string;
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  local?: string;
  bloqueiaTempo: boolean;
  importadoEm: string;
  tarefaGeradaId?: string | null;
  ignorado?: boolean;
}

export interface ConfiguracaoAgenda {
  id: string;
  fonte: FonteAgenda;
  nome: string;
  ativa: boolean;
  sincronizadaEm?: string | null;
}

export interface DisponibilidadeDia {
  data: string;
  inicioJanela: string;
  fimJanela: string;
  minutosJanela: number;
  minutosOcupados: number;
  minutosDisponiveis: number;
  eventos: EventoAgenda[];
}

// ---- STORE GLOBAL (LocalStorage) ----
export interface AppData {
  metas: Meta[];
  tarefas: Tarefa[];
  blocosTempo: BlocoTempo[];
  rotinasSemana: BlocoRotina[];
  receitas: Receita[];
  despesas: Despesa[];
  cartoes: Cartao[];
  dividas: Divida[];
  reservas: Reserva[];
  bens: Bem[];
  configuracoes: Configuracoes;
  eventosAgenda: EventoAgenda[];
  configuracoesAgenda: ConfiguracaoAgenda[];
}
