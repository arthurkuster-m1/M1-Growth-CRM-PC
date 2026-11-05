import { describe, expect, it } from "vitest";

import { comMidiaParaOCliente, urlDaMidiaParaOCliente } from "./url-para-o-cliente";

const base = { id: "m-1", media_url: null, media_storage_path: null };

describe("media_url que sai para o navegador", () => {
  it("troca o endereço interno do WAHA pela rota autenticada de mídia", () => {
    const m = comMidiaParaOCliente({
      ...base,
      media_url: "http://localhost:3000/api/files/abc.jpg",
      media_storage_path: "org/abc.jpg",
    });
    expect(m.media_url).toBe("/api/v1/messages/m-1/media");
    expect(JSON.stringify(m)).not.toContain("localhost");
  });

  it("mantém o campo preenchido (a tela só lê se há mídia)", () => {
    expect(
      urlDaMidiaParaOCliente({ ...base, media_url: "http://127.0.0.1:3100/api/files/x.ogg" }),
    ).toBeTruthy();
  });

  it("sem mídia continua nulo e a mensagem passa intacta", () => {
    const m = { ...base, body: "oi" };
    expect(comMidiaParaOCliente(m)).toBe(m);
    expect(urlDaMidiaParaOCliente(base)).toBeNull();
  });

  it("não mexe nos outros campos", () => {
    const m = comMidiaParaOCliente({ ...base, media_url: "http://localhost:3000/x", body: "legenda" });
    expect(m.body).toBe("legenda");
  });
});
