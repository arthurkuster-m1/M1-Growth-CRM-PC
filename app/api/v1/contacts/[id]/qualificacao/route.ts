import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET /api/v1/contacts/[id]/qualificacao — a ficha de qualificação do lead: quando entrou,
 * quando foi abordado pela primeira vez, se é MQL e em quais funis está.
 * PUT /api/v1/contacts/[id]/qualificacao — marca ou desmarca o MQL (atendente em diante).
 *
 * "Lead" é o contato: um por telefone. Os funis vêm dos negócios (`crm_leads`) dele.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

const idSchema = z.string().uuid();

export async function GET(_req: NextRequest, ctx: Contexto): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const id = idSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail("not_found", t("Contato não encontrado."), 404, { requestId });

  const supabase = await createClient();
  const { data: contato, error } = await supabase
    .from("contacts")
    .select("id, created_at, is_mql, mql_at, first_approached_at, first_purchase_on")
    .eq("id", id.data)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", t("Erro ao carregar o contato."), 500, { requestId });
  if (!contato) return fail("not_found", t("Contato não encontrado."), 404, { requestId });

  const { data: negocios } = await supabase
    .from("crm_leads")
    .select("id, status, created_at, crm_pipelines(name), crm_stages!crm_leads_stage_id_fkey(name)")
    .eq("organization_id", authz.org.orgId)
    .eq("contact_id", id.data)
    .order("created_at", { ascending: true })
    .limit(50);

  const um = <T>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  const c = contato as {
    created_at: string;
    is_mql: boolean;
    mql_at: string | null;
    first_approached_at: string | null;
    first_purchase_on: string | null;
  };

  return ok(
    {
      entrou_em: c.created_at,
      primeira_abordagem: c.first_approached_at,
      primeira_compra: c.first_purchase_on,
      is_mql: c.is_mql,
      mql_at: c.mql_at,
      funis: (
        (negocios ?? []) as unknown as Array<{
          id: string;
          status: string;
          created_at: string;
          crm_pipelines: { name: string } | { name: string }[] | null;
          crm_stages: { name: string } | { name: string }[] | null;
        }>
      ).map((n) => ({
        lead_id: n.id,
        status: n.status,
        entrou_em: n.created_at,
        funil: um(n.crm_pipelines)?.name ?? "—",
        etapa: um(n.crm_stages)?.name ?? "—",
      })),
    },
    { requestId },
  );
}

const corpoSchema = z
  .object({
    is_mql: z.boolean().optional(),
    /** `YYYY-MM-DD`, ou `null` para limpar. */
    primeira_compra: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
  })
  .refine((v) => v.is_mql !== undefined || v.primeira_compra !== undefined);

export async function PUT(req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const id = idSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail("not_found", t("Contato não encontrado."), 404, { requestId });
  const contactId = id.data;
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const supabase = await createClient();
  const agora = new Date().toISOString();
  const { data, error } = await supabase
    .from("contacts")
    .update({
      ...(corpo.data.is_mql !== undefined
        ? {
            is_mql: corpo.data.is_mql,
            mql_at: corpo.data.is_mql ? agora : null,
            mql_by: corpo.data.is_mql ? authz.user.id : null,
          }
        : {}),
      ...(corpo.data.primeira_compra !== undefined
        ? { first_purchase_on: corpo.data.primeira_compra }
        : {}),
    })
    .eq("id", id.data)
    .eq("organization_id", authz.org.orgId)
    .select("id, is_mql, mql_at")
    .maybeSingle();
  if (error) return fail("internal_error", t("Erro ao salvar."), 500, { requestId });
  if (!data) return fail("not_found", t("Contato não encontrado."), 404, { requestId });

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "contact.mql_changed",
    resourceType: "contact",
    resourceId: contactId,
    requestId,
    metadata: {
      is_mql: corpo.data.is_mql ?? null,
      primeira_compra: corpo.data.primeira_compra ?? null,
    },
  });
  return ok(data, { requestId });
}
