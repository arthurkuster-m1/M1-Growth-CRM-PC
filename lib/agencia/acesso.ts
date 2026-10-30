import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { ROLE_RANK, type AuthUser, type Role } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O ACESSO DO MODO AGÊNCIA. Quem pode ver um cliente é quem é MEMBRO da organização dele (manager
 * ou admin) — a mesma associação que a RLS já usa; o super-admin da plataforma vê todas. Nada de
 * camada de permissão paralela. A seleção (quais clientes aparecem agora) é preferência da pessoa,
 * num cookie, e SEMPRE reconferida contra esta lista: o cookie nunca concede acesso.
 */
export interface ClienteDaAgencia {
  id: string;
  name: string;
  role: Role | "plataforma";
}

export const COOKIE_DA_SELECAO = "agencia_clientes";

/** O super-admin pleno (fora do modo suporte) enxerga toda organização ativa. */
export const ehSuperAdminPleno = (u: Pick<AuthUser, "is_platform_admin" | "platform_admin_scope" | "support">) =>
  u.is_platform_admin && !u.support && u.platform_admin_scope !== "support_readonly";

export async function clientesDaAgencia(user: AuthUser): Promise<ClienteDaAgencia[]> {
  const porId = new Map<string, ClienteDaAgencia>();
  for (const m of user.organizations) {
    if (ROLE_RANK[m.role] >= ROLE_RANK.manager) {
      porId.set(m.organization_id, { id: m.organization_id, name: m.organization_name, role: m.role });
    }
  }
  if (ehSuperAdminPleno(user)) {
    const { data } = await createAdminClient()
      .from("organizations")
      .select("id, name")
      .eq("status", "active")
      .order("name", { ascending: true })
      .limit(500);
    for (const o of (data ?? []) as Array<{ id: string; name: string }>) {
      if (!porId.has(o.id)) porId.set(o.id, { id: o.id, name: o.name, role: "plataforma" });
    }
  }
  return [...porId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Os clientes que a pessoa escolheu ver; sem escolha (ou só ids que perdeu), todos. */
export async function clientesSelecionados(
  todos: readonly ClienteDaAgencia[],
): Promise<ClienteDaAgencia[]> {
  const bruto = (await cookies()).get(COOKIE_DA_SELECAO)?.value ?? "";
  const ids = new Set(
    bruto
      .split(",")
      .map((s) => s.trim())
      .filter((s) => z.string().uuid().safeParse(s).success),
  );
  const escolhidos = todos.filter((c) => ids.has(c.id));
  return escolhidos.length > 0 ? escolhidos : [...todos];
}
