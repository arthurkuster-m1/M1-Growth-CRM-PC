import { describe, expect, it } from "vitest";

import { lerPerfilDaUrl } from "./perfil";

const ler = (q: string) => lerPerfilDaUrl(new URLSearchParams(q));

describe("lerPerfilDaUrl", () => {
  it("sem nicho não há perfil", () => {
    expect(ler("")).toEqual({ ok: true, perfil: null });
  });

  it("lê nicho, modelos e oferta pronta", () => {
    expect(ler("nicho=clinica&modelos=agendamento,whatsapp&ja_tem_oferta=1")).toEqual({
      ok: true,
      perfil: { nicho: "clinica", modelos: ["agendamento", "whatsapp"], jaTemOferta: true },
    });
  });

  it("modelos e oferta são opcionais, e modelo repetido some", () => {
    expect(ler("nicho=loja&modelos=checkout,checkout")).toEqual({
      ok: true,
      perfil: { nicho: "loja", modelos: ["checkout"], jaTemOferta: false },
    });
  });

  it("recusa nicho, modelo ou flag que não existem", () => {
    expect(ler("nicho=advocacia").ok).toBe(false);
    expect(ler("nicho=loja&modelos=telepatia").ok).toBe(false);
    expect(ler("nicho=loja&ja_tem_oferta=talvez").ok).toBe(false);
  });
});
