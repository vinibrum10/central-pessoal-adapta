import { useState, useCallback } from 'react';
import {
  Wallet, Plus, Trash2, Pencil, TrendingUp, TrendingDown,
  CreditCard, AlertTriangle, PiggyBank, Package
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import type {
  Receita, Despesa, Cartao, Divida, Reserva, Bem,
  CategoriaFinanceira, FormaPagamento, StatusCartao,
  PrioridadeQuitacao, StatusBem, TipoBem
} from '../types';
import { Card, CardHeader, CardBody } from '../components/Card';
import { ProgressBar } from '../components/Badge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input, Select, Textarea, Checkbox } from '../components/FormFields';
import { formatarDinheiro, formatarData, gerarId, hojeISO } from '../utils';

type Aba = 'resumo' | 'receitas' | 'despesas' | 'cartoes' | 'dividas' | 'reserva' | 'bens';

const categoriasReceita: CategoriaFinanceira[] = ['Salário', 'Freelance', 'Investimentos', 'Outros'];
const categoriasDespesa: CategoriaFinanceira[] = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Dívidas', 'Cartão', 'Reserva', 'Outros'];
const formasPagamento: FormaPagamento[] = ['Dinheiro', 'Cartão de crédito', 'Débito', 'PIX', 'Boleto', 'Transferência'];

export function OrcamentoPage() {
  const { data, setData } = useApp();
  const [aba, setAba] = useState<Aba>('resumo');
  const [modal, setModal] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Forms
  const [formReceita, setFormReceita] = useState<Omit<Receita, 'id' | 'dataCriacao'>>({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Salário', recorrente: false });
  const [formDespesa, setFormDespesa] = useState<Omit<Despesa, 'id' | 'dataCriacao'>>({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Alimentação', formaPagamento: 'PIX', recorrente: false, essencial: true });
  const [formCartao, setFormCartao] = useState<Omit<Cartao, 'id' | 'dataCriacao'>>({ nome: '', limite: 0, faturaAtual: 0, vencimento: 10, status: 'ativo' });
  const [formDivida, setFormDivida] = useState<Omit<Divida, 'id' | 'dataCriacao'>>({ nome: '', valorTotal: 0, valorParcela: 0, totalParcelas: 1, parcelasPagas: 0, taxaJuros: 0, prioridadeQuitacao: 'média' });
  const [formReserva, setFormReserva] = useState<Omit<Reserva, 'id' | 'dataCriacao'>>({ nome: '', metaReserva: 0, valorAtual: 0, prazoDesejado: '' });
  const [formBem, setFormBem] = useState<Omit<Bem, 'id' | 'dataCriacao'>>({ nome: '', tipo: 'Carro', valorEstimado: 0, status: 'manter', observacoes: '' });

  // Resumo financeiro do mês
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();
  const receitasMes = data.receitas.filter(r => new Date(r.data).getMonth() === mesAtual && new Date(r.data).getFullYear() === anoAtual).reduce((a, r) => a + r.valor, 0);
  const despesasMes = data.despesas.filter(d => new Date(d.data).getMonth() === mesAtual && new Date(d.data).getFullYear() === anoAtual).reduce((a, d) => a + d.valor, 0);
  const saldoMes = receitasMes - despesasMes;
  const totalDividas = data.dividas.reduce((a, d) => a + (d.valorTotal - d.parcelasPagas * d.valorParcela), 0);
  const totalReservas = data.reservas.reduce((a, r) => a + r.valorAtual, 0);
  const totalMetaReservas = data.reservas.reduce((a, r) => a + r.metaReserva, 0);

  const abrirModal = (tipo: string, item?: { id: string }) => {
    setEditandoId(item?.id ?? null);
    setModal(tipo);
  };

  const salvarReceita = useCallback(() => {
    setData(d => ({
      ...d,
      receitas: editandoId
        ? d.receitas.map(r => r.id === editandoId ? { ...r, ...formReceita } : r)
        : [...d.receitas, { id: gerarId(), ...formReceita, dataCriacao: hojeISO() }],
    }));
    setModal(null);
    setEditandoId(null);
    setFormReceita({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Salário', recorrente: false });
  }, [formReceita, editandoId, setData]);

  const salvarDespesa = useCallback(() => {
    setData(d => ({
      ...d,
      despesas: editandoId
        ? d.despesas.map(dep => dep.id === editandoId ? { ...dep, ...formDespesa } : dep)
        : [...d.despesas, { id: gerarId(), ...formDespesa, dataCriacao: hojeISO() }],
    }));
    setModal(null);
    setEditandoId(null);
    setFormDespesa({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Alimentação', formaPagamento: 'PIX', recorrente: false, essencial: true });
  }, [formDespesa, editandoId, setData]);

  const salvarCartao = useCallback(() => {
    setData(d => ({
      ...d,
      cartoes: editandoId
        ? d.cartoes.map(c => c.id === editandoId ? { ...c, ...formCartao } : c)
        : [...d.cartoes, { id: gerarId(), ...formCartao, dataCriacao: hojeISO() }],
    }));
    setModal(null);
  }, [formCartao, editandoId, setData]);

  const salvarDivida = useCallback(() => {
    setData(d => ({
      ...d,
      dividas: editandoId
        ? d.dividas.map(div => div.id === editandoId ? { ...div, ...formDivida } : div)
        : [...d.dividas, { id: gerarId(), ...formDivida, dataCriacao: hojeISO() }],
    }));
    setModal(null);
  }, [formDivida, editandoId, setData]);

  const salvarReserva = useCallback(() => {
    setData(d => ({
      ...d,
      reservas: editandoId
        ? d.reservas.map(r => r.id === editandoId ? { ...r, ...formReserva } : r)
        : [...d.reservas, { id: gerarId(), ...formReserva, dataCriacao: hojeISO() }],
    }));
    setModal(null);
  }, [formReserva, editandoId, setData]);

  const salvarBem = useCallback(() => {
    setData(d => ({
      ...d,
      bens: editandoId
        ? d.bens.map(b => b.id === editandoId ? { ...b, ...formBem } : b)
        : [...d.bens, { id: gerarId(), ...formBem, dataCriacao: hojeISO() }],
    }));
    setModal(null);
  }, [formBem, editandoId, setData]);

  const tabs: { id: Aba; label: string }[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'receitas', label: 'Receitas' },
    { id: 'despesas', label: 'Despesas' },
    { id: 'cartoes', label: 'Cartões' },
    { id: 'dividas', label: 'Dívidas' },
    { id: 'reserva', label: 'Reserva' },
    { id: 'bens', label: 'Bens' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">Orçamento</h2>
        <p className="text-sm text-surface-500 dark:text-surface-400">Seu dinheiro está te aproximando ou afastando das suas metas?</p>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 pb-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setAba(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${aba === tab.id ? 'bg-primary-600 text-white' : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* RESUMO */}
      {aba === 'resumo' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Receitas do mês', valor: receitasMes, icon: <TrendingUp size={18} />, cor: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/20' },
              { label: 'Despesas do mês', valor: despesasMes, icon: <TrendingDown size={18} />, cor: 'text-danger-600 dark:text-danger-400', bg: 'bg-danger-50 dark:bg-danger-900/20' },
              { label: 'Total de dívidas', valor: totalDividas, icon: <AlertTriangle size={18} />, cor: 'text-warning-600 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-warning-900/20' },
              { label: 'Reserva atual', valor: totalReservas, icon: <PiggyBank size={18} />, cor: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20' },
            ].map(item => (
              <Card key={item.label}>
                <CardBody>
                  <div className={`w-9 h-9 rounded-lg ${item.bg} ${item.cor} flex items-center justify-center mb-3`}>{item.icon}</div>
                  <p className={`text-xl font-bold ${item.cor}`}>{formatarDinheiro(item.valor)}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{item.label}</p>
                </CardBody>
              </Card>
            ))}
          </div>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Saldo do mês</span>
                <span className={`text-lg font-bold ${saldoMes >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                  {formatarDinheiro(saldoMes)}
                </span>
              </div>
              <ProgressBar value={receitasMes > 0 ? Math.min(100, (despesasMes / receitasMes) * 100) : 0} color={despesasMes / receitasMes > 0.9 ? 'danger' : 'primary'} height="md" />
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                {receitasMes > 0 ? `${Math.round((despesasMes / receitasMes) * 100)}% da renda comprometida` : 'Sem receitas cadastradas este mês'}
              </p>
            </CardBody>
          </Card>

          {totalMetaReservas > 0 && (
            <Card>
              <CardHeader title="Progresso das Reservas" icon={<PiggyBank size={18} />} />
              <CardBody>
                {data.reservas.map(r => (
                  <div key={r.id} className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-surface-700 dark:text-surface-300">{r.nome}</span>
                      <span className="text-surface-500">{formatarDinheiro(r.valorAtual)} / {formatarDinheiro(r.metaReserva)}</span>
                    </div>
                    <ProgressBar value={(r.valorAtual / r.metaReserva) * 100} showLabel height="md" />
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* RECEITAS */}
      {aba === 'receitas' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => { setFormReceita({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Salário', recorrente: false }); abrirModal('receita'); }}>
              Nova Receita
            </Button>
          </div>
          <Card>
            <CardBody className="!px-4 !pb-4">
              {data.receitas.length === 0 ? (
                <p className="text-center py-8 text-surface-400">Nenhuma receita cadastrada</p>
              ) : (
                <div className="space-y-2">
                  {data.receitas.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-200 dark:border-surface-700">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-success-50 dark:bg-success-900/20 flex items-center justify-center">
                          <TrendingUp size={14} className="text-success-600 dark:text-success-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-900 dark:text-white">{r.descricao}</p>
                          <p className="text-xs text-surface-400 dark:text-surface-500">{formatarData(r.data)} · {r.categoria}{r.recorrente ? ' · Recorrente' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-success-600 dark:text-success-400">{formatarDinheiro(r.valor)}</span>
                        <button onClick={() => { setFormReceita({ descricao: r.descricao, valor: r.valor, data: r.data, categoria: r.categoria, recorrente: r.recorrente }); abrirModal('receita', r); }} className="p-1.5 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setData(d => ({ ...d, receitas: d.receitas.filter(x => x.id !== r.id) }))} className="p-1.5 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* DESPESAS */}
      {aba === 'despesas' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => { setFormDespesa({ descricao: '', valor: 0, data: hojeISO(), categoria: 'Alimentação', formaPagamento: 'PIX', recorrente: false, essencial: true }); abrirModal('despesa'); }}>
              Nova Despesa
            </Button>
          </div>
          <Card>
            <CardBody className="!px-4 !pb-4">
              {data.despesas.length === 0 ? (
                <p className="text-center py-8 text-surface-400">Nenhuma despesa cadastrada</p>
              ) : (
                <div className="space-y-2">
                  {data.despesas.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-200 dark:border-surface-700">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${d.essencial ? 'bg-surface-100 dark:bg-surface-700' : 'bg-warning-50 dark:bg-warning-900/20'}`}>
                          <TrendingDown size={14} className="text-danger-600 dark:text-danger-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-900 dark:text-white">{d.descricao}</p>
                          <p className="text-xs text-surface-400 dark:text-surface-500">
                            {formatarData(d.data)} · {d.categoria} · {d.formaPagamento}
                            {!d.essencial && ' · ⚠ Não essencial'}
                            {d.recorrente && ' · Recorrente'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-danger-600 dark:text-danger-400">{formatarDinheiro(d.valor)}</span>
                        <button onClick={() => { setFormDespesa({ descricao: d.descricao, valor: d.valor, data: d.data, categoria: d.categoria, formaPagamento: d.formaPagamento, recorrente: d.recorrente, essencial: d.essencial }); abrirModal('despesa', d); }} className="p-1.5 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setData(prev => ({ ...prev, despesas: prev.despesas.filter(x => x.id !== d.id) }))} className="p-1.5 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* CARTÕES */}
      {aba === 'cartoes' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => { setFormCartao({ nome: '', limite: 0, faturaAtual: 0, vencimento: 10, status: 'ativo' }); abrirModal('cartao'); }}>
              Novo Cartão
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.cartoes.map(c => (
              <Card key={c.id}>
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                        <CreditCard size={14} className="text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-surface-900 dark:text-white text-sm">{c.nome}</p>
                        <p className="text-xs text-surface-400">Vence dia {c.vencimento}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setFormCartao({ nome: c.nome, limite: c.limite, faturaAtual: c.faturaAtual, vencimento: c.vencimento, status: c.status }); abrirModal('cartao', c); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => setData(d => ({ ...d, cartoes: d.cartoes.filter(x => x.id !== c.id) }))} className="p-1 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500">Fatura atual</span>
                      <span className="font-semibold text-danger-600 dark:text-danger-400">{formatarDinheiro(c.faturaAtual)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500">Limite</span>
                      <span className="text-surface-700 dark:text-surface-300">{formatarDinheiro(c.limite)}</span>
                    </div>
                    <ProgressBar value={c.limite > 0 ? (c.faturaAtual / c.limite) * 100 : 0} color={c.faturaAtual / c.limite > 0.8 ? 'danger' : c.faturaAtual / c.limite > 0.5 ? 'warning' : 'success'} showLabel height="md" />
                  </div>
                </CardBody>
              </Card>
            ))}
            {data.cartoes.length === 0 && (
              <div className="col-span-2 text-center py-10 text-surface-400">Nenhum cartão cadastrado</div>
            )}
          </div>
        </div>
      )}

      {/* DÍVIDAS */}
      {aba === 'dividas' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => { setFormDivida({ nome: '', valorTotal: 0, valorParcela: 0, totalParcelas: 1, parcelasPagas: 0, taxaJuros: 0, prioridadeQuitacao: 'média' }); abrirModal('divida'); }}>
              Nova Dívida
            </Button>
          </div>
          <div className="space-y-3">
            {data.dividas.map(d => {
              const saldo = d.valorTotal - d.parcelasPagas * d.valorParcela;
              const progresso = (d.parcelasPagas / d.totalParcelas) * 100;
              return (
                <Card key={d.id}>
                  <CardBody>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-surface-900 dark:text-white">{d.nome}</p>
                        <p className="text-xs text-surface-400 dark:text-surface-500">
                          {d.parcelasPagas}/{d.totalParcelas} parcelas · {d.taxaJuros > 0 ? `${d.taxaJuros}% a.a.` : 'Sem juros'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setFormDivida({ nome: d.nome, valorTotal: d.valorTotal, valorParcela: d.valorParcela, totalParcelas: d.totalParcelas, parcelasPagas: d.parcelasPagas, taxaJuros: d.taxaJuros, prioridadeQuitacao: d.prioridadeQuitacao }); abrirModal('divida', d); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setData(prev => ({ ...prev, dividas: prev.dividas.filter(x => x.id !== d.id) }))} className="p-1 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-surface-500">Saldo devedor</span>
                      <span className="font-bold text-danger-600 dark:text-danger-400">{formatarDinheiro(saldo)}</span>
                    </div>
                    <ProgressBar value={progresso} showLabel color="success" height="md" />
                    <p className="text-xs text-surface-400 mt-1">Parcela: {formatarDinheiro(d.valorParcela)}/mês</p>
                  </CardBody>
                </Card>
              );
            })}
            {data.dividas.length === 0 && (
              <div className="text-center py-10 text-surface-400">Nenhuma dívida cadastrada 🎉</div>
            )}
          </div>
        </div>
      )}

      {/* RESERVA */}
      {aba === 'reserva' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => { setFormReserva({ nome: '', metaReserva: 0, valorAtual: 0, prazoDesejado: '' }); abrirModal('reserva'); }}>
              Nova Reserva
            </Button>
          </div>
          <div className="space-y-3">
            {data.reservas.map(r => (
              <Card key={r.id}>
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-surface-900 dark:text-white">{r.nome}</p>
                      {r.prazoDesejado && <p className="text-xs text-surface-400">Prazo: {formatarData(r.prazoDesejado)}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setFormReserva({ nome: r.nome, metaReserva: r.metaReserva, valorAtual: r.valorAtual, prazoDesejado: r.prazoDesejado }); abrirModal('reserva', r); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => setData(d => ({ ...d, reservas: d.reservas.filter(x => x.id !== r.id) }))} className="p-1 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-surface-500">Acumulado</span>
                    <span className="font-bold text-primary-600 dark:text-primary-400">{formatarDinheiro(r.valorAtual)} / {formatarDinheiro(r.metaReserva)}</span>
                  </div>
                  <ProgressBar value={r.metaReserva > 0 ? (r.valorAtual / r.metaReserva) * 100 : 0} showLabel color="primary" height="md" />
                </CardBody>
              </Card>
            ))}
            {data.reservas.length === 0 && (
              <div className="text-center py-10 text-surface-400">Nenhuma reserva cadastrada</div>
            )}
          </div>
        </div>
      )}

      {/* BENS */}
      {aba === 'bens' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => { setFormBem({ nome: '', tipo: 'Carro', valorEstimado: 0, status: 'manter', observacoes: '' }); abrirModal('bem'); }}>
              Novo Bem
            </Button>
          </div>
          <div className="space-y-3">
            {data.bens.map(b => (
              <Card key={b.id}>
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
                        <Package size={18} className="text-surface-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-surface-900 dark:text-white">{b.nome}</p>
                        <p className="text-xs text-surface-400">{b.tipo} · {b.status}</p>
                        {b.observacoes && <p className="text-xs text-surface-400 italic mt-0.5">{b.observacoes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-surface-700 dark:text-surface-300">{formatarDinheiro(b.valorEstimado)}</span>
                      <button onClick={() => { setFormBem({ nome: b.nome, tipo: b.tipo, valorEstimado: b.valorEstimado, status: b.status, observacoes: b.observacoes }); abrirModal('bem', b); }} className="p-1 rounded text-surface-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => setData(d => ({ ...d, bens: d.bens.filter(x => x.id !== b.id) }))} className="p-1 rounded text-surface-400 hover:text-danger-600 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
            {data.bens.length === 0 && <div className="text-center py-10 text-surface-400">Nenhum bem cadastrado</div>}
          </div>
        </div>
      )}

      {/* MODAIS */}
      <Modal isOpen={modal === 'receita'} onClose={() => setModal(null)} title={editandoId ? 'Editar Receita' : 'Nova Receita'}>
        <div className="space-y-4">
          <Input id="rec-desc" label="Descrição" required value={formReceita.descricao} onChange={e => setFormReceita(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Salário, freelance..." />
          <div className="grid grid-cols-2 gap-3">
            <Input id="rec-valor" label="Valor (R$)" required type="number" min="0" step="0.01" value={formReceita.valor || ''} onChange={e => setFormReceita(f => ({ ...f, valor: Number(e.target.value) }))} />
            <Input id="rec-data" label="Data" type="date" value={formReceita.data} onChange={e => setFormReceita(f => ({ ...f, data: e.target.value }))} />
          </div>
          <Select id="rec-cat" label="Categoria" value={formReceita.categoria} onChange={e => setFormReceita(f => ({ ...f, categoria: e.target.value as CategoriaFinanceira }))}>
            {categoriasReceita.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Checkbox id="rec-rec" label="Receita recorrente" checked={formReceita.recorrente} onChange={e => setFormReceita(f => ({ ...f, recorrente: e.target.checked }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarReceita}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'despesa'} onClose={() => setModal(null)} title={editandoId ? 'Editar Despesa' : 'Nova Despesa'}>
        <div className="space-y-4">
          <Input id="desp-desc" label="Descrição" required value={formDespesa.descricao} onChange={e => setFormDespesa(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel, supermercado..." />
          <div className="grid grid-cols-2 gap-3">
            <Input id="desp-valor" label="Valor (R$)" required type="number" min="0" step="0.01" value={formDespesa.valor || ''} onChange={e => setFormDespesa(f => ({ ...f, valor: Number(e.target.value) }))} />
            <Input id="desp-data" label="Data" type="date" value={formDespesa.data} onChange={e => setFormDespesa(f => ({ ...f, data: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select id="desp-cat" label="Categoria" value={formDespesa.categoria} onChange={e => setFormDespesa(f => ({ ...f, categoria: e.target.value as CategoriaFinanceira }))}>
              {categoriasDespesa.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select id="desp-forma" label="Forma de pagamento" value={formDespesa.formaPagamento} onChange={e => setFormDespesa(f => ({ ...f, formaPagamento: e.target.value as FormaPagamento }))}>
              {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
            </Select>
          </div>
          <div className="flex gap-4">
            <Checkbox id="desp-rec" label="Recorrente" checked={formDespesa.recorrente} onChange={e => setFormDespesa(f => ({ ...f, recorrente: e.target.checked }))} />
            <Checkbox id="desp-ess" label="Essencial" checked={formDespesa.essencial} onChange={e => setFormDespesa(f => ({ ...f, essencial: e.target.checked }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarDespesa}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'cartao'} onClose={() => setModal(null)} title={editandoId ? 'Editar Cartão' : 'Novo Cartão'}>
        <div className="space-y-4">
          <Input id="cart-nome" label="Nome do cartão" required value={formCartao.nome} onChange={e => setFormCartao(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Nubank, Bradesco..." />
          <div className="grid grid-cols-2 gap-3">
            <Input id="cart-limite" label="Limite (R$)" type="number" min="0" value={formCartao.limite || ''} onChange={e => setFormCartao(f => ({ ...f, limite: Number(e.target.value) }))} />
            <Input id="cart-fatura" label="Fatura atual (R$)" type="number" min="0" value={formCartao.faturaAtual || ''} onChange={e => setFormCartao(f => ({ ...f, faturaAtual: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="cart-venc" label="Dia vencimento" type="number" min="1" max="31" value={formCartao.vencimento} onChange={e => setFormCartao(f => ({ ...f, vencimento: Number(e.target.value) }))} />
            <Select id="cart-status" label="Status" value={formCartao.status} onChange={e => setFormCartao(f => ({ ...f, status: e.target.value as StatusCartao }))}>
              <option value="ativo">Ativo</option>
              <option value="bloqueado">Bloqueado</option>
              <option value="cancelado">Cancelado</option>
            </Select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarCartao}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'divida'} onClose={() => setModal(null)} title={editandoId ? 'Editar Dívida' : 'Nova Dívida'}>
        <div className="space-y-4">
          <Input id="div-nome" label="Nome da dívida" required value={formDivida.nome} onChange={e => setFormDivida(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Empréstimo banco..." />
          <div className="grid grid-cols-2 gap-3">
            <Input id="div-total" label="Valor total (R$)" type="number" min="0" value={formDivida.valorTotal || ''} onChange={e => setFormDivida(f => ({ ...f, valorTotal: Number(e.target.value) }))} />
            <Input id="div-parcela" label="Valor parcela (R$)" type="number" min="0" value={formDivida.valorParcela || ''} onChange={e => setFormDivida(f => ({ ...f, valorParcela: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="div-totparc" label="Total de parcelas" type="number" min="1" value={formDivida.totalParcelas} onChange={e => setFormDivida(f => ({ ...f, totalParcelas: Number(e.target.value) }))} />
            <Input id="div-pagas" label="Parcelas pagas" type="number" min="0" value={formDivida.parcelasPagas} onChange={e => setFormDivida(f => ({ ...f, parcelasPagas: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="div-juros" label="Taxa de juros (% a.a.)" type="number" min="0" step="0.1" value={formDivida.taxaJuros || ''} onChange={e => setFormDivida(f => ({ ...f, taxaJuros: Number(e.target.value) }))} />
            <Select id="div-prio" label="Prioridade quitação" value={formDivida.prioridadeQuitacao} onChange={e => setFormDivida(f => ({ ...f, prioridadeQuitacao: e.target.value as PrioridadeQuitacao }))}>
              <option value="baixa">Baixa</option>
              <option value="média">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </Select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarDivida}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'reserva'} onClose={() => setModal(null)} title={editandoId ? 'Editar Reserva' : 'Nova Reserva'}>
        <div className="space-y-4">
          <Input id="res-nome" label="Nome da reserva" required value={formReserva.nome} onChange={e => setFormReserva(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Reserva para EUA..." />
          <div className="grid grid-cols-2 gap-3">
            <Input id="res-meta" label="Meta (R$)" type="number" min="0" value={formReserva.metaReserva || ''} onChange={e => setFormReserva(f => ({ ...f, metaReserva: Number(e.target.value) }))} />
            <Input id="res-atual" label="Valor atual (R$)" type="number" min="0" value={formReserva.valorAtual || ''} onChange={e => setFormReserva(f => ({ ...f, valorAtual: Number(e.target.value) }))} />
          </div>
          <Input id="res-prazo" label="Prazo desejado" type="date" value={formReserva.prazoDesejado} onChange={e => setFormReserva(f => ({ ...f, prazoDesejado: e.target.value }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarReserva}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'bem'} onClose={() => setModal(null)} title={editandoId ? 'Editar Bem' : 'Novo Bem'}>
        <div className="space-y-4">
          <Input id="bem-nome" label="Nome do bem" required value={formBem.nome} onChange={e => setFormBem(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: HB20 2019, Casa na rua..." />
          <div className="grid grid-cols-2 gap-3">
            <Select id="bem-tipo" label="Tipo" value={formBem.tipo} onChange={e => setFormBem(f => ({ ...f, tipo: e.target.value as TipoBem }))}>
              {(['Casa', 'Carro', 'Eletrônico', 'Móvel', 'Outro'] as TipoBem[]).map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input id="bem-valor" label="Valor estimado (R$)" type="number" min="0" value={formBem.valorEstimado || ''} onChange={e => setFormBem(f => ({ ...f, valorEstimado: Number(e.target.value) }))} />
          </div>
          <Select id="bem-status" label="Status" value={formBem.status} onChange={e => setFormBem(f => ({ ...f, status: e.target.value as StatusBem }))}>
            <option value="manter">Manter</option>
            <option value="avaliar venda">Avaliar venda</option>
            <option value="à venda">À venda</option>
            <option value="vendido">Vendido</option>
          </Select>
          <Textarea id="bem-obs" label="Observações" value={formBem.observacoes} onChange={e => setFormBem(f => ({ ...f, observacoes: e.target.value }))} placeholder="Detalhes sobre o bem..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarBem}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
