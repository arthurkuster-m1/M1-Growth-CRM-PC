import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { comprimirImagem } from "./comprimir-imagem";

async function imagemGrande(largura: number, altura: number, formato: "png" | "jpeg") {
  // Ruído: comprime mal, como uma foto.
  const bruto = Buffer.alloc(largura * altura * 3);
  for (let i = 0; i < bruto.length; i++) bruto[i] = (i * 2654435761) >>> 24;
  const img = sharp(bruto, { raw: { width: largura, height: altura, channels: 3 } });
  return new Uint8Array(await (formato === "png" ? img.png() : img.jpeg({ quality: 100 })).toBuffer());
}

describe("comprimirImagem", () => {
  it("reduz uma imagem grande para no máximo 1080 px, em JPG, e mais leve", async () => {
    const original = await imagemGrande(2400, 1600, "png");
    const r = await comprimirImagem(original);
    expect(r.tipo).toBe("image/jpeg");
    expect(r.bytes.length).toBeLessThan(original.length);
    const meta = await sharp(r.bytes).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1080);
    expect(meta.format).toBe("jpeg");
  });
  it("não aumenta imagem pequena (mantém o original quando não ganha nada)", async () => {
    const pequena = new Uint8Array(
      await sharp({ create: { width: 40, height: 40, channels: 3, background: "#ff0000" } })
        .jpeg({ quality: 60 })
        .toBuffer(),
    );
    const r = await comprimirImagem(pequena);
    expect(r.bytes.length).toBeLessThanOrEqual(pequena.length);
  });
  it("lixo que não é imagem volta como veio, sem lançar", async () => {
    const lixo = new Uint8Array([1, 2, 3, 4]);
    const r = await comprimirImagem(lixo);
    expect(r.bytes).toBe(lixo);
    expect(r.tipo).toBeNull();
  });
});
