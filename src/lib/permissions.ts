import type { RoleUsuario } from '../types';

export function canView(role: RoleUsuario | undefined | null): boolean {
  return role === 'admin' || role === 'usuario';
}

export function canEdit(role: RoleUsuario | undefined | null): boolean {
  return role === 'admin';
}

export function canAdmin(role: RoleUsuario | undefined | null): boolean {
  return role === 'admin';
}
