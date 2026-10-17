import { randomUUID } from "node:crypto";
import { z } from "zod";

import { atendentesLivresNoHorario } from "@/lib/agenda/equipe";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { chaveDoDia, inicioDoDia, somarDias } from "@/lib/inicio/datas";
import { fusoUtilizavel } from "@/lib/tempo/fusos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const consulta = z.object({
  event_type_id: z.string().uuid(),
  starts_at: z.string().datetime({ offset: true }),
  ignorar_agendamento_id: z.string().uuid().optional(),
});

/**
 * Escolhi o HORÁRIO: quais atendentes do tipo estão livres nele? Já vem ordenado pelo menos
 * carregado no dia (o primeiro é quem o "qualquer atendente" pegaria) e diz quem tem Google
 * conectado (sem ele, o compromisso fica só na agenda do app).
 */
export async function GET(req: Request) {
  const requestId = randomUUID();
  const auth = await requireRole("agent", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const p = consulta.safeParse({
    event_type_id: url.searchParams.get("event_type_id") ?? undefined,
    starts_at: url.searchParams.get("starts_at") ?? undefined,
    ignorar_agendamento_id: url.searchParams.get("ignorar_agendamento_id") ?? undefined,
  });
  if (!p.success) return fail("validation_failed", "Parâmetros inválidos.", 422, { requestId });
  const org = auth.org.orgId;
  const db = await createClient();
  const [{ data: tipo }, { data: orgRow }] = await Promise.all([
    db
      .from("calendar_event_types")
      .select("duration_minutes, default_owner_user_id")
      .eq("organization_id", org)
      .eq("id", p.data.event_type_id)
      .maybeSingle(),
    db.from("organizations").select("timezone").eq("id", org).maybeSingle(),
  ]);
  if (!tipo) return fail("not_found", "Tipo de agendamento não encontrado.", 404, { requestId });
  const fuso = fusoUtilizavel(orgRow?.timezone);
  const inicio = new Date(p.data.starts_at);
  const dia = chaveDoDia(inicio, fuso);
  const livres = await atendentesLivresNoHorario(db, org, {
    eventTypeId: p.data.event_type_id,
    responsavelPadrao: (tipo.default_owner_user_id as string | null) ?? null,
    inicio,
    fim: new Date(inicio.getTime() + Number(tipo.duration_minutes) * 60_000),
    agora: new Date(),
    ignorarAgendamentoId: p.data.ignorar_agendamento_id,
    diaDe: inicioDoDia(dia, fuso),
    diaAte: inicioDoDia(somarDias(dia, 1), fuso),
  });
  return ok({ atendentes: livres }, { requestId });
}
