import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { carregarCorTema, aplicarCorTema } from './utils/themeColors'

// Aplica a cor do tema salva antes de renderizar
aplicarCorTema(carregarCorTema())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
