"use server";
import { cookies } from "next/headers";
import { z } from "zod";

import { clientesDaAgencia, COOKIE_DA_SELECAO, ehSuperAdminPleno } from "@/lib/agencia/acesso";
import { ORIGENS_DOS_LEADS } from "@/lib/agencia/campanhas";
import { loadAuthUser } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookieSecure } from "@/lib/supabase/cookie-secure";

type Resultado = { ok: true } | { ok: false; error: string };

/** Guarda quais clientes a pessoa quer ver no modo agência (só os que ela pode acessar). */
export async function salvarClientesDaAgencia(ids: string[]): Promise<Resultado> {
  const user = await loadAuthUser();
  if (!user) return { ok: false, error: "auth_required" };
  const parsed = z.array(z.string().uuid()).max(500).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "invalid_request" };
  const permitidos = new Set((await clientesDaAgencia(user)).map((c) => c.id));
  const validos = parsed.data.filter((id) => permitidos.has(id));
  (await cookies()).set(COOKIE_DA_SELECAO, validos.join(","), {
    httpOnly: true,
    sameSite: "strict",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}

/**
 * De onde vêm os leads das campanhas de um cliente: `crm` (os do CRM dele) ou `meta` (as conversas
 * iniciadas do gerenciador — para quem não contratou Inbox/CRM). Manager+ da organização, ou o
 * super-admin pleno.
 */
export async function definirOrigemDosLeads(orgId: string, origem: string): Promise<Resultado> {
  const user = await loadAuthUser();
  if (!user) return { ok: false, error: "auth_required" };
  if (user.support) return { ok: false, error: "forbidden" };
  const ok = z.string().uuid().safeParse(orgId).success && (ORIGENS_DOS_LEADS as readonly string[]).includes(origem);
  if (!ok) return { ok: false, error: "invalid_request" };
  const membro = user.organizations.find((m) => m.organization_id === orgId);
  const pode = (membro && ROLE_RANK[membro.role] >= ROLE_RANK.manager) || ehSuperAdminPleno(user);
  if (!pode) return { ok: false, error: "forbidden" };
  const db = createAdminClient();
  const { data } = await db.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  if (!data) return { ok: false, error: "not_found" };
  const settings = { ...((data.settings as Record<string, unknown> | null) ?? {}), leads_source: origem };
  const { error } = await db.from("organizations").update({ settings }).eq("id", orgId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
