import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, type PieLabelRenderProps,
} from 'recharts';

// Isolado do Inicio.tsx para que o recharts (biblioteca pesada, usada só
// aqui) vire seu próprio chunk, carregado sob demanda via React.lazy, e para
// que os 4 gráficos fiquem num Suspense boundary próprio — assim o resto do
// dashboard (KPIs, foco do dia etc.) pinta antes, sem esperar o recharts.

function TooltipDark({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-xl text-xs text-white">
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i}>{p.name}: <span className="font-bold">{p.value}{p.name === 'Atendimento' ? '%' : ''}</span></p>
      ))}
    </div>
  );
}

const RADIAN = Math.PI / 180;
function LabelPie(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (!midAngle || !innerRadius || !outerRadius || !percent || percent < 0.06) return null;
  const cxN = Number(cx);
  const cyN = Number(cy);
  const iR = Number(innerRadius);
  const oR = Number(outerRadius);
  const radius = iR + (oR - iR) * 0.5;
  const x = cxN + radius * Math.cos(-Number(midAngle) * RADIAN);
  const y = cyN + radius * Math.sin(-Number(midAngle) * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
      {`${(Number(percent) * 100).toFixed(0)}%`}
    </text>
  );
}

type DadoAtendimento = { nome: string; atendimento: number; grau: number; fill: string };
type DadoFatiado = { name: string; value: number; fill: string };

export default function InicioCharts({
  dadosAtendimento,
  acoesPorStatus,
  acoesPorFaixa,
  metasPorCategoria,
}: {
  dadosAtendimento: DadoAtendimento[];
  acoesPorStatus: DadoFatiado[];
  acoesPorFaixa: DadoFatiado[];
  metasPorCategoria: DadoFatiado[];
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

      {/* Gráfico 1 — Atendimento por meta (horizontal) */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-surface-900 dark:text-white">Atendimento por Meta</h3>
        <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5 mb-4">% de ações concluídas · ordenado por grau</p>
        {dadosAtendimento.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-surface-400 dark:text-surface-500 text-sm">Nenhuma meta ativa</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, dadosAtendimento.length * 46)}>
            <BarChart data={dadosAtendimento} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="nome" width={148} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip content={<TooltipDark />} />
              <Bar dataKey="atendimento" name="Atendimento" radius={[0, 6, 6, 0]}>
                {dadosAtendimento.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Gráfico 2 — Ações por status (rosca) */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-surface-900 dark:text-white">Ações por Status</h3>
        <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5 mb-4">Distribuição das ações vinculadas a metas ativas</p>
        {acoesPorStatus.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-surface-400 dark:text-surface-500 text-sm">Nenhuma ação</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={acoesPorStatus}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                labelLine={false}
                label={LabelPie}
              >
                {acoesPorStatus.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
              <Tooltip
                formatter={(v) => [`${v} ações`]}
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Gráfico 3 — Ações por Faixa */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-surface-900 dark:text-white">Ações por Faixa</h3>
        <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5 mb-4">UG · AI · MI · BI — ações pendentes e concluídas</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={acoesPorFaixa} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="sigla" tick={{ fontSize: 13, fill: '#94a3b8', fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as { sigla: string; name: string; value: number };
                return (
                  <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                    <p className="font-semibold">{d?.name}</p>
                    <p>{d?.value} ações</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" name="Ações" radius={[6, 6, 0, 0]}>
              {acoesPorFaixa.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico 4 — Metas por Categoria */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-surface-900 dark:text-white">Metas por Categoria</h3>
        <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5 mb-4">Distribuição das metas ativas por área de vida</p>
        {metasPorCategoria.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-surface-400 dark:text-surface-500 text-sm">Nenhuma meta ativa</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metasPorCategoria} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: '#fff' }}
                labelStyle={{ color: '#fff', fontWeight: 600 }}
              />
              <Bar dataKey="value" name="Metas" radius={[6, 6, 0, 0]}>
                {metasPorCategoria.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
