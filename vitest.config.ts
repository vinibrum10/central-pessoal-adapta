import { defineConfig } from 'vitest/config';

// Config separada do vite.config.ts (usado só para `vite build`) para não
// arriscar puxar nada de teste para o bundle de produção.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
  },
});
