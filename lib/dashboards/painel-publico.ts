import { AsyncLocalStorage } from "node:async_hooks";

import type { ActiveOrg, AuthUser } from "@/lib/auth/types";
import { STATUS_OPERANTE } from "@/lib/organizacao/operante";

/**
 * O DASHBOARD PELO LINK SEM LOGIN (a mesma tecnologia das páginas de Marketing publicadas).
 *
 * Quem abre o link não tem sessão. Em vez de reescrever cada rota de dados, a rota pública
 * (`app/p/[token]/dados/[...caminho]`) resolve o link NO SERVIDOR e roda o handler de LEITURA da
 * rota normal dentro deste contexto. Dentro dele, `requireRole` devolve um leitor (viewer) da
 * empresa do link e `createClient` devolve o cliente de serviço — por isso cada handler liberado
 * filtra `organization_id` (e a lista de rotas liberadas é fechada, só GET, em `ROTAS_PUBLICAS`).
 *
 * O contexto só é aberto por `emPainelPublico`, chamado apenas pela rota pública depois de
 * `resolverLink`. Nada que venha da requisição (header, cookie, query) o liga.
 */
export { CHAVE_DOS_DASHBOARDS } from "@/lib/dashboards/chave";

interface ContextoPublico {
  orgId: string;
  nome: string;
  idioma: string;
}

const armazem = new AsyncLocalStorage<ContextoPublico>();

export function emPainelPublico<T>(ctx: ContextoPublico, fn: () => Promise<T>): Promise<T> {
  return armazem.run(ctx, fn);
}

export const painelPublicoAtual = (): ContextoPublico | null => armazem.getStore() ?? null;

/** O leitor sintético que o contexto público entrega no lugar de uma pessoa logada. */
export function sessaoDoPainelPublico(): { user: AuthUser; org: ActiveOrg } | null {
  const ctx = armazem.getStore();
  if (!ctx) return null;
  const user = {
    id: "00000000-0000-0000-0000-000000000000",
    email: "",
    full_name: null,
    avatar_url: null,
    is_platform_admin: false,
    platform_admin_scope: null,
    support: null,
    idioma: ctx.idioma,
    organizations: [],
  } as unknown as AuthUser;
  const org = {
    orgId: ctx.orgId,
    name: ctx.nome,
    role: "viewer",
    org_status: STATUS_OPERANTE,
  } as unknown as ActiveOrg;
  return { user, org };
}

/**
 * As rotas de LEITURA que o painel público pode alcançar (caminho depois de `/api/v1/`).
 * Fechada de propósito: rota fora daqui responde 404, mesmo com link válido.
 */
export const ROTAS_PUBLICAS = [
  "dashboards/trafego",
  "dashboards/prospeccao",
  "dashboards/prospeccao/custos",
  "dashboards/business",
  "dashboards/atendimento",
  "dashboards/visibilidade",
  "agenda/analises",
  "team/assignable",
  "reports/activities",
  "reports/tags",
] as const;
