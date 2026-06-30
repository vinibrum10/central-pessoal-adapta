/**
 * Fundo tecnológico global: grade de circuito + glows HUD + traços de energia
 * em cobre/azul. Puramente decorativo — fica atrás do conteúdo (-z-10), não
 * captura cliques, e só aparece no tema escuro (no claro o body mantém o
 * gradiente suave atual).
 */
export function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden dark:block">
      {/* base grafite/azul muito escuro */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,#1a1612_0%,#0a0807_55%,#020202_100%)]" />

      {/* grade de circuito */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(217,158,94,0.7) 1px, transparent 1px),' +
            'linear-gradient(0deg, rgba(96,165,250,0.4) 1px, transparent 1px)',
          backgroundSize: '52px 52px, 52px 52px',
        }}
      />

      {/* traços de energia diagonais (curvas largas em cobre, estilo "circuito iluminado") */}
      <div className="absolute right-[-10%] top-[8%] h-[3px] w-[70%] -rotate-[18deg] rounded-full bg-gradient-to-r from-transparent via-primary-300/60 to-transparent blur-[2px]" />
      <div className="absolute right-[-15%] top-[14%] h-[2px] w-[55%] -rotate-[18deg] rounded-full bg-gradient-to-r from-transparent via-primary-200/40 to-transparent blur-[1px]" />
      <div className="absolute left-[-10%] bottom-[12%] h-[3px] w-[60%] rotate-[14deg] rounded-full bg-gradient-to-r from-transparent via-blue-300/35 to-transparent blur-[2px]" />

      {/* glows HUD circulares — cobre (topo-esquerda) e azul (baixo-direita) */}
      <div className="absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-primary-500/20 blur-[140px]" />
      <div className="absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-blue-500/15 blur-[150px]" />
      <div className="absolute right-[-6%] top-[20%] h-80 w-80 rounded-full bg-primary-400/14 blur-[110px]" />
      <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-primary-400/8 blur-[100px]" />

      {/* anéis HUD — centro fica limpo para preservar leitura */}
      <div className="absolute right-[8%] top-[12%] h-64 w-64 rounded-full border border-primary-300/15" />
      <div className="absolute right-[8%] top-[12%] h-64 w-64 scale-125 rounded-full border border-primary-300/8" />
      <div className="absolute right-[8%] top-[12%] h-64 w-64 scale-150 rounded-full border border-primary-300/5" />
      <div className="absolute bottom-[10%] left-[6%] h-48 w-48 rounded-full border border-blue-300/15" />
      <div className="absolute bottom-[10%] left-[6%] h-48 w-48 scale-125 rounded-full border border-blue-300/8" />

      {/* leve vinheta para manter o centro limpo e legível */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_45%,transparent_0%,rgba(2,2,2,0.4)_100%)]" />
    </div>
  );
}
