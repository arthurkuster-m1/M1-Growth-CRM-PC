/**
 * POST /api/v1/messages/[id]/resend — reenvia a mensagem de uma PESSOA que ficou presa porque o
 * número estava fora do ar (`queued` + `queued_reason = channel_session_not_working`).
 *
 * Nada sai sozinho quando o número volta: o dono preferiu que a pessoa decida (mensagem velha, sem
 * contexto, não pode chegar ao cliente por conta própria). Esta rota é a decisão dela.
 *
 * O envio é o MESMO da Inbox (`sendMessageHandler`), sobre a MESMA linha: o `id` da mensagem entra
 * como `internalMessageId`, o insert esbarra na chave primária e o handler segue com a linha que
 * já existe — sem mensagem duplicada, com todas as travas de sempre (canal, janela, fronteira).
 * Antes de entregar ao handler a linha é "reservada" (`queued` → `sending`) numa escrita
 * condicional: dois cliques seguidos não enviam duas vezes. Se o envio não chegar a sair (número
 * ainda fora do ar, erro), a linha volta a `queued` e o botão continua lá.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { ApiError } from "@/lib/api/types";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { mensagemEsperaReenvio, MOTIVO_NUMERO_FORA_DO_AR } from "@/lib/inbox/mensagem-presa";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "messages" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const orgId = authz.org.orgId;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  }

  const supabase = await createClient();
  const { data: linha, error: erroDeLeitura } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, type, body, media_url, media_mime, media_storage_path, media_size_bytes, reply_to_message_id, direction, status, sent_via, metadata",
    )
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (erroDeLeitura) {
    return fail("internal_error", t("Erro ao buscar mensagem."), 500, { requestId });
  }
  if (!linha) return fail("not_found", t("Mensagem não encontrada."), 404, { requestId });

  const mensagem = linha as unknown as {
    id: string;
    conversation_id: string;
    type: string;
    body: string | null;
    media_url: string | null;
    media_mime: string | null;
    media_storage_path: string | null;
    media_size_bytes: number | null;
    reply_to_message_id: string | null;
    direction: string;
    status: string;
    sent_via: string | null;
    metadata: Record<string, unknown> | null;
  };

  if (!mensagemEsperaReenvio(mensagem)) {
    return fail("not_resendable", t("Esta mensagem não está esperando reenvio."), 409, {
      requestId,
    });
  }

  // O número já voltou? Se não, avisa na hora (e nada é reservado).
  const { data: conversa } = await supabase
    .from("conversations")
    .select("id, channel_sessions(status)")
    .eq("id", mensagem.conversation_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  const sessao = (conversa as unknown as { channel_sessions: { status: string } | null } | null)
    ?.channel_sessions;
  if (!sessao || sessao.status !== "WORKING") {
    return fail(
      "number_still_offline",
      t("O número ainda está fora do ar. Reconecte em Conexões e tente de novo."),
      409,
      { requestId },
    );
  }

  // Reserva condicional: só quem ainda a encontra `queued` segue (dois cliques não enviam duas vezes).
  const { data: reservada } = await supabase
    .from("messages")
    .update({ status: "sending" })
    .eq("id", mensagem.id)
    .eq("organization_id", orgId)
    .eq("status", "queued")
    .select("id");
  if (!reservada || reservada.length === 0) {
    return fail("not_resendable", t("Esta mensagem não está esperando reenvio."), 409, {
      requestId,
    });
  }

  const devolverAFila = async () => {
    await supabase
      .from("messages")
      .update({ status: "queued" })
      .eq("id", mensagem.id)
      .eq("organization_id", orgId)
      .eq("status", "sending");
  };

  // Do metadata só segue o que o ENVIO usa (ex.: cartão de contato); o motivo da fila fica de fora.
  const { queued_reason: _motivo, ...metadataDoEnvio } = mensagem.metadata ?? {};
  const entrada = {
    conversation_id: mensagem.conversation_id,
    type: mensagem.type,
    ...(mensagem.body ? { body: mensagem.body } : {}),
    ...(mensagem.media_url ? { media_url: mensagem.media_url } : {}),
    ...(mensagem.media_storage_path ? { media_storage_path: mensagem.media_storage_path } : {}),
    ...(mensagem.media_mime ? { media_mime: mensagem.media_mime } : {}),
    ...(mensagem.media_size_bytes ? { media_size_bytes: mensagem.media_size_bytes } : {}),
    ...(mensagem.reply_to_message_id ? { reply_to_message_id: mensagem.reply_to_message_id } : {}),
    ...(Object.keys(metadataDoEnvio).length > 0 ? { metadata: metadataDoEnvio } : {}),
  };

  let resultado;
  try {
    resultado = await sendMessageHandler(
      supabase,
      {
        organization_id: orgId,
        actor: { type: "user", id: authz.user.id },
        requestId,
        idioma: authz.user.idioma,
        internalMessageId: mensagem.id,
      },
      entrada as Parameters<typeof sendMessageHandler>[2],
    );
  } catch (err) {
    await devolverAFila();
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, { requestId });
    }
    return fail("internal_error", t("Não foi possível reenviar agora. Tente de novo."), 500, {
      requestId,
    });
  }

  // Não saiu (o handler a deixou na fila de novo, ou ficou reservada): volta a esperar.
  if (resultado.status === "sending" || resultado.status === "queued") {
    await devolverAFila();
    return fail(
      "number_still_offline",
      t("A mensagem ainda não pôde sair. Confira a conexão do número e tente de novo."),
      409,
      { requestId },
    );
  }

  // Saiu: o motivo da fila já não vale (a tela não pode mais dizer "fora do ar").
  if (resultado.status !== "failed") {
    const { queued_reason: _resolvido, ...restante } = (resultado.metadata ?? {}) as Record<
      string,
      unknown
    >;
    await supabase
      .from("messages")
      .update({ metadata: restante })
      .eq("id", mensagem.id)
      .eq("organization_id", orgId);
  }

  await audit({
    action: "message.resent",
    actorUserId: authz.user.id,
    organizationId: orgId,
    resourceType: "message",
    resourceId: mensagem.id,
    requestId,
    metadata: { reason: MOTIVO_NUMERO_FORA_DO_AR, resulting_status: resultado.status },
  });

  return ok(resultado, { requestId });
}
