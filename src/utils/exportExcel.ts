import * as XLSX from 'xlsx';
import type { AppData } from '../types';

const fmt = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  return String(v);
};

const fmtData = (iso: string | undefined | null): string => {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  if (s.length < 10) return s;
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

const fmtMoeda = (v: number | undefined): string => {
  if (v === undefined || v === null) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};

const fmtBool = (v: boolean | undefined): string => (v ? 'Sim' : 'Não');

export function exportarDadosExcel(data: AppData): void {
  const wb = XLSX.utils.book_new();

  // 1 — Metas
  const metasRows = data.metas.map(m => ({
    'Nome': m.nome,
    'Categoria': m.categoria,
    'Grau': m.grau,
    'Status': m.status,
    'Prazo Final': fmtData(m.prazoFinal),
    'Classificação Prazo': fmt(m.classificacaoPrazo),
    'Frequência Revisão': m.frequenciaRevisao,
    'Última Revisão': fmtData(m.dataUltimaRevisao),
    'Última Ação': fmtData(m.dataUltimaAcao),
    'Motivo': m.motivo,
    'Resultado Esperado': m.resultadoEsperado,
    'Data Criação': fmtData(m.dataCriacao),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metasRows), 'Metas');

  // 2 — Tarefas
  const tarefasRows = data.tarefas.map(t => ({
    'Título': t.titulo,
    'Categoria': t.categoria,
    'Status': t.status,
    'Faixa': t.faixa,
    'Tipo': t.tipoAcao ?? 'eventual',
    'Prazo': fmtData(t.prazo),
    'Tempo Estimado (min)': t.tempoEstimado,
    'Energia': t.energiaNecessaria,
    'Conclusão': fmtData(t.dataConclusao),
    'Observações': t.observacoes,
    'Data Criação': fmtData(t.dataCriacao),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tarefasRows), 'Tarefas');

  // 3 — Receitas
  const receitasRows = data.receitas.map(r => ({
    'Descrição': r.descricao,
    'Valor': fmtMoeda(r.valor),
    'Data': fmtData(r.data),
    'Categoria': r.categoria,
    'Recorrente': fmtBool(r.recorrente),
    'Data Criação': fmtData(r.dataCriacao),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(receitasRows), 'Receitas');

  // 4 — Despesas
  const despesasRows = data.despesas.map(d => ({
    'Descrição': d.descricao,
    'Valor': fmtMoeda(d.valor),
    'Data': fmtData(d.data),
    'Categoria': d.categoria,
    'Forma Pagamento': d.formaPagamento,
    'Recorrente': fmtBool(d.recorrente),
    'Essencial': fmtBool(d.essencial),
    'Data Criação': fmtData(d.dataCriacao),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(despesasRows), 'Despesas');

  // 5 — Cartões
  const cartoesRows = data.cartoes.map(c => ({
    'Nome': c.nome,
    'Limite': fmtMoeda(c.limite),
    'Fatura Atual': fmtMoeda(c.faturaAtual),
    'Vencimento Dia': c.vencimento,
    'Status': c.status,
    'Data Criação': fmtData(c.dataCriacao),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cartoesRows), 'Cartões');

  // 6 — Dívidas
  const dividasRows = data.dividas.map(d => ({
    'Nome': d.nome,
    'Valor Total': fmtMoeda(d.valorTotal),
    'Valor Parcela': fmtMoeda(d.valorParcela),
    'Total Parcelas': d.totalParcelas,
    'Parcelas Pagas': d.parcelasPagas,
    'Taxa Juros (% a.a.)': d.taxaJuros,
    'Prioridade': d.prioridadeQuitacao,
    'Data Início': fmtData(d.dataInicio),
    'Dia Vencimento': fmt(d.diaVencimento),
    'Status': d.status ?? 'ativa',
    'Data Criação': fmtData(d.dataCriacao),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dividasRows), 'Dívidas');

  // 7 — Reservas
  const reservasRows = data.reservas.map(r => ({
    'Nome': r.nome,
    'Meta': fmtMoeda(r.metaReserva),
    'Valor Atual': fmtMoeda(r.valorAtual),
    'Prazo Desejado': fmtData(r.prazoDesejado),
    'Progresso': `${Math.round((r.valorAtual / Math.max(1, r.metaReserva)) * 100)}%`,
    'Data Criação': fmtData(r.dataCriacao),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reservasRows), 'Reservas');

  // 8 — Bens
  const bensRows = data.bens.map(b => ({
    'Nome': b.nome,
    'Tipo': b.tipo,
    'Valor Estimado': fmtMoeda(b.valorEstimado),
    'Status': b.status,
    'Observações': b.observacoes,
    'Data Criação': fmtData(b.dataCriacao),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bensRows), 'Bens');

  // 9 — Agenda
  const agendaRows = data.eventosAgenda.map(e => ({
    'Título': e.titulo,
    'Fonte': e.fonte,
    'Início': e.inicio,
    'Fim': e.fim,
    'Dia Inteiro': fmtBool(e.diaInteiro),
    'Bloqueia Tempo': fmtBool(e.bloqueiaTempo),
    'Ignorado': fmtBool(e.ignorado),
    'Local': fmt(e.local),
    'Importado Em': fmtData(e.importadoEm),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(agendaRows), 'Agenda');

  // 10 — Leituras Diárias
  const leiturasRows = data.leiturasDiarias.map(l => ({
    'Título': l.titulo,
    'Tipo': l.tipo,
    'Status': l.status,
    'Origem': l.origem,
    'Categoria': l.categoria,
    'Prioridade': l.prioridade,
    'URL': fmt(l.url),
    'Data Leitura': fmtData(l.dataLeitura),
    'Data Criação': fmtData(l.dataCriacao),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leiturasRows), 'Leituras Diárias');

  // 11 — Configurações
  const configRows = [
    { 'Chave': 'Nome Usuário', 'Valor': data.configuracoes.nomeUsuario },
    { 'Chave': 'Tema', 'Valor': data.configuracoes.tema },
    { 'Chave': 'Visualização Padrão', 'Valor': data.configuracoes.visualizacaoPadrao },
    { 'Chave': 'Total de Metas', 'Valor': String(data.metas.length) },
    { 'Chave': 'Total de Tarefas', 'Valor': String(data.tarefas.length) },
    { 'Chave': 'Total de Receitas', 'Valor': String(data.receitas.length) },
    { 'Chave': 'Total de Despesas', 'Valor': String(data.despesas.length) },
    { 'Chave': 'Exportado Em', 'Valor': new Date().toLocaleString('pt-BR') },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(configRows), 'Configurações');

  // Gerar e baixar
  const hoje = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `sistema-gestao-pessoal-backup-${hoje}.xlsx`);
}
