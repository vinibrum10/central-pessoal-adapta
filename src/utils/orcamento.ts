import type { AppData, StatusPagamentoMensal } from '../types';
import { calcularValorEfetivo } from './faturaCartao';

// ---- Estrutura de item a pagar no mês ----
export interface ItemPagar {
  id: string;
  tipo: 'despesa' | 'fatura' | 'divida';
  descricao: string;
  valor: number;
  origemLabel: string;
  pago: boolean;
  // faturas
  cartaoNome?: string;
  faturaId?: string;
  competencia?: string;
  cartaoId?: string;
}

function mesAnoDeIso(iso: string): { mes: number; ano: number } {
  const [anoStr, mesStr] = iso.slice(0, 7).split('-');
  return { mes: Number(mesStr) - 1, ano: Number(anoStr) };
}

export function isDespesaPaga(
  despesaId: string,
  mes: number,
  ano: number,
  statusPagamentos: StatusPagamentoMensal[]
): boolean {
  return statusPagamentos.some(
    s => s.itemId === despesaId && s.tipo === 'despesa' && s.mes === mes && s.ano === ano && s.pago
  );
}

export function isDividaParcelaPaga(
  dividaId: string,
  mes: number,
  ano: number,
  statusPagamentos: StatusPagamentoMensal[]
): boolean {
  return statusPagamentos.some(
    s => s.itemId === dividaId && s.tipo === 'divida' && s.mes === mes && s.ano === ano && s.pago
  );
}

export function isFaturaPaga(
  faturaId: string,
  mes: number,
  ano: number,
  statusPagamentos: StatusPagamentoMensal[]
): boolean {
  return statusPagamentos.some(
    s => s.itemId === faturaId && s.tipo === 'fatura' && s.mes === mes && s.ano === ano && s.pago
  );
}

export function gerarItensPagarMes(mes: number, ano: number, data: AppData): ItemPagar[] {
  const statusPagamentos = data.statusPagamentos ?? [];
  const competencia = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const items: ItemPagar[] = [];

  // 1. Despesas não-cartão (ou cartão sem faturaId)
  data.despesas
    .filter(d => {
      if (d.formaPagamento !== 'Cartão de crédito' || !d.faturaId) {
        const { mes: dm, ano: da } = mesAnoDeIso(d.data);
        return dm === mes && da === ano;
      }
      return false;
    })
    .forEach(d => {
      items.push({
        id: d.id,
        tipo: 'despesa',
        descricao: d.descricao,
        valor: d.valor,
        origemLabel: d.formaPagamento,
        pago: isDespesaPaga(d.id, mes, ano, statusPagamentos),
      });
    });

  // 2. Faturas de cartão do mês
  (data.faturas ?? [])
    .filter(f => f.competencia === competencia)
    .forEach(f => {
      const cartao = data.cartoes.find(c => c.id === f.cartaoId);
      const valor = calcularValorEfetivo(f);
      if (valor > 0 || f.valorDetalhado > 0) {
        items.push({
          id: f.id,
          tipo: 'fatura',
          descricao: `Fatura ${cartao?.nome ?? 'Cartão'}`,
          valor: Math.max(valor, f.valorDetalhado),
          origemLabel: 'Cartão de crédito',
          pago: f.status === 'paga' || isFaturaPaga(f.id, mes, ano, statusPagamentos),
          cartaoNome: cartao?.nome,
          faturaId: f.id,
          competencia: f.competencia,
          cartaoId: f.cartaoId,
        });
      }
    });

  // 3. Parcelas de dívidas
  (data.dividas ?? [])
    .filter(d => (d.status === 'ativa' || !d.status) && d.dataInicio)
    .forEach(div => {
      const [inicioAno, inicioMes] = div.dataInicio!.slice(0, 7).split('-').map(Number);
      const mesesDecorridos = (ano - inicioAno) * 12 + (mes - (inicioMes - 1));
      const numeroParcela = mesesDecorridos + 1;
      if (numeroParcela >= 1 && numeroParcela <= div.totalParcelas) {
        items.push({
          id: div.id,
          tipo: 'divida',
          descricao: `${div.nome} — Parcela ${numeroParcela}/${div.totalParcelas}`,
          valor: div.valorParcela,
          origemLabel: 'Dívida',
          pago: isDividaParcelaPaga(div.id, mes, ano, statusPagamentos),
        });
      }
    });

  return items;
}

// Limite usado = soma de todas as despesas do cartão cujas faturas ainda NÃO foram pagas
export function calcularLimiteUsadoCartao(cartaoId: string, data: AppData): number {
  const faturas = data.faturas ?? [];
  return data.despesas
    .filter(d => d.cartaoId === cartaoId)
    .reduce((total, dep) => {
      if (!dep.faturaId) return total + dep.valor;
      const fatura = faturas.find(f => f.id === dep.faturaId);
      if (!fatura) return total + dep.valor;
      if (fatura.status === 'paga') return total;
      return total + dep.valor;
    }, 0);
}

export function calcularLimiteDisponivelCartao(cartaoId: string, limite: number, data: AppData): number {
  return Math.max(0, limite - calcularLimiteUsadoCartao(cartaoId, data));
}

export function calcularFaturaCartaoMes(
  cartaoId: string,
  mes: number,
  ano: number,
  data: AppData
): number {
  const competencia = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const fatura = (data.faturas ?? []).find(f => f.cartaoId === cartaoId && f.competencia === competencia);
  if (fatura) return fatura.valorInformado ?? fatura.valorDetalhado;
  // Sem fatura: soma despesas do cartão no mês (fallback)
  return data.despesas
    .filter(d => {
      if (d.cartaoId !== cartaoId || !d.faturaId) return false;
      const fat = (data.faturas ?? []).find(f => f.id === d.faturaId);
      return fat?.competencia === competencia;
    })
    .reduce((s, d) => s + d.valor, 0);
}

export function calcularAReceberMes(mes: number, ano: number, data: AppData) {
  const lista = (data.aReceber ?? []).filter(a => a.mes === mes + 1 && a.ano === ano);
  const totalAReceber = lista.filter(a => a.status === 'a_receber').reduce((s, a) => s + a.valor, 0);
  const totalRecebido = lista.filter(a => a.status === 'recebido').reduce((s, a) => s + a.valor, 0);
  return { lista, totalAReceber, totalRecebido };
}
