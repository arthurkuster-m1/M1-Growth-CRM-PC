import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET  /api/v1/contacts/[id]/anotacoes — as anotações do lead (mais novas primeiro).
 * POST /api/v1/contacts/[id]/anotacoes — adiciona uma (atendente em diante).
 *
 * Moram em `lead_notes` — a mesma memória que o agente de IA lê ao atender: o que a equipe
 * anota aqui, o agente passa a saber.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const corpoSchema = z.object({
  /** A oportunidade em que a anotação foi feita: ela fica no perfil do lead, marcada com o funil. */
  lead_id: z.string().uuid().optional(),
  titulo: z.string().trim().max(120).optional(),
  texto: z.string().trim().min(1).max(4000),
});

async function contatoDaOrg(contactId: string, orgId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .maybeSingle();
  return Boolean(data);
}

/** O funil e a campanha de cada oportunidade citada, para marcar de onde a anotação veio. */
async function rotulosDasOportunidades(
  orgId: string,
  leadIds: string[],
): Promise<Map<string, { funil: string | null; campanha: string | null }>> {
  const saida = new Map<string, { funil: string | null; campanha: string | null }>();
  if (leadIds.length === 0) return saida;
  const admin = createAdminClient();
  const { data: leads } = await admin
    .from("crm_leads")
    .select("id, pipeline_id, demand_campaign_id")
    .eq("organization_id", orgId)
    .in("id", leadIds);
  const funilIds = [...new Set((leads ?? []).map((l) => l.pipeline_id as string).filter(Boolean))];
  const campanhaIds = [
    ...new Set((leads ?? []).map((l) => l.demand_campaign_id as string | null).filter(Boolean)),
  ] as string[];
  const [funis, campanhas] = await Promise.all([
    funilIds.length
      ? admin.from("crm_pipelines").select("id, name").eq("organization_id", orgId).in("id", funilIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    campanhaIds.length
      ? admin.from("demand_campaigns").select("id, name").eq("organization_id", orgId).in("id", campanhaIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const nomeFunil = new Map((funis.data ?? []).map((f) => [f.id as string, f.name as string]));
  const nomeCampanha = new Map((campanhas.data ?? []).map((c) => [c.id as string, c.name as string]));
  for (const l of leads ?? []) {
    saida.set(l.id as string, {
      funil: nomeFunil.get(l.pipeline_id as string) ?? null,
      campanha: nomeCampanha.get(l.demand_campaign_id as string) ?? null,
    });
  }
  return saida;
}

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success || !(await contatoDaOrg(id.data, authz.org.orgId))) {
    return fail("not_found", t("Contato não encontrado."), 404, { requestId });
  }
  // Na página da oportunidade vem `?lead_id=`: só as anotações daquela oportunidade. Sem ele, o
  // perfil do lead mostra as de todas as oportunidades (e as que não são de nenhuma).
  const filtroDoLead = z.string().uuid().safeParse(new URL(req.url).searchParams.get("lead_id"));
  let consulta = createAdminClient()
    .from("lead_notes")
    .select("id, headline, body, pinned, created_at, lead_id")
    .eq("organization_id", authz.org.orgId)
    .eq("contact_id", id.data);
  if (filtroDoLead.success) consulta = consulta.eq("lead_id", filtroDoLead.data);
  const { data, error } = await consulta
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return fail("internal_error", t("Erro ao carregar as anotações."), 500, { requestId });
  const rotulos = await rotulosDasOportunidades(
    authz.org.orgId,
    [...new Set((data ?? []).map((n) => n.lead_id as string | null).filter(Boolean))] as string[],
  );
  return ok(
    (data ?? []).map((n) => ({
      id: n.id as string,
      titulo: (n.headline as string) ?? "",
      texto: (n.body as string) ?? "",
      fixada: Boolean(n.pinned),
      criada_em: n.created_at as string,
      lead_id: (n.lead_id as string | null) ?? null,
      funil: rotulos.get(n.lead_id as string)?.funil ?? null,
      campanha: rotulos.get(n.lead_id as string)?.campanha ?? null,
    })),
    { requestId },
  );
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success || !(await contatoDaOrg(id.data, authz.org.orgId))) {
    return fail("not_found", t("Contato não encontrado."), 404, { requestId });
  }
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  // A oportunidade tem de ser deste contato e desta organização (nunca do corpo às cegas).
  if (corpo.data.lead_id) {
    const { data: lead } = await createAdminClient()
      .from("crm_leads")
      .select("id")
      .eq("id", corpo.data.lead_id)
      .eq("organization_id", authz.org.orgId)
      .eq("contact_id", id.data)
      .maybeSingle();
    if (!lead) return fail("not_found", t("Oportunidade não encontrada."), 404, { requestId });
  }

  const { data, error } = await createAdminClient()
    .from("lead_notes")
    .insert({
      organization_id: authz.org.orgId,
      contact_id: id.data,
      lead_id: corpo.data.lead_id ?? null,
      headline: corpo.data.titulo ?? "",
      body: corpo.data.texto,
    })
    .select("id, headline, body, pinned, created_at")
    .single();
  if (error || !data) {
    return fail("internal_error", t("Erro ao salvar a anotação."), 500, { requestId });
  }
  void audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "contact.updated",
    resourceType: "contacts",
    resourceId: id.data,
    requestId,
    metadata: { anotacao_adicionada: true, lead_id: corpo.data.lead_id ?? null },
  });
  return ok(
    {
      id: data.id as string,
      titulo: (data.headline as string) ?? "",
      texto: (data.body as string) ?? "",
      fixada: Boolean(data.pinned),
      criada_em: data.created_at as string,
    },
    { requestId, status: 201 },
  );
}
