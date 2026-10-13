/**
 * GET /api/v1/tags/categorias — as categorias de tag (cada uma com a sua cor) e a categoria
 * escolhida à mão para cada tag. Quem atende lê (`viewer`): o chip precisa da cor.
 * PUT /api/v1/tags/categorias — grava a configuração (`manager`): criar/renomear/recolorir
 * categorias e mover tags entre elas.
 *
 * Mora em `organizations.settings.categorias_de_tags`. Leitura pelo client da sessão (a RLS
 * isola a organização); escrita pelo admin client DEPOIS do portão de papel, com a organização
 * conferida à mão — a escrita de `settings` não é aberta ao gerente pela RLS.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { lerConfigDeCategorias } from "@/lib/tags/categorias";
import { chaveDaEtiqueta, normalizarCorDeEtiqueta } from "@/lib/tags/cor-da-etiqueta";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const auth = await requireRole("viewer", { requestId, resource: "settings_tags" });
  if (!auth.ok) return auth.response;
  const db = await createClient();
  const { data, error } = await db
    .from("organizations")
    .select("settings")
    .eq("id", auth.org.orgId)
    .maybeSingle();
  if (error) {
    return fail("internal_error", "Não foi possível carregar as categorias.", 500, { requestId });
  }
  return ok(lerConfigDeCategorias(data?.settings ?? null), { requestId });
}

const corpoSchema = z.object({
  categorias: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        nome: z.string().trim().min(1).max(40),
        cor: z.string().refine((c) => normalizarCorDeEtiqueta(c) !== null, "Cor inválida."),
      }),
    )
    .max(30),
  tags: z.record(z.string().max(80), z.string().max(40)).default({}),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const auth = await requireRole("manager", { requestId, resource: "settings_tags" });
  if (!auth.ok) return auth.response;
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", "Confira os nomes e as cores das categorias.", 422, {
      requestId,
    });
  }
  const limpas = lerConfigDeCategorias({
    categorias_de_tags: {
      categorias: corpo.data.categorias,
      tags: Object.fromEntries(
        Object.entries(corpo.data.tags).map(([k, v]) => [chaveDaEtiqueta(k), v]),
      ),
    },
  });
  // Só guarda o que difere do padrão + as criadas pela organização.
  const guardar = {
    categorias: limpas.categorias.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor })),
    tags: limpas.tags,
  };

  const admin = createAdminClient();
  const { data: atual, error: eLeitura } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", auth.org.orgId)
    .maybeSingle();
  if (eLeitura || !atual) {
    return fail("internal_error", "Não foi possível salvar as categorias.", 500, { requestId });
  }
  const settings = {
    ...((atual.settings as Record<string, unknown> | null) ?? {}),
    categorias_de_tags: guardar,
  };
  const { error } = await admin
    .from("organizations")
    .update({ settings })
    .eq("id", auth.org.orgId);
  if (error) {
    return fail("internal_error", "Não foi possível salvar as categorias.", 500, { requestId });
  }
  void audit({
    organizationId: auth.org.orgId,
    actorUserId: auth.user.id,
    action: "tag_vocabulary.changed",
    resourceType: "organizations",
    resourceId: auth.org.orgId,
    requestId,
    metadata: { categorias: guardar.categorias.length, tags_atribuidas: Object.keys(guardar.tags).length },
  });
  return ok(limpas, { requestId });
}
