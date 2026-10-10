import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * PUT /api/v1/marketing/pages/ordem — define a ordem das subpáginas de um módulo
 * (`{ modulo, keys: [...] }`, na ordem desejada). Só a agência (manager+).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { lerChaveDePagina } from "@/lib/marketing/modulos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  modulo: z.string(),
  keys: z.array(z.string()).min(1).max(100),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  const modulo = corpo.success ? lerChaveDePagina(corpo.data.modulo) : null;
  if (!corpo.success || !modulo || modulo.tipo !== null) {
    return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  }
  const { keys } = corpo.data;
  // Só subpáginas DESTE módulo, sem repetir.
  const valido =
    new Set(keys).size === keys.length &&
    keys.every((k) => k.startsWith(`${modulo.modulo}--`) && lerChaveDePagina(k)?.tipo);
  if (!valido) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const supabase = await createClient();
  for (const [posicao, chave] of keys.entries()) {
    const { error } = await supabase
      .from("marketing_pages")
      .update({ sort_order: posicao })
      .eq("organization_id", authz.org.orgId)
      .eq("module_key", chave);
    if (error) return fail("internal_error", t("Erro ao salvar a ordem."), 500, { requestId });
  }
  return ok({ keys }, { requestId });
}
