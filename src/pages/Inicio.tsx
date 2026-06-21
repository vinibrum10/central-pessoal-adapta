import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, AlertTriangle, Clock, TrendingDown,
  TrendingUp, Target, Zap, ChevronRight, AlertCircle, CheckCheck,
  Lightbulb
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import {
  getTarefasHoje, getTarefasAtrasadas,
  formatarDinheiro, calcularMinutosDisponiveis,
  sugerirTarefas, formatarMinutos, corFaixa, siglaFaixa, hojeISO,
  calcularEficienciaFoco, corEficiencia, corBarraEficiencia, mensagemEficiencia,
  revisaoAtrasada,
} from '../utils';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FaixaTarefa } from '../types';

export function InicioPage() {
  const { data, setData } = useApp();
  const navigate = useNavigate();
  const [concluindoId, setConcluindoId] = useState<string | null>(null);

  const hoje = new Date();

  const tarefasHoje = getTarefasHoje(data.tarefas);
  const tarefasAtrasadas = getTarefasAtrasadas(data.tarefas);

  const metasAtivas = data.metas
    .filter(m => m.status === 'ativa')
    .sort((a, b) => b.grau - a.grau);
  const metaFoco = metasAtivas[0] ?? null;
  const metasFuturo = data.metas.filter(m => m.status === 'planejar futuro');
  const metasRevisaoAtrasada = metasAtivas.filter(m => revisaoAtrasada(m));
  const eficiencia = calcularEficienciaFoco(metasAtivas.length);

  const minutosDisponiveis = calcularMinutosDisponiveis(data.blocosTempo);
  const sugestoes = sugerirTarefas(data.tarefas, data.metas, minutosDisponiveis || 120);

  // Contagem por faixa
  const faixas: FaixaTarefa[] = ['urgente', 'alto impacto', 'médio impacto', 'baixo impacto'];
  const contFaixa = (f: FaixaTarefa) =>
    data.tarefas.filter(t => t.faixa === f && t.status !== 'concluído').length;

  // Resumo financeiro do mês atual
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const receitasMes = data.receitas
    .filter(r => new Date(r.data).getMonth() === mesAtual && new Date(r.data).getFullYear() === anoAtual)
    .reduce((acc, r) => acc + r.valor, 0);
  const despesasMes = data.despesas
    .filter(d => new Date(d.data).getMonth() === mesAtual && new Date(d.data).getFullYear() === anoAtual)
    .reduce((acc, d) => acc + d.valor, 0);
  const saldoMes = receitasMes - despesasMes;

  const concluirTarefa = (id: string) => {
    setConcluindoId(id);
    setTimeout(() => {
      setData(d => ({
        ...d,
        tarefas: d.tarefas.map(t =>
          t.id === id ? { ...t, status: 'concluído', dataConclusao: hojeISO() } : t
        ),
        metas: d.metas.map(m => {
          const tarefa = d.tarefas.find(t => t.id === id);
          if (tarefa?.metaId === m.id) return { ...m, dataUltimaAcao: hojeISO() };
          return m;
        }),
      }));
      setConcluindoId(null);
    }, 300);
  };

  const tarefasConcluidas = data.tarefas.filter(t =>
    t.status === 'concluído' && t.dataConclusao === hojeISO()
  ).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header do dia */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-surface-500 dark:text-surface-400 capitalize">
            {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <h2 className="text-2xl font-bold text-surface-900 dark:text-white mt-0.5">
            Bom dia, {data.configuracoes.nomeUsuario}! 👋
          </h2>
        </div>
        <Button variant="primary" size="sm" icon={<ChevronRight size={14} />} onClick={() => navigate('/plano')}>
          Ver Plano de Ação
        </Button>
      </div>

      {/* Meta de maior grau (foco principal) */}
      {metaFoco && (
        <div
          className="flex items-center gap-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-2xl px-5 py-4 cursor-pointer hover:border-primary-300 transition-colors"
          onClick={() => navigate('/metas')}
        >
          <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center font-bold text-xl text-white flex-shrink-0 shadow-md shadow-primary-600/30">
            {metaFoco.grau}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold uppercase tracking-wide">Meta Principal</p>
            <p className="font-bold text-surface-900 dark:text-white truncate">{metaFoco.nome}</p>
            {metaFoco.resultadoEsperado && (
              <p className="text-xs text-surface-500 dark:text-surface-400 truncate mt-0.5">{metaFoco.resultadoEsperado}</p>
            )}
          </div>
          <ChevronRight size={16} className="text-primary-400 flex-shrink-0" />
        </div>
      )}

      {/* Contadores de faixa */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {faixas.map(f => (
          <button
            key={f}
            onClick={() => navigate(`/plano?faixa=${encodeURIComponent(f)}`)}
            className="flex flex-col items-center gap-1 p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
          >
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${corFaixa(f)}`}>
              {siglaFaixa(f)}
            </span>
            <span className="text-2xl font-bold text-surface-900 dark:text-white">{contFaixa(f)}</span>
            <span className="text-[10px] text-surface-400 dark:text-surface-500 text-center leading-tight capitalize">{f}</span>
          </button>
        ))}
      </div>

      {/* Alertas */}
      {(tarefasAtrasadas.length > 0 || metasRevisaoAtrasada.length > 0) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {tarefasAtrasadas.length > 0 && (
            <div className="flex-1 flex items-center gap-3 bg-danger-50 dark:bg-danger-600/10 border border-danger-200 dark:border-danger-600/30 rounded-xl px-4 py-3">
              <AlertCircle size={18} className="text-danger-600 dark:text-danger-400 flex-shrink-0" />
              <p className="text-sm text-danger-700 dark:text-danger-300 font-medium">
                {tarefasAtrasadas.length} {tarefasAtrasadas.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}
              </p>
              <button onClick={() => navigate('/plano?filtro=atrasadas')} className="ml-auto text-xs text-danger-600 dark:text-danger-400 hover:underline">
                Ver →
              </button>
            </div>
          )}
          {metasRevisaoAtrasada.length > 0 && (
            <div className="flex-1 flex items-center gap-3 bg-warning-50 dark:bg-warning-600/10 border border-warning-200 dark:border-warning-600/30 rounded-xl px-4 py-3">
              <AlertTriangle size={18} className="text-warning-600 dark:text-warning-400 flex-shrink-0" />
              <p className="text-sm text-warning-700 dark:text-warning-300 font-medium">
                {metasRevisaoAtrasada.length} meta(s) com revisão atrasada
              </p>
              <button onClick={() => navigate('/metas')} className="ml-auto text-xs text-warning-600 dark:text-warning-400 hover:underline">
                Revisar →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Col esquerda */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tarefas de hoje */}
          <Card>
            <CardHeader
              title="Tarefas de Hoje"
              subtitle={tarefasConcluidas > 0 ? `${tarefasConcluidas} concluída(s) hoje` : 'Nenhuma concluída ainda'}
              icon={<CheckCircle2 size={18} />}
              action={
                <Button variant="ghost" size="sm" icon={<ChevronRight size={14} />} onClick={() => navigate('/plano')}>
                  Ver todas
                </Button>
              }
            />
            <CardBody>
              {tarefasHoje.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCheck size={32} className="mx-auto text-success-500 mb-2" />
                  <p className="text-sm text-surface-500 dark:text-surface-400">Você está em dia! Nenhuma tarefa pendente para hoje.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tarefasHoje.slice(0, 5).map(tarefa => {
                    const meta = data.metas.find(m => m.id === tarefa.metaId);
                    const concluindo = concluindoId === tarefa.id;
                    return (
                      <div
                        key={tarefa.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300
                          ${concluindo ? 'opacity-50 scale-95' : ''}
                          border-surface-200 dark:border-surface-700 hover:border-primary-200 dark:hover:border-primary-700 hover:bg-surface-50 dark:hover:bg-surface-700/50`}
                      >
                        <button
                          onClick={() => concluirTarefa(tarefa.id)}
                          className="w-5 h-5 rounded-full border-2 border-surface-300 dark:border-surface-600 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors flex-shrink-0"
                          title="Concluir tarefa"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{tarefa.titulo}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {meta && <span className="text-xs text-surface-400 dark:text-surface-500 truncate">{meta.nome}</span>}
                            <span className="text-xs text-surface-400 dark:text-surface-500 flex-shrink-0">• {formatarMinutos(tarefa.tempoEstimado)}</span>
                          </div>
                        </div>
                        <Badge className={corFaixa(tarefa.faixa)}>{siglaFaixa(tarefa.faixa)}</Badge>
                      </div>
                    );
                  })}
                  {tarefasHoje.length > 5 && (
                    <button onClick={() => navigate('/plano')} className="w-full text-center text-xs text-primary-600 dark:text-primary-400 py-2 hover:underline">
                      +{tarefasHoje.length - 5} mais tarefas
                    </button>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Sugestão de foco */}
          {sugestoes.length > 0 && (
            <Card>
              <CardHeader
                title="Sugestão de Foco"
                subtitle={`Com base em ${minutosDisponiveis > 0 ? formatarMinutos(minutosDisponiveis) : '2h'} disponíveis`}
                icon={<Zap size={18} />}
              />
              <CardBody>
                <div className="space-y-2">
                  {sugestoes.slice(0, 3).map(tarefa => {
                    const meta = data.metas.find(m => m.id === tarefa.metaId);
                    return (
                      <div key={tarefa.id} className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800">
                        <Zap size={14} className="text-primary-600 dark:text-primary-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{tarefa.titulo}</p>
                          {meta && <p className="text-xs text-primary-600 dark:text-primary-400">{meta.nome}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <Badge className={corFaixa(tarefa.faixa)}>{siglaFaixa(tarefa.faixa)}</Badge>
                          <span className="text-xs text-surface-500 dark:text-surface-400">{formatarMinutos(tarefa.tempoEstimado)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Col direita */}
        <div className="space-y-5">
          {/* Eficiência de foco resumida */}
          <Card>
            <CardHeader title="Foco" icon={<Target size={18} />} action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/metas')}>Ver metas</Button>
            } />
            <CardBody>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-surface-600 dark:text-surface-400">Eficiência</span>
                  <span className={`text-lg font-bold ${corEficiencia(eficiencia)}`}>{eficiencia}%</span>
                </div>
                <div className="w-full h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${corBarraEficiencia(eficiencia)}`}
                    style={{ width: `${eficiencia}%` }}
                  />
                </div>
                <p className={`text-xs font-medium ${corEficiencia(eficiencia)}`}>{mensagemEficiencia(eficiencia)}</p>
                <div className="flex items-center justify-between text-xs text-surface-400 dark:text-surface-500 pt-1 border-t border-surface-100 dark:border-surface-700">
                  <span>{metasAtivas.length} ativa{metasAtivas.length !== 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1">
                    <Lightbulb size={11} className="text-amber-400" />
                    {metasFuturo.length} no futuro
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Tempo disponível */}
          <Card>
            <CardHeader title="Tempo Hoje" icon={<Clock size={18} />} action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/agenda')}>Ajustar</Button>
            } />
            <CardBody>
              {minutosDisponiveis > 0 ? (
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary-600 dark:text-primary-400">{formatarMinutos(minutosDisponiveis)}</p>
                  <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">disponíveis hoje</p>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-surface-400 dark:text-surface-500">Nenhum tempo cadastrado</p>
                  <Button variant="primary" size="sm" className="mt-3" onClick={() => navigate('/agenda')}>Cadastrar tempo</Button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Resumo financeiro */}
          <Card>
            <CardHeader title="Finanças do Mês" icon={<TrendingUp size={18} />} action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/orcamento')}>Ver mais</Button>
            } />
            <CardBody>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-success-500" />
                    <span className="text-sm text-surface-600 dark:text-surface-400">Receitas</span>
                  </div>
                  <span className="text-sm font-semibold text-success-600 dark:text-success-400">{formatarDinheiro(receitasMes)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-danger-500" />
                    <span className="text-sm text-surface-600 dark:text-surface-400">Despesas</span>
                  </div>
                  <span className="text-sm font-semibold text-danger-600 dark:text-danger-400">{formatarDinheiro(despesasMes)}</span>
                </div>
                <div className="border-t border-surface-200 dark:border-surface-700 pt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">Saldo</span>
                  <div className="flex items-center gap-1">
                    {saldoMes >= 0
                      ? <TrendingUp size={14} className="text-success-600 dark:text-success-400" />
                      : <TrendingDown size={14} className="text-danger-600 dark:text-danger-400" />
                    }
                    <span className={`text-sm font-bold ${saldoMes >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                      {formatarDinheiro(saldoMes)}
                    </span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
