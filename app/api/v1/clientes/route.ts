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
  ultima_compra: string | null;
  ultima_atividade: string | null;
  campos: Record<string, unknown>;
  participacoes: ParticipacaoDoCliente[];
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
      .select("id, pipeline_id, name, color, position, is_won, is_lost")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
    supabase.from("demand_campaigns").select("id, name").eq("organization_id", orgId).limit(500),
  ]);

  // Participações (negócios com contato). Com um funil escolhido, primeiro quem está nele.
  let consultaDeNegocios = supabase
    .from("crm_leads")
    .select(
      "id, contact_id, pipeline_id, stage_id, status, value_cents, currency, owner_user_id, created_at, updated_at, closed_at, last_activity_at, expected_close_date, source, demand_campaign_id",
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
  }>;

  // Quem aparece: no funil escolhido, os contatos dele; em "todos", todos os contatos.
  let consultaDeContatos = supabase
    .from("contacts")
    .select(
      "id, name, display_name, phone_number, email, tags, source, is_mql, mql_at, created_at, first_approached_at, first_purchase_on, last_activity_at, custom_fields, ltv_cents, ltv_forecast_cents, interest_cents, sales_count, last_purchase_on",
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
    });
    porContato.set(n.contact_id, lista);
  }

  const clientes: ClienteDaLista[] = (
    (contatos ?? []) as Array<{
      id: string;
      name: string | null;
      display_name: string | null;
      phone_number: string | null;
      email: string | null;
      tags: string[] | null;
      source: string | null;
      is_mql: boolean;
      mql_at: string | null;
      created_at: string;
      first_approached_at: string | null;
      first_purchase_on: string | null;
      ltv_cents: number | string | null;
      ltv_forecast_cents: number | string | null;
      interest_cents: number | string | null;
      sales_count: number | null;
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
      campanhas: (campanhas ?? []) as Array<{ id: string; name: string }>,
      clientes,
      pode_editar: roleAtLeast(authz.org.role, "agent"),
      pode_gerir: roleAtLeast(authz.org.role, "manager"),
    },
    { requestId },
  );
}
