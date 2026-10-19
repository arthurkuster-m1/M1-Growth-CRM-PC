import { describe, expect, it } from "vitest";

import { lerLinhasDeClientes } from "./planilha-de-clientes";

describe("lerLinhasDeClientes", () => {
  it("só nome e e-mail já basta (lead guardado, sem funil e sem venda)", () => {
    const r = lerLinhasDeClientes([["Nome", "E-mail"], ["Ana Souza", "ana@x.com"]]);
    if ("erro" in r) throw new Error(r.erro);
    expect(r.erros).toEqual([]);
    expect(r.linhas[0]).toMatchObject({
      nome: "Ana Souza",
      email: "ana@x.com",
      telefone: null,
      funil: null,
      valor_cents: null,
    });
  });
  it("só nome e telefone também", () => {
    const r = lerLinhasDeClientes([["Nome", "Telefone"], ["Bia", "(11) 99999-8888"]]);
    if ("erro" in r) throw new Error(r.erro);
    expect(r.linhas[0]!.telefone).toBe("+5511999998888");
  });
  it("todas as propriedades opcionais", () => {
    const r = lerLinhasDeClientes([
      ["Nome", "Telefone", "Origem", "Funil", "Etapa", "Produto", "Valor da venda", "Status da venda", "Previsão de fechamento", "Observações", "Etiquetas", "Renda"],
      ["Carla", "11988887777", "Instagram", "Seletiva", "Contato feito", "Plano Plus", "1.500,00", "Comprometida", "30/12/2026", "Quer parcelar", "vip; recompra", "5 mil"],
    ]);
    if ("erro" in r) throw new Error(r.erro);
    expect(r.linhas[0]).toMatchObject({
      origem: "Instagram",
      funil: "Seletiva",
      etapa: "Contato feito",
      produto: "Plano Plus",
      valor_cents: 150000,
      status_da_venda: "comprometida",
      previsao: "2026-12-30",
      descricao: "Quer parcelar",
      etiquetas: ["vip", "recompra"],
      campos: { Renda: "5 mil" },
    });
    expect(r.colunasPersonalizadas).toEqual(["Renda"]);
  });
  it("linha sem telefone nem e-mail é recusada com o motivo", () => {
    const r = lerLinhasDeClientes([["Nome", "Telefone", "E-mail"], ["Dani", "", ""]]);
    if ("erro" in r) throw new Error(r.erro);
    expect(r.linhas).toHaveLength(0);
    expect(r.erros[0]).toMatchObject({ linha: 2, motivo: "sem telefone nem e-mail" });
  });
  it("planilha sem coluna de contato é recusada inteira", () => {
    const r = lerLinhasDeClientes([["Nome", "Cidade"], ["Eva", "BH"]]);
    expect("erro" in r).toBe(true);
  });
  it("status da venda desconhecido recusa a linha", () => {
    const r = lerLinhasDeClientes([["Nome", "E-mail", "Status da venda"], ["Fê", "f@x.com", "talvez"]]);
    if ("erro" in r) throw new Error(r.erro);
    expect(r.erros).toHaveLength(1);
  });

  it("lê Instagram e Site como links do contato; link ruim avisa e a linha entra", () => {
    const r = lerLinhasDeClientes([
      ["Nome", "Telefone", "Instagram", "Site"],
      ["Gil", "(11) 99999-8888", "instagram.com/gil", "@gil"],
    ]);
    if ("erro" in r) throw new Error(r.erro);
    expect(r.linhas[0]!.links).toEqual({ link_instagram: "https://instagram.com/gil" });
    expect(r.erros).toHaveLength(1);
    expect(r.colunasPersonalizadas).toEqual([]);
  });
});
