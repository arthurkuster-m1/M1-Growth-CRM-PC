import type { SupabaseClient } from "@supabase/supabase-js";

import { capabilitiesOf, type ChannelProvider } from "@/lib/channels/capabilities";

import { lerPoolExtra } from "./pool-de-numeros";

export interface CanalDoDisparo {
  /** Todos os números do disparo aceitam mensagem livre fora da janela de 24 h (WAHA)? */
  aceitaMensagemLivre: boolean;
  /** Os números que NÃO aceitam (canal oficial: só modelo aprovado abre a conversa). */
  semMensagemLivre: string[];
}

/**
 * O que os números do disparo permitem. Pergunta a CAPACIDADE do canal, nunca "quem é": a regra é
 * a da doutrina de restrição de canal. O principal e os extras do rodízio entram na conta — um
 * número oficial no meio do pool bastaria para a abertura livre ser recusada pelo canal.
 */
export async function canalDoDisparo(
  admin: SupabaseClient,
  disparo: { id: string; organization_id: string; channel_session_id?: string | null },
): Promise<CanalDoDisparo> {
  const extras = await lerPoolExtra(admin, disparo.organization_id, disparo.id).catch(() => []);
  const ids = [
    ...new Set([disparo.channel_session_id, ...extras].filter((x): x is string => Boolean(x))),
  ];
  if (ids.length === 0) return { aceitaMensagemLivre: true, semMensagemLivre: [] };
  const { data } = await admin
    .from("channel_sessions")
    .select("id, display_name, phone_number, provider")
    .eq("organization_id", disparo.organization_id)
    .in("id", ids);
  const semMensagemLivre: string[] = [];
  for (const s of (data ?? []) as Array<{
    id: string;
    display_name: string | null;
    phone_number: string | null;
    provider: string;
  }>) {
    let livre = false;
    try {
      livre = capabilitiesOf(s.provider as ChannelProvider).freeformOutsideWindow;
    } catch {
      livre = false;
    }
    if (!livre) semMensagemLivre.push(s.display_name || s.phone_number || s.id);
  }
  return { aceitaMensagemLivre: semMensagemLivre.length === 0, semMensagemLivre };
}

/** A frase que a tela e a recusa usam quando a abertura da IA cai num canal oficial. */
export const AVISO_DO_CANAL_OFICIAL =
  "Em número da API oficial a primeira mensagem de uma abordagem precisa ser um modelo aprovado pela Meta: a IA só escreve depois que o lead responde. Escolha um número não oficial para este disparo.";
