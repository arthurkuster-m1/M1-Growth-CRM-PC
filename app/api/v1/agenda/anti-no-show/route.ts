/**
 * GET  /api/v1/agenda/anti-no-show — os fluxos anti no-show da empresa, os tipos de compromisso
 *      (com o resumo do lembrete de cada um) e o modelo para começar. A empresa lê.
 * POST /api/v1/agenda/anti-no-show — cria um fluxo e liga os tipos escolhidos (manager+).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { FLUXO_MODELO, fluxoSchema, type FluxoAntiNoShow } from "@/lib/agenda/anti-no-show";
import { ligarTiposAoFluxo } from "@/lib/agenda/anti-no-show-servidor";
import { desempacotarLembretes } from "@/lib/agenda/lembretes";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const orgId = authz.org.orgId;
  const supabase = await createClient();

  const [{ data: fluxos, error }, { data: ligacoes }, { data: tipos }] = await Promise.all([
    supabase
      .from("agenda_noshow_flows")
      .select(
        "id, name, call_hours_before, confirm_tag, no_show_tag, remarcar_days, remarcar_attempts, remarcar_interval_days",
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("agenda_noshow_flow_types")
      .select("flow_id, event_type_id")
      .eq("organization_id", orgId)
      .limit(1000),
    supabase
      .from("calendar_event_types")
      .select(
        "id, name, reminder_enabled, reminder_minutes_before, reminder_extra_offsets_minutes, reminder_body, reminder_bodies",
      )
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(200),
  ]);
  if (error) {
    return fail("internal_error", t("Erro ao carregar os fluxos."), 500, { requestId });
  }
  const porFluxo = new Map<string, string[]>();
  for (const l of (ligacoes ?? []) as Array<{ flow_id: string; event_type_id: string }>) {
    porFluxo.set(l.flow_id, [...(porFluxo.get(l.flow_id) ?? []), l.event_type_id]);
  }
  const lista: FluxoAntiNoShow[] = (
    (fluxos ?? []) as Array<Omit<FluxoAntiNoShow, "event_type_ids">>
  ).map((f) => ({ ...f, event_type_ids: porFluxo.get(f.id) ?? [] }));
  const tiposDoFluxo = (
    (tipos ?? []) as Array<{
      id: string;
      name: string;
      reminder_enabled: boolean;
      reminder_minutes_before: number;
      reminder_extra_offsets_minutes: number[] | null;
      reminder_body: string | null;
      reminder_bodies: unknown;
    }>
  ).map((x) => ({
    id: x.id,
    name: x.name,
    lembrete_ligado: x.reminder_enabled,
    // Cada lembrete do tipo com a mensagem dele: a MESMA fonte da tela de Tipos de atendimento.
    lembretes: desempacotarLembretes({
      reminder_minutes_before: x.reminder_minutes_before,
      reminder_extra_offsets_minutes: x.reminder_extra_offsets_minutes,
      reminder_body: x.reminder_body,
      reminder_bodies: x.reminder_bodies,
    }),
  }));
  return ok({ fluxos: lista, tipos: tiposDoFluxo, modelo: FLUXO_MODELO }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const corpo = fluxoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const orgId = authz.org.orgId;
  const supabase = await createClient();
  const { event_type_ids, ...campos } = corpo.data;
  const { data, error } = await supabase
    .from("agenda_noshow_flows")
    .insert({ ...campos, organization_id: orgId, created_by: authz.user.id })
    .select("id")
    .single();
  if (error || !data) {
    return fail("internal_error", t("Erro ao salvar o fluxo."), 500, { requestId });
  }
  if (!(await ligarTiposAoFluxo(supabase, orgId, data.id as string, event_type_ids))) {
    return fail("internal_error", t("O fluxo foi criado, mas os tipos não foram ligados."), 500, {
      requestId,
    });
  }
  return ok({ id: data.id as string }, { requestId, status: 201 });
}
