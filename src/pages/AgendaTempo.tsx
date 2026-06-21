import { useState, useCallback } from 'react';
import { Clock, Plus, Trash2, Zap, Battery } from 'lucide-react';
import { useApp } from '../hooks/useApp';
import type { BlocoTempo, DiaSemana, Periodo, NivelEnergia } from '../types';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input, Select, Textarea } from '../components/FormFields';
import {
  calcularMinutosDisponiveis, sugerirTarefas,
  formatarMinutos, corFaixa, siglaFaixa, hojeISO, gerarId
} from '../utils';
import { format } from 'date-fns';

const diasSemana: DiaSemana[] = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const periodos: Periodo[] = ['manhã', 'tarde', 'noite'];
const energias: NivelEnergia[] = ['baixa', 'média', 'alta'];

const getDiaSemanaHoje = (): DiaSemana => {
  const dias: DiaSemana[] = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return dias[new Date().getDay()];
};

const blocoVazio = (): Omit<BlocoTempo, 'id'> => ({
  data: hojeISO(),
  diaSemana: getDiaSemanaHoje(),
  periodo: 'manhã',
  horasDisponiveis: 1,
  compromissos: '',
  nivelEnergia: 'média',
  observacoes: '',
});

const corEnergia = (e: string) => {
  switch (e) {
    case 'alta': return 'text-success-600 bg-success-50 dark:bg-success-600/20 dark:text-success-400';
    case 'média': return 'text-warning-600 bg-warning-50 dark:bg-warning-600/20 dark:text-warning-400';
    default: return 'text-surface-500 bg-surface-100 dark:bg-surface-700';
  }
};

export function AgendaTempoPage() {
  const { data, setData } = useApp();
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(blocoVazio());
  const [erros, setErros] = useState<Record<string, string>>({});

  const minutosHoje = calcularMinutosDisponiveis(data.blocosTempo);
  const sugestoes = sugerirTarefas(data.tarefas, data.metas, minutosHoje || 120);

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.data) e.data = 'Data obrigatória';
    if (form.horasDisponiveis <= 0) e.horas = 'Informe as horas disponíveis';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = useCallback(() => {
    if (!validar()) return;
    setData(d => ({
      ...d,
      blocosTempo: [...d.blocosTempo, { id: gerarId(), ...form }],
    }));
    setModalAberto(false);
    setForm(blocoVazio());
  }, [form, setData]);

  const excluir = (id: string) => {
    setData(d => ({ ...d, blocosTempo: d.blocosTempo.filter(b => b.id !== id) }));
  };

  // Blocos de hoje
  const blocosHoje = data.blocosTempo.filter(b => b.data === hojeISO());
  // Blocos recentes
  const blocosRecentes = data.blocosTempo
    .filter(b => b.data !== hojeISO())
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">Agenda e Tempo</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400">Gerencie seu tempo disponível e receba sugestões inteligentes</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => { setForm(blocoVazio()); setModalAberto(true); }}>
          Cadastrar Tempo
        </Button>
      </div>

      {/* Resumo do dia */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="sm:col-span-1">
          <CardBody>
            <div className="text-center py-2">
              <Clock size={24} className="mx-auto text-primary-600 dark:text-primary-400 mb-2" />
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{formatarMinutos(minutosHoje)}</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">disponíveis hoje</p>
            </div>
          </CardBody>
        </Card>
        <Card className="sm:col-span-1">
          <CardBody>
            <div className="text-center py-2">
              <Battery size={24} className="mx-auto text-warning-600 dark:text-warning-400 mb-2" />
              <p className="text-3xl font-bold text-surface-900 dark:text-white">
                {blocosHoje.length > 0
                  ? Math.ceil(sugestoes.reduce((acc, t) => acc + t.tempoEstimado, 0) / 60 * 10) / 10
                  : 0}h
              </p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">em tarefas sugeridas</p>
            </div>
          </CardBody>
        </Card>
        <Card className="sm:col-span-1">
          <CardBody>
            <div className="text-center py-2">
              <Zap size={24} className="mx-auto text-success-600 dark:text-success-400 mb-2" />
              <p className="text-3xl font-bold text-surface-900 dark:text-white">{sugestoes.length}</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">tarefas sugeridas</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Blocos de hoje */}
        <Card>
          <CardHeader title="Tempo Cadastrado Hoje" icon={<Clock size={18} />} />
          <CardBody>
            {blocosHoje.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-surface-400 dark:text-surface-500">Nenhum bloco cadastrado para hoje</p>
                <Button variant="primary" size="sm" className="mt-3" icon={<Plus size={14} />} onClick={() => { setForm(blocoVazio()); setModalAberto(true); }}>
                  Cadastrar agora
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {periodos.map(periodo => {
                  const bloco = blocosHoje.find(b => b.periodo === periodo);
                  if (!bloco) return (
                    <div key={periodo} className="flex items-center justify-between p-3 rounded-xl border border-dashed border-surface-200 dark:border-surface-700">
                      <span className="text-sm text-surface-400 capitalize">{periodo}</span>
                      <span className="text-xs text-surface-300 dark:text-surface-600">—</span>
                    </div>
                  );
                  return (
                    <div key={bloco.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-700/30">
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-xs text-surface-400 capitalize">{bloco.periodo}</p>
                          <p className="font-semibold text-primary-600 dark:text-primary-400">{bloco.horasDisponiveis}h</p>
                        </div>
                        <div>
                          {bloco.compromissos && <p className="text-xs text-surface-500 dark:text-surface-400">{bloco.compromissos}</p>}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${corEnergia(bloco.nivelEnergia)}`}>
                            Energia {bloco.nivelEnergia}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => excluir(bloco.id)} className="p-1.5 rounded text-surface-300 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Sugestão inteligente */}
        <Card>
          <CardHeader
            title="Sugestão Inteligente"
            subtitle={minutosHoje > 0 ? `Priorizadas para ${formatarMinutos(minutosHoje)} disponíveis` : 'Baseada em 2h disponíveis'}
            icon={<Zap size={18} />}
          />
          <CardBody>
            {sugestoes.length === 0 ? (
              <p className="text-sm text-surface-400 dark:text-surface-500 text-center py-4">
                Nenhuma tarefa pendente para sugerir
              </p>
            ) : (
              <div className="space-y-2">
                {sugestoes.map((tarefa, idx) => {
                  const meta = data.metas.find(m => m.id === tarefa.metaId);
                  return (
                    <div key={tarefa.id} className="flex items-center gap-3 p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
                      <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{tarefa.titulo}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {meta && <span className="text-xs text-primary-600 dark:text-primary-400 truncate">{meta.nome}</span>}
                          <span className="text-xs text-surface-400">{formatarMinutos(tarefa.tempoEstimado)}</span>
                        </div>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${corFaixa(tarefa.faixa)}`}>{siglaFaixa(tarefa.faixa)}</span>
                    </div>
                  );
                })}
                <p className="text-xs text-center text-surface-400 dark:text-surface-500 pt-2">
                  Total: {formatarMinutos(sugestoes.reduce((acc, t) => acc + t.tempoEstimado, 0))}
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Histórico */}
      {blocosRecentes.length > 0 && (
        <Card>
          <CardHeader title="Histórico de Tempo" />
          <CardBody>
            <div className="space-y-2">
              {blocosRecentes.map(bloco => (
                <div key={bloco.id} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-surface-400 dark:text-surface-500 w-20 flex-shrink-0">{format(new Date(bloco.data), 'dd/MM')}</span>
                    <span className="text-xs text-surface-500 dark:text-surface-400 capitalize">{bloco.diaSemana} — {bloco.periodo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{bloco.horasDisponiveis}h</span>
                    <button onClick={() => excluir(bloco.id)} className="p-1 rounded text-surface-300 hover:text-danger-600 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Modal */}
      <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} title="Cadastrar Tempo Disponível" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input id="bloco-data" label="Data" required type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} error={erros.data} />
            <Select id="bloco-dia" label="Dia da semana" value={form.diaSemana} onChange={e => setForm(f => ({ ...f, diaSemana: e.target.value as DiaSemana }))}>
              {diasSemana.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select id="bloco-periodo" label="Período" value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value as Periodo }))}>
              {periodos.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </Select>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Horas disponíveis: {form.horasDisponiveis}h
              </label>
              <input
                type="range" min={0.5} max={8} step={0.5} value={form.horasDisponiveis}
                onChange={e => setForm(f => ({ ...f, horasDisponiveis: Number(e.target.value) }))}
                className="w-full accent-primary-600"
              />
            </div>
          </div>
          <Select id="bloco-energia" label="Nível de energia" value={form.nivelEnergia} onChange={e => setForm(f => ({ ...f, nivelEnergia: e.target.value as NivelEnergia }))}>
            {energias.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
          </Select>
          <Input id="bloco-compromissos" label="Compromissos fixos" value={form.compromissos} onChange={e => setForm(f => ({ ...f, compromissos: e.target.value }))} placeholder="Ex: Reunião às 14h, buscar filho na escola..." />
          <Textarea id="bloco-obs" label="Observações" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Observações sobre o dia..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvar}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
