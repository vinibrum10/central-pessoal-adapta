export type CategoriaStatus =
  | 'Enviada'
  | 'Dry-run'
  | 'Incompleta'
  | 'Incerta'
  | 'Cancelada'
  | 'Falha no envio'
  | 'Candidatura manual'
  | 'Outro';

export function categoriaStatus(status: string): CategoriaStatus {
  if (status.startsWith('ENVIADA')) return 'Enviada';
  if (status.startsWith('DRY-RUN')) return 'Dry-run';
  if (status.startsWith('INCOMPLETA')) return 'Incompleta';
  if (status.startsWith('INCERTA')) return 'Incerta';
  if (status.startsWith('Cancelado')) return 'Cancelada';
  if (status.startsWith('Falha')) return 'Falha no envio';
  if (status.includes('candidatura manual')) return 'Candidatura manual';
  return 'Outro';
}

export const CATEGORIA_BADGE_VARIANT: Record<CategoriaStatus, 'default' | 'success' | 'warning' | 'danger' | 'primary'> = {
  Enviada: 'success',
  'Dry-run': 'default',
  Incompleta: 'warning',
  Incerta: 'warning',
  Cancelada: 'danger',
  'Falha no envio': 'danger',
  'Candidatura manual': 'primary',
  Outro: 'default',
};
