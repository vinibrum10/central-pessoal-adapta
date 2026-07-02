'use strict';
// Inicia o Vite passando a PORT que o "vercel dev" injeta como variável de ambiente.
// Usar este script em vez de "vite --port $PORT" garante compatibilidade no Windows,
// onde $PORT não é expandido pelo shell.

const { spawn } = require('child_process');

const port = process.env.PORT || '5173';

// shell: true → Windows resolve npx → npx.cmd automaticamente.
const child = spawn(
  'npx',
  ['vite', '--host', '127.0.0.1', '--port', port],
  { stdio: 'inherit', shell: true },
);

child.on('close', (code) => process.exit(code ?? 0));
