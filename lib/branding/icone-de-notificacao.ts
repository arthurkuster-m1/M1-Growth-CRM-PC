import sharp from "sharp";

/**
 * O ÍCONE PEQUENO DA NOTIFICAÇÃO (a barra de status do Android): uma SILHUETA.
 *
 * O Android ignora a cor desse ícone e usa só o canal alfa (transparência): o que for opaco vira
 * branco, o resto some. Mandar o ícone colorido do app (um ladrilho opaco) resulta num QUADRADO
 * branco cheio — era o que aparecia. Aqui o ícone da marca vira uma silhueta: branco puro com o
 * alfa tirado de "o quanto cada ponto se afasta do branco". Fundo branco ou transparente some; o
 * desenho (preto, colorido, em degradê) fica.
 *
 * Premissa declarada: o ícone enviado em Marca tem fundo BRANCO ou transparente (o normal de um
 * logo). Um ícone com fundo escuro e opaco resulta num ladrilho cheio — a tela de Marca diz isso.
 */
export const LADO_DA_SILHUETA = 96;

/** `data:image/...;base64,...` → bytes; `null` se não for um data URI de imagem. */
export function bytesDoDataUri(dataUri: string | null | undefined): Buffer | null {
  const m = /^data:image\/[a-z+.-]+;base64,(.+)$/i.exec(dataUri ?? "");
  return m ? Buffer.from(m[1]!, "base64") : null;
}

/** Resolução de trabalho: a silhueta é calculada grande e só depois encolhida (bordas limpas). */
const LADO_DE_TRABALHO = 256;
/** O desenho ocupa 84% do ícone; o resto é respiro (o Android corta bordas coladas). */
const OCUPACAO = 0.84;

export async function silhuetaDeNotificacao(imagem: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(imagem)
    .resize(LADO_DE_TRABALHO, LADO_DE_TRABALHO, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const saida = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const afastamento = (255 - Math.min(data[i]!, data[i + 1]!, data[i + 2]!)) / 255;
    // Um reforço (×1,6) para o cinza claro e o degradê não sumirem; abaixo de 8% é fundo.
    const nitidez = afastamento < 0.08 ? 0 : Math.min(1, afastamento * 1.6);
    saida[i] = 255;
    saida[i + 1] = 255;
    saida[i + 2] = 255;
    saida[i + 3] = Math.round((data[i + 3]! / 255) * nitidez * 255);
  }
  // Recorta a margem transparente e recentra: um logo com muita margem branca ficava minúsculo.
  const silhueta = await sharp(saida, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
  const miolo = Math.round(LADO_DA_SILHUETA * OCUPACAO);
  const recortada = await sharp(silhueta)
    .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 }, threshold: 1 })
    .resize(miolo, miolo, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: {
      width: LADO_DA_SILHUETA,
      height: LADO_DA_SILHUETA,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([{ input: recortada, gravity: "center" }])
    .png()
    .toBuffer();
}
