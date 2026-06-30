/**
 * Fundo tecnológico global: grade de circuito + glows HUD em cobre/azul.
 * Puramente decorativo — fica atrás do conteúdo (z-0), não captura cliques,
 * e só aparece no tema escuro (no claro o body mantém o gradiente suave atual).
 */
export function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden dark:block">
      {/* base grafite/azul muito escuro */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,#141210_0%,#070605_55%,#020202_100%)]" />

      {/* grade de circuito discreta */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(217,158,94,0.6) 1px, transparent 1px),' +
            'linear-gradient(0deg, rgba(96,165,250,0.35) 1px, transparent 1px)',
          backgroundSize: '56px 56px, 56px 56px',
        }}
      />

      {/* glows HUD circulares — cobre (topo-esquerda) e azul (baixo-direita) */}
      <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-primary-500/10 blur-[120px]" />
      <div className="absolute -bottom-40 -right-24 h-[26rem] w-[26rem] rounded-full bg-blue-500/10 blur-[130px]" />
      <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-primary-400/5 blur-[100px]" />

      {/* anéis HUD bem suaves, só para textura — centro fica limpo */}
      <div className="absolute right-[8%] top-[12%] h-64 w-64 rounded-full border border-primary-300/10" />
      <div className="absolute right-[8%] top-[12%] h-64 w-64 scale-125 rounded-full border border-primary-300/5" />
      <div className="absolute bottom-[10%] left-[6%] h-48 w-48 rounded-full border border-blue-300/10" />

      {/* leve vinheta para manter o centro limpo e legível */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_45%,transparent_0%,rgba(2,2,2,0.35)_100%)]" />
    </div>
  );
}
