import "server-only";

/** O maior lado da imagem guardada, em pixels (o feed do Meta usa 1080). */
export const LADO_MAXIMO_DA_IMAGEM = 1080;
const QUALIDADE_DO_JPG = 80;

/**
 * Reduz uma imagem importada: no máximo 1080 px no maior lado, JPG com qualidade 80 (fundo
 * branco onde havia transparência). Só devolve o resultado se ele for MENOR que o original —
 * senão (ou se a biblioteca falhar) devolve o original, sem mexer. Nunca lança.
 */
export async function comprimirImagem(bytes: Uint8Array): Promise<{
  bytes: Uint8Array;
  tipo: "image/jpeg" | null;
}> {
  try {
    const sharp = (await import("sharp")).default;
    const saida = await sharp(bytes, { failOn: "none" })
      .rotate()
      .resize({
        width: LADO_MAXIMO_DA_IMAGEM,
        height: LADO_MAXIMO_DA_IMAGEM,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: QUALIDADE_DO_JPG, mozjpeg: true })
      .toBuffer();
    if (saida.length > 0 && saida.length < bytes.length) {
      return { bytes: new Uint8Array(saida), tipo: "image/jpeg" };
    }
  } catch {
    // Biblioteca indisponível ou imagem estranha: guarda o original.
  }
  return { bytes, tipo: null };
}
