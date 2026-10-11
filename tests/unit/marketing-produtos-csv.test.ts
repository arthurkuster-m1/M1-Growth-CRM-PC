import { describe, expect, it } from "vitest";

import { campos, lerPlanilha, modeloDaPlanilha, ofertaDaLinha } from "@/lib/marketing/produtos-csv";

let n = 0;
const id = () => `b${++n}`;

describe("planilha de produtos", () => {
  it("lê CSV com ; aspas, BOM e quebra de linha do Windows", () => {
    const t = '﻿nome;resumo\r\n"Plano; Ouro";"diz ""oi"""\r\nBásico;simples\r\n';
    expect(campos(t)).toEqual([
      ["nome", "resumo"],
      ["Plano; Ouro", 'diz "oi"'],
      ["Básico", "simples"],
    ]);
  });

  it("aceita vírgula e entende apelidos de coluna sem acento", () => {
    const r = lerPlanilha("Produto,Descrição,Valor,Coluna Estranha\nCorte,Corte masculino,50,x\n");
    expect(r.erro).toBeNull();
    expect(r.ignoradas).toEqual(["Coluna Estranha"]);
    expect(r.linhas[0]).toMatchObject({ nome: "Corte", resumo: "Corte masculino", preco: "50" });
  });

  it("recusa planilha sem a coluna do nome", () => {
    expect(lerPlanilha("a;b\n1;2\n").erro).toBe("sem_nome");
    expect(lerPlanilha("").erro).toBe("vazia");
  });

  it("monta a oferta simples com preço formatado e padrões", () => {
    const r = ofertaDaLinha(
      {
        nome: "Gestão",
        etapa: "Recorrência",
        tipo_de_preco: "Setup + mensal",
        preco: "1.500,00",
        setup: "500",
        carro_chefe: "Sim",
        inclui: "A|B",
      },
      id,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.oferta).toMatchObject({
      nivel: "simples",
      etapa: "recorrencia",
      carroChefe: true,
      inclui: ["A", "B"],
    });
    expect(r.oferta.preco.tipo).toBe("setup-mensal");
    expect(r.oferta.preco.valor.replace(/\s/g, " ")).toBe("R$ 1.500,00");
    expect(r.oferta.preco.setup.replace(/\s/g, " ")).toBe("R$ 500,00");
  });

  it("sem tipo de preço: deduz; sem preço vira sob consulta", () => {
    const a = ofertaDaLinha({ nome: "X", preco: "10" }, id);
    const b = ofertaDaLinha({ nome: "Y" }, id);
    expect(a.ok && a.oferta.preco.tipo).toBe("unico");
    expect(b.ok && b.oferta.preco.tipo).toBe("sob-consulta");
    expect(b.ok && b.oferta.etapa).toBe("principal");
  });

  it("diz o que corrigir", () => {
    expect(ofertaDaLinha({ nome: "" }, id)).toMatchObject({ ok: false, erro: "Falta o nome." });
    expect(ofertaDaLinha({ nome: "X", etapa: "luxo" }, id)).toMatchObject({ ok: false });
    expect(ofertaDaLinha({ nome: "X", preco: "caro" }, id)).toMatchObject({ ok: false });
    expect(ofertaDaLinha({ nome: "X", carro_chefe: "talvez" }, id)).toMatchObject({ ok: false });
  });

  it("o modelo para baixar é lido de volta sem erro", () => {
    const r = lerPlanilha(modeloDaPlanilha());
    expect(r.erro).toBeNull();
    expect(r.ignoradas).toEqual([]);
    expect(r.linhas).toHaveLength(2);
    for (const l of r.linhas) expect(ofertaDaLinha(l, id).ok).toBe(true);
  });
});
