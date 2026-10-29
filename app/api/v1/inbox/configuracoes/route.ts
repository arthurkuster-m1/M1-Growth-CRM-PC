/**
 * GET /api/v1/inbox/configuracoes — nome/cor dos números e o que o filtro de tags esconde.
 * Quem atende lê (`viewer`): a lista do inbox precisa da cor.
 * PUT — grava (`manager`). Mora em `organizations.settings.inbox`; leitura pelo client da sessão
 * (a RLS isola a organização) e escrita pelo admin client DEPOIS do portão de papel, com a
 * organização conferida à mão — mesma razão de `/api/v1/tags/categorias`.
 */
import { requireSupportWrite } from "@/lib/impersonate/support";
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { lerConfigDoInbox } from "@/lib/inbox/configuracao";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizarCorDeEtiqueta } from "@/lib/tags/cor-da-etiqueta";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const auth = await requireRole("viewer", { requestId, resource: "settings_inbox" });
  if (!auth.ok) return auth.response;
  const db = await createClient();
  const { data, error } = await db
    .from("organizations")
    .select("settings")
    .eq("id", auth.org.orgId)
    .maybeSingle();
  if (error) {
    return fail("internal_error", "Não foi possível carregar as configurações.", 500, { requestId });
  }
  return ok(lerConfigDoInbox(data?.settings ?? null), { requestId });
}

const corpoSchema = z.object({
  numeros: z
    .record(
      z.string().uuid(),
      z.object({
        nome: z.string().trim().max(40).optional(),
        cor: z
          .string()
          .refine((c) => normalizarCorDeEtiqueta(c) !== null, "Cor inválida.")
          .optional(),
      }),
    )
    .default({}),
  categorias_ocultas: z.array(z.string().max(80)).max(60).default([]),
  tags_ocultas: z.array(z.string().max(80)).max(500).default([]),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const auth = await requireRole("manager", { requestId, resource: "settings_inbox" });
  if (!auth.ok) return auth.response;
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", "Confira os nomes e as cores dos números.", 422, { requestId });
  }
  const limpa = lerConfigDoInbox({ inbox: corpo.data });

  const admin = createAdminClient();
  const { data: atual, error: eLeitura } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", auth.org.orgId)
    .maybeSingle();
  if (eLeitura || !atual) {
    return fail("internal_error", "Não foi possível salvar as configurações.", 500, { requestId });
  }
  const settings = {
    ...((atual.settings as Record<string, unknown> | null) ?? {}),
    inbox: limpa,
  };
  const { error } = await admin
    .from("organizations")
    .update({ settings })
    .eq("id", auth.org.orgId);
  if (error) {
    return fail("internal_error", "Não foi possível salvar as configurações.", 500, { requestId });
  }
  void audit({
    organizationId: auth.org.orgId,
    actorUserId: auth.user.id,
    action: "inbox_settings.changed",
    resourceType: "organizations",
    resourceId: auth.org.orgId,
    requestId,
    metadata: {
      numeros: Object.keys(limpa.numeros).length,
      tags_ocultas: limpa.tags_ocultas.length,
      categorias_ocultas: limpa.categorias_ocultas.length,
    },
  });
  return ok(limpa, { requestId });
}
