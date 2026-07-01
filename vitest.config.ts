import { defineConfig } from 'vitest/config';

// Config separada do vite.config.ts (usado só para `vite build`) para não
// arriscar puxar nada de teste para o bundle de produção.
//
// Todos os testes ficam dentro de src/ (inclusive os que exercitam os
// handlers de api/english/*.ts, importados por caminho relativo a partir de
// src/__tests__/api-english/). Isso é proposital: qualquer arquivo colocado
// diretamente dentro de api/ é tratado pela Vercel como uma Serverless
// Function — um *.test.ts ali quebraria o deploy ou criaria uma rota morta.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
