import { describe, expect, it } from "vitest";
import type { Categoria, Conta } from "./tipos";
import {
  acharCategoria,
  acharConta,
  chavesComOcorrencia,
  linhasDeMatriz,
  normalizar,
  parseData,
  parseFatura,
  parseSituacao,
  parseTipo,
  parseValorComSinal,
  sha256Hex,
  validarLinha,
  type ContextoImportacao,
  type LinhaCrua,
} from "./importacao";

const conta = (
  id: string,
  nome: string,
  tipo: Conta["tipo"] = "corrente",
  x: Partial<Conta> = {},
): Conta => ({
  id,
  nome,
  tipo,
  ativa: true,
  ordem: 0,
  rendimento_pct: null,
  rendimento_base: null,
  dia_fechamento: null,
  dia_vencimento: null,
  conta_pagamento_id: null,
  ...x,
});
const cat = (id: string, nome: string, tipo: Categoria["tipo"]): Categoria => ({
  id,
  nome,
  group_id: null,
  grupo: null,
  cor: null,
  tipo,
  orcamento_mensal_cents: 0,
  orcamento_anual_cents: 0,
  ativa: true,
  ordem: 0,
});
const ctx = (over: Partial<ContextoImportacao> = {}): ContextoImportacao => ({
  anoRef: 2026,
  tipoPadrao: "saida",
  hoje: "2026-10-31",
  contas: [
    conta("ak", "AK"),
    conta("vi", "VI"),
    conta("va", "VA"),
    conta("nu", "Nubank 120%", "investida"),
    conta("duda", "Duda", "cartao", { dia_fechamento: 28, dia_vencimento: 5 }),
    conta("casa", "Casa", "bem"),
  ],
  categorias: [
    cat("c-saude", "Saúde", "saida"),
    cat("c-forvi", "For Vi", "saida"),
    cat("c-forart", "For Art", "saida"),
    cat("c-gm", "GM", "entrada"),
    cat("c-ns", "New Start", "entrada"),
    cat("c-rend", "Rendimentos", "entrada"),
  ],
  ...over,
});
const ok = (l: LinhaCrua, c = ctx()) => {
  const r = validarLinha(l, c);
  if (r.estado !== "ok") throw new Error("esperava ok, veio " + JSON.stringify(r));
  return r;
};

describe("leitura de campos", () => {
  it.each([
    ["01/10", "2026-10-01"],
    ["1/10", "2026-10-01"],
    ["01/10/26", "2026-10-01"],
    ["01/10/2025", "2025-10-01"],
    ["2026-10-01", "2026-10-01"],
    [" 05-10 ", "2026-10-05"],
  ])("data %j → %s", (t, e) => expect(parseData(t, 2026)).toBe(e));
  it.each(["Out 01-30", "31/02", "32/01", "00/10", "abc", ""])("data inválida %j", (t) =>
    expect(parseData(t, 2026)).toBeNull(),
  );
  it.each([
    [" R$  13.227,20 ", 1322720],
    ["-R$  61,78", -6178],
    ["-R$  0,00 ", 0],
    ["R$ 536,24", 53624],
    ["(12,50)", -1250],
    ["−5,00", -500],
    ["1.234", 123400],
  ])("valor %j → %i", (t, e) => expect(parseValorComSinal(t)).toBe(e));
  it.each(["", "abc", "R$"])("valor ilegível %j → null", (t) =>
    expect(parseValorComSinal(t)).toBeNull(),
  );
  it("tipo", () => {
    expect(parseTipo("Saída")).toBe("saida");
    expect(parseTipo("ENTRADAS")).toBe("entrada");
    expect(parseTipo("transf.")).toBe("transferencia");
    expect(parseTipo("")).toBeNull();
    expect(parseTipo("xx")).toBe("invalido");
  });
  it("situação", () => {
    expect(parseSituacao("Previsto")).toBe("pendente");
    expect(parseSituacao("pago")).toBe("pago");
    expect(parseSituacao("")).toBeNull();
    expect(parseSituacao("?")).toBe("invalido");
  });
  it.each([
    ["nov/2026", "2026-11"],
    ["Nov/26", "2026-11"],
    ["11/2026", "2026-11"],
    ["2026-11", "2026-11"],
    ["novembro de 2026", "2026-11"],
    ["dez", "2026-12"],
  ])("fatura %j → %s", (t, e) => expect(parseFatura(t, 2026)).toBe(e));
  it("fatura inválida", () => {
    expect(parseFatura("13/2026", 2026)).toBeNull();
    expect(parseFatura("xyz", 2026)).toBeNull();
  });
  it("normalizar tira acento e caixa", () =>
    expect(normalizar("  Saúde  Extra ")).toBe("saude extra"));
  it("conta por nome sem acento/caixa e por prefixo único", () => {
    expect(acharConta("ak", ctx().contas)?.id).toBe("ak");
    expect(acharConta("Nubank", ctx().contas)?.id).toBe("nu");
    expect(acharConta("X", ctx().contas)).toBeUndefined();
  });
  it("categoria: prefere o mesmo tipo, aceita o outro", () => {
    expect(acharCategoria("saude", "saida", ctx().categorias)?.outroTipo).toBe(false);
    expect(acharCategoria("GM", "saida", ctx().categorias)?.outroTipo).toBe(true);
    expect(acharCategoria("nada", "saida", ctx().categorias)).toBeUndefined();
  });
});

describe("linhas REAIS da planilha (aba Out)", () => {
  it("Saída comum: 01/10 AK Saúde R$ 536,24 Bike Ergométrica", () => {
    const r = ok({
      data: "01/10",
      conta: "AK",
      categoria: "Saúde",
      valor: "R$ 536,24",
      nota: "Bike Ergométrica",
    });
    expect(r.lancamento).toMatchObject({
      data: "2026-10-01",
      tipo: "saida",
      valor_cents: 53624,
      account_id: "ak",
      category_id: "c-saude",
      status: "pago",
      nota: "Bike Ergométrica",
      fatura_mes: null,
    });
  });
  it("Entrada: 05/10 VA GM R$ 1.559,60 (tipo vindo do cabeçalho 'Entradas')", () => {
    const r = ok(
      { data: "05/10", conta: "VA", categoria: "GM", valor: " R$  1.559,60 " },
      ctx({ tipoPadrao: "entrada" }),
    );
    expect(r.lancamento).toMatchObject({
      tipo: "entrada",
      valor_cents: 155960,
      category_id: "c-gm",
      account_id: "va",
    });
  });
  it("'Caixa' vira SALDO DE ABERTURA (não entrada): 01/10 AK Caixa R$ 13.227,20", () => {
    const r = validarLinha(
      { data: "01/10", conta: "AK", categoria: "Caixa", valor: " R$  13.227,20 " },
      ctx({ tipoPadrao: "entrada" }),
    );
    expect(r).toMatchObject({ estado: "abertura", mes: "2026-10", cents: 1322720 });
  });
  it("'Caixa' com -R$ 0,00 é abertura zero, não linha ignorada", () => {
    expect(
      validarLinha(
        { data: "01/10", conta: "VA", categoria: "Caixa", valor: "-R$  0,00 " },
        ctx({ tipoPadrao: "entrada" }),
      ),
    ).toMatchObject({ estado: "abertura", cents: 0 });
  });
  it("Estorno em Saídas (-R$ 61,78 For Vi) vira ENTRADA na mesma categoria", () => {
    const r = ok({ data: "28/08", conta: "VI", categoria: "For Vi", valor: "-R$ 61,78" });
    expect(r.lancamento).toMatchObject({
      tipo: "entrada",
      valor_cents: 6178,
      category_id: "c-forvi",
    });
    expect(r.avisos.join(" ")).toMatch(/estorno/);
  });
  it("Entrada negativa (-R$ 230,45 New Start) vira SAÍDA, com aviso", () => {
    const r = ok(
      { data: "05/10", conta: "AK", categoria: "New Start", valor: "-R$  230,45 " },
      ctx({ tipoPadrao: "entrada" }),
    );
    expect(r.lancamento).toMatchObject({ tipo: "saida", valor_cents: 23045, category_id: "c-ns" });
    expect(r.avisos.length).toBeGreaterThan(0);
  });
  it("'Invest Total' sem valor é IGNORADA (mesmo com categoria inexistente)", () => {
    expect(
      validarLinha({ data: "01/10", conta: "AK", categoria: "Invest Total", valor: "" }, ctx()),
    ).toEqual({ estado: "ignorada", motivo: "sem valor" });
  });
  it("'Out 01-30' (data de rendimento) é erro de data", () => {
    const r = validarLinha(
      { data: "Out 01-30", conta: "AK", categoria: "Rendimentos", valor: "R$ 175,65" },
      ctx({ tipoPadrao: "entrada" }),
    );
    expect(r).toMatchObject({ estado: "erro" });
    expect((r as { erros: string[] }).erros[0]).toMatch(/Data inválida/);
  });
  it("categoria inexistente (Uber) é erro e diz qual criar", () => {
    const r = validarLinha(
      { data: "05/10", conta: "AK", categoria: "Uber", valor: "R$ 35,40" },
      ctx(),
    );
    expect(r).toMatchObject({ estado: "erro", categoriaFaltando: { nome: "Uber", tipo: "saida" } });
  });
});

describe("cartão, transferência, situação", () => {
  it("compra no cartão: fatura padrão pelo vencimento (fecha 28, vence 5: 28/08 paga em set)", () => {
    const r = ok({ data: "28/08", conta: "Duda", categoria: "For Vi", valor: "R$ 56,74" });
    expect(r.lancamento.fatura_mes).toBe("2026-09-01");
  });
  it("fatura escolhida na linha vale", () =>
    expect(
      ok({ data: "28/08", conta: "Duda", categoria: "For Vi", valor: "10,00", fatura: "nov/2026" })
        .lancamento.fatura_mes,
    ).toBe("2026-11-01"));
  it("fatura inválida é erro", () =>
    expect(
      validarLinha(
        { data: "28/08", conta: "Duda", categoria: "For Vi", valor: "10,00", fatura: "xx" },
        ctx(),
      ),
    ).toMatchObject({ estado: "erro" }));
  it("fatura em conta que não é cartão: ignorada com aviso", () => {
    const r = ok({
      data: "05/10",
      conta: "AK",
      categoria: "Saúde",
      valor: "10,00",
      fatura: "nov/2026",
    });
    expect(r.lancamento.fatura_mes).toBeNull();
    expect(r.avisos.join()).toMatch(/Fatura ignorada/);
  });
  it("transferência com destino", () => {
    const r = ok({
      tipo: "transf",
      data: "05/10",
      conta: "AK",
      destino: "Nubank 120%",
      valor: "3.000,00",
    });
    expect(r.lancamento).toMatchObject({
      tipo: "transferencia",
      account_id: "ak",
      account_destino_id: "nu",
      category_id: null,
      valor_cents: 300000,
    });
  });
  it("transferência sem destino, para a mesma conta ou negativa → erro", () => {
    for (const l of [
      { tipo: "transf", data: "05/10", conta: "AK", valor: "10" },
      { tipo: "transf", data: "05/10", conta: "AK", destino: "AK", valor: "10" },
      { tipo: "transf", data: "05/10", conta: "AK", destino: "VI", valor: "-10" },
    ])
      expect(validarLinha(l, ctx()).estado).toBe("erro");
  });
  it("pagar fatura: transferência AK → cartão", () =>
    expect(
      ok({ tipo: "transferencia", data: "05/10", conta: "AK", destino: "Duda", valor: "21,94" })
        .lancamento.fatura_mes,
    ).toBeNull());
  it("data futura vira previsto, com aviso", () => {
    const r = ok({ data: "20/11", conta: "AK", categoria: "Saúde", valor: "10,00" });
    expect(r.lancamento.status).toBe("pendente");
    expect(r.avisos.join()).toMatch(/Data futura/);
  });
  it("situação explícita 'previsto' e 'cancelado'", () => {
    expect(
      ok({ data: "01/10", conta: "AK", categoria: "Saúde", valor: "1", situacao: "previsto" })
        .lancamento.status,
    ).toBe("pendente");
    expect(
      ok({ data: "01/10", conta: "AK", categoria: "Saúde", valor: "1", situacao: "cancelado" })
        .lancamento.status,
    ).toBe("cancelado");
  });
  it("bem não recebe lançamento; conta inexistente é erro", () => {
    expect(
      validarLinha({ data: "01/10", conta: "Casa", categoria: "Saúde", valor: "1" }, ctx()).estado,
    ).toBe("erro");
    expect(
      validarLinha({ data: "01/10", conta: "ZZ", categoria: "Saúde", valor: "1" }, ctx()).estado,
    ).toBe("erro");
  });
  it("linha toda em branco é 'vazia'; valor inválido é erro", () => {
    expect(validarLinha({}, ctx()).estado).toBe("vazia");
    expect(
      validarLinha({ data: "01/10", conta: "AK", categoria: "Saúde", valor: "abc" }, ctx()).estado,
    ).toBe("erro");
  });
  it("junta TODOS os erros da linha de uma vez", () => {
    const r = validarLinha({ data: "xx", conta: "ZZ", categoria: "Nada", valor: "1" }, ctx());
    expect(r.estado === "erro" && r.erros.length).toBe(3);
  });
});

describe("colar/CSV: cabeçalho e colunas", () => {
  it("sem cabeçalho: ordem Data, Conta, Categoria, Valor, Nota", () => {
    const { linhas, temCabecalho } = linhasDeMatriz([
      ["01/10", "AK", "Saúde", "R$ 536,24", "Bike"],
      ["05/10", "AK", "Uber", "R$ 35,40", ""],
    ]);
    expect(temCabecalho).toBe(false);
    expect(linhas[0]).toEqual({
      data: "01/10",
      conta: "AK",
      categoria: "Saúde",
      valor: "R$ 536,24",
      nota: "Bike",
    });
  });
  it("cabeçalho da planilha 'Data | C | Saídas | (vazio) | ...' → saída e valor na 4ª coluna", () => {
    const { linhas, tipoDoCabecalho, temCabecalho } = linhasDeMatriz([
      ["Data", "C", "Saídas", "", "Obs"],
      ["01/10", "AK", "Saúde", "R$ 536,24", "Bike"],
    ]);
    expect(temCabecalho).toBe(true);
    expect(tipoDoCabecalho).toBe("saida");
    expect(linhas[0]).toMatchObject({
      data: "01/10",
      conta: "AK",
      categoria: "Saúde",
      valor: "R$ 536,24",
    });
  });
  it("cabeçalho 'Entradas' define entrada", () =>
    expect(
      linhasDeMatriz([
        ["Data", "C", "Entradas"],
        ["05/10", "VA", "GM", "R$ 1,00"],
      ]).tipoDoCabecalho,
    ).toBe("entrada"));
  it("cabeçalho completo em qualquer ordem", () => {
    const { linhas } = linhasDeMatriz([
      ["Valor", "Data", "Conta", "Categoria", "Tipo", "Fatura", "Situação", "Anotação"],
      ["10,00", "01/10", "Duda", "For Vi", "saída", "nov/2026", "pago", "x"],
    ]);
    expect(linhas[0]).toEqual({
      valor: "10,00",
      data: "01/10",
      conta: "Duda",
      categoria: "For Vi",
      tipo: "saída",
      fatura: "nov/2026",
      situacao: "pago",
      nota: "x",
    });
  });
  it("ignora linhas totalmente vazias", () =>
    expect(
      linhasDeMatriz([
        ["", ""],
        ["01/10", "AK", "Saúde", "1"],
        ["", ""],
      ]).linhas.length,
    ).toBe(1));
});

describe("duplicatas", () => {
  it("duas compras IDÊNTICAS no mesmo arquivo continuam sendo duas (#1, #2)", () =>
    expect(chavesComOcorrencia(["a", "b", "a"])).toEqual(["a|#1", "b|#1", "a|#2"]));
  it("reimportar o mesmo arquivo gera as MESMAS impressões digitais", async () => {
    const chaves = ["2026-10-01|saida|53624|ak|||bike|", "2026-10-01|saida|53624|ak|||bike|"];
    const h1 = await Promise.all(chavesComOcorrencia(chaves).map(sha256Hex));
    const h2 = await Promise.all(chavesComOcorrencia(chaves).map(sha256Hex));
    expect(h1).toEqual(h2);
    expect(h1[0]).not.toBe(h1[1]);
    expect(h1[0]).toMatch(/^[0-9a-f]{64}$/);
  });
});
