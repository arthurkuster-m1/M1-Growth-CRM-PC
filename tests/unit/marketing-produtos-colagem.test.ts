import { describe, expect, it } from "vitest";

import {
  linhasDeMatriz,
  matrizDoTexto,
  nomeDaCopia,
  situacoesDasLinhas,
  textoDeProdutos,
} from "@/lib/marketing/produtos-colagem";
import { lerPlanilha, ofertaDaLinha } from "@/lib/marketing/produtos-csv";

describe("colar produtos na tabela", () => {
  it("lê o que a planilha copia (tabulação) com cabeçalho em qualquer ordem", () => {
    const texto =
      "preço\tproduto\tetapa\n1500,00\tGestão de tráfego\tprincipal\n\t Diagnóstico \tisca\n";
    const lida = linhasDeMatriz(matrizDoTexto(texto));
    expect(lida.temCabecalho).toBe(true);
    expect(lida.linhas).toEqual([
      { preco: "1500,00", nome: "Gestão de tráfego", etapa: "principal" },
      { preco: "", nome: "Diagnóstico", etapa: "isca" },
    ]);
  });

  it("sem cabeçalho vale a ordem do modelo", () => {
    const lida = linhasDeMatriz(matrizDoTexto("Corte\tCorte masculino\tprincipal\tunico\t50\n"));
    expect(lida.temCabecalho).toBe(false);
    expect(lida.linhas[0]).toMatchObject({
      nome: "Corte",
      resumo: "Corte masculino",
      etapa: "principal",
      tipo_de_preco: "unico",
      preco: "50",
    });
  });

  it("vírgula dentro do texto não quebra a coluna quando há tabulação", () => {
    const lida = linhasDeMatriz(
      matrizDoTexto("nome\tresumo\nPlano\tcriativos, relatório e reunião\n"),
    );
    expect(lida.linhas[0]?.resumo).toBe("criativos, relatório e reunião");
  });

  it("diz a situação de cada linha: pronta, aviso, erro, já existe e repetida", () => {
    const linhas = [
      { nome: "Gestão de tráfego", preco: "1500", tipo_de_preco: "mensal" },
      { nome: "Consultoria", tipo_de_preco: "unico" },
      { nome: "Mentoria", etapa: "VIP" },
      { nome: "Diagnóstico gratuito" },
      {},
      { nome: "gestao de trafego" },
      { nome: "Site", preco: "2000" },
    ];
    const s = situacoesDasLinhas(linhas, ["Diagnóstico Gratuito"]);
    expect(s.map((x) => x?.tom ?? null)).toEqual(["ok", "aviso", "erro", "dup", null, "dup", "ok"]);
    expect(s[0]?.texto).toContain("R$");
    expect(s[3]?.texto).toMatch(/já existe/i);
    expect(s[5]?.texto).toMatch(/repetida/i);
    expect(s.filter((x) => x?.importavel)).toHaveLength(3);
  });

  it("só o que a situação deixa passar é o que a rota aceitaria", () => {
    const linhas = [
      { nome: "A", preco: "10" },
      { nome: "B", etapa: "xyz" },
    ];
    const s = situacoesDasLinhas(linhas, []);
    linhas.forEach((l, i) => {
      expect(s[i]?.importavel).toBe(ofertaDaLinha(l, () => "x").ok);
    });
  });
});

describe("copiar produtos como texto", () => {
  it("o texto copiado cola de volta na planilha e dá a mesma oferta", () => {
    const base = ofertaDaLinha(
      {
        nome: "Gestão de tráfego",
        resumo: "Anúncios com\nrelatório",
        etapa: "principal",
        tipo_de_preco: "setup + mensal",
        preco: "1500,00",
        setup: "500,00",
        carro_chefe: "sim",
        inclui: "Criativos|Relatório mensal",
        para_quem: "Clínicas",
        prazo: "3 meses",
        condicoes: "Pix\tou cartão",
      },
      () => "x",
    );
    if (!base.ok) throw new Error(base.erro);
    const texto = textoDeProdutos([{ titulo: base.titulo, oferta: base.oferta }]);
    const lida = lerPlanilha(texto);
    expect(lida.erro).toBeNull();
    expect(lida.ignoradas).toEqual([]);
    const volta = ofertaDaLinha(lida.linhas[0]!, () => "x");
    if (!volta.ok) throw new Error(volta.erro);
    expect(volta.titulo).toBe(base.titulo);
    expect(volta.oferta).toMatchObject({
      etapa: "principal",
      carroChefe: true,
      inclui: ["Criativos", "Relatório mensal"],
      preco: {
        tipo: "setup-mensal",
        valor: base.oferta.preco.valor,
        setup: base.oferta.preco.setup,
      },
    });
    // tabulação e quebra de linha dentro do campo viram espaço: não quebram a linha da planilha
    expect(texto.split("\n").filter(Boolean)).toHaveLength(2);
  });
});

describe("nome da cópia", () => {
  it("numera as cópias sem repetir nome (sem distinguir caixa e acento)", () => {
    const emUso = new Set(["gestao", "gestao (copia)"]);
    expect(nomeDaCopia("Gestão", emUso)).toBe("Gestão (cópia 2)");
    expect(nomeDaCopia("Gestão (cópia)", new Set())).toBe("Gestão (cópia)");
    expect(nomeDaCopia("Outro", emUso)).toBe("Outro (cópia)");
  });
});
