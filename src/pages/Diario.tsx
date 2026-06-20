import { useState, useCallback } from 'react';
import { BookHeart, Plus, ChevronLeft, ChevronRight, Star, Calendar, RotateCcw } from 'lucide-react';
import { useApp } from '../hooks/useApp';
import type { DiarioEvolucao, RevisaoSemanal } from '../types';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input, Textarea } from '../components/FormFields';
import { formatarDataCompleta, gerarId, hojeISO } from '../utils';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Aba = 'diario' | 'semanal';

const StarRating = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">{label}</label>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`p-1 transition-colors ${n <= value ? 'text-warning-500' : 'text-surface-300 dark:text-surface-600'}`}
        >
          <Star size={22} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  </div>
);

const diarioVazio = (): Omit<DiarioEvolucao, 'id' | 'dataCriacao'> => ({
  data: hojeISO(),
  energia: 3,
  foco: 3,
  humor: 3,
  principalVitoria: '',
  principalDificuldade: '',
  gatilhos: '',
  aprendizado: '',
  ajusteAmanha: '',
});

const revisaoVazia = (): Omit<RevisaoSemanal, 'id' | 'dataCriacao'> => ({
  semanaInicio: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  semanaFim: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  oqueavancou: '',
  oqueFicouParado: '',
  metaNegligenciada: '',
  ondePerdeuTempo: '',
  ondeMelhorou: '',
  focoProximaSemana: '',
});

export function DiarioPage() {
  const { data, setData } = useApp();
  const [aba, setAba] = useState<Aba>('diario');
  const [modalDiario, setModalDiario] = useState(false);
  const [modalSemanal, setModalSemanal] = useState(false);
  const [formDiario, setFormDiario] = useState(diarioVazio());
  const [formSemanal, setFormSemanal] = useState(revisaoVazia());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);

  const diarioOrdenado = [...data.diarioEvolucao].sort((a, b) => b.data.localeCompare(a.data));
  const revisoeOrdenadas = [...data.revisoesSemana].sort((a, b) => b.semanaInicio.localeCompare(a.semanaInicio));

  const abrirNovoDiario = () => {
    setFormDiario(diarioVazio());
    setEditandoId(null);
    setModalDiario(true);
  };

  const abrirEditarDiario = (entry: DiarioEvolucao) => {
    setFormDiario({
      data: entry.data, energia: entry.energia, foco: entry.foco, humor: entry.humor,
      principalVitoria: entry.principalVitoria, principalDificuldade: entry.principalDificuldade,
      gatilhos: entry.gatilhos, aprendizado: entry.aprendizado, ajusteAmanha: entry.ajusteAmanha,
    });
    setEditandoId(entry.id);
    setModalDiario(true);
  };

  const salvarDiario = useCallback(() => {
    setData(d => ({
      ...d,
      diarioEvolucao: editandoId
        ? d.diarioEvolucao.map(e => e.id === editandoId ? { ...e, ...formDiario } : e)
        : [...d.diarioEvolucao, { id: gerarId(), ...formDiario, dataCriacao: hojeISO() }],
    }));
    setModalDiario(false);
  }, [formDiario, editandoId, setData]);

  const salvarRevisao = useCallback(() => {
    setData(d => ({
      ...d,
      revisoesSemana: editandoId
        ? d.revisoesSemana.map(r => r.id === editandoId ? { ...r, ...formSemanal } : r)
        : [...d.revisoesSemana, { id: gerarId(), ...formSemanal, dataCriacao: hojeISO() }],
    }));
    setModalSemanal(false);
  }, [formSemanal, editandoId, setData]);

  const excluirDiario = (id: string) => {
    if (!confirm('Excluir este registro?')) return;
    setData(d => ({ ...d, diarioEvolucao: d.diarioEvolucao.filter(e => e.id !== id) }));
  };

  const excluirRevisao = (id: string) => {
    if (!confirm('Excluir esta revisão?')) return;
    setData(d => ({ ...d, revisoesSemana: d.revisoesSemana.filter(r => r.id !== id) }));
  };

  const mediaEnergia = data.diarioEvolucao.slice(0, 7).reduce((a, e) => a + e.energia, 0) / Math.max(data.diarioEvolucao.slice(0, 7).length, 1);
  const mediaFoco = data.diarioEvolucao.slice(0, 7).reduce((a, e) => a + e.foco, 0) / Math.max(data.diarioEvolucao.slice(0, 7).length, 1);
  const mediaHumor = data.diarioEvolucao.slice(0, 7).reduce((a, e) => a + e.humor, 0) / Math.max(data.diarioEvolucao.slice(0, 7).length, 1);

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">Diário de Evolução</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400">Registre e acompanhe sua evolução diária</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />} onClick={() => { setFormSemanal(revisaoVazia()); setEditandoId(null); setModalSemanal(true); }}>
            Revisão Semanal
          </Button>
          <Button icon={<Plus size={16} />} size="sm" onClick={abrirNovoDiario}>
            Registro do Dia
          </Button>
        </div>
      </div>

      {/* Métricas da semana */}
      {data.diarioEvolucao.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Energia média', valor: mediaEnergia, emoji: '⚡' },
            { label: 'Foco médio', valor: mediaFoco, emoji: '🎯' },
            { label: 'Humor médio', valor: mediaHumor, emoji: '😊' },
          ].map(item => (
            <Card key={item.label}>
              <CardBody>
                <div className="text-center">
                  <p className="text-2xl">{item.emoji}</p>
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-1">{item.valor.toFixed(1)}</p>
                  <div className="flex justify-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} size={10} className={n <= Math.round(item.valor) ? 'text-warning-500' : 'text-surface-200 dark:text-surface-700'} fill={n <= Math.round(item.valor) ? 'currentColor' : 'none'} />
                    ))}
                  </div>
                  <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">{item.label}</p>
                  <p className="text-[10px] text-surface-300 dark:text-surface-600">últimos 7 dias</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1">
        {[{ id: 'diario' as Aba, label: 'Registros Diários' }, { id: 'semanal' as Aba, label: 'Revisões Semanais' }].map(tab => (
          <button key={tab.id} onClick={() => setAba(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${aba === tab.id ? 'bg-primary-600 text-white' : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista diária */}
      {aba === 'diario' && (
        <div className="space-y-3 animate-fade-in">
          {diarioOrdenado.length === 0 ? (
            <Card>
              <CardBody>
                <div className="text-center py-10">
                  <BookHeart size={40} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                  <p className="text-surface-400">Nenhum registro ainda</p>
                  <Button className="mt-4" size="sm" onClick={abrirNovoDiario}>Criar primeiro registro</Button>
                </div>
              </CardBody>
            </Card>
          ) : diarioOrdenado.map(entry => (
            <Card key={entry.id} hover onClick={() => abrirEditarDiario(entry)}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-1 text-xs text-surface-500 dark:text-surface-400">
                        <Calendar size={12} />
                        {formatarDataCompleta(entry.data)}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5" title={`Energia: ${entry.energia}`}>
                          <span className="text-xs">⚡</span>
                          <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} size={9} className={i < entry.energia ? 'text-warning-400' : 'text-surface-200 dark:text-surface-700'} fill={i < entry.energia ? 'currentColor' : 'none'} />)}</div>
                        </div>
                        <div className="flex items-center gap-0.5" title={`Foco: ${entry.foco}`}>
                          <span className="text-xs">🎯</span>
                          <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} size={9} className={i < entry.foco ? 'text-warning-400' : 'text-surface-200 dark:text-surface-700'} fill={i < entry.foco ? 'currentColor' : 'none'} />)}</div>
                        </div>
                        <div className="flex items-center gap-0.5" title={`Humor: ${entry.humor}`}>
                          <span className="text-xs">😊</span>
                          <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} size={9} className={i < entry.humor ? 'text-warning-400' : 'text-surface-200 dark:text-surface-700'} fill={i < entry.humor ? 'currentColor' : 'none'} />)}</div>
                        </div>
                      </div>
                    </div>
                    {entry.principalVitoria && (
                      <p className="text-sm text-surface-700 dark:text-surface-300">
                        <span className="text-success-600 dark:text-success-400 font-medium">✓ </span>
                        {entry.principalVitoria}
                      </p>
                    )}
                    {entry.principalDificuldade && (
                      <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                        <span className="text-danger-500 font-medium">✗ </span>
                        {entry.principalDificuldade}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); excluirDiario(entry.id); }}
                    className="p-1.5 rounded text-surface-300 hover:text-danger-600 transition-colors ml-2"
                  >
                    ✕
                  </button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Lista revisões semanais */}
      {aba === 'semanal' && (
        <div className="space-y-3 animate-fade-in">
          {revisoeOrdenadas.length === 0 ? (
            <Card>
              <CardBody>
                <div className="text-center py-10">
                  <RotateCcw size={40} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                  <p className="text-surface-400">Nenhuma revisão semanal ainda</p>
                  <Button className="mt-4" size="sm" onClick={() => { setFormSemanal(revisaoVazia()); setEditandoId(null); setModalSemanal(true); }}>
                    Fazer primeira revisão
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : revisoeOrdenadas.map(rev => (
            <Card key={rev.id}>
              <CardHeader
                title={`Semana de ${formatarDataCompleta(rev.semanaInicio)} a ${formatarDataCompleta(rev.semanaFim)}`}
                action={
                  <div className="flex gap-1">
                    <button onClick={() => { setFormSemanal({ semanaInicio: rev.semanaInicio, semanaFim: rev.semanaFim, oqueavancou: rev.oqueavancou, oqueFicouParado: rev.oqueFicouParado, metaNegligenciada: rev.metaNegligenciada, ondePerdeuTempo: rev.ondePerdeuTempo, ondeMelhorou: rev.ondeMelhorou, focoProximaSemana: rev.focoProximaSemana }); setEditandoId(rev.id); setModalSemanal(true); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors text-xs">✎</button>
                    <button onClick={() => excluirRevisao(rev.id)} className="p-1 rounded text-surface-400 hover:text-danger-600 transition-colors text-xs">✕</button>
                  </div>
                }
              />
              <CardBody>
                <div className="space-y-2 text-sm">
                  {rev.oqueavancou && <div><span className="text-success-600 dark:text-success-400 font-medium">✓ Avancei: </span><span className="text-surface-600 dark:text-surface-400">{rev.oqueavancou}</span></div>}
                  {rev.oqueFicouParado && <div><span className="text-warning-600 dark:text-warning-400 font-medium">⏸ Ficou parado: </span><span className="text-surface-600 dark:text-surface-400">{rev.oqueFicouParado}</span></div>}
                  {rev.focoProximaSemana && <div><span className="text-primary-600 dark:text-primary-400 font-medium">→ Foco: </span><span className="text-surface-600 dark:text-surface-400">{rev.focoProximaSemana}</span></div>}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Diário */}
      <Modal isOpen={modalDiario} onClose={() => setModalDiario(false)} title={editandoId ? 'Editar Registro' : 'Registro do Dia'} size="lg">
        <div className="space-y-5">
          <Input id="diario-data" label="Data" type="date" value={formDiario.data} onChange={e => setFormDiario(f => ({ ...f, data: e.target.value }))} />
          <div className="grid grid-cols-3 gap-4">
            <StarRating label="⚡ Energia" value={formDiario.energia} onChange={v => setFormDiario(f => ({ ...f, energia: v }))} />
            <StarRating label="🎯 Foco" value={formDiario.foco} onChange={v => setFormDiario(f => ({ ...f, foco: v }))} />
            <StarRating label="😊 Humor" value={formDiario.humor} onChange={v => setFormDiario(f => ({ ...f, humor: v }))} />
          </div>
          <Textarea id="diario-vitoria" label="Principal vitória do dia" value={formDiario.principalVitoria} onChange={e => setFormDiario(f => ({ ...f, principalVitoria: e.target.value }))} placeholder="O que você conquistou hoje?" />
          <Textarea id="diario-dificuldade" label="Principal dificuldade" value={formDiario.principalDificuldade} onChange={e => setFormDiario(f => ({ ...f, principalDificuldade: e.target.value }))} placeholder="O que foi difícil hoje?" />
          <Textarea id="diario-gatilhos" label="Gatilhos percebidos" value={formDiario.gatilhos} onChange={e => setFormDiario(f => ({ ...f, gatilhos: e.target.value }))} placeholder="O que te desequilibrou ou distraiu?" />
          <Textarea id="diario-aprendizado" label="O que aprendi hoje" value={formDiario.aprendizado} onChange={e => setFormDiario(f => ({ ...f, aprendizado: e.target.value }))} placeholder="Qual insight você teve?" />
          <Textarea id="diario-ajuste" label="O que ajusto amanhã" value={formDiario.ajusteAmanha} onChange={e => setFormDiario(f => ({ ...f, ajusteAmanha: e.target.value }))} placeholder="O que vai ser diferente amanhã?" />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalDiario(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarDiario}>{editandoId ? 'Salvar' : 'Registrar'}</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Revisão Semanal */}
      <Modal isOpen={modalSemanal} onClose={() => setModalSemanal(false)} title="Revisão Semanal" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input id="rev-inicio" label="Semana — início" type="date" value={formSemanal.semanaInicio} onChange={e => setFormSemanal(f => ({ ...f, semanaInicio: e.target.value }))} />
            <Input id="rev-fim" label="Semana — fim" type="date" value={formSemanal.semanaFim} onChange={e => setFormSemanal(f => ({ ...f, semanaFim: e.target.value }))} />
          </div>
          <Textarea id="rev-avancou" label="O que avancei esta semana?" value={formSemanal.oqueavancou} onChange={e => setFormSemanal(f => ({ ...f, oqueavancou: e.target.value }))} placeholder="Progressos, conquistas, tarefas concluídas..." />
          <Textarea id="rev-parado" label="O que ficou parado?" value={formSemanal.oqueFicouParado} onChange={e => setFormSemanal(f => ({ ...f, oqueFicouParado: e.target.value }))} placeholder="Tarefas não feitas, metas sem ação..." />
          <Textarea id="rev-negligenciada" label="Qual meta foi negligenciada?" value={formSemanal.metaNegligenciada} onChange={e => setFormSemanal(f => ({ ...f, metaNegligenciada: e.target.value }))} placeholder="Qual meta precisa de atenção urgente?" />
          <Textarea id="rev-tempo" label="Onde perdi tempo?" value={formSemanal.ondePerdeuTempo} onChange={e => setFormSemanal(f => ({ ...f, ondePerdeuTempo: e.target.value }))} placeholder="Onde o tempo foi desperdiçado?" />
          <Textarea id="rev-melhorou" label="Onde melhorei?" value={formSemanal.ondeMelhorou} onChange={e => setFormSemanal(f => ({ ...f, ondeMelhorou: e.target.value }))} placeholder="Comportamentos, hábitos, habilidades..." />
          <Textarea id="rev-foco" label="Foco da próxima semana" value={formSemanal.focoProximaSemana} onChange={e => setFormSemanal(f => ({ ...f, focoProximaSemana: e.target.value }))} placeholder="Qual será a prioridade #1 da próxima semana?" />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalSemanal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarRevisao}>{editandoId ? 'Salvar' : 'Registrar revisão'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
