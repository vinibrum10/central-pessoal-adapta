/**
 * Fundo tecnológico global do app — grade sutil + circuitos técnicos à
 * esquerda + HUD circular grande à direita (estilo radar/sci-fi), em
 * cobre/bronze sobre base grafite/azul-marinho muito escura.
 *
 * Implementação: CSS para base/grade/vinheta + um SVG inline decorativo
 * (leve, sem filtros pesados) para os circuitos e o HUD — sem imagens
 * estáticas pesadas.
 *
 * Puramente decorativo: fixo atrás do conteúdo (-z-10), pointer-events
 * desativado, e só aparece no tema escuro (no claro o body mantém o
 * gradiente suave já existente).
 *
 * Pontos fáceis de ajustar depois:
 * - Opacidade da grade: classe no <div> "grade de circuito" abaixo.
 * - Brilho cobre dos glows: classes bg-primary-500/.. nos <div> de glow.
 * - Tamanho do HUD direito: grupo <g id="hud-direito"> (raios dos <circle>).
 * - Intensidade dos circuitos da esquerda: opacity dos <path>/<circle> em <g id="circuitos-esquerda">.
 */
export function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden dark:block">
      {/* 1) base: preto / grafite / azul-marinho muito escuro, com leve aquecimento cobre */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_130%_90%_at_18%_-8%,#1f1b16_0%,#100d0a_38%,#070605_70%,#020202_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_75%_at_94%_42%,rgba(201,130,58,0.18)_0%,transparent_62%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_4%_55%,rgba(201,130,58,0.10)_0%,transparent_55%)]" />

      {/* 2) grade sutil em toda a área */}
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(217,158,94,0.9) 1px, transparent 1px),' +
            'linear-gradient(0deg, rgba(217,158,94,0.9) 1px, transparent 1px)',
          backgroundSize: '46px 46px, 46px 46px',
        }}
      />

      {/* 3) circuitos (esquerda) + HUD circular grande (direita), via SVG leve */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <linearGradient id="copperStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e9b074" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#a8662f" stopOpacity="0.15" />
          </linearGradient>
          {/* halo de brilho — duplica os tracos com blur por baixo, para parecerem "acesos" e não apenas linhas finas */}
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* halos (atrás, borrados) — pintados antes das versões nítidas abaixo */}
        <use href="#hud-direito" filter="url(#glow)" opacity="0.65" />
        <use href="#circuitos-esquerda" filter="url(#glow)" opacity="0.6" />

        {/* ---- HUD circular grande, lado direito, cortado pela borda ---- */}
        <g id="hud-direito" stroke="#e2ad6e" strokeWidth="1.4">
          <circle cx="1560" cy="380" r="260" opacity="0.28" />
          <circle cx="1560" cy="380" r="225" opacity="0.36" strokeDasharray="6 10" />
          <circle cx="1560" cy="380" r="165" opacity="0.44" />
          <circle cx="1560" cy="380" r="110" opacity="0.50" strokeDasharray="2 6" />
          <circle cx="1560" cy="380" r="60" opacity="0.55" />

          {/* arcos incompletos (radar) */}
          <path d="M 1300 250 A 260 260 0 0 1 1560 120" opacity="0.40" strokeWidth="2" />
          <path d="M 1560 640 A 260 260 0 0 1 1810 470" opacity="0.36" strokeWidth="2" />
          <path d="M 1320 470 A 225 225 0 0 0 1450 600" opacity="0.40" strokeWidth="2" />

          {/* linhas radiantes finas */}
          <line x1="1560" y1="380" x2="1230" y2="200" opacity="0.28" />
          <line x1="1560" y1="380" x2="1290" y2="600" opacity="0.24" />
          <line x1="1560" y1="380" x2="1700" y2="120" opacity="0.28" />
          <line x1="1560" y1="380" x2="1430" y2="700" opacity="0.22" />

          {/* ticks tipo radar no anel externo */}
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            const innerR = 260;
            const outerR = 274;
            const x1 = 1560 + Math.cos(angle) * innerR;
            const y1 = 380 + Math.sin(angle) * innerR;
            const x2 = 1560 + Math.cos(angle) * outerR;
            const y2 = 380 + Math.sin(angle) * outerR;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} opacity="0.32" strokeWidth="1.6" />;
          })}

          {/* nós luminosos (glow simples: círculo grande translúcido + ponto sólido) */}
          <circle cx="1560" cy="120" r="13" fill="#f0bb86" opacity="0.22" stroke="none" />
          <circle cx="1560" cy="120" r="3.5" fill="#fbe0bb" opacity="0.9" stroke="none" />
          <circle cx="1320" cy="470" r="11" fill="#f0bb86" opacity="0.20" stroke="none" />
          <circle cx="1320" cy="470" r="3" fill="#fbe0bb" opacity="0.85" stroke="none" />
          <circle cx="1700" cy="120" r="9" fill="#9bc1ec" opacity="0.20" stroke="none" />
          <circle cx="1700" cy="120" r="2.4" fill="#cfe2f8" opacity="0.75" stroke="none" />
        </g>

        {/* ---- circuitos técnicos, lado esquerdo (deslocados p/ fora da sidebar) ---- */}
        <g id="circuitos-esquerda" transform="translate(150 0)" stroke="url(#copperStroke)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M -20 130 L 90 130 L 90 190 L 200 190 L 200 150 L 260 150" opacity="0.70" />
          <path d="M -20 260 L 60 260 L 60 330 L 150 330" opacity="0.55" />
          <path d="M -20 520 L 100 520 L 100 470 L 180 470 L 180 410" opacity="0.62" />
          <path d="M -20 650 L 70 650 L 70 720 L 190 720 L 190 760" opacity="0.50" />
          <path d="M -20 820 L 110 820 L 110 770" opacity="0.46" />

          {/* pequeno HUD circular no meio-esquerda */}
          <g id="hud-esquerda-pequeno" opacity="0.75" strokeWidth="1.4">
            <circle cx="150" cy="470" r="46" />
            <circle cx="150" cy="470" r="30" strokeDasharray="3 5" />
            <line x1="150" y1="424" x2="150" y2="402" />
            <line x1="150" y1="516" x2="150" y2="538" />
            <line x1="104" y1="470" x2="82" y2="470" />
            <line x1="196" y1="470" x2="218" y2="470" />
          </g>

          {/* nós luminosos nas interseções */}
          <circle cx="200" cy="190" r="9" fill="#f0bb86" opacity="0.22" stroke="none" />
          <circle cx="200" cy="190" r="3" fill="#fbe0bb" opacity="0.85" stroke="none" />
          <circle cx="100" cy="520" r="9" fill="#f0bb86" opacity="0.22" stroke="none" />
          <circle cx="100" cy="520" r="3" fill="#fbe0bb" opacity="0.8" stroke="none" />
          <circle cx="190" cy="760" r="8" fill="#f0bb86" opacity="0.20" stroke="none" />
          <circle cx="190" cy="760" r="2.6" fill="#fbe0bb" opacity="0.7" stroke="none" />
        </g>

        {/* ---- traços diagonais suaves, para profundidade ---- */}
        <line x1="-40" y1="40" x2="520" y2="380" stroke="#d9a35e" strokeWidth="1.2" opacity="0.10" />
        <line x1="900" y1="900" x2="1500" y2="560" stroke="#6f93c2" strokeWidth="1.2" opacity="0.10" />
      </svg>

      {/* 4) glows pontuais (cobre à esquerda, cobre+azul à direita) — blur em CSS, barato */}
      <div className="absolute left-12 top-16 h-72 w-72 rounded-full bg-primary-500/25 blur-[110px]" />
      <div className="absolute -right-20 top-1/4 h-[28rem] w-[28rem] rounded-full bg-primary-500/30 blur-[140px]" />
      <div className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-blue-500/18 blur-[120px]" />

      {/* 5) linha horizontal luminosa próxima ao topo */}
      <div className="absolute inset-x-[6%] top-[64px] h-px bg-gradient-to-r from-transparent via-primary-300/70 to-transparent" />

      {/* 6) vinheta leve — só no centro exato, sem escurecer as laterais onde ficam o HUD/circuitos */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_40%_at_50%_42%,rgba(2,2,2,0.35)_0%,transparent_100%)]" />
    </div>
  );
}
