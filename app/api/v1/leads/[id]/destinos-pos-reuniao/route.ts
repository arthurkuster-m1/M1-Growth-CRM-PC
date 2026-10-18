/**
 * GET /api/v1/leads/[id]/destinos-pos-reuniao — para onde a oportunidade pode ir depois de uma
 * reunião sem venda (Em negociação, Desqualificado, Não comprou), segundo as etapas do funil dela.
 *
 * Só LÊ (agent+): quem registra o resultado da reunião não é, necessariamente, gerente do funil —
 * por isso não usa a rota de etapas, que é de manager. Organização e papel vêm de requireRole.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { opcoesDeDestinoPosReuniao, type EtapaParaODestino } from "@/lib/leads/destino-pos-reuniao";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", t("Oportunidade não encontrada."), 404, { requestId });
  }

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("crm_leads")
    .select("id, pipeline_id, stage_id, status, updated_at")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!lead) return fail("not_found", t("Oportunidade não encontrada."), 404, { requestId });

  const { data: etapas, error } = await supabase
    .from("crm_stages")
    .select("id, name, slug, position, is_won, is_lost, qualification")
    .eq("organization_id", authz.org.orgId)
    .eq("pipeline_id", lead.pipeline_id as string)
    .eq("is_archived", false)
    .order("position", { ascending: true });
  if (error) return fail("internal_error", t("Falha ao listar etapas."), 500, { requestId });

  // Negócio já encerrado não tem destino a escolher.
  const opcoes =
    lead.status === "open"
      ? opcoesDeDestinoPosReuniao((etapas ?? []) as EtapaParaODestino[], lead.stage_id as string)
      : [];
  return ok(
    { lead: { id, status: lead.status, updated_at: lead.updated_at }, opcoes },
    { requestId },
  );
}
