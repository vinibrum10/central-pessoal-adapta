import type { PerfilUsuario } from '../types';

// Re-export types used by other modules (Usuarios.tsx imports these)
export type Modulo =
  | 'dashboard'
  | 'metas'
  | 'plano_acao'
  | 'agenda_tempo'
  | 'orcamento'
  | 'leitura_diaria'
  | 'configuracoes'
  | 'usuarios';

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

// ─── Core permission functions ────────────────────────────────────────────────

export function canView(_modulo: string, perfil: PerfilUsuario | null): boolean {
  if (!perfil || perfil.status === 'bloqueado') return false;
  return true;
}

export function canCreate(modulo: string, perfil: PerfilUsuario | null): boolean {
  if (!perfil || perfil.status === 'bloqueado') return false;
  if (perfil.role === 'admin' || perfil.tipoAcesso === 'total') return true;
  if (perfil.tipoAcesso === 'financas' && modulo === 'despesas') return true;
  return false;
}

export function canEdit(modulo: string, perfil: PerfilUsuario | null, itemCreatedBy?: string): boolean {
  if (!perfil || perfil.status === 'bloqueado') return false;
  if (perfil.role === 'admin' || perfil.tipoAcesso === 'total') return true;
  if (perfil.tipoAcesso === 'financas' && modulo === 'despesas') {
    return !itemCreatedBy || itemCreatedBy === perfil.id;
  }
  return false;
}

export function canDelete(modulo: string, perfil: PerfilUsuario | null, itemCreatedBy?: string): boolean {
  return canEdit(modulo, perfil, itemCreatedBy);
}

export function canManageUsers(perfil: PerfilUsuario | null): boolean {
  return perfil?.role === 'admin';
}

export function canCreateExpense(perfil: PerfilUsuario | null): boolean {
  return canCreate('despesas', perfil);
}

export function canEditExpense(perfil: PerfilUsuario | null, expenseCreatedBy?: string): boolean {
  return canEdit('despesas', perfil, expenseCreatedBy);
}

export function canDeleteExpense(perfil: PerfilUsuario | null, expenseCreatedBy?: string): boolean {
  return canDelete('despesas', perfil, expenseCreatedBy);
}

// ─── Legacy helpers kept for compatibility (Usuarios.tsx uses these) ──────────

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
