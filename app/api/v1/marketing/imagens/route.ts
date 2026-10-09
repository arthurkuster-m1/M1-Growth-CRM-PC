import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/marketing/imagens — sobe UMA imagem (multipart `file`) para as páginas de
 * Marketing e devolve o NOME do arquivo (`<uuid>.<png|jpg>`), que o bloco guarda.
 *
 * Só a agência (manager+) envia. O caminho é gerado AQUI com a empresa da sessão — nunca
 * aceito do cliente — e o tipo sai dos BYTES, não do `Content-Type` que quem envia escolheu.
 * SVG é recusado (executa script quando aberto direto do endereço). Sem auditoria: é rascunho;
 * publicar, que é o que o cliente passa a ver, audita.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { requireRole } from "@/lib/auth/require-role";
import { extensaoDe, farejarTipo, pareceSvg } from "@/lib/branding/logo-arquivo";
import { traduzir } from "@/lib/i18n/dicionario";
import { logger } from "@/lib/logger";
import {
  BUCKET_DE_IMAGENS,
  caminhoDaImagem,
  TAMANHO_MAXIMO_DA_IMAGEM,
} from "@/lib/marketing/imagens";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TETO_POR_USUARIO = 60;
const JANELA_SEGUNDOS = 300;

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const limite = await checkRateLimit(
    `marketing-imagem:${authz.user.id}`,
    TETO_POR_USUARIO,
    JANELA_SEGUNDOS,
  );
  if (!limite.allowed) {
    return fail("rate_limited", t("Muitos envios seguidos. Tente em alguns minutos."), 429, {
      requestId,
      headers: { "Retry-After": String(JANELA_SEGUNDOS) },
    });
  }

  // Recusa pelo tamanho declarado ANTES de bufferizar; o `file.size` abaixo é o check final.
  const declarado = Number(req.headers.get("content-length") ?? 0);
  if (declarado > TAMANHO_MAXIMO_DA_IMAGEM + 1_048_576) {
    return fail("payload_too_large", t("A imagem precisa ter até 5 MB."), 413, { requestId });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return fail("validation_failed", t("Campo 'file' (multipart) obrigatório."), 422, {
      requestId,
    });
  }
  if (file.size > TAMANHO_MAXIMO_DA_IMAGEM) {
    return fail("payload_too_large", t("A imagem precisa ter até 5 MB."), 413, { requestId });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (pareceSvg(bytes)) {
    return fail("imagem_svg_recusada", t("SVG não é aceito. Envie a imagem em PNG ou JPG."), 415, {
      requestId,
    });
  }
  const tipo = farejarTipo(bytes);
  if (!tipo) {
    return fail("unsupported_media_type", t("A imagem precisa ser PNG ou JPG."), 415, {
      requestId,
      details: { content_type_declarado: file.type || null },
    });
  }

  const arquivo = `${randomUUID()}.${extensaoDe(tipo)}`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET_DE_IMAGENS)
    .upload(caminhoDaImagem(authz.org.orgId, arquivo), bytes, { contentType: tipo, upsert: false });
  if (error) {
    logger.error("[marketing/imagens] upload falhou", { detalhe: error.message, requestId });
    return fail("internal_error", t("Erro ao enviar a imagem."), 500, { requestId });
  }

  return ok({ arquivo }, { requestId });
}
