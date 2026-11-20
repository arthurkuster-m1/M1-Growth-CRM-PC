/**
 * ENTREGA UMA NOTIFICAÇÃO: grava uma linha por pessoa em `notificacoes` (o aviso na tela chega
 * por Realtime) e manda o push só para os aparelhos dessas pessoas.
 *
 * Os dois saem da MESMA linha: o que aparece na tela e no celular é sempre igual.
 *
 * Dedup: com `origemEvento`, o mesmo evento reprocessado não grava nem empurra de novo para
 * quem já recebeu (índice único `notificacoes_evento_pessoa_unico`, migration 0697).
 *
 * Sem a tabela (migration 0697 ainda não aplicada), o push sai mesmo assim para todos os
 * destinatários — só o aviso na tela fica faltando até a migration entrar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

import { paraPush } from "./aviso-pessoal";
import type { Entrega } from "./montar-avisos";
import { enviarPushAosUsuarios } from "./web_push";

async function desligaramNoCelular(
  admin: SupabaseClient,
  organizationId: string,
  categoria: string,
  userIds: string[],
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data, error } = await admin
    .from("notificacoes_preferencias")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("categoria", categoria)
    .eq("no_celular", false)
    .in("user_id", userIds);
  // Sem a tabela (0698 não aplicada): ninguém desligou nada.
  if (error) return new Set();
  return new Set(((data ?? []) as Array<{ user_id: string }>).map((l) => l.user_id));
}

export async function entregarNotificacao(
  admin: SupabaseClient,
  organizationId: string,
  entrega: Entrega,
  origemEvento?: string | null,
): Promise<{ gravadas: number; push: number }> {
  const destinatarios = [...new Set(entrega.destinatarios.filter(Boolean))];
  if (destinatarios.length === 0) return { gravadas: 0, push: 0 };
  const { aviso } = entrega;

  const linhas = destinatarios.map((userId) => ({
    organization_id: organizationId,
    user_id: userId,
    categoria: aviso.categoria,
    titulo: aviso.titulo,
    corpo: aviso.corpo,
    acoes: aviso.acoes,
    tag: aviso.tag,
    origem_evento: origemEvento ?? null,
  }));

  let novos = destinatarios;
  const { data, error } = await admin
    .from("notificacoes")
    .upsert(linhas, { onConflict: "origem_evento,user_id", ignoreDuplicates: true })
    .select("user_id");
  if (error) {
    logger.warn("notificacao_nao_gravada", {
      organization_id: organizationId,
      categoria: aviso.categoria,
      detail: error.message,
    });
  } else {
    // Só quem recebeu agora (os já entregues voltam fora do `select`).
    novos = ((data ?? []) as Array<{ user_id: string }>).map((l) => l.user_id);
  }

  // Quem desligou esta categoria "no celular" (migration 0698) não recebe o push; a
  // notificação continua no sino.
  const desligaram = await desligaramNoCelular(admin, organizationId, aviso.categoria, novos);
  const paraOCelular = novos.filter((u) => !desligaram.has(u));
  const { sent } = await enviarPushAosUsuarios(organizationId, paraOCelular, paraPush(aviso));
  return { gravadas: error ? 0 : novos.length, push: sent };
}
