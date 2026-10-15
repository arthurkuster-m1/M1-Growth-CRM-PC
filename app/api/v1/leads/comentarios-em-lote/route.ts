/**
 * POST /api/v1/leads/comentarios-em-lote — grava os COMENTÁRIOS de várias oportunidades de uma vez
 * (colar de uma planilha). Corpo: `{ itens: [{ lead_id, comentarios }] }`. Agent+.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpo = z.object({
  itens: z
    .array(z.object({ lead_id: z.string().uuid(), comentarios: z.string().max(5000) }))
    .min(1)
    .max(500),
});

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Dados inválidos.", 422, { requestId });

  const supabase = await createClient();
  let gravados = 0;
  for (const item of parsed.data.itens) {
    const { error } = await supabase
      .from("crm_leads")
      .update({ notes: item.comentarios })
      .eq("id", item.lead_id)
      .eq("organization_id", authz.org.orgId);
    if (!error) gravados += 1;
  }
  return ok({ gravados, total: parsed.data.itens.length }, { requestId });
}
