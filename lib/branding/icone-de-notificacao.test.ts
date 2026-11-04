import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { bytesDoDataUri, LADO_DA_SILHUETA, silhuetaDeNotificacao } from "./icone-de-notificacao";

/** Fundo branco opaco com um quadrado preto e um quadrado ciano (como o ícone: moldura + seta). */
async function iconeDeTeste(): Promise<Buffer> {
  return sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      {
        input: { create: { width: 60, height: 60, channels: 3, background: "#000000" } },
        left: 20,
        top: 20,
      },
      {
        input: { create: { width: 60, height: 60, channels: 3, background: "#00e5ee" } },
        left: 120,
        top: 120,
      },
    ])
    .png()
    .toBuffer();
}

async function pixels(png: Buffer) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => {
    const i = (y * info.width + x) * 4;
    return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! };
  };
  return { info, px };
}

describe("silhueta da notificação (o Android usa só a transparência)", () => {
  it("o fundo branco some e o desenho vira branco opaco, centrado e sem margem exagerada", async () => {
    const { info, px } = await pixels(await silhuetaDeNotificacao(await iconeDeTeste()));
    expect([info.width, info.height]).toEqual([LADO_DA_SILHUETA, LADO_DA_SILHUETA]);
    expect(px(1, 1).a).toBe(0); // canto: fundo
    let minX = info.width,
      maxX = 0;
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++)
        if (px(x, y).a > 200) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
    // o desenho preenche ~84% da largura (recortado e recentrado), com respiro dos dois lados
    expect(maxX - minX + 1).toBeGreaterThan(LADO_DA_SILHUETA * 0.75);
    expect(minX).toBeGreaterThanOrEqual(3);
    expect(info.width - 1 - maxX).toBeGreaterThanOrEqual(3);
  });

  it("nada colorido sobra: todo pixel é branco, só o alfa varia — e não é um quadrado cheio", async () => {
    const { info, px } = await pixels(await silhuetaDeNotificacao(await iconeDeTeste()));
    let opacos = 0;
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const p = px(x, y);
        // O RGB só importa onde há alfa (o Android usa só a transparência).
        if (p.a > 0) expect([p.r, p.g, p.b]).toEqual([255, 255, 255]);
        if (p.a > 128) opacos++;
      }
    const total = info.width * info.height;
    expect(opacos).toBeGreaterThan(total * 0.05);
    expect(opacos).toBeLessThan(total * 0.6);
  });

  it("transparência original é respeitada (PNG com fundo transparente)", async () => {
    const png = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: { create: { width: 20, height: 20, channels: 3, background: "#000" } },
          left: 15,
          top: 15,
        },
      ])
      .png()
      .toBuffer();
    const { px } = await pixels(await silhuetaDeNotificacao(png));
    expect(px(1, 1).a).toBe(0);
    expect(px(Math.round(LADO_DA_SILHUETA / 2), Math.round(LADO_DA_SILHUETA / 2)).a).toBe(255);
  });

  it("bytesDoDataUri lê data URI de imagem e recusa o resto", () => {
    expect(bytesDoDataUri("data:image/png;base64,AAAA")?.length).toBe(3);
    expect(bytesDoDataUri("data:text/html;base64,AAAA")).toBeNull();
    expect(bytesDoDataUri(null)).toBeNull();
  });
});
