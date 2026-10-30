"use server";
import { z } from "zod";

import { ehSuperAdminPleno } from "@/lib/agencia/acesso";
import { ehHexValido } from "@/lib/agencia/cor-do-cliente";
import { loadAuthUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A cor que a AGÊNCIA dá a uma organização (hex em `organizations.settings.agencia_cor`), usada nas tags
 * do Modo agência. Só o super-admin pleno define; `null` volta à cor automática. O cliente não vê.
 */
export async function definirCorDaOrganizacao(
  orgId: string,
  cor: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(orgId).success) return { ok: false, error: "invalid_request" };
  if (cor !== null && !ehHexValido(cor)) return { ok: false, error: "invalid_request" };
  const user = await loadAuthUser();
  if (!user) return { ok: false, error: "auth_required" };
  if (!ehSuperAdminPleno(user)) return { ok: false, error: "forbidden" };
  const db = createAdminClient();
  const { data } = await db.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  if (!data) return { ok: false, error: "not_found" };
  const settings = { ...((data.settings as Record<string, unknown> | null) ?? {}) };
  if (cor === null) delete settings.agencia_cor;
  else settings.agencia_cor = cor.toLowerCase();
  const { error } = await db.from("organizations").update({ settings }).eq("id", orgId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
