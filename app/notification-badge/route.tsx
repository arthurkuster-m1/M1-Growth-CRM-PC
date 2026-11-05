import { createHash } from "node:crypto";
import { ImageResponse } from "next/og";

import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { fail } from "@/lib/api/wrappers";
import { letraDoIcone } from "@/lib/branding/icone";
import { caminhoDoIconeDeNotificacao } from "@/lib/branding/icone-de-notificacao-caminho";
import { lerArquivoDoIcone } from "@/lib/branding/icone-do-app";
import {
  bytesDoDataUri,
  silhuetaDeNotificacao,
  LADO_DA_SILHUETA,
} from "@/lib/branding/icone-de-notificacao";
import { marcaDaInstalacao } from "@/lib/branding/instalacao";
import { marcaDaSaida } from "@/lib/branding/saida";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CABECALHOS = {
  "content-type": "image/png",
  "cache-control": "public, max-age=60, stale-while-revalidate=600",
  "x-content-type-options": "nosniff",
};

/**
 * `badge` das notificações do navegador: a silhueta (branco sobre transparente) da imagem da
 * notificação da instalação (ou do logo de fundo branco), que é o que o Android desenha na barra de status. Ver
 * `lib/branding/icone-de-notificacao.ts`. Sem ícone enviado, cai na inicial da marca em branco
 * sobre transparente — nunca num ladrilho cheio.
 */
export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const chave = createHash("sha256").update(ip).digest("hex");
  const limite = await checkRateLimit(`notification-badge:${chave}`, 60, 60);
  if (!limite.allowed) return fail("rate_limited", "Muitas leituras de ícone.", 429);

  const marca = await marcaDaSaida(null);
  const linha = await marcaDaInstalacao();
  // Quem manda: a imagem própria da notificação (Marca › Ícone da notificação); sem ela, o logo de
  // fundo branco. NUNCA o ícone do app (`favicon_path`): é um ladrilho com fundo, e a silhueta
  // dele seria um quadrado cheio.
  const caminho = (await caminhoDoIconeDeNotificacao()) ?? linha?.logo_path ?? null;
  const bytes = bytesDoDataUri(await lerArquivoDoIcone(caminho));
  if (bytes) {
    try {
      return new Response(new Uint8Array(await silhuetaDeNotificacao(bytes)), {
        headers: CABECALHOS,
      });
    } catch {
      logger.warn("marca: não foi possível fazer a silhueta do ícone; usando a inicial");
    }
  }
  const letra = letraDoIcone(marca.nome) ?? "•";
  const corpo = await new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontSize: Math.round(LADO_DA_SILHUETA * 0.8),
      }}
    >
      {letra}
    </div>,
    { width: LADO_DA_SILHUETA, height: LADO_DA_SILHUETA },
  ).arrayBuffer();
  return new Response(corpo, { headers: CABECALHOS });
}
