import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  notificacao: null as string | null,
  logo: null as string | null,
  lidos: [] as Array<string | null | undefined>,
  imagem: "" as string,
}));

// O `next/og` (satori + resvg) não roda sob o vitest; o desenho em si é o mesmo de `app/icon.tsx`.
vi.mock("next/og", () => ({
  ImageResponse: class {
    arrayBuffer = async () => new ArrayBuffer(8);
  },
}));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true }),
}));
vi.mock("@/lib/branding/saida", () => ({
  marcaDaSaida: async () => ({ nome: "Acme", accent: "#366d6f" }),
}));
vi.mock("@/lib/branding/instalacao", () => ({
  marcaDaInstalacao: async () => ({ logo_path: h.logo, favicon_path: "platform/favicon.png" }),
}));
vi.mock("@/lib/branding/icone-de-notificacao-caminho", () => ({
  caminhoDoIconeDeNotificacao: async () => h.notificacao,
}));
vi.mock("@/lib/branding/icone-do-app", () => ({
  lerArquivoDoIcone: async (caminho: string | null | undefined) => {
    h.lidos.push(caminho);
    return caminho ? h.imagem : null;
  },
}));

import { GET } from "./route";

beforeEach(async () => {
  h.notificacao = null;
  h.logo = null;
  h.lidos = [];
  // Fundo branco com um quadrado preto: uma silhueta reconhecível.
  const png = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#ffffff" },
  })
    .composite([
      {
        input: { create: { width: 50, height: 50, channels: 3, background: "#000" } },
        left: 25,
        top: 25,
      },
    ])
    .png()
    .toBuffer();
  h.imagem = `data:image/png;base64,${png.toString("base64")}`;
});

const pedir = () => GET(new Request("http://localhost/notification-badge"));

describe("GET /notification-badge — de onde sai a silhueta", () => {
  it("com imagem da notificação, usa ELA (e não o logo nem o ícone do app)", async () => {
    h.notificacao = "platform/notificacao.png";
    h.logo = "platform/logo.png";
    const res = await pedir();
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(h.lidos).toEqual(["platform/notificacao.png"]);
  });

  it("sem imagem própria, cai no logo de fundo branco — nunca no ícone do app", async () => {
    h.logo = "platform/logo.png";
    await pedir();
    expect(h.lidos).toEqual(["platform/logo.png"]);
    expect(h.lidos).not.toContain("platform/favicon.png");
  });

  it("sem nada, responde (a inicial desenhada) sem ler arquivo nenhum", async () => {
    // O que se afirma aqui é o caminho (sem arquivo, sem leitura) e a resposta.
    const res = await pedir();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(h.lidos).toEqual([null]);
  });
});
