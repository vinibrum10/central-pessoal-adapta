/**
 * AppBackground — fundo tecnológico premium do SGP
 *
 * Props:
 *  • standalone (boolean, default false)
 *    Use standalone=true em páginas sem Layout (Login, erros, splash).
 *    Nesse modo o componente usa `absolute inset-0` em vez de
 *    `fixed inset-0 -z-10`, e sempre é exibido (sem dark:block).
 *    O pai DEVE ter `relative overflow-hidden` e os filhos `relative z-10`.
 *
 * Camadas (de baixo para cima):
 *  1. Base: gradiente radial preto/grafite/azul-marinho muito escuro
 *  2. Glow de profundidade (cobre à esq. + cobre/azul à dir.)
 *  3. Grade fina (linhas verticais/horizontais em cobre baixíssima opacidade)
 *  4. SVG decorativo:
 *       – Circuitos técnicos densos (lado esquerdo)
 *       – HUD circular grande tipo radar (lado direito, cortado pela borda)
 *       – Traços diagonais de profundidade
 *  5. Linha horizontal luminosa próxima ao topo
 *  6. Vinheta central suave (centro mais limpo para o conteúdo)
 *
 * Pontos de ajuste rápido:
 *  • Opacidade da grade            → prop style do div "#grade"
 *  • Brilho cobre dos glows        → divs com blur-[...] abaixo
 *  • Tamanho do HUD direito        → raios dos <circle cx="1540" ...> no grupo #hud-right
 *  • Intensidade dos circuitos     → opacity dos <path> / <circle> em #circuits-left
 */
export function AppBackground({ standalone = false }: { standalone?: boolean }) {
  const posClass = standalone
    ? 'pointer-events-none absolute inset-0 overflow-hidden'
    : 'pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden dark:block';
  /* Ticks do anel externo do HUD — 24 marcações */
  const hudTicks = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const isMajor = i % 6 === 0;
    const innerR = isMajor ? 295 : 300;
    const outerR = isMajor ? 316 : 310;
    const cx = 1540, cy = 420;
    return {
      x1: cx + Math.cos(angle) * innerR,
      y1: cy + Math.sin(angle) * innerR,
      x2: cx + Math.cos(angle) * outerR,
      y2: cy + Math.sin(angle) * outerR,
      isMajor,
    };
  });

  /* Arcos do HUD interno — segmentos pontilhados decorativos */
  const sweepArcs = [
    { r: 220, startAngle: -60, endAngle: 40, dash: '8 14' },
    { r: 220, startAngle: 130, endAngle: 210, dash: '8 14' },
    { r: 140, startAngle: 20, endAngle: 100, dash: '4 8' },
    { r: 140, startAngle: 200, endAngle: 310, dash: '4 8' },
  ];

  function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
    const start = ((startDeg - 90) * Math.PI) / 180;
    const end = ((endDeg - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  const HUD_CX = 1540;
  const HUD_CY = 420;

  return (
    <div
      aria-hidden
      className={posClass}
    >
      {/* ── 1. BASE ──────────────────────────────────────────────────── */}
      {/* Gradiente base: preto profundo com toque quente no canto sup-esq */}
      <div className="absolute inset-0 bg-[#050404]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_140%_80%_at_12%_-5%,#1a160e_0%,#0c0a07_30%,#050404_65%,#020202_100%)]" />
      {/* Aquecimento azul-marinho sutíssimo no centro-direita */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_90%_at_100%_50%,#060b12_0%,transparent_60%)]" />

      {/* ── 2. GLOWS DE PROFUNDIDADE ─────────────────────────────────── */}
      {/* Glow cobre grande à esquerda */}
      <div className="absolute -left-24 top-0 h-[600px] w-[480px] rounded-full bg-[radial-gradient(ellipse,rgba(180,110,40,0.22)_0%,transparent_70%)] blur-[80px]" />
      {/* Glow cobre intenso no canto sup-esq */}
      <div className="absolute left-10 top-8 h-48 w-48 rounded-full bg-[rgba(201,130,58,0.28)] blur-[90px]" />
      {/* Glow cobre/laranja à direita — onde fica o HUD */}
      <div className="absolute -right-32 top-[15%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(ellipse,rgba(190,115,45,0.32)_0%,transparent_65%)] blur-[100px]" />
      {/* Glow azulado bem tênue no canto inf-dir */}
      <div className="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-[rgba(40,80,130,0.14)] blur-[100px]" />

      {/* ── 3. GRADE FINA ────────────────────────────────────────────── */}
      <div
        id="grade"
        className="absolute inset-0"
        style={{
          opacity: 0.065,
          backgroundImage:
            'linear-gradient(90deg, rgba(217,158,94,1) 1px, transparent 1px),' +
            'linear-gradient(0deg,  rgba(217,158,94,1) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      {/* Subdivide a grade com células menores ainda mais tênues */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.025,
          backgroundImage:
            'linear-gradient(90deg, rgba(217,158,94,1) 1px, transparent 1px),' +
            'linear-gradient(0deg,  rgba(217,158,94,1) 1px, transparent 1px)',
          backgroundSize: '11px 11px',
        }}
      />

      {/* ── 4. SVG DECORATIVO ────────────────────────────────────────── */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradiente cobre/bronze para traços */}
          <linearGradient id="copperH" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#e8aa60" stopOpacity="0.0" />
            <stop offset="20%"  stopColor="#e8aa60" stopOpacity="0.75" />
            <stop offset="80%"  stopColor="#b07232" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#b07232" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="copperV" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#e8aa60" stopOpacity="0.0" />
            <stop offset="20%"  stopColor="#e8aa60" stopOpacity="0.70" />
            <stop offset="80%"  stopColor="#b07232" stopOpacity="0.50" />
            <stop offset="100%" stopColor="#b07232" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="copperDiag" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#e8aa60" stopOpacity="0.0" />
            <stop offset="40%"  stopColor="#dfa05a" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#9a5e28" stopOpacity="0.0" />
          </linearGradient>

          {/* Gradiente do HUD — mais brilhante no topo */}
          <radialGradient id="hudGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#f0c070" stopOpacity="0.9" />
            <stop offset="60%"  stopColor="#c98040" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#7a4a20" stopOpacity="0.0" />
          </radialGradient>

          {/* Filtro de glow (blur) para elementos "acesos" */}
          <filter id="glowSoft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowHard" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="glowNode" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="7" />
          </filter>

          {/* Clip para não vazar conteúdo */}
          <clipPath id="screenClip">
            <rect width="1600" height="900" />
          </clipPath>
        </defs>

        <g clipPath="url(#screenClip)">

          {/* ══════════════════════════════════════════════════════════
              HUD CIRCULAR GRANDE — LADO DIREITO (cx=1540, cy=420)
              Cortado pela borda direita da tela — aparece parcialmente.
          ══════════════════════════════════════════════════════════ */}
          <g id="hud-right">
            {/* Halos de brilho por baixo (blur) */}
            <circle cx={HUD_CX} cy={HUD_CY} r="300" stroke="#e0a050" strokeWidth="2.5" opacity="0.18" filter="url(#glowHard)" />
            <circle cx={HUD_CX} cy={HUD_CY} r="220" stroke="#e0a050" strokeWidth="2"   opacity="0.22" filter="url(#glowHard)" />
            <circle cx={HUD_CX} cy={HUD_CY} r="140" stroke="#e0a050" strokeWidth="1.5" opacity="0.25" filter="url(#glowHard)" />

            {/* Anéis sólidos — do maior ao menor */}
            <circle cx={HUD_CX} cy={HUD_CY} r="300" stroke="#c88840" strokeWidth="1.2" opacity="0.30" />
            <circle cx={HUD_CX} cy={HUD_CY} r="270" stroke="#d4984a" strokeWidth="0.8" opacity="0.20" strokeDasharray="3 9" />
            <circle cx={HUD_CX} cy={HUD_CY} r="240" stroke="#c88840" strokeWidth="1.0" opacity="0.32" />
            <circle cx={HUD_CX} cy={HUD_CY} r="220" stroke="#b87838" strokeWidth="0.7" opacity="0.18" strokeDasharray="6 12" />
            <circle cx={HUD_CX} cy={HUD_CY} r="190" stroke="#c88840" strokeWidth="1.0" opacity="0.38" />
            <circle cx={HUD_CX} cy={HUD_CY} r="160" stroke="#d4984a" strokeWidth="0.8" opacity="0.22" strokeDasharray="4 8" />
            <circle cx={HUD_CX} cy={HUD_CY} r="140" stroke="#c88840" strokeWidth="1.2" opacity="0.45" />
            <circle cx={HUD_CX} cy={HUD_CY} r="110" stroke="#b87838" strokeWidth="0.7" opacity="0.28" strokeDasharray="2 6" />
            <circle cx={HUD_CX} cy={HUD_CY} r="80"  stroke="#c88840" strokeWidth="1.0" opacity="0.50" />
            <circle cx={HUD_CX} cy={HUD_CY} r="50"  stroke="#d4984a" strokeWidth="0.8" opacity="0.42" strokeDasharray="2 4" />
            <circle cx={HUD_CX} cy={HUD_CY} r="24"  stroke="#e0aa58" strokeWidth="1.5" opacity="0.60" />

            {/* Arcos varridos (incompletos — estilo radar) */}
            {sweepArcs.map((arc, i) => (
              <path
                key={i}
                d={describeArc(HUD_CX, HUD_CY, arc.r, arc.startAngle, arc.endAngle)}
                stroke="#e2b060"
                strokeWidth="1.8"
                strokeDasharray={arc.dash}
                opacity="0.45"
              />
            ))}

            {/* Ticks no anel externo */}
            {hudTicks.map((t, i) => (
              <line
                key={i}
                x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                stroke="#d4984a"
                strokeWidth={t.isMajor ? 2 : 1}
                opacity={t.isMajor ? 0.55 : 0.30}
              />
            ))}

            {/* Linhas radiantes finas — vão do centro para fora */}
            <line x1={HUD_CX} y1={HUD_CY} x2={HUD_CX - 320} y2={HUD_CY - 180} stroke="#c88840" strokeWidth="0.7" opacity="0.22" />
            <line x1={HUD_CX} y1={HUD_CY} x2={HUD_CX - 300} y2={HUD_CY + 200} stroke="#c88840" strokeWidth="0.7" opacity="0.18" />
            <line x1={HUD_CX} y1={HUD_CY} x2={HUD_CX - 80}  y2={HUD_CY - 310} stroke="#c88840" strokeWidth="0.7" opacity="0.20" />
            <line x1={HUD_CX} y1={HUD_CY} x2={HUD_CX - 60}  y2={HUD_CY + 320} stroke="#c88840" strokeWidth="0.7" opacity="0.18" />

            {/* Cruz central */}
            <line x1={HUD_CX - 30} y1={HUD_CY} x2={HUD_CX + 30} y2={HUD_CY} stroke="#e0a050" strokeWidth="1" opacity="0.55" />
            <line x1={HUD_CX} y1={HUD_CY - 30} x2={HUD_CX} y2={HUD_CY + 30} stroke="#e0a050" strokeWidth="1" opacity="0.55" />

            {/* Linhas horizontais conectadas ao HUD — à esquerda dele */}
            <line x1="1050" y1="340" x2="1260" y2="340" stroke="#c88840" strokeWidth="0.8" opacity="0.28" />
            <line x1="1100" y1="360" x2="1240" y2="360" stroke="#c88840" strokeWidth="0.6" opacity="0.20" />
            <line x1="1080" y1="500" x2="1250" y2="500" stroke="#c88840" strokeWidth="0.8" opacity="0.26" />
            <line x1="1120" y1="520" x2="1240" y2="520" stroke="#c88840" strokeWidth="0.6" opacity="0.18" />

            {/* Canto do HUD — linhas oblíquas de conexão */}
            <line x1="1200" y1="200" x2="1350" y2="270" stroke="#c88840" strokeWidth="0.8" opacity="0.22" />
            <line x1="1200" y1="640" x2="1350" y2="570" stroke="#c88840" strokeWidth="0.8" opacity="0.22" />

            {/* Nó central brilhante */}
            <circle cx={HUD_CX} cy={HUD_CY} r="18" fill="#f0c070" opacity="0.12" stroke="none" filter="url(#glowNode)" />
            <circle cx={HUD_CX} cy={HUD_CY} r="5"  fill="#fde8b0" opacity="0.85" stroke="none" />
            <circle cx={HUD_CX} cy={HUD_CY} r="2"  fill="#fff5d8" opacity="1"    stroke="none" />

            {/* Nós luminosos em interseções de anéis */}
            <circle cx={HUD_CX - 140} cy={HUD_CY - 20}  r="14" fill="#f0b860" opacity="0.15" stroke="none" filter="url(#glowNode)" />
            <circle cx={HUD_CX - 140} cy={HUD_CY - 20}  r="4"  fill="#fde0a0" opacity="0.80" stroke="none" />

            <circle cx={HUD_CX - 80}  cy={HUD_CY + 190} r="12" fill="#f0b860" opacity="0.13" stroke="none" filter="url(#glowNode)" />
            <circle cx={HUD_CX - 80}  cy={HUD_CY + 190} r="3.5" fill="#fde0a0" opacity="0.75" stroke="none" />

            <circle cx={HUD_CX - 60}  cy={HUD_CY - 295} r="10" fill="#90b8e0" opacity="0.18" stroke="none" filter="url(#glowNode)" />
            <circle cx={HUD_CX - 60}  cy={HUD_CY - 295} r="3"  fill="#c8dff5" opacity="0.80" stroke="none" />
          </g>

          {/* ══════════════════════════════════════════════════════════
              CIRCUITOS TÉCNICOS — LADO ESQUERDO
              Originam nas bordas/esquinas e ficam contidos à esquerda,
              sem poluir o centro da tela.
          ══════════════════════════════════════════════════════════ */}
          <g id="circuits-left" stroke="#d4984a" strokeLinecap="round" strokeLinejoin="round">

            {/* ── BLOCO SUPERIOR-ESQUERDO ── */}
            {/* Trilha principal — vem da borda esquerda topo */}
            <path d="M -10 80  L 80 80  L 80 120 L 180 120 L 180 160 L 280 160 L 280 200"
              strokeWidth="1.4" opacity="0.65" />
            <path d="M -10 110 L 60 110 L 60 150 L 140 150"
              strokeWidth="1.0" opacity="0.45" />
            <path d="M -10 160 L 45 160 L 45 200 L 120 200 L 120 240 L 210 240"
              strokeWidth="1.2" opacity="0.55" />
            {/* Bifurcações */}
            <path d="M 80 120 L 80 80  L 130 80  L 130 50  L 200 50"
              strokeWidth="0.9" opacity="0.38" />
            <path d="M 180 160 L 180 130 L 240 130 L 240 100 L 310 100"
              strokeWidth="0.9" opacity="0.35" />
            {/* Segmento diagonal curto estilo PCB */}
            <path d="M 280 200 L 310 170 L 360 170"
              strokeWidth="0.8" opacity="0.30" />

            {/* ── MEIO-ESQUERDO ── */}
            <path d="M -10 300 L 70  300 L 70  350 L 160 350 L 160 320 L 230 320"
              strokeWidth="1.3" opacity="0.60" />
            <path d="M -10 340 L 55  340 L 55  390 L 130 390"
              strokeWidth="1.0" opacity="0.48" />
            <path d="M 160 350 L 160 420 L 240 420 L 240 460 L 310 460"
              strokeWidth="1.1" opacity="0.52" />
            <path d="M -10 430 L 90  430 L 90  380 L 150 380"
              strokeWidth="1.0" opacity="0.42" />
            {/* Trilha que encontra o HUD pequeno */}
            <path d="M 90 430 L 90 480 L 130 480"
              strokeWidth="0.9" opacity="0.38" />

            {/* ── PEQUENO HUD / ALVO NO MEIO-ESQUERDO ── */}
            <g id="hud-left-small" opacity="0.72">
              {/* Halo de brilho */}
              <circle cx="185" cy="490" r="52" stroke="#e0a850" strokeWidth="1.5" opacity="0.15" filter="url(#glowHard)" />
              {/* Anéis */}
              <circle cx="185" cy="490" r="52" strokeWidth="1.1" opacity="0.48" />
              <circle cx="185" cy="490" r="38" strokeWidth="0.9" opacity="0.38" strokeDasharray="3 6" />
              <circle cx="185" cy="490" r="24" strokeWidth="1.0" opacity="0.55" />
              <circle cx="185" cy="490" r="10" strokeWidth="0.8" opacity="0.60" />
              {/* Cruz de mira */}
              <line x1="185" y1="434" x2="185" y2="416" strokeWidth="1.0" opacity="0.55" />
              <line x1="185" y1="546" x2="185" y2="564" strokeWidth="1.0" opacity="0.55" />
              <line x1="129" y1="490" x2="111" y2="490" strokeWidth="1.0" opacity="0.55" />
              <line x1="241" y1="490" x2="259" y2="490" strokeWidth="1.0" opacity="0.55" />
              {/* Ticks menores */}
              <line x1="185" y1="438" x2="185" y2="446" strokeWidth="0.8" opacity="0.38" />
              <line x1="185" y1="534" x2="185" y2="542" strokeWidth="0.8" opacity="0.38" />
              <line x1="133" y1="490" x2="141" y2="490" strokeWidth="0.8" opacity="0.38" />
              <line x1="229" y1="490" x2="237" y2="490" strokeWidth="0.8" opacity="0.38" />
              {/* Nó central */}
              <circle cx="185" cy="490" r="10" fill="#f0b860" opacity="0.15" stroke="none" filter="url(#glowNode)" />
              <circle cx="185" cy="490" r="3"  fill="#fde0a0" opacity="0.80" stroke="none" />
            </g>

            {/* ── INFERIOR-ESQUERDO ── */}
            <path d="M -10 580 L 100 580 L 100 540 L 190 540 L 190 510 L 250 510"
              strokeWidth="1.2" opacity="0.55" />
            <path d="M -10 640 L 80  640 L 80  690 L 190 690 L 190 730 L 270 730"
              strokeWidth="1.3" opacity="0.58" />
            <path d="M -10 720 L 60  720 L 60  770 L 140 770"
              strokeWidth="1.0" opacity="0.45" />
            <path d="M -10 800 L 110 800 L 110 760 L 200 760 L 200 800"
              strokeWidth="1.1" opacity="0.48" />
            <path d="M 100 580 L 100 630 L 170 630"
              strokeWidth="0.9" opacity="0.36" />
            {/* Bifurcação diagonal estilo PCB */}
            <path d="M 190 690 L 220 660 L 290 660"
              strokeWidth="0.9" opacity="0.32" />
            <path d="M 140 770 L 140 810 L 200 810"
              strokeWidth="0.8" opacity="0.30" />

            {/* ── TRILHAS VERTICAIS ── */}
            <line x1="80"  y1="80"  x2="80"  y2="200" strokeWidth="0.8" opacity="0.28" />
            <line x1="160" y1="160" x2="160" y2="320" strokeWidth="0.8" opacity="0.25" />
            <line x1="230" y1="320" x2="230" y2="420" strokeWidth="0.8" opacity="0.25" />

            {/* ── NÓS LUMINOSOS NAS INTERSEÇÕES ── */}
            {/* Canto sup-esq */}
            <circle cx="80"  cy="120" r="11" fill="#f0b860" opacity="0.18" stroke="none" filter="url(#glowNode)" />
            <circle cx="80"  cy="120" r="3.5" fill="#fde0a0" opacity="0.88" stroke="none" />

            <circle cx="180" cy="160" r="10" fill="#f0b860" opacity="0.18" stroke="none" filter="url(#glowNode)" />
            <circle cx="180" cy="160" r="3"  fill="#fde0a0" opacity="0.85" stroke="none" />

            <circle cx="180" cy="120" r="8"  fill="#f0b860" opacity="0.14" stroke="none" filter="url(#glowNode)" />
            <circle cx="180" cy="120" r="2.5" fill="#fde0a0" opacity="0.75" stroke="none" />

            {/* Meio-esq */}
            <circle cx="160" cy="350" r="10" fill="#f0b860" opacity="0.16" stroke="none" filter="url(#glowNode)" />
            <circle cx="160" cy="350" r="3"  fill="#fde0a0" opacity="0.82" stroke="none" />

            <circle cx="90"  cy="430" r="9"  fill="#f0b860" opacity="0.16" stroke="none" filter="url(#glowNode)" />
            <circle cx="90"  cy="430" r="2.8" fill="#fde0a0" opacity="0.80" stroke="none" />

            <circle cx="240" cy="460" r="9"  fill="#f0b860" opacity="0.14" stroke="none" filter="url(#glowNode)" />
            <circle cx="240" cy="460" r="2.8" fill="#fde0a0" opacity="0.78" stroke="none" />

            {/* Inf-esq */}
            <circle cx="100" cy="580" r="10" fill="#f0b860" opacity="0.18" stroke="none" filter="url(#glowNode)" />
            <circle cx="100" cy="580" r="3"  fill="#fde0a0" opacity="0.85" stroke="none" />

            <circle cx="190" cy="690" r="10" fill="#f0b860" opacity="0.16" stroke="none" filter="url(#glowNode)" />
            <circle cx="190" cy="690" r="3"  fill="#fde0a0" opacity="0.82" stroke="none" />

            <circle cx="110" cy="800" r="9"  fill="#f0b860" opacity="0.14" stroke="none" filter="url(#glowNode)" />
            <circle cx="110" cy="800" r="2.8" fill="#fde0a0" opacity="0.78" stroke="none" />

            {/* Azulado num ponto (detalhe sutil de variação) */}
            <circle cx="310" cy="170" r="8"  fill="#80a8d8" opacity="0.18" stroke="none" filter="url(#glowNode)" />
            <circle cx="310" cy="170" r="2.5" fill="#b8d0f0" opacity="0.75" stroke="none" />
          </g>

          {/* ══════════════════════════════════════════════════════════
              TRAÇOS DIAGONAIS / CURVOS SUTIS — PROFUNDIDADE
          ══════════════════════════════════════════════════════════ */}
          {/* Diagonal sup-esq → centro */}
          <line x1="-30" y1="30"  x2="560" y2="400" stroke="url(#copperDiag)" strokeWidth="1.0" opacity="0.09" />
          {/* Diagonal inf-dir → centro */}
          <line x1="1640" y1="870" x2="1000" y2="480" stroke="url(#copperDiag)" strokeWidth="1.0" opacity="0.09" />
          {/* Diagonal leve centro-topo → dir */}
          <line x1="400" y1="10"  x2="1400" y2="420" stroke="#d4984a" strokeWidth="0.8" opacity="0.06" />
          {/* Leve curva (simulada por 2 linhas) */}
          <polyline points="0,600 300,580 700,560" stroke="#c88840" strokeWidth="0.8" opacity="0.07" />
          <polyline points="800,10 1000,80 1200,60" stroke="#c88840" strokeWidth="0.7" opacity="0.07" />

          {/* ══════════════════════════════════════════════════════════
              LINHA HORIZONTAL LUMINOSA — PRÓXIMA AO TOPO
          ══════════════════════════════════════════════════════════ */}
          <defs>
            <linearGradient id="lineTop" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#e8aa60" stopOpacity="0.00" />
              <stop offset="10%"  stopColor="#e8aa60" stopOpacity="0.80" />
              <stop offset="50%"  stopColor="#f0c070" stopOpacity="0.95" />
              <stop offset="90%"  stopColor="#e8aa60" stopOpacity="0.70" />
              <stop offset="100%" stopColor="#e8aa60" stopOpacity="0.00" />
            </linearGradient>
          </defs>
          {/* Linha principal */}
          <line x1="80" y1="68" x2="1520" y2="68"
            stroke="url(#lineTop)" strokeWidth="1.0" opacity="0.65" />
          {/* Halo de brilho da linha */}
          <line x1="80" y1="68" x2="1520" y2="68"
            stroke="#f0c070" strokeWidth="4" opacity="0.10" filter="url(#glowSoft)" />

        </g>
      </svg>

      {/* ── 5. VINHETA CENTRAL SUAVE ─────────────────────────────────── */}
      {/* Escurece levemente só o centro, sem afetar as laterais com os circuitos */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_52%_44%,rgba(3,2,2,0.40)_0%,transparent_100%)]" />
      {/* Reforço nas bordas top e bottom para dar profundidade */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[rgba(3,2,2,0.55)] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgba(3,2,2,0.45)] to-transparent" />
    </div>
  );
}
