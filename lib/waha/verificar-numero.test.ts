import { describe, expect, it, vi } from "vitest";

import { verificarNumeroNoWhatsapp } from "./verificar-numero";

const cliente = (impl: (digitos: string) => Promise<{ numberExists: boolean }>) => ({
  checkContactExists: vi.fn(async (_sessao: string, digitos: string) => impl(digitos)),
});

describe("verificarNumeroNoWhatsapp", () => {
  it("tem: basta uma grafia existir (o celular BR com e sem o nono dígito)", async () => {
    const c = cliente(async (d) => ({ numberExists: d.length === 12 }));
    expect(await verificarNumeroNoWhatsapp(c, "sessao", "+5541988887777")).toBe("tem");
    // Consulta pela sessão pedida.
    expect(c.checkContactExists.mock.calls[0]![0]).toBe("sessao");
  });

  it("não tem: todas as grafias consultadas e nenhuma existe", async () => {
    const c = cliente(async () => ({ numberExists: false }));
    expect(await verificarNumeroNoWhatsapp(c, "s", "+5541988887777")).toBe("nao_tem");
    expect(c.checkContactExists.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("incerto: a consulta falhou e nada confirmou — nunca vira 'não tem'", async () => {
    const c = cliente(async () => {
      throw new Error("waha_503");
    });
    expect(await verificarNumeroNoWhatsapp(c, "s", "+5541988887777")).toBe("incerto");
  });

  it("uma grafia falha e a outra confirma: tem", async () => {
    let chamada = 0;
    const c = cliente(async () => {
      chamada += 1;
      if (chamada === 1) throw new Error("waha_503");
      return { numberExists: true };
    });
    expect(await verificarNumeroNoWhatsapp(c, "s", "+5541988887777")).toBe("tem");
  });

  it("sem dígitos aproveitáveis: incerto, sem consultar", async () => {
    const c = cliente(async () => ({ numberExists: true }));
    expect(await verificarNumeroNoWhatsapp(c, "s", "sem telefone")).toBe("incerto");
    expect(c.checkContactExists).not.toHaveBeenCalled();
  });
});
