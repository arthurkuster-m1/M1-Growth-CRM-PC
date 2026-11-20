/** Peças de servidor das rotas do Guia: autorização (manager+) e leitura do corpo. */
import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import type { z } from "zod";

import { fail, type ApiError } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export type AutorizacaoDoGuia =
  | { ok: true; supabase: SupabaseClient; orgId: string; userId: string; requestId: string }
  | { ok: false; response: NextResponse<ApiError> };

/**
 * Piso `manager`, org ativa do cookie validado (NUNCA do corpo), client de SESSÃO (a RLS repete o
 * piso). `escrita` exige platform admin com scope full; leitura aceita qualquer scope.
 */
export async function autorizarGuia(escrita: boolean): Promise<AutorizacaoDoGuia> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "guia",
    allowPlatformAdmin: escrita ? true : "leitura",
  });
  if (!authz.ok) return { ok: false, response: authz.response };
  return {
    ok: true,
    supabase: await createClient(),
    orgId: authz.org.orgId,
    userId: authz.user.id,
    requestId,
  };
}

export async function lerCorpo<S extends z.ZodType>(
  req: Request,
  schema: S,
  requestId: string,
): Promise<{ ok: true; dados: z.infer<S> } | { ok: false; response: NextResponse<ApiError> }> {
  const r = schema.safeParse(await req.json().catch(() => null));
  if (!r.success) {
    return {
      ok: false,
      response: fail("validation_failed", "Dados inválidos.", 422, { requestId }),
    };
  }
  return { ok: true, dados: r.data };
}

export const SEM_MIGRATION =
  "O banco ainda não recebeu a atualização do Guia (migration 0702). Peça para aplicá-la na VPS.";
