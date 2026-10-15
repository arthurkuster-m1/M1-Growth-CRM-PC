/**
 * GET /api/v1/clientes?funil=<uuid|todos> — o CRM numa lista: um lead (contato) por linha, com
 * as participações dele nos funis. `funil=todos` (padrão) traz todos os leads; com o id de um
 * funil, só quem está nele. Também devolve os funis e as etapas, para a tela montar o seletor.
 *
 * "Lead" é o contato (um por telefone). Quem é só grupo de WhatsApp, pessoal ou anonimizado
 * não entra. O limite é de 2.000 leads por consulta.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { roleAtLeast } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import { statusDaOportunidade } from "@/lib/vendas";
import { origemDoContato } from "@/lib/leads/origem-do-contato";

export const dynamic = "force-dynamic";

const LIMITE = 2000;
const consultaSchema = z.object({
  funil: z.union([z.literal("todos"), z.string().uuid()]).default("todos"),
});

export interface ParticipacaoDoCliente {
  lead_id: string;
  funil_id: string;
  etapa_id: string;
  status: "open" | "won" | "lost";
  valor_cents: number | null;
  moeda: string | null;
  responsavel_id: string | null;
  criado_em: string;
  atualizado_em: string;
  fechado_em: string | null;
  ultima_atividade: string | null;
  previsao_de_fechamento: string | null;
  origem: string | null;
  /** A campanha de demanda de onde o negócio veio (anúncio, LP, formulário ou o funil dela). */
  campanha_id: string | null;
  /** O próximo passo combinado da oportunidade e para quando. */
  proxima_acao: string;
  proxima_acao_em: string | null;
}

/** Uma venda ativa (não cancelada) do cliente, para a coluna "Vendas" do CRM. */
export interface VendaAtivaDoCliente {
  id: string;
  nome: string;
  status: "interesse" | "comprometida" | "concluida" | "recorrencia_ativa" | "recorrencia_encerrada" | "cancelada";
  funil_id: string | null;
  valor_cents: number;
  pago_cents: number;
  /** O card (negócio) da venda e a etapa dele; a origem é a da própria venda. */
  lead_id: string | null;
  etapa_id: string | null;
  campanha_id: string | null;
  anuncio_id: string | null;
  lp_id: string | null;
  /** Assinatura: o valor recorrente previsto (parcelas previstas) e a marca de recorrente. */
  recorrente: boolean;
  previsto_cents: number;
}

export interface ClienteDaLista {
  contact_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  tags: string[];
  origem: string | null;
  is_mql: boolean;
  mql_at: string | null;
  entrou_em: string;
  primeira_abordagem: string | null;
  primeira_compra: string | null;
  ltv_cents: number;
  ltv_previsto_cents: number;
  interesse_cents: number;
  vendas: number;
  /** Ciclo de vida calculado no banco (migration 0631) e o porquê. */
  ciclo_de_vida: string | null;
  ciclo_motivo: string | null;
  oportunidades_abertas: number;
  /** Quem cuida do relacionamento com a pessoa (diferente do dono da oportunidade). */
  dono_user_id: string | null;
  /** De onde o CLIENTE veio (o cadastro do lead), não a origem de uma oportunidade dele. */
  origem_do_cliente: {
    fonte: string | null;
    campanha: string | null;
    conjunto: string | null;
    anuncio: string | null;
    pagina: string | null;
    posicionamento: string | null;
  };
  /** Quando deixa de contar como cliente ativo se não pagar de novo (fim da janela). */
  ativo_ate: string | null;
  valor_em_aberto_cents: number;
  proximo_vencimento: string | null;
  /** Vendas PAGAS (ao menos uma parcela recebida) por funil: funil_id → quantidade. */
  vendas_por_funil: Record<string, number>;
  /** As vendas ativas (interesse, comprometida, concluída) com o status de cada uma. */
  vendas_ativas: VendaAtivaDoCliente[];
  /** Anúncios e landing pages de onde vieram as vendas (e, sem venda com origem, os cards). */
  anuncios: string[];
  lps: string[];
  ultima_compra: string | null;
  ultima_atividade: string | null;
  campos: Record<string, unknown>;
  participacoes: ParticipacaoDoCliente[];
}

/** A origem do cadastro do lead (o que a ficha mostra em Cadastro › Origem), em campos soltos. */
function origemDoCadastro(
  metadata: Record<string, unknown> | null,
  fonte: string | null,
): ClienteDaLista["origem_do_cliente"] {
  const o = origemDoContato(metadata, fonte ?? "");
  const manual =
    metadata && typeof metadata.origem_manual === "object" && metadata.origem_manual
      ? (metadata.origem_manual as Record<string, unknown>)
      : {};
  const txt = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
  const pagina =
    txt(manual.lp) ??
    txt(metadata?.lp_name) ??
    txt(metadata?.landing_page_name) ??
    txt(metadata?.landing_page);
  return {
    fonte: o.origem || null,
    campanha: o.campanha,
    conjunto: o.conjunto,
    anuncio: o.anuncio,
    pagina,
    posicionamento: o.posicionamento,
  };
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const q = consultaSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return fail("validation_failed", t("Parâmetros inválidos."), 422, { requestId });
  const orgId = authz.org.orgId;
  const supabase = await createClient();

  const [{ data: funis }, { data: etapas }, { data: campanhas }] = await Promise.all([
    supabase
      .from("crm_pipelines")
      .select("id, name, slug, position, is_default, settings")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
    supabase
      .from("crm_stages")
      .select("id, pipeline_id, name, color, position, is_won, is_lost, qualification, win_probability")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
    supabase
      .from("demand_campaigns")
      .select("id, name, status, channel, pipeline_id")
      .eq("organization_id", orgId)
      .limit(500),
  ]);

  // Participações (negócios com contato). Com um funil escolhido, primeiro quem está nele.
  let consultaDeNegocios = supabase
    .from("crm_leads")
    .select(
      "id, contact_id, pipeline_id, stage_id, status, value_cents, currency, owner_user_id, created_at, updated_at, closed_at, last_activity_at, expected_close_date, source, demand_campaign_id, demand_creative_id, demand_landing_page_id, proxima_acao, proxima_acao_em",
    )
    .eq("organization_id", orgId)
    .not("contact_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(LIMITE * 3);
  if (q.data.funil !== "todos")
    consultaDeNegocios = consultaDeNegocios.eq("pipeline_id", q.data.funil);
  const { data: negocios, error: erroDeNegocios } = await consultaDeNegocios;
  if (erroDeNegocios) {
    return fail("internal_error", t("Erro ao carregar os clientes."), 500, { requestId });
  }

  const linhasDeNegocio = (negocios ?? []) as Array<{
    id: string;
    contact_id: string;
    pipeline_id: string;
    stage_id: string;
    status: "open" | "won" | "lost";
    value_cents: number | null;
    currency: string | null;
    owner_user_id: string | null;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    last_activity_at: string | null;
    expected_close_date: string | null;
    source: string | null;
    demand_campaign_id: string | null;
    demand_creative_id: string | null;
    demand_landing_page_id: string | null;
    proxima_acao: string | null;
    proxima_acao_em: string | null;
  }>;

  // Quem aparece: no funil escolhido, os contatos dele; em "todos", todos os contatos.
  let consultaDeContatos = supabase
    .from("contacts")
    .select(
      "id, name, display_name, phone_number, email, tags, source, source_metadata, is_mql, mql_at, created_at, first_approached_at, first_purchase_on, last_activity_at, custom_fields, ltv_cents, ltv_forecast_cents, interest_cents, sales_count, last_purchase_on, ciclo_de_vida, ciclo_motivo, oportunidades_abertas, valor_em_aberto_cents, proximo_vencimento, dono_user_id, ativo_ate",
    )
    .eq("organization_id", orgId)
    .eq("kind", "person")
    .eq("is_personal", false)
    .eq("is_anonymized", false)
    .is("is_merged_into", null)
    .order("created_at", { ascending: false })
    .limit(LIMITE);
  if (q.data.funil !== "todos") {
    const ids = [...new Set(linhasDeNegocio.map((n) => n.contact_id))].slice(0, LIMITE);
    consultaDeContatos = consultaDeContatos.in("id", ids.length > 0 ? ids : [randomUUID()]);
  }
  const { data: contatos, error: erroDeContatos } = await consultaDeContatos;
  if (erroDeContatos) {
    return fail("internal_error", t("Erro ao carregar os clientes."), 500, { requestId });
  }

  const porContato = new Map<string, ParticipacaoDoCliente[]>();
  for (const n of linhasDeNegocio) {
    const lista = porContato.get(n.contact_id) ?? [];
    lista.push({
      lead_id: n.id,
      funil_id: n.pipeline_id,
      etapa_id: n.stage_id,
      status: n.status,
      valor_cents: n.value_cents,
      moeda: n.currency,
      responsavel_id: n.owner_user_id,
      criado_em: n.created_at,
      atualizado_em: n.updated_at,
      fechado_em: n.closed_at,
      ultima_atividade: n.last_activity_at,
      previsao_de_fechamento: n.expected_close_date,
      origem: n.source,
      campanha_id: n.demand_campaign_id,
      proxima_acao: n.proxima_acao ?? "",
      proxima_acao_em: n.proxima_acao_em,
    });
    porContato.set(n.contact_id, lista);
  }

  // As vendas pagas de cada contato, por funil (uma venda "paga" tem ao menos uma parcela recebida,
  // ou é concluída sem parcelas). Alimenta "Vendas" e a taxa de conversão do topo do CRM.
  const idsDosContatos = ((contatos ?? []) as Array<{ id: string }>).map((c) => c.id);
  const etapaDoCard = new Map(linhasDeNegocio.map((n) => [n.id, n.stage_id] as const));
  const vendasPorContato = new Map<string, Record<string, number>>();
  const ativasPorContato = new Map<string, VendaAtivaDoCliente[]>();
  const idsDeAnuncio = new Map<string, Set<string>>();
  const idsDeLp = new Map<string, Set<string>>();
  const juntar = (m: Map<string, Set<string>>, contato: string, id: string | null) => {
    if (!id) return;
    const s2 = m.get(contato) ?? new Set<string>();
    s2.add(id);
    m.set(contato, s2);
  };
  for (let i = 0; i < idsDosContatos.length; i += 200) {
    // A venda É a oportunidade (card): as que não terminaram em "Não comprou".
    const { data: oportunidades } = await supabase
      .from("crm_leads")
      .select(
        "id, contact_id, pipeline_id, status, title, nome_da_venda, value_cents, is_recurring, recurrence_active, demand_campaign_id, demand_creative_id, demand_landing_page_id, items:crm_sale_items(product_name, position), payments:crm_sale_payments(status, amount_cents)",
      )
      .eq("organization_id", orgId)
      .in("contact_id", idsDosContatos.slice(i, i + 200))
      .limit(5000);
    for (const o of (oportunidades ?? []) as unknown as Array<{
      id: string;
      contact_id: string;
      pipeline_id: string | null;
      status: string;
      title: string | null;
      nome_da_venda: string | null;
      value_cents: number | string | null;
      is_recurring: boolean | null;
      recurrence_active: boolean | null;
      demand_campaign_id: string | null;
      demand_creative_id: string | null;
      demand_landing_page_id: string | null;
      items: Array<{ product_name: string; position: number }> | null;
      payments: Array<{ status: string; amount_cents: number | string }> | null;
    }>) {
      const pagamentosTodos = o.payments ?? [];
      // Oportunidade perdida só entra se já recebeu algo: o sinal não volta e conta no LTV.
      if (o.status === "lost" && !pagamentosTodos.some((p) => p.status === "recebida")) continue;
      const nomesDosProdutos = [...(o.items ?? [])]
        .sort((x, y) => (x.position ?? 0) - (y.position ?? 0))
        .map((x) => x.product_name)
        .filter(Boolean)
        .join(" + ");
      const vivasDaVenda = pagamentosTodos.filter((p) => p.status !== "cancelada");
      const v = {
        id: o.id,
        contact_id: o.contact_id,
        lead_id: o.id as string | null,
        is_recurring: o.is_recurring,
        pipeline_id: o.pipeline_id,
        demand_campaign_id: o.demand_campaign_id,
        status: statusDaOportunidade(o.status, pagamentosTodos, {
          is_recurring: o.is_recurring,
          recurrence_active: o.recurrence_active,
        }) as VendaAtivaDoCliente["status"],
        name: o.nome_da_venda,
        product_name: nomesDosProdutos || o.title,
        amount_cents:
          o.is_recurring === true && vivasDaVenda.length > 0
            ? vivasDaVenda.reduce((s2, p) => s2 + Number(p.amount_cents), 0)
            : Number(o.value_cents) || 0,
        demand_creative_id: o.demand_creative_id,
        demand_landing_page_id: o.demand_landing_page_id,
        payments: pagamentosTodos,
      };
      const pagamentos = vivasDaVenda;
      const pago = pagamentos
        .filter((p) => p.status === "recebida")
        .reduce((s2, p) => s2 + Number(p.amount_cents), 0);
      const lista = ativasPorContato.get(v.contact_id) ?? [];
      lista.push({
        id: v.id,
        nome: (v.name ?? "").trim() || v.product_name || "",
        status: v.status,
        funil_id: v.pipeline_id,
        valor_cents: Number(v.amount_cents) || 0,
        pago_cents: pago,
        lead_id: v.lead_id,
        etapa_id: v.lead_id ? (etapaDoCard.get(v.lead_id) ?? null) : null,
        campanha_id: v.demand_campaign_id,
        anuncio_id: v.demand_creative_id,
        lp_id: v.demand_landing_page_id,
        recorrente: v.is_recurring === true,
        previsto_cents: pagamentos
          .filter((p) => p.status === "prevista")
          .reduce((s2, p) => s2 + Number(p.amount_cents), 0),
      });
      ativasPorContato.set(v.contact_id, lista);
      juntar(idsDeAnuncio, v.contact_id, v.demand_creative_id);
      juntar(idsDeLp, v.contact_id, v.demand_landing_page_id);
      if (v.status === "interesse") continue;
      if (pago <= 0) continue;
      const mapa = vendasPorContato.get(v.contact_id) ?? {};
      const chave = v.pipeline_id ?? "sem_funil";
      mapa[chave] = (mapa[chave] ?? 0) + 1;
      vendasPorContato.set(v.contact_id, mapa);
    }
  }
  // Sem origem na venda, vale a do card (o lead) — para o cliente nunca ficar sem anúncio/LP à toa.
  for (const [contato, lista] of porContato) {
    for (const n of linhasDeNegocio.filter((x) => x.contact_id === contato)) {
      if (!idsDeAnuncio.get(contato)?.size) juntar(idsDeAnuncio, contato, n.demand_creative_id);
      if (!idsDeLp.get(contato)?.size) juntar(idsDeLp, contato, n.demand_landing_page_id);
    }
    void lista;
  }
  const todosAnuncios = [...new Set([...idsDeAnuncio.values()].flatMap((s2) => [...s2]))];
  const todasLps = [...new Set([...idsDeLp.values()].flatMap((s2) => [...s2]))];
  const nomeDoAnuncio = new Map<string, string>();
  const nomeDaLp = new Map<string, string>();
  if (todosAnuncios.length > 0) {
    const { data } = await supabase
      .from("demand_campaign_creatives")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("id", todosAnuncios.slice(0, 1000));
    for (const r of data ?? []) nomeDoAnuncio.set(r.id as string, String(r.name ?? ""));
  }
  if (todasLps.length > 0) {
    const { data } = await supabase
      .from("demand_campaign_landing_pages")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("id", todasLps.slice(0, 1000));
    for (const r of data ?? []) nomeDaLp.set(r.id as string, String(r.name ?? ""));
  }
  const nomesDe = (m: Map<string, Set<string>>, nomes: Map<string, string>, contato: string) =>
    [...(m.get(contato) ?? [])].map((id) => nomes.get(id)).filter((n): n is string => Boolean(n));

  const clientes: ClienteDaLista[] = (
    (contatos ?? []) as Array<{
      id: string;
      name: string | null;
      display_name: string | null;
      phone_number: string | null;
      email: string | null;
      tags: string[] | null;
      source: string | null;
      source_metadata: Record<string, unknown> | null;
      is_mql: boolean;
      mql_at: string | null;
      created_at: string;
      first_approached_at: string | null;
      first_purchase_on: string | null;
      ltv_cents: number | string | null;
      ltv_forecast_cents: number | string | null;
      interest_cents: number | string | null;
      sales_count: number | null;
      ciclo_de_vida: string | null;
      ciclo_motivo: string | null;
      oportunidades_abertas: number | null;
      dono_user_id: string | null;
      ativo_ate: string | null;
      valor_em_aberto_cents: number | string | null;
      proximo_vencimento: string | null;
      last_purchase_on: string | null;
      last_activity_at: string | null;
      custom_fields: Record<string, unknown> | null;
    }>
  ).map((c) => ({
    contact_id: c.id,
    nome: c.display_name?.trim() || c.name?.trim() || c.phone_number || "—",
    telefone: c.phone_number,
    email: c.email,
    tags: c.tags ?? [],
    origem: c.source,
    is_mql: c.is_mql,
    mql_at: c.mql_at,
    entrou_em: c.created_at,
    primeira_abordagem: c.first_approached_at,
    primeira_compra: c.first_purchase_on,
    ltv_cents: Number(c.ltv_cents) || 0,
    ltv_previsto_cents: Number(c.ltv_forecast_cents) || 0,
    interesse_cents: Number(c.interest_cents) || 0,
    vendas: c.sales_count ?? 0,
    ciclo_de_vida: c.ciclo_de_vida,
    ciclo_motivo: c.ciclo_motivo,
    oportunidades_abertas: c.oportunidades_abertas ?? 0,
    dono_user_id: c.dono_user_id,
    origem_do_cliente: origemDoCadastro(c.source_metadata, c.source),
    ativo_ate: c.ativo_ate,
    valor_em_aberto_cents: Number(c.valor_em_aberto_cents) || 0,
    proximo_vencimento: c.proximo_vencimento,
    vendas_por_funil: vendasPorContato.get(c.id) ?? {},
    vendas_ativas: ativasPorContato.get(c.id) ?? [],
    anuncios: nomesDe(idsDeAnuncio, nomeDoAnuncio, c.id),
    lps: nomesDe(idsDeLp, nomeDaLp, c.id),
    ultima_compra: c.last_purchase_on,
    ultima_atividade: c.last_activity_at,
    campos: c.custom_fields ?? {},
    participacoes: porContato.get(c.id) ?? [],
  }));

  return ok(
    {
      funis: (funis ?? []).map((f) => ({
        id: (f as { id: string }).id,
        name: (f as { name: string }).name,
        is_default: (f as { is_default: boolean }).is_default,
      })),
      etapas: etapas ?? [],
      campanhas: (campanhas ?? []) as Array<{
        id: string;
        name: string;
        status: string;
        channel: string;
        pipeline_id: string | null;
      }>,
      clientes,
      anuncios_por_id: Object.fromEntries(nomeDoAnuncio),
      lps_por_id: Object.fromEntries(nomeDaLp),
      pode_editar: roleAtLeast(authz.org.role, "agent"),
      pode_gerir: roleAtLeast(authz.org.role, "manager"),
    },
    { requestId },
  );
}
