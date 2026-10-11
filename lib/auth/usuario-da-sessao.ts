import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Quem está logado — SEM perguntar ao Supabase a cada requisição.
 *
 * `auth.getUser()` vai à rede toda vez (`/auth/v1/user`): 12.700 chamadas em 24 h, o maior
 * consumidor do "Log Ingestion". `auth.getClaims()` confere a assinatura do token aqui mesmo,
 * com a chave pública do projeto (ES256, guardada em memória), e só renova a sessão quando o
 * token está perto de vencer. Sem chave assimétrica o próprio SDK volta para `getUser()`.
 *
 * Contrapartida conhecida: uma sessão encerrada/banida no Supabase vale até o token vencer
 * (1 h). O acesso a dados continua protegido, porque as políticas (RLS) e o `fn_user_role_in_org`
 * são consultados no banco a cada operação.
 *
 * Se o client não tiver `getClaims` (mocks de teste), usa `getUser()`.
 */
export type UsuarioDaSessao = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type LeituraDaSessao = {
  user: UsuarioDaSessao | null;
  error: { name?: string; code?: string; status?: number; message: string } | null;
};

export async function usuarioDaSessao(auth: SupabaseClient["auth"]): Promise<LeituraDaSessao> {
  if (typeof auth.getClaims === "function") {
    const { data, error } = await auth.getClaims();
    const claims = data?.claims as
      { sub?: string; email?: string; user_metadata?: Record<string, unknown> } | undefined;
    if (claims?.sub) {
      return {
        user: { id: claims.sub, email: claims.email, user_metadata: claims.user_metadata },
        error: null,
      };
    }
    return { user: null, error: error ?? null };
  }
  const { data, error } = await auth.getUser();
  return { user: (data?.user as UsuarioDaSessao | null) ?? null, error: error ?? null };
}
