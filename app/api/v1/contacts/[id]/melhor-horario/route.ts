/**
 * GET /api/v1/contacts/[id]/melhor-horario — a faixa de 2h em que o lead mais respondeu ou atendeu
 * (mensagens recebidas dos últimos 120 dias + ligações atendidas). Sem dado suficiente: faixa null.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { melhorFaixa } from "@/lib/leads/mensagem-de-prospeccao";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success) return fail("not_found", "Contato não encontrado.", 404, { requestId });
  const supabase = await createClient();
  const orgId = authz.org.orgId;

  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", orgId)
    .maybeSingle();
  const fuso = (org?.timezone as string | null) || "America/Sao_Paulo";
  const horaNoFuso = (iso: string) =>
    Number(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: fuso }).format(
        new Date(iso),
      ),
    ) % 24;
  const desde = new Date(Date.now() - 120 * 86_400_000).toISOString();

  const horas: number[] = [];
  const { data: conversas } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", id.data)
    .limit(20);
  const ids = ((conversas ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (ids.length > 0) {
    const { data: mensagens } = await supabase
      .from("messages")
      .select("created_at")
      .eq("organization_id", orgId)
      .in("conversation_id", ids)
      .eq("direction", "inbound")
      .gte("created_at", desde)
      .limit(1000);
    for (const m of (mensagens ?? []) as Array<{ created_at: string }>) {
      horas.push(horaNoFuso(m.created_at));
    }
  }
  const { data: ligacoes } = await supabase
    .from("crm_lead_activities")
    .select("performed_at, payload")
    .eq("organization_id", orgId)
    .eq("contact_id", id.data)
    .eq("type", "note")
    .gte("performed_at", desde)
    .limit(500);
  for (const a of (ligacoes ?? []) as Array<{
    performed_at: string;
    payload: { acao?: string; resultado?: string | null } | null;
  }>) {
    if (a.payload?.acao === "ligacao" && (a.payload.resultado ?? "").startsWith("Atendeu")) {
      horas.push(horaNoFuso(a.performed_at));
    }
  }
  return ok({ melhor: melhorFaixa(horas) }, { requestId });
}
