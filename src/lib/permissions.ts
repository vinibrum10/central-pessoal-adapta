import type { RoleUsuario } from '../types';

export function canView(role: RoleUsuario | undefined | null): boolean {
  return role === 'admin' || role === 'editor' || role === 'visualizador';
}

export function canEdit(role: RoleUsuario | undefined | null): boolean {
  return role === 'admin' || role === 'editor';
}

export function canAdmin(role: RoleUsuario | undefined | null): boolean {
  return role === 'admin';
}
