import { randomUUID } from "node:crypto";
import { z } from "zod";

import { LIMITE_DE_PASSOS, lerModeloDoTipo } from "@/lib/agenda/modelos-de-atendimento";
import { blocosSchema } from "@/lib/marketing/blocos";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** A página de atendimento de cada tipo (modelo, blocos e roteiro), já com o padrão onde nada foi gravado. */
export async function GET() {
  const requestId = randomUUID();
  const auth = await requireRole("agent", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const org = auth.org.orgId;
  const db = await createClient();
  const [{ data: tipos }, { data: orgRow }] = await Promise.all([
    db
      .from("calendar_event_types")
      .select("id, name, slug")
      .eq("organization_id", org)
      .order("name"),
    db.from("organizations").select("settings").eq("id", org).maybeSingle(),
  ]);
  const gravado = ((orgRow?.settings as Record<string, unknown> | null)?.atendimento_por_tipo ??
    {}) as Record<string, unknown>;
  const modelos: Record<string, ReturnType<typeof lerModeloDoTipo>> = {};
  for (const t of tipos ?? []) {
    modelos[t.id as string] = lerModeloDoTipo(gravado[t.id as string], {
      nome: t.name as string,
      slug: t.slug as string,
    });
  }
  return ok({ modelos }, { requestId });
}

const corpo = z.object({
  event_type_id: z.string().uuid(),
  modelo: z.enum(["vendas", "padrao"]),
  blocos: z.object({
    roteiro: z.boolean(),
    anotacoes: z.boolean(),
    oportunidade: z.boolean(),
    ia: z.boolean(),
  }),
  roteiro: z
    .array(
      z.object({
        titulo: z.string().trim().min(1).max(80),
        dica: z.string().trim().max(300).default(""),
      }),
    )
    .max(LIMITE_DE_PASSOS),
  /** O modelo de blocos do tipo (o editor da página do compromisso abre com ele). */
  blocos_do_modelo: blocosSchema.optional(),
});

/** Grava a página de atendimento de UM tipo. Só gerente ou acima. */
export async function PUT(req: Request) {
  const requestId = randomUUID();
  const denied = await requireSupportWrite();
  if (denied) return denied;
  const auth = await requireRole("manager", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const body = corpo.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("validation_failed", "Dados inválidos.", 422, { requestId });
  const org = auth.org.orgId;
  // `organizations` só aceita escrita do cliente admin (a RLS recusa o membro em silêncio).
  const admin = createAdminClient();
  const { data: tipo } = await admin
    .from("calendar_event_types")
    .select("id")
    .eq("organization_id", org)
    .eq("id", body.data.event_type_id)
    .maybeSingle();
  if (!tipo) return fail("not_found", "Tipo de atendimento não encontrado.", 404, { requestId });
  const { data: atual } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", org)
    .maybeSingle();
  const settings = (atual?.settings ?? {}) as Record<string, unknown>;
  const porTipo = (settings.atendimento_por_tipo ?? {}) as Record<string, unknown>;
  const { event_type_id, ...modelo } = body.data;
  const { error } = await admin
    .from("organizations")
    .update({
      settings: { ...settings, atendimento_por_tipo: { ...porTipo, [event_type_id]: modelo } },
    })
    .eq("id", org);
  if (error) return fail("internal_error", "Não foi possível salvar.", 500, { requestId });
  void audit({
    action: "agenda.appointment_updated",
    actorUserId: auth.user.id,
    organizationId: org,
    resourceType: "calendar_event_type",
    resourceId: event_type_id,
    requestId,
    metadata: { modelo_de_atendimento: modelo.modelo, passos: modelo.roteiro.length },
  });
  return ok({ event_type_id }, { requestId });
}
