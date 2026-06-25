// ── Sistema de Cores via CSS Variables ──────────────────────────────────────

export interface VariacoesDaCor {
  primary: string;
  hover: string;
  soft: string;
  muted: string;
  contrast: string;
}

export interface PaletaPredefinida {
  nome: string;
  hex: string;
  label: string;
}

export const PALETA_PREDEFINIDA: PaletaPredefinida[] = [
  { nome: 'adapta', hex: '#e11d2e', label: 'ADAPTA' },
  { nome: 'grafite', hex: '#2a2a2a', label: 'Grafite' },
  { nome: 'roxo', hex: '#4f46e5', label: 'Roxo' },
  { nome: 'azul', hex: '#2563eb', label: 'Azul' },
  { nome: 'verde', hex: '#16a34a', label: 'Verde' },
  { nome: 'laranja', hex: '#ea580c', label: 'Laranja' },
  { nome: 'vermelho', hex: '#dc2626', label: 'Vermelho' },
  { nome: 'ciano', hex: '#0891b2', label: 'Ciano' },
  { nome: 'cinza', hex: '#475569', label: 'Cinza' },
];

const LS_KEY = 'sgp-cor-tema';

// Converte hex para {r, g, b}
function hexParaRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Converte {r, g, b} para hex
function rgbParaHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Escurece uma cor em um percentual (0–100)
function escurecer(hex: string, pct: number): string {
  const { r, g, b } = hexParaRgb(hex);
  const f = 1 - pct / 100;
  return rgbParaHex(r * f, g * f, b * f);
}

export function gerarVariacoesDaCor(hex: string): VariacoesDaCor {
  const { r, g, b } = hexParaRgb(hex);
  return {
    primary: hex,
    hover: escurecer(hex, 12),
    soft: `rgba(${r}, ${g}, ${b}, 0.15)`,
    muted: `rgba(${r}, ${g}, ${b}, 0.08)`,
    contrast: '#ffffff',
  };
}

export function aplicarCorTema(hex: string): void {
  const v = gerarVariacoesDaCor(hex);
  const root = document.documentElement;
  root.style.setProperty('--color-primary', v.primary);
  root.style.setProperty('--color-primary-hover', v.hover);
  root.style.setProperty('--color-primary-soft', v.soft);
  root.style.setProperty('--color-primary-muted', v.muted);
  root.style.setProperty('--color-primary-contrast', v.contrast);
}

export function salvarCorTema(hex: string): void {
  localStorage.setItem(LS_KEY, hex);
}

export function carregarCorTema(): string {
  return localStorage.getItem(LS_KEY) ?? '#e11d2e';
}

export function obterPaletaPorNome(nome: string): string {
  return PALETA_PREDEFINIDA.find(p => p.nome === nome)?.hex ?? '#e11d2e';
}
