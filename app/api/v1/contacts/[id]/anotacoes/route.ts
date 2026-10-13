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

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success || !(await contatoDaOrg(id.data, authz.org.orgId))) {
    return fail("not_found", t("Contato não encontrado."), 404, { requestId });
  }
  const { data, error } = await createAdminClient()
    .from("lead_notes")
    .select("id, headline, body, created_at")
    .eq("organization_id", authz.org.orgId)
    .eq("contact_id", id.data)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return fail("internal_error", t("Erro ao carregar as anotações."), 500, { requestId });
  return ok(
    (data ?? []).map((n) => ({
      id: n.id as string,
      titulo: (n.headline as string) ?? "",
      texto: (n.body as string) ?? "",
      criada_em: n.created_at as string,
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

  const { data, error } = await createAdminClient()
    .from("lead_notes")
    .insert({
      organization_id: authz.org.orgId,
      contact_id: id.data,
      headline: corpo.data.titulo ?? "",
      body: corpo.data.texto,
    })
    .select("id, headline, body, created_at")
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
    metadata: { anotacao_adicionada: true },
  });
  return ok(
    {
      id: data.id as string,
      titulo: (data.headline as string) ?? "",
      texto: (data.body as string) ?? "",
      criada_em: data.created_at as string,
    },
    { requestId, status: 201 },
  );
}
