/**
 * POST /api/v1/marketing/estrategia/ocultas — esconde, mostra ou apaga páginas da aba Estratégia.
 *
 *   { chave, acao: "ocultar" } esconde (uma fase, uma página ou um atalho). Nada é apagado: o
 *                              conteúdo fica guardado e volta ao mostrar.
 *   { chave, acao: "mostrar" } traz de volta.
 *   { chave, acao: "apagar" }  apaga o CONTEÚDO (a página e as subpáginas dela, com rascunho e
 *                              histórico) e esconde; ao mostrar de novo a página volta do zero.
 *                              Vale para fase e página; atalho só se oculta.
 *
 * "Produtos e ofertas" nunca entra: é o que sustenta as vendas do CRM. Gerente em diante.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { chavesDePaginaParaApagar, lerChaveOculta } from "@/lib/marketing/estrategia-oculta";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  chave: z.string().min(1).max(80),
  acao: z.enum(["ocultar", "mostrar", "apagar"]),
});

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const { chave, acao } = corpo.data;
  const lida = lerChaveOculta(chave);
  if (!lida) {
    return fail(
      "validation_failed",
      t("Esta página não pode ser ocultada (Produtos e ofertas é essencial para as vendas)."),
      422,
      { requestId },
    );
  }
  if (acao === "apagar" && lida.tipo === "atalho") {
    return fail("validation_failed", t("Um atalho só pode ser ocultado."), 422, { requestId });
  }

  const orgId = authz.org.orgId;
  const supabase = await createClient();

  if (acao === "mostrar") {
    const { error } = await supabase
      .from("marketing_estrategia_ocultos")
      .delete()
      .eq("organization_id", orgId)
      .eq("chave", chave);
    if (error) return fail("internal_error", t("Erro ao mostrar a página."), 500, { requestId });
    await audit({
      organizationId: orgId,
      actorUserId: authz.user.id,
      action: "marketing_estrategia.shown",
      resourceType: "marketing_pages",
      requestId,
      metadata: { chave },
    });
    return ok({ chave, oculta: false }, { requestId });
  }

  // Apagar: o conteúdo da página (e das subpáginas dela) sai antes de esconder. Rascunho e
  // histórico vão junto, por cascata do banco.
  let apagadas = 0;
  if (acao === "apagar") {
    for (const k of chavesDePaginaParaApagar(chave)) {
      const { data: a } = await supabase
        .from("marketing_pages")
        .delete()
        .eq("organization_id", orgId)
        .eq("module_key", k)
        .select("id");
      const { data: b } = await supabase
        .from("marketing_pages")
        .delete()
        .eq("organization_id", orgId)
        .like("module_key", `${k}--%`)
        .select("id");
      apagadas += (a?.length ?? 0) + (b?.length ?? 0);
    }
  }

  const { error } = await supabase
    .from("marketing_estrategia_ocultos")
    .upsert(
      { organization_id: orgId, chave, hidden_by: authz.user.id },
      { onConflict: "organization_id,chave" },
    );
  if (error) return fail("internal_error", t("Erro ao ocultar a página."), 500, { requestId });

  await audit({
    organizationId: orgId,
    actorUserId: authz.user.id,
    action: acao === "apagar" ? "marketing_estrategia.deleted" : "marketing_estrategia.hidden",
    resourceType: "marketing_pages",
    requestId,
    metadata: { chave, ...(acao === "apagar" ? { paginas_apagadas: apagadas } : {}) },
  });
  return ok({ chave, oculta: true, paginas_apagadas: apagadas }, { requestId });
}
