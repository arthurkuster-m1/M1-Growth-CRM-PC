import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { fusoUtilizavel } from "@/lib/tempo/fusos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const consulta = z.object({
  contact_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
});

/**
 * O que a página de NOVO compromisso precisa saber: o fuso da empresa, os tipos de atendimento, as
 * oportunidades do cliente e quem é o responsável padrão.
 *
 * Responsável padrão: primeiro o da OPORTUNIDADE; sem ele, o do RELACIONAMENTO com o cliente; sem
 * os dois, a tela cai no responsável do tipo de atendimento. Só sugere: quem marca pode trocar sem
 * mexer no CRM nem na oportunidade.
 */
export async function GET(req: Request) {
  const requestId = randomUUID();
  const auth = await requireRole("agent", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const p = consulta.safeParse({
    contact_id: url.searchParams.get("contact_id") ?? undefined,
    lead_id: url.searchParams.get("lead_id") ?? undefined,
  });
  if (!p.success) return fail("validation_failed", "Parâmetros inválidos.", 422, { requestId });
  const org = auth.org.orgId;
  const db = await createClient();

  const [{ data: orgRow }, { data: tipos }] = await Promise.all([
    db.from("organizations").select("timezone").eq("id", org).maybeSingle(),
    db
      .from("calendar_event_types")
      .select("id, name, slug, duration_minutes, default_owner_user_id")
      .eq("organization_id", org)
      .eq("is_active", true)
      .order("name"),
  ]);

  let contactId = p.data.contact_id ?? null;
  let responsavel: { user_id: string; origem: "oportunidade" | "cliente" } | null = null;

  if (p.data.lead_id) {
    const { data: lead } = await db
      .from("crm_leads")
      .select("contact_id, owner_user_id")
      .eq("organization_id", org)
      .eq("id", p.data.lead_id)
      .maybeSingle();
    if (lead) {
      contactId = contactId ?? (lead.contact_id as string | null);
      if (lead.owner_user_id) responsavel = { user_id: lead.owner_user_id as string, origem: "oportunidade" };
    }
  }

  let oportunidades: Array<{ id: string; titulo: string; funil: string | null; etapa: string | null; responsavel_id: string | null }> = [];
  if (contactId) {
    const [{ data: contato }, { data: leads }] = await Promise.all([
      db.from("contacts").select("dono_user_id").eq("organization_id", org).eq("id", contactId).maybeSingle(),
      db
        .from("crm_leads")
        .select(
          "id, title, nome_da_venda, owner_user_id, created_at, pipeline:crm_pipelines(name), stage:crm_stages!crm_leads_stage_id_fkey(name)",
        )
        .eq("organization_id", org)
        .eq("contact_id", contactId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    if (!responsavel && contato?.dono_user_id)
      responsavel = { user_id: contato.dono_user_id as string, origem: "cliente" };
    const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
    oportunidades = (leads ?? []).map((l) => ({
      id: l.id as string,
      titulo: ((l.nome_da_venda as string | null) || (l.title as string | null) || "Oportunidade").slice(0, 120),
      funil: um(l.pipeline as { name?: string } | { name?: string }[] | null)?.name ?? null,
      etapa: um(l.stage as { name?: string } | { name?: string }[] | null)?.name ?? null,
      responsavel_id: (l.owner_user_id as string | null) ?? null,
    }));
  }

  return ok(
    {
      fuso: fusoUtilizavel(orgRow?.timezone),
      tipos: (tipos ?? []).map((t) => ({
        id: t.id as string,
        nome: t.name as string,
        slug: t.slug as string,
        duracaoMin: t.duration_minutes as number,
        donoId: (t.default_owner_user_id as string | null) ?? null,
      })),
      oportunidades,
      responsavel_padrao: responsavel,
    },
    { requestId },
  );
}
