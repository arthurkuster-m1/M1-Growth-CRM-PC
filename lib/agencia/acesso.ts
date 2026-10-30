import { corDoCliente } from "@/lib/agencia/cor-do-cliente";
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
  /** A cor do cliente na agência (hex): a escolhida em Gerenciar organizações, ou uma da paleta. */
  cor: string;
  role: Role | "plataforma";
}

export const COOKIE_DA_SELECAO = "agencia_clientes";
/** A ordem dos clientes que a pessoa escolheu (ids separados por vírgula). */
export const COOKIE_DA_ORDEM = "agencia_ordem";

/** O super-admin pleno (fora do modo suporte) enxerga toda organização ativa. */
export const ehSuperAdminPleno = (
  u: Pick<AuthUser, "is_platform_admin" | "platform_admin_scope" | "support">,
) => u.is_platform_admin && !u.support && u.platform_admin_scope !== "support_readonly";

export async function clientesDaAgencia(user: AuthUser): Promise<ClienteDaAgencia[]> {
  const porId = new Map<string, ClienteDaAgencia>();
  for (const m of user.organizations) {
    if (ROLE_RANK[m.role] >= ROLE_RANK.manager) {
      porId.set(m.organization_id, {
        id: m.organization_id,
        name: m.organization_name,
        cor: corDoCliente(m.agencia_cor, m.organization_id),
        role: m.role,
      });
    }
  }
  if (ehSuperAdminPleno(user)) {
    const { data } = await createAdminClient()
      .from("organizations")
      .select("id, name:display_name, cor:settings->>agencia_cor")
      .eq("status", "active")
      .order("display_name", { ascending: true })
      .limit(500);
    for (const o of (data ?? []) as Array<{ id: string; name: string; cor: string | null }>) {
      if (!porId.has(o.id))
        porId.set(o.id, {
          id: o.id,
          name: o.name,
          cor: corDoCliente(o.cor, o.id),
          role: "plataforma",
        });
    }
  }
  const alfabetica = [...porId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return aplicarOrdem(alfabetica, await ordemSalva());
}

async function ordemSalva(): Promise<string[]> {
  try {
    return ((await cookies()).get(COOKIE_DA_ORDEM)?.value ?? "").split(",").filter(Boolean);
  } catch {
    return []; // fora de uma requisição
  }
}

/** Os clientes na ordem escolhida pela pessoa; os que ela ainda não ordenou vêm depois, em ordem alfabética. */
export function aplicarOrdem<T extends { id: string }>(
  clientes: readonly T[],
  ordem: readonly string[],
): T[] {
  const posicao = new Map(ordem.map((id, i) => [id, i]));
  return [...clientes].sort(
    (a, b) =>
      (posicao.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (posicao.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
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
