// Módulos disponíveis
export type Modulo =
  | 'dashboard'
  | 'metas'
  | 'plano_acao'
  | 'agenda_tempo'
  | 'orcamento'
  | 'leitura_diaria'
  | 'configuracoes'
  | 'usuarios';

// Ações disponíveis
export type Acao =
  | 'visualizar'
  | 'criar'
  | 'editar'
  | 'excluir'
  | 'concluir'
  | 'exportar'
  | 'importar'
  | 'aprovar'
  | 'gerenciar_permissoes';

export interface UserPermission {
  modulo: Modulo;
  acao: Acao;
  permitido: boolean;
}

export type RoleUsuario = 'admin' | 'editor' | 'visualizador';

// Permissões padrão por role (quando não há permissão específica cadastrada)
function permissaoPadraoDoRole(role: RoleUsuario, modulo: Modulo, acao: Acao): boolean {
  if (role === 'admin') return true;
  if (role === 'editor') {
    if (modulo === 'usuarios') return acao === 'visualizar';
    if (acao === 'gerenciar_permissoes' || acao === 'aprovar') return false;
    return true;
  }
  // visualizador
  if (modulo === 'usuarios') return false;
  return acao === 'visualizar';
}

// Verifica permissão: permissões específicas sobrescrevem o role
export function hasPermission(
  role: RoleUsuario,
  permissoes: UserPermission[],
  modulo: Modulo,
  acao: Acao
): boolean {
  if (role === 'admin') return true;
  const especifica = permissoes.find(p => p.modulo === modulo && p.acao === acao);
  if (especifica !== undefined) return especifica.permitido;
  return permissaoPadraoDoRole(role, modulo, acao);
}

// Atalhos
export function canView(role: RoleUsuario, permissoes: UserPermission[], modulo: Modulo) {
  return hasPermission(role, permissoes, modulo, 'visualizar');
}
export function canCreate(role: RoleUsuario, permissoes: UserPermission[], modulo: Modulo) {
  return hasPermission(role, permissoes, modulo, 'criar');
}
export function canEdit(role: RoleUsuario, permissoes: UserPermission[], modulo: Modulo) {
  return hasPermission(role, permissoes, modulo, 'editar');
}
export function canDelete(role: RoleUsuario, permissoes: UserPermission[], modulo: Modulo) {
  return hasPermission(role, permissoes, modulo, 'excluir');
}
export function canManageUsers(role: RoleUsuario, permissoes: UserPermission[]) {
  return hasPermission(role, permissoes, 'usuarios', 'gerenciar_permissoes');
}
export function canCreateExpense(role: RoleUsuario, permissoes: UserPermission[]) {
  return hasPermission(role, permissoes, 'orcamento', 'criar');
}
export function canEditExpense(
  role: RoleUsuario,
  permissoes: UserPermission[],
  userId: string,
  expenseCreatedBy?: string
) {
  if (role === 'admin') return true;
  if (!hasPermission(role, permissoes, 'orcamento', 'editar')) return false;
  // visualizador com permissão específica só edita o que criou
  if (role === 'visualizador' && expenseCreatedBy && expenseCreatedBy !== userId) return false;
  return true;
}
export function canDeleteExpense(role: RoleUsuario, permissoes: UserPermission[]) {
  return hasPermission(role, permissoes, 'orcamento', 'excluir');
}

// Modelos de permissão prontos
export const MODELO_SOMENTE_VISUALIZACAO: UserPermission[] = [
  { modulo: 'dashboard', acao: 'visualizar', permitido: true },
  { modulo: 'orcamento', acao: 'visualizar', permitido: true },
  { modulo: 'metas', acao: 'visualizar', permitido: true },
  { modulo: 'plano_acao', acao: 'visualizar', permitido: true },
  { modulo: 'agenda_tempo', acao: 'visualizar', permitido: true },
  { modulo: 'leitura_diaria', acao: 'visualizar', permitido: true },
];

export const MODELO_LANCAR_DESPESAS: UserPermission[] = [
  { modulo: 'dashboard', acao: 'visualizar', permitido: true },
  { modulo: 'orcamento', acao: 'visualizar', permitido: true },
  { modulo: 'orcamento', acao: 'criar', permitido: true },
  { modulo: 'orcamento', acao: 'editar', permitido: true },
  { modulo: 'orcamento', acao: 'excluir', permitido: false },
  { modulo: 'metas', acao: 'visualizar', permitido: true },
  { modulo: 'plano_acao', acao: 'visualizar', permitido: true },
];

export const MODELO_EDITOR_COMPLETO: UserPermission[] = (
  ['dashboard', 'metas', 'plano_acao', 'agenda_tempo', 'orcamento', 'leitura_diaria', 'configuracoes'] as Modulo[]
).flatMap(m => (['visualizar', 'criar', 'editar', 'excluir', 'concluir', 'exportar'] as Acao[]).map(a => ({
  modulo: m,
  acao: a,
  permitido: true,
})));

export const MODULOS_ROTULOS: Record<Modulo, string> = {
  dashboard: 'Dashboard',
  metas: 'Metas',
  plano_acao: 'Plano de Ação',
  agenda_tempo: 'Agenda e Tempo',
  orcamento: 'Orçamento',
  leitura_diaria: 'Leitura Diária',
  configuracoes: 'Configurações',
  usuarios: 'Usuários',
};

export const ACOES_POR_MODULO: Record<Modulo, Acao[]> = {
  dashboard: ['visualizar'],
  metas: ['visualizar', 'criar', 'editar', 'excluir'],
  plano_acao: ['visualizar', 'criar', 'editar', 'excluir', 'concluir'],
  agenda_tempo: ['visualizar', 'criar', 'editar', 'excluir'],
  orcamento: ['visualizar', 'criar', 'editar', 'excluir', 'exportar'],
  leitura_diaria: ['visualizar', 'criar', 'editar', 'excluir'],
  configuracoes: ['visualizar', 'exportar', 'importar'],
  usuarios: ['visualizar', 'aprovar', 'gerenciar_permissoes'],
};

export const ACOES_ROTULOS: Record<Acao, string> = {
  visualizar: 'Visualizar',
  criar: 'Criar',
  editar: 'Editar',
  excluir: 'Excluir',
  concluir: 'Concluir',
  exportar: 'Exportar',
  importar: 'Importar',
  aprovar: 'Aprovar',
  gerenciar_permissoes: 'Gerenciar permissões',
};
