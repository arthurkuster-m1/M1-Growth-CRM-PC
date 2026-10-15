/**
 * GET /api/v1/agenda/analises?de=AAAA-MM-DD&ate=AAAA-MM-DD — as análises da Agenda: compromissos,
 * comparecimento e conversão, por atendente, tipo e campanha. Quem vê a agenda (viewer+) lê.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { analisarCompromissos, type CompromissoParaAnalise } from "@/lib/agenda/analises";
import { diaLocalISO, instanteDe } from "@/lib/agenda/fuso";
import { requireRole } from "@/lib/auth/require-role";
import { campanhaDaOportunidade, type CampanhaDoFunil } from "@/lib/marketing/atribuicao";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const consulta = z.object({ de: dia, ate: dia });

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const q = consulta.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success || q.data.de > q.data.ate) {
    return fail("validation_failed", "Período inválido.", 422, { requestId });
  }
  const supabase = await createClient();
  const orgId = authz.org.orgId;

  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", orgId)
    .maybeSingle();
  const fuso = (org?.timezone as string | null) || "America/Sao_Paulo";
  // O período é de DIAS no fuso da empresa: do começo do primeiro ao fim do último.
  const [a1, m1, d1] = q.data.de.split("-").map(Number) as [number, number, number];
  const [a2, m2, d2] = q.data.ate.split("-").map(Number) as [number, number, number];
  const inicio = instanteDe({ ano: a1, mes: m1, dia: d1, hora: 0, minuto: 0, segundo: 0 }, fuso);
  const fim = instanteDe({ ano: a2, mes: m2, dia: d2, hora: 23, minuto: 59, segundo: 59 }, fuso);

  const { data: compromissos, error } = await supabase
    .from("calendar_appointments")
    .select("id, status, starts_at, ends_at, owner_user_id, event_type_id, client_confirmation")
    .eq("organization_id", orgId)
    .gte("starts_at", inicio.toISOString())
    .lte("starts_at", fim.toISOString())
    .order("starts_at", { ascending: true })
    .limit(5000);
  if (error) return fail("internal_error", "Erro ao carregar as análises.", 500, { requestId });
  const lista = (compromissos ?? []) as Array<{
    id: string;
    status: CompromissoParaAnalise["status"];
    starts_at: string;
    ends_at: string;
    owner_user_id: string | null;
    event_type_id: string | null;
    client_confirmation: "confirmed" | "reschedule" | "cancel" | null;
  }>;
  const ids = lista.map((c) => c.id);

  // O compromisso → oportunidade (vínculo gravado na marcação).
  const leadDoCompromisso = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("crm_lead_links")
      .select("lead_id, target_id, created_at")
      .eq("organization_id", orgId)
      .eq("target_kind", "appointment")
      .in("target_id", ids.slice(i, i + 200))
      .order("created_at", { ascending: true })
      .limit(5000);
    for (const l of (data ?? []) as Array<{ lead_id: string; target_id: string }>) {
      if (!leadDoCompromisso.has(l.target_id)) leadDoCompromisso.set(l.target_id, l.lead_id);
    }
  }
  const leadIds = [...new Set(leadDoCompromisso.values())];

  // A campanha da oportunidade (a mesma regra do resto do produto) e se ela já vendeu.
  const { data: campanhasBrutas } = await supabase
    .from("demand_campaigns")
    .select("id, name, pipeline_id")
    .eq("organization_id", orgId)
    .limit(1000);
  const campanhas = (campanhasBrutas ?? []) as Array<CampanhaDoFunil & { name: string }>;
  const campanhaDoLead = new Map<string, string | null>();
  const vendeu = new Set<string>();
  for (let i = 0; i < leadIds.length; i += 200) {
    const lote = leadIds.slice(i, i + 200);
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("id, pipeline_id, demand_campaign_id")
      .eq("organization_id", orgId)
      .in("id", lote);
    for (const l of (leads ?? []) as Array<{
      id: string;
      pipeline_id: string | null;
      demand_campaign_id: string | null;
    }>) {
      campanhaDoLead.set(l.id, campanhaDaOportunidade(l, campanhas));
    }
    const { data: pagos } = await supabase
      .from("crm_sale_payments")
      .select("lead_id")
      .eq("organization_id", orgId)
      .eq("status", "recebida")
      .in("lead_id", lote);
    for (const p of (pagos ?? []) as Array<{ lead_id: string }>) vendeu.add(p.lead_id);
  }

  const paraAnalise: CompromissoParaAnalise[] = lista.map((c) => {
    const lead = leadDoCompromisso.get(c.id) ?? null;
    return {
      id: c.id,
      status: c.status,
      starts_at: c.starts_at,
      ends_at: c.ends_at,
      owner_user_id: c.owner_user_id,
      event_type_id: c.event_type_id,
      confirmacao: c.client_confirmation,
      lead_id: lead,
      campaign_id: lead ? (campanhaDoLead.get(lead) ?? null) : null,
      vendeu: lead ? vendeu.has(lead) : false,
    };
  });
  const analise = analisarCompromissos(
    paraAnalise,
    (instante) => diaLocalISO(new Date(instante), fuso),
  );

  // Remarcações no período (fato da linha do tempo; a situação do compromisso continua "agendado").
  const { count: remarcados } = await supabase
    .from("crm_lead_activities")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("type", "appointment_rescheduled")
    .gte("performed_at", inicio.toISOString())
    .lte("performed_at", fim.toISOString());

  const { data: tipos } = await supabase
    .from("calendar_event_types")
    .select("id, name")
    .eq("organization_id", orgId)
    .limit(200);

  return ok(
    {
      de: q.data.de,
      ate: q.data.ate,
      ...analise,
      remarcados: remarcados ?? 0,
      tipos: (tipos ?? []) as Array<{ id: string; name: string }>,
      campanhas: campanhas.map((c) => ({ id: c.id, name: c.name })),
    },
    { requestId },
  );
}
