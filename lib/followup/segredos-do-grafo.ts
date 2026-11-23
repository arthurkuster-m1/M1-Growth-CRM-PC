/**
 * O SEGREDO DO WEBHOOK NUNCA FICA EM CLARO NO FLUXO (motor único, Fase 5).
 *
 * O formulário da ação "Avisar outro sistema (webhook)" grava o segredo digitado em `config.secret` (texto
 * puro, só de escrita). Nas regras, a rota o troca por `secret_enc` (cifrado) antes de salvar. O editor de
 * fluxo reaproveita o mesmo formulário, então o rascunho passa pela MESMA troca — `encryptRuleActionSecrets`,
 * que também desce para dentro das opções do "a IA decide" — e a publicação recusa qualquer segredo que ainda
 * esteja em claro (defesa em profundidade: o fluxo publicado vira versão imutável, legível por quem lê a versão).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { encryptRuleActionSecrets } from "@/lib/webhooks/secrets";
import { temSegredoEmClaro } from "./segredo-em-claro";
import type { FlowGraph } from "./graph-schema";

/**
 * Devolve o grafo com os segredos das ações trocados por `secret_enc`, ou `null` se a chave de cifra da
 * instalação não está ativa (a rota diz isso à pessoa, em vez de gravar em claro).
 */
export async function cifrarSegredosDoGrafo(
  admin: SupabaseClient,
  graph: FlowGraph,
  cifrar: typeof encryptRuleActionSecrets = encryptRuleActionSecrets,
): Promise<FlowGraph | null> {
  const nos: FlowGraph["nodes"] = [];
  for (const no of graph.nodes) {
    if (no.type !== "crm_action" || !temSegredoEmClaro(no.config.action)) {
      nos.push(no);
      continue;
    }
    const cifradas = await cifrar(admin, [
      no.config.action as Parameters<typeof cifrar>[1][number],
    ]);
    if (cifradas === null || cifradas[0] === undefined) return null;
    nos.push({ ...no, config: { action: cifradas[0] as typeof no.config.action } });
  }
  return { ...graph, nodes: nos };
}
