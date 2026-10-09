import "server-only";

import { logger } from "@/lib/logger";
import {
  BUCKET_DE_IMAGENS,
  caminhoDaImagem,
  mimeDaImagem,
  nomeDeImagemValido,
} from "@/lib/marketing/imagens";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Entrega os bytes de uma imagem da EMPRESA dada. A empresa vem de quem chama (sessão ou
 * link, já conferidos) e o nome é validado pela forma — não há como sair da pasta da empresa.
 * O nome é um uuid: o conteúdo nunca muda, então o navegador pode guardar à vontade.
 */
export async function entregarImagem(
  orgId: string,
  nome: string,
  cache: "private" | "public",
): Promise<Response> {
  if (!nomeDeImagemValido(nome)) return new Response(null, { status: 404 });
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET_DE_IMAGENS)
    .download(caminhoDaImagem(orgId, nome));
  if (error || !data) {
    if (error) logger.warn("[marketing/imagens] leitura falhou", { detalhe: error.message });
    return new Response(null, { status: 404 });
  }
  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": mimeDaImagem(nome),
      "Cache-Control": `${cache}, max-age=86400, immutable`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
