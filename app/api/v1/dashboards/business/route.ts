/**
 * GET /api/v1/dashboards/business?de=&ate=&ativo=6 — os números do dashboard Business: o que
 * entrou, o que saiu (por ora, mídia), lucro, CAC, LTV, ticket, clientes (ativos = compraram nos
 * últimos N meses), tempo do lead à 1ª compra, recorrência (MRR e churn), carteira e produtos.
 * Toda a empresa lê (viewer+).
 *
 * Definições: faturamento = parcelas RECEBIDAS no período; venda = venda com algo pago, no dia da
 * 1ª parcela; cliente = pessoa com compra paga; LTV = só o recebido.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import {
  corteDoAtivo,
  diasEntreDatas,
  maisMeses,
  media,
  mediana,
  mesDe,
  somarDias,
  ultimosMeses,
} from "@/lib/dashboards/business";
import { taxaDoRecebimento, type TaxaDaForma } from "@/lib/financeiro/taxas";
import { periodoAnterior } from "@/lib/dashboards/trafego";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const reais = (c: unknown) => Math.round(n(c)) / 100;
const arred = (v: number) => Math.round(v * 100) / 100;

interface Parcela {
  sale_id: string;
  amount: number;
  paid_on: string | null;
  due_on: string | null;
  contact_id: string | null;
  recorrente: boolean;
  /** Taxa da forma de pagamento paga pela empresa (custo variável). */
  taxa?: number;
}

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const q = req.nextUrl.searchParams;
  const de = dia.safeParse(q.get("de"));
  const ate = dia.safeParse(q.get("ate"));
  if (!de.success || !ate.success || de.data > ate.data) {
    return fail("validation_failed", a.t("Período inválido."), 422, { requestId: a.requestId });
  }
  const mesesAtivo = Math.min(36, Math.max(1, Math.round(Number(q.get("ativo") ?? 6)) || 6));
  const ant = periodoAnterior(de.data, ate.data);

  const { data: org } = await a.supabase
    .from("organizations")
    .select("timezone")
    .eq("id", a.orgId)
    .maybeSingle();
  const fuso = (org?.timezone as string | null) || "America/Sao_Paulo";
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date());

  // As taxas de cada forma de pagamento (custo variável quando a empresa paga).
  const { data: taxasBrutas } = await a.supabase
    .from("payment_fee_settings")
    .select("forma, name, is_custom, payer, percent_bps, fixed_cents, installment_bps")
    .eq("organization_id", a.orgId)
    .eq("is_active", true)
    .limit(200);
  const taxasPorForma = new Map<string, TaxaDaForma>(
    ((taxasBrutas ?? []) as unknown as TaxaDaForma[]).map((x) => [x.forma, x]),
  );

  // O que foi RECEBIDO: do mais antigo entre (período anterior, 6 meses atrás) até o fim.
  const seisMeses = ultimosMeses(ate.data, 6)[0]!;
  const inicioDaSerie = `${seisMeses}-01`;
  const desde = inicioDaSerie < ant.de ? inicioDaSerie : ant.de;
  const { data: recebidasBrutas } = await a.supabase
    .from("crm_sale_payments")
    .select("lead_id, amount_cents, paid_on, forma, crm_leads!inner(contact_id, status, is_recurring, payment_method, installments)")
    .eq("organization_id", a.orgId)
    .eq("status", "recebida")
    .gte("paid_on", desde)
    .lte("paid_on", ate.data)
    .limit(30000);
  const recebidas: Parcela[] = ((recebidasBrutas ?? []) as unknown as Array<Record<string, unknown>>).map(
    (p) => {
      const s = (Array.isArray(p.crm_leads) ? p.crm_leads[0] : p.crm_leads) as
        | {
            contact_id?: string | null;
            is_recurring?: boolean;
            payment_method?: string | null;
            installments?: number | null;
          }
        | null;
      const forma = String(p.forma ?? "") || String(s?.payment_method ?? "");
      const taxa = taxaDoRecebimento(
        taxasPorForma.get(forma),
        Math.round(n(p.amount_cents)),
        n(s?.installments) || 1,
      );
      return {
        sale_id: String(p.lead_id),
        amount: reais(p.amount_cents),
        paid_on: p.paid_on ? String(p.paid_on).slice(0, 10) : null,
        due_on: null,
        contact_id: s?.contact_id ?? null,
        recorrente: s?.is_recurring === true,
        taxa: reais(taxa.custo_cents),
      };
    },
  );

  // O que está PREVISTO (próximos 75 dias e vencidas).
  const { data: previstasBrutas } = await a.supabase
    .from("crm_sale_payments")
    .select("lead_id, amount_cents, due_on, crm_leads!inner(contact_id, status, is_recurring)")
    .eq("organization_id", a.orgId)
    .eq("status", "prevista")
    .lte("due_on", somarDias(hoje, 75))
    .neq("crm_leads.status", "lost")
    .limit(30000);
  const previstas: Parcela[] = ((previstasBrutas ?? []) as unknown as Array<Record<string, unknown>>).map(
    (p) => {
      const s = (Array.isArray(p.crm_leads) ? p.crm_leads[0] : p.crm_leads) as
        | { contact_id?: string | null; is_recurring?: boolean }
        | null;
      return {
        sale_id: String(p.lead_id),
        amount: reais(p.amount_cents),
        paid_on: null,
        due_on: p.due_on ? String(p.due_on).slice(0, 10) : null,
        contact_id: s?.contact_id ?? null,
        recorrente: s?.is_recurring === true,
      };
    },
  );

  // Mídia (saiu): gasto das campanhas por dia/mês.
  const { data: gastos } = await a.supabase
    .from("demand_campaign_days")
    .select("day, spend")
    .eq("organization_id", a.orgId)
    .gte("day", desde)
    .lte("day", ate.data)
    .limit(30000);
  const gastoPorDia = new Map<string, number>();
  for (const g of (gastos ?? []) as Array<{ day: string; spend: number | string }>) {
    const d = String(g.day).slice(0, 10);
    gastoPorDia.set(d, (gastoPorDia.get(d) ?? 0) + n(g.spend));
  }
  const gastoNo = (de2: string, ate2: string) =>
    arred([...gastoPorDia].filter(([d]) => d >= de2 && d <= ate2).reduce((s, [, v]) => s + v, 0));

  const noPeriodo = (p: Parcela) => (p.paid_on ?? "") >= de.data && (p.paid_on ?? "") <= ate.data;
  const noAnterior = (p: Parcela) => (p.paid_on ?? "") >= ant.de && (p.paid_on ?? "") <= ant.ate;
  const somar = (l: Parcela[]) => arred(l.reduce((s, p) => s + p.amount, 0));
  const somarTaxas = (l: Parcela[]) => arred(l.reduce((s, p) => s + (p.taxa ?? 0), 0));
  const doPeriodo = recebidas.filter(noPeriodo);
  const doAnterior = recebidas.filter(noAnterior);

  // Vendas = vendas com a 1ª parcela recebida (em toda a série lida) dentro do período.
  const primeiraDaVenda = new Map<string, string>();
  for (const p of recebidas) {
    const atual = primeiraDaVenda.get(p.sale_id);
    if (p.paid_on && (!atual || p.paid_on < atual)) primeiraDaVenda.set(p.sale_id, p.paid_on);
  }
  const contaVendas = (de2: string, ate2: string) =>
    [...primeiraDaVenda.values()].filter((d) => d >= de2 && d <= ate2).length;

  // Clientes (base): pessoas com compra paga.
  const { data: contatos } = await a.supabase
    .from("contacts")
    .select("id, created_at, first_purchase_on, last_purchase_on, ltv_cents, sales_count")
    .eq("organization_id", a.orgId)
    .eq("kind", "person")
    .or("ltv_cents.gt.0,sales_count.gt.0")
    .limit(30000);
  const clientes = ((contatos ?? []) as Array<Record<string, unknown>>).filter((c) => n(c.ltv_cents) > 0);
  const corte = corteDoAtivo(hoje, mesesAtivo);
  const ativos = clientes.filter((c) => c.last_purchase_on && String(c.last_purchase_on).slice(0, 10) >= corte);
  const novosNoPeriodo = clientes.filter((c) => {
    const f = c.first_purchase_on ? String(c.first_purchase_on).slice(0, 10) : "";
    return f >= de.data && f <= ate.data;
  });
  const novosNoAnterior = clientes.filter((c) => {
    const f = c.first_purchase_on ? String(c.first_purchase_on).slice(0, 10) : "";
    return f >= ant.de && f <= ant.ate;
  });
  const ltvTotal = clientes.reduce((s, c) => s + n(c.ltv_cents), 0) / 100;
  const vendasDeTodos = clientes.reduce((s, c) => s + n(c.sales_count), 0);
  const diasAte1aCompra = novosNoPeriodo
    .filter((c) => c.created_at && c.first_purchase_on)
    .map((c) => Math.max(0, diasEntreDatas(String(c.created_at), String(c.first_purchase_on))));

  // Quantos funis foi preciso para o lead comprar: os funis distintos em que ele teve oportunidade
  // até o dia da 1ª compra (quem entrou em vários lançamentos, workshops ou campanhas).
  const compradoresDoPeriodo = novosNoPeriodo.map((c) => String(c.id));
  const funisAteComprar: number[] = [];
  for (let i = 0; i < compradoresDoPeriodo.length; i += 200) {
    const { data: oportunidadesDeCompradores } = await a.supabase
      .from("crm_leads")
      .select("contact_id, pipeline_id, created_at")
      .eq("organization_id", a.orgId)
      .in("contact_id", compradoresDoPeriodo.slice(i, i + 200))
      .limit(20000);
    const porContato = new Map<string, Set<string>>();
    for (const o of (oportunidadesDeCompradores ?? []) as Array<{
      contact_id: string;
      pipeline_id: string;
      created_at: string;
    }>) {
      const compra = clientes.find((c) => String(c.id) === o.contact_id)?.first_purchase_on;
      if (!compra || String(o.created_at).slice(0, 10) > String(compra).slice(0, 10)) continue;
      const set = porContato.get(o.contact_id) ?? new Set<string>();
      set.add(o.pipeline_id);
      porContato.set(o.contact_id, set);
    }
    for (const set of porContato.values()) funisAteComprar.push(set.size);
  }

  // Recorrência (assinaturas).
  const { data: assinaturas } = await a.supabase
    .from("crm_leads")
    .select("id, recurrence_active, updated_at, status, value_cents")
    .eq("organization_id", a.orgId)
    .eq("is_recurring", true)
    .limit(5000);
  const lista = (assinaturas ?? []) as Array<{
    id: string;
    recurrence_active: boolean;
    updated_at: string;
    status: string;
    value_cents: number | string | null;
  }>;
  const ativas = lista.filter((s) => s.recurrence_active);
  const encerradasNoPeriodo = lista.filter(
    (s) =>
      !s.recurrence_active &&
      String(s.updated_at).slice(0, 10) >= de.data &&
      String(s.updated_at).slice(0, 10) <= ate.data,
  );
  // MRR = o valor mensal de cada assinatura ativa (a última parcela, ou a próxima prevista).
  const valorMensalDe = new Map<string, number>();
  for (const p of [...recebidas].sort((x, y) => (x.paid_on ?? "").localeCompare(y.paid_on ?? ""))) {
    if (p.recorrente) valorMensalDe.set(p.sale_id, p.amount);
  }
  for (const p of [...previstas].sort((x, y) => (x.due_on ?? "").localeCompare(y.due_on ?? ""))) {
    if (p.recorrente && !valorMensalDe.has(p.sale_id)) valorMensalDe.set(p.sale_id, p.amount);
  }
  const mrr = arred(ativas.reduce((s, v) => s + (valorMensalDe.get(v.id) ?? 0), 0));
  const recorrenteNoPeriodo = somar(doPeriodo.filter((p) => p.recorrente));

  // Série mensal (6 meses) e previsão (2 meses à frente).
  const meses = ultimosMeses(ate.data, 6);
  const serie = meses.map((m) => ({
    mes: m,
    recebido: somar(recebidas.filter((p) => p.paid_on && mesDe(p.paid_on) === m)),
    saiu: arred(
      [...gastoPorDia].filter(([d]) => mesDe(d) === m).reduce((s, [, v]) => s + v, 0),
    ),
    previsto: somar(previstas.filter((p) => p.due_on && mesDe(p.due_on) === m && p.due_on >= hoje)),
    taxas: somarTaxas(recebidas.filter((p) => p.paid_on && mesDe(p.paid_on) === m)),
  }));
  const ultimoMes = meses[meses.length - 1]!;
  for (const k of [1, 2]) {
    const m = maisMeses(ultimoMes, k);
    serie.push({
      mes: m,
      recebido: 0,
      saiu: 0,
      taxas: 0,
      previsto: somar(previstas.filter((p) => p.due_on && mesDe(p.due_on) === m)),
    });
  }

  // Carteira: a receber, vencidas, concentração.
  const aReceber60 = somar(
    previstas.filter((p) => p.due_on && p.due_on >= hoje && p.due_on <= somarDias(hoje, 60)),
  );
  const vencidas = somar(previstas.filter((p) => p.due_on && p.due_on < hoje));
  const porCliente = new Map<string, number>();
  for (const p of doPeriodo) {
    if (p.contact_id) porCliente.set(p.contact_id, (porCliente.get(p.contact_id) ?? 0) + p.amount);
  }
  const top10 = [...porCliente.values()].sort((x, y) => y - x).slice(0, 10).reduce((s, v) => s + v, 0);

  // Por produto (rateio pelo peso de cada item): a função do banco.
  const { data: produtos } = await a.supabase.rpc("fn_vendas_por_produto", {
    p_org: a.orgId,
    p_from: de.data,
    p_to: ate.data,
  });

  const recebido = somar(doPeriodo);
  const recebidoAnt = somar(doAnterior);
  const taxas = somarTaxas(doPeriodo);
  const taxasAnt = somarTaxas(doAnterior);
  const saiu = gastoNo(de.data, ate.data);
  const saiuAnt = gastoNo(ant.de, ant.ate);
  const vendas = contaVendas(de.data, ate.data);
  const vendasAnt = contaVendas(ant.de, ant.ate);

  return ok(
    {
      de: de.data,
      ate: ate.data,
      anterior: ant,
      mesesAtivo,
      recebido,
      recebidoAnterior: recebidoAnt,
      saiu,
      saiuAnterior: saiuAnt,
      taxas,
      taxasAnterior: taxasAnt,
      liquido: arred(recebido - taxas),
      aReceber60,
      vendas,
      vendasAnterior: vendasAnt,
      novosClientes: novosNoPeriodo.length,
      novosClientesAnterior: novosNoAnterior.length,
      clientes: clientes.length,
      ativos: ativos.length,
      ltvMedio: clientes.length > 0 ? arred(ltvTotal / clientes.length) : null,
      vendasPorCliente: clientes.length > 0 ? arred(vendasDeTodos / clientes.length) : null,
      funisAteComprarMedia:
        media(funisAteComprar) === null ? null : arred(media(funisAteComprar)!),
      funisAteComprarMediana: mediana(funisAteComprar),
      diasAte1aCompraMediana: mediana(diasAte1aCompra),
      diasAte1aCompraMedia: media(diasAte1aCompra) === null ? null : arred(media(diasAte1aCompra)!),
      assinaturasAtivas: ativas.length,
      encerradasNoPeriodo: encerradasNoPeriodo.length,
      mrr,
      recorrenteNoPeriodo,
      avulsoNoPeriodo: arred(recebido - recorrenteNoPeriodo),
      vencidas,
      concentracaoTop10: recebido > 0 ? arred((top10 / recebido) * 100) : null,
      serie,
      produtos: ((produtos ?? []) as Array<Record<string, unknown>>).map((r) => ({
        nome: String(r.nome ?? ""),
        vendas: n(r.vendas),
        recebido: reais(r.recebido_cents),
        aReceber: reais(r.a_receber_cents),
      })),
    },
    { requestId: a.requestId },
  );
}
