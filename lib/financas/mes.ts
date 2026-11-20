import type { Categoria, Conta, Lancamento } from "./tipos";
import { datasDaFatura } from "./formato";

/**
 * Cálculo da Visão do mês — função pura, sem tela e sem banco (por isso é testável).
 *
 * Regra de ouro (decidida com o dono): o mês mostra QUANDO O DINHEIRO SAI DO CAIXA, não quando a compra foi feita.
 * Compra de cartão entra pelo mês da fatura (`fatura_mes`); a fatura aberta sai do caixa na data do vencimento.
 * Transferência nunca é entrada nem saída: só move dinheiro entre contas (pagar fatura é uma transferência).
 */
export type EntradaMes = {
  mes: string;
  hoje: string;
  contas: Conta[];
  categorias: Categoria[];
  /** Lançamentos com DATA dentro do mês (qualquer status). */
  doMes: Lancamento[];
  /** Lançamentos de cartão cuja FATURA é este mês (qualquer data de compra). */
  daFatura: Lancamento[];
  /** Saldo de cada conta no início do mês. */
  inicio: Record<string, number>;
  /** Gasto (ou ganho) ACUMULADO de cada categoria nos meses anteriores do mesmo ano — base do orçamento anual flexível. */
  anoAcumulado?: Record<string, number>;
  /** Teto de gastos DESTE mês (centavos). 0/ausente = ainda não definido (usa a soma dos orçamentos das categorias ÷ 12). */
  teto?: number;
  /** Meta de ganhos DESTE mês (centavos). 0/ausente = ainda não definida (usa a soma das metas das categorias). */
  meta?: number;
  /** Categorias de gasto esporádico (IPVA, seguro, viagem…): contam no teto só pela reserva mensal (orçamento do ano ÷ 12), não pelo que gastaram no mês. */
  esporadicas?: Set<string>;
};

export type ItemConsumo = {
  l: Lancamento;
  /** compra positiva; estorno de cartão negativo */ valor: number;
  categoriaId: string | null;
  cartaoId: string | null;
};
export type FatiaCategoria = {
  categoriaId: string | null;
  nome: string;
  pago: number;
  previsto: number;
  total: number;
  cor: number | null;
  /** orçamento do ANO da categoria (o anual, ou o mensal × 12), o gasto do ano até este mês (inclusive) e o % consumido (1 = 100%); null = sem orçamento */
  orcamentoAnual: number;
  acumuladoAno: number;
  uso: number | null;
  esporadica: boolean;
  /** referência do mês (orçamento do ano ÷ 12) — só informativa: quem manda no mês é o teto */ orcamento: number;
};
/** O teto do mês: valor fixo escolhido por você; o gasto que conta nele e o que sobra. */
export type TetoDoMes = {
  valor: number;
  definido: boolean;
  pago: number;
  previsto: number;
  reserva: number;
  usado: number;
  restante: number;
  estourou: boolean;
};
export type FaturaDoMes = {
  cartao: Conta;
  total: number;
  pagoCompras: number;
  previsto: number;
  jaPaga: number;
  restante: number;
  fecha: string | null;
  paga: string | null;
  contaPagamentoId: string | null;
};
export type ContaDoMes = {
  conta: Conta;
  inicio: number;
  realizado: number;
  faturaRestante: number;
  previsto: number;
};
/** Em que bloco do quadro de alertas aparece: perto do limite, passou do limite, fatura a pagar, previstos atrasados ou aviso solto. */
export type AlertaGrupo = "proximo" | "passou" | "falta_pagar" | "atrasados" | "aviso";
export type Alerta = {
  id: string;
  grupo: AlertaGrupo;
  tom: "warning" | "error" | "info";
  texto: string;
  para?: string;
  /** nome da categoria ou do cartão */ nome?: string;
  /** proximo: o que RESTA; passou: quanto PASSOU; falta_pagar: quanto falta pagar */ valor?: number;
  /** falta_pagar: data do vencimento e se já venceu */ vence?: string;
  vencida?: boolean;
  /** "mês" ou "ano": em que orçamento o alerta se baseia */ base?: "mês" | "ano";
  /** quanto do orçamento já foi usado (1 = 100%) e o teto, para desenhar a barra */ uso?: number;
  teto?: number;
};

export type ResultadoMes = {
  entradas: { pago: number; previsto: number; total: number };
  saidas: { pago: number; previsto: number; total: number };
  resultado: { realizado: number; previsto: number };
  /** Teto do mês (orcamento = teto.valor; restante = teto.restante, negativo quando passou) e o detalhe do que conta nele. */
  orcamento: number;
  restante: number;
  teto: TetoDoMes;
  /** Meta de ganhos do mês (soma das metas das categorias de entrada) e quanto falta para chegar nela. */
  metaEntradas: number;
  metaDefinida: boolean;
  faltaGanhar: number;
  itensSaida: ItemConsumo[];
  itensEntrada: ItemConsumo[];
  categoriasSaida: FatiaCategoria[];
  categoriasEntrada: FatiaCategoria[];
  faturas: FaturaDoMes[];
  contas: ContaDoMes[];
  /** Soma das contas (sem cartão): no início, agora e na previsão de fechamento (já sem as faturas que ainda saem). */
  patrimonio: { inicio: number; realizado: number; previsto: number; faturaSemConta: number };
  alertas: Alerta[];
};

const ativo = (l: Lancamento) => l.status !== "cancelado";
const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const ehSistema = (c: Categoria | undefined) => c?.grupo === "Sistema";

/** Efeito do lançamento sobre o saldo de UMA conta (0 se não a toca). */
export function efeitoNaConta(l: Lancamento, contaId: string): number {
  let d = 0;
  if (l.account_id === contaId) d += l.tipo === "entrada" ? l.valor_cents : -l.valor_cents;
  if (l.account_destino_id === contaId && l.tipo === "transferencia") d += l.valor_cents;
  return d;
}

export function calcularMes(e: EntradaMes): ResultadoMes {
  const cartoes = new Map(e.contas.filter((c) => c.tipo === "cartao").map((c) => [c.id, c]));
  const cats = new Map(e.categorias.map((c) => [c.id, c]));

  /* ── consumo: o que o mês gasta/recebe (sem transferências; cartão pela fatura) ── */
  const base: ItemConsumo[] = [];
  for (const l of e.doMes) {
    if (!ativo(l) || l.tipo === "transferencia" || (l.account_id && cartoes.has(l.account_id)))
      continue;
    base.push({ l, valor: l.valor_cents, categoriaId: l.category_id, cartaoId: null });
  }
  for (const l of e.daFatura) {
    if (!ativo(l) || l.tipo === "transferencia" || !l.account_id || !cartoes.has(l.account_id))
      continue;
    base.push({
      l,
      valor: l.tipo === "saida" ? l.valor_cents : -l.valor_cents,
      categoriaId: l.category_id,
      cartaoId: l.account_id,
    });
  }
  const doConsumo = base.filter(
    (i) => !ehSistema(i.categoriaId ? cats.get(i.categoriaId) : undefined),
  );
  const itensSaida = doConsumo
    .filter((i) => i.l.tipo === "saida" || i.cartaoId)
    .sort((a, b) => b.l.data.localeCompare(a.l.data));
  const itensEntrada = doConsumo
    .filter((i) => i.l.tipo === "entrada" && !i.cartaoId)
    .sort((a, b) => b.l.data.localeCompare(a.l.data));
  const totalPor = (xs: ItemConsumo[]) => {
    const pago = soma(xs.filter((i) => i.l.status === "pago").map((i) => i.valor));
    const previsto = soma(xs.filter((i) => i.l.status === "pendente").map((i) => i.valor));
    return { pago, previsto, total: pago + previsto };
  };
  const saidas = totalPor(itensSaida),
    entradas = totalPor(itensEntrada);

  // O TETO do mês é o único orçamento de gastos: um valor fixo que você escolhe (padrão ou só para este mês).
  // Orçamento por categoria / do ano não existe mais para saídas; a meta de ganho da categoria é só a do mês.
  const metaMensal = (c: Categoria) => c.orcamento_mensal_cents;
  const fatiar = (xs: ItemConsumo[], saida: boolean): FatiaCategoria[] => {
    const m = new Map<string | null, FatiaCategoria>();
    for (const i of xs) {
      const c = i.categoriaId ? cats.get(i.categoriaId) : undefined;
      const f = m.get(i.categoriaId) ?? {
        categoriaId: i.categoriaId,
        nome: c?.nome ?? "Sem categoria",
        pago: 0,
        previsto: 0,
        total: 0,
        cor: c?.cor ?? null,
        orcamentoAnual: 0,
        acumuladoAno: 0,
        uso: null as number | null,
        esporadica: false,
        orcamento: c && !saida ? metaMensal(c) : 0,
      };
      if (i.l.status === "pago") f.pago += i.valor;
      else f.previsto += i.valor;
      f.total = f.pago + f.previsto;
      m.set(i.categoriaId, f);
    }
    return [...m.values()]
      .map((f) => {
        const acumuladoAno = (f.categoriaId ? (e.anoAcumulado?.[f.categoriaId] ?? 0) : 0) + f.total;
        // saída não tem orçamento por categoria; ganho: % da meta do mês
        const uso = saida ? null : f.orcamento > 0 ? f.total / f.orcamento : null;
        return { ...f, acumuladoAno, uso: uso === null ? null : Math.min(uso, 9.99) };
      })
      .sort((a, b) => b.total - a.total);
  };
  const categoriasSaida = fatiar(itensSaida, true);
  const categoriasEntrada = fatiar(itensEntrada, false);
  const metaDasCategorias = soma(
    e.categorias.filter((c) => c.ativa && c.tipo === "entrada" && !ehSistema(c)).map(metaMensal),
  );
  const metaDefinida = (e.meta ?? 0) > 0;
  const metaEntradas = metaDefinida ? (e.meta as number) : metaDasCategorias;

  // tudo que sai conta no teto (inclusive Investimento); sem teto definido não há orçamento
  const tetoValor = (e.teto ?? 0) > 0 ? (e.teto as number) : 0;
  const usado = saidas.total;
  const teto: TetoDoMes = {
    valor: tetoValor,
    definido: tetoValor > 0,
    pago: saidas.pago,
    previsto: saidas.previsto,
    reserva: 0,
    usado,
    restante: tetoValor - usado,
    estourou: tetoValor > 0 && usado > tetoValor,
  };
  const orcamento = tetoValor;

  /* ── faturas do mês ── */
  const faturas: FaturaDoMes[] = [];
  for (const cartao of cartoes.values()) {
    const itens = e.daFatura.filter(
      (l) => l.account_id === cartao.id && ativo(l) && l.tipo !== "transferencia",
    );
    const com = (l: Lancamento) => (l.tipo === "saida" ? l.valor_cents : -l.valor_cents);
    const pagoCompras = soma(itens.filter((l) => l.status === "pago").map(com));
    const previsto = soma(itens.filter((l) => l.status === "pendente").map(com));
    const total = pagoCompras + previsto;
    const jaPaga = soma(
      e.doMes
        .filter((l) => l.tipo === "transferencia" && l.account_destino_id === cartao.id && ativo(l))
        .map((l) => l.valor_cents),
    );
    if (total === 0 && jaPaga === 0) continue;
    const d = datasDaFatura(e.mes, cartao.dia_fechamento, cartao.dia_vencimento);
    faturas.push({
      cartao,
      total,
      pagoCompras,
      previsto,
      jaPaga,
      restante: Math.max(total - jaPaga, 0),
      fecha: d.fecha,
      paga: d.paga,
      contaPagamentoId: cartao.conta_pagamento_id,
    });
  }

  /* ── contas (as de cartão ficam de fora: a dívida delas é a fatura) ── */
  const contasNaoCartao = e.contas.filter((c) => c.tipo !== "cartao" && c.ativa);
  const ids = new Set(contasNaoCartao.map((c) => c.id));
  const validos = e.doMes.filter(ativo);
  const contas: ContaDoMes[] = contasNaoCartao.map((conta) => {
    const inicio = e.inicio[conta.id] ?? 0;
    const pago = soma(
      validos.filter((l) => l.status === "pago").map((l) => efeitoNaConta(l, conta.id)),
    );
    const prev = soma(
      validos.filter((l) => l.status === "pendente").map((l) => efeitoNaConta(l, conta.id)),
    );
    const faturaRestante = soma(
      faturas.filter((f) => f.contaPagamentoId === conta.id).map((f) => f.restante),
    );
    return {
      conta,
      inicio,
      realizado: inicio + pago,
      faturaRestante,
      previsto: inicio + pago + prev - faturaRestante,
    };
  });
  const faturaSemConta = soma(
    faturas
      .filter((f) => !f.contaPagamentoId || !ids.has(f.contaPagamentoId))
      .map((f) => f.restante),
  );

  /* ── patrimônio: todas as contas (sem cartão); a dívida do cartão é a fatura ── */
  const patrimonio = {
    inicio: soma(contas.map((c) => c.inicio)),
    realizado: soma(contas.map((c) => c.realizado)),
    previsto: soma(contas.map((c) => c.previsto)) - faturaSemConta,
    faturaSemConta,
  };

  /* ── alertas ── */
  const alertas: Alerta[] = [];
  const atrasados = validos.filter(
    (l) => l.status === "pendente" && l.data < e.hoje && l.tipo !== "transferencia",
  );
  if (atrasados.length)
    alertas.push({
      id: "atrasados",
      grupo: "atrasados",
      tom: "warning",
      valor: atrasados.length,
      texto: `${atrasados.length} lançamento${atrasados.length > 1 ? "s" : ""} previsto${atrasados.length > 1 ? "s" : ""} com data já passada: pague ou ajuste a data.`,
      para: `/financas/lancamentos?mes=${e.mes}`,
    });
  for (const f of faturas) {
    if (f.restante <= 0) continue;
    const vencida = !!f.paga && f.paga < e.hoje;
    alertas.push({
      id: `falta-pagar-${f.cartao.id}`,
      grupo: "falta_pagar",
      tom: vencida ? "error" : "warning",
      nome: f.cartao.nome,
      valor: f.restante,
      vence: f.paga ?? undefined,
      vencida,
      texto: `Fatura ${f.cartao.nome}: falta pagar${f.paga ? ` (vence ${f.paga.slice(8, 10)}/${f.paga.slice(5, 7)})` : ""}.`,
      para: `/financas/faturas?cartao=${f.cartao.id}&mes=${e.mes}`,
    });
    if (!f.contaPagamentoId)
      alertas.push({
        id: `sem-conta-${f.cartao.id}`,
        grupo: "aviso",
        tom: "info",
        nome: f.cartao.nome,
        texto: `${f.cartao.nome} não tem conta de pagamento: a fatura sai do caixa total, não de uma conta.`,
        para: "/financas/config?aba=cartoes",
      });
  }
  // alerta de gasto: só o TETO do mês
  if (teto.definido && teto.usado > teto.valor)
    alertas.push({
      id: "estouro-teto",
      grupo: "passou",
      tom: "error",
      nome: "Teto do mês",
      valor: teto.usado - teto.valor,
      uso: teto.usado / teto.valor,
      teto: teto.valor,
      base: "mês",
      texto: "O teto do mês foi ultrapassado.",
    });
  else if (teto.definido && teto.usado / teto.valor >= 0.9)
    alertas.push({
      id: "perto-teto",
      grupo: "proximo",
      tom: "warning",
      nome: "Teto do mês",
      valor: teto.valor - teto.usado,
      uso: teto.usado / teto.valor,
      teto: teto.valor,
      base: "mês",
      texto: "O teto do mês está acabando.",
    });

  return {
    entradas,
    saidas,
    resultado: { realizado: entradas.pago - saidas.pago, previsto: entradas.total - saidas.total },
    orcamento,
    restante: teto.restante,
    teto,
    metaEntradas,
    metaDefinida,
    faltaGanhar: Math.max(metaEntradas - entradas.total, 0),
    itensSaida,
    itensEntrada,
    categoriasSaida,
    categoriasEntrada,
    faturas,
    contas,
    patrimonio,
    alertas,
  };
}
