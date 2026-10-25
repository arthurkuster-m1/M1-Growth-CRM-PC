import type { SupabaseClient } from "@supabase/supabase-js";

import { loadCredential } from "@/lib/ai/credentials";
import { chaveDePlataforma } from "@/lib/ai/runtime/agent";

export interface CerebroDaOrganizacao {
  provider: string;
  model: string;
  apiKey: string;
}

/**
 * O modelo e a chave que a organização já tem configurados: os da versão publicada do agente
 * principal. Serve a quem precisa escrever texto com a IA da empresa fora do atendimento (por
 * exemplo, a mensagem personalizada de um disparo) sem pedir outra configuração. Mesma ordem do
 * turno de produção: a credencial cadastrada vence; na falta dela vale a chave da instalação.
 * Devolve `{ erro }` em frase — nunca lança.
 */
export async function cerebroDaOrganizacao(
  admin: SupabaseClient,
  orgId: string,
): Promise<CerebroDaOrganizacao | { erro: string }> {
  const { data: agente } = await admin
    .from("ai_agents")
    .select("published_version_id")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .maybeSingle();
  const versionId = (agente as { published_version_id?: string | null } | null)
    ?.published_version_id;
  if (!versionId)
    return { erro: "A IA da empresa ainda não está no ar: publique o agente principal." };

  const { data: versao } = await admin
    .from("ai_agent_versions")
    .select("provider, model, credential_id")
    .eq("id", versionId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!versao) return { erro: "Não achei a configuração da IA da empresa." };
  const provider = String((versao as { provider?: string }).provider ?? "");
  const model = String((versao as { model?: string }).model ?? "");
  if (!provider || !model) return { erro: "O agente principal está sem modelo definido." };

  const credentialId = (versao as { credential_id?: string | null }).credential_id;
  if (credentialId) {
    try {
      const cred = await loadCredential(credentialId, orgId);
      return { provider, model, apiKey: cred.apiKey };
    } catch {
      return { erro: "Não consegui usar a chave cadastrada da IA." };
    }
  }
  const daInstalacao = chaveDePlataforma(provider);
  if (!daInstalacao) return { erro: `Esta instalação não tem chave de ${provider}.` };
  return { provider, model, apiKey: daInstalacao };
}
