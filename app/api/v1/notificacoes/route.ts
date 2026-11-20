/**
 * GET /api/v1/notificacoes — as notificações da PRÓPRIA pessoa nesta empresa (aba "Para você" do
 * sino): as mais recentes e quantas ainda não foram lidas. A RLS de `notificacoes` (migration
 * 0697) só devolve as linhas dela; o filtro por `user_id` aqui é a mesma regra, explícita.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const consultaSchema = z.object({ limite: z.coerce.number().int().min(1).max(50).default(30) });

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "notificacoes",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;
  const consulta = consultaSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!consulta.success)
    return fail("validation_failed", "Parâmetros inválidos.", 422, { requestId });

  const supabase = await createClient();
  const [lista, naoLidas] = await Promise.all([
    supabase
      .from("notificacoes")
      .select("id, categoria, titulo, corpo, acoes, tag, lida_em, created_at")
      .eq("organization_id", authz.org.orgId)
      .eq("user_id", authz.user.id)
      .order("created_at", { ascending: false })
      .limit(consulta.data.limite),
    supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", authz.org.orgId)
      .eq("user_id", authz.user.id)
      .is("lida_em", null),
  ]);
  if (lista.error) {
    // Migration 0697 ainda não aplicada: o sino segue funcionando, só sem a aba pessoal.
    if (lista.error.code === "PGRST205" || lista.error.code === "42P01") {
      return ok({ itens: [], nao_lidas: 0, disponivel: false }, { requestId });
    }
    return fail("internal_error", "Erro ao carregar as notificações.", 500, { requestId });
  }
  return ok(
    { itens: lista.data ?? [], nao_lidas: naoLidas.count ?? 0, disponivel: true },
    { requestId },
  );
}
