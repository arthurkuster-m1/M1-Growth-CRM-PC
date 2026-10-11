import { describe, expect, it } from "vitest";

import {
  fasesDoCronograma,
  itemSchema,
  numeroDaSemana,
  periodoDaSemana,
  progressoDaMeta,
  domingoDe,
  domingoDaSemana,
  inicioDaJanela,
  formatarValorDaMeta,
  numeroDoTexto,
  edicaoDeMetaSchema,
  metaSchema,
  situacaoDaTarefa,
  tarefasDaSemana,
  type ItemDoCronograma,
  type TarefaDoCronograma,
} from "@/lib/marketing/cronograma";

const item = (p: Partial<ItemDoCronograma>): ItemDoCronograma => ({
  id: "i",
  acao: "x",
  semana_inicio: 1,
  semana_fim: 1,
  status: "planejado",
  destaque: false,
  notas: "",
  fase: "",
  arquivado: false,
  ordem: 1,
  ...p,
});

const tarefa = (p: Partial<TarefaDoCronograma>): TarefaDoCronograma => ({
  id: "t",
  title: "t",
  status: "pending",
  due_date: null,
  prazo_original: null,
  adiamentos: 0,
  lado: "agencia",
  ...p,
});

describe("semanas do cronograma", () => {
  it("a semana começa no domingo", () => {
    expect(domingoDe("2026-10-14")).toBe("2026-10-11"); // quarta → domingo anterior
    expect(domingoDe("2026-10-11")).toBe("2026-10-11"); // domingo fica
    expect(domingoDe("2026-10-17")).toBe("2026-10-11"); // sábado → domingo anterior
    expect(periodoDaSemana("2026-10-11")).toBe("11/10 – 17/10");
  });

  it("numera a semana contra a data de início e recusa antes dela", () => {
    const cfg = { data_inicio: "2026-10-04" }; // um domingo
    expect(numeroDaSemana(cfg, "2026-10-04")).toBe(1);
    expect(numeroDaSemana(cfg, "2026-10-18")).toBe(3);
    expect(numeroDaSemana(cfg, "2026-09-27")).toBeNull();
    // o cronograma não termina: meses depois ainda tem número
    expect(numeroDaSemana(cfg, "2027-03-07")).toBe(23);
    expect(numeroDaSemana({ data_inicio: null }, "2026-10-04")).toBeNull();
    expect(domingoDaSemana("2026-10-04", 3)).toBe("2026-10-18");
    // uma data de início que não é domingo é lida como o domingo da sua semana
    expect(numeroDaSemana({ data_inicio: "2026-10-05" }, "2026-10-04")).toBe(1);
  });

  it("a janela da tela começa uma semana antes de hoje e nunca passa do limite", () => {
    expect(inicioDaJanela(null, 8)).toBe(1);
    expect(inicioDaJanela(1, 8)).toBe(1);
    expect(inicioDaJanela(10, 8)).toBe(9);
    expect(inicioDaJanela(520, 8)).toBe(513);
  });

  it("valida a ação: fim não vem antes do início", () => {
    expect(
      itemSchema.safeParse({ acao: "Landing page", semana_inicio: 2, semana_fim: 4 }).success,
    ).toBe(true);
    expect(itemSchema.safeParse({ acao: "x", semana_inicio: 4, semana_fim: 2 }).success).toBe(
      false,
    );
    expect(itemSchema.safeParse({ acao: " ", semana_inicio: 1, semana_fim: 1 }).success).toBe(
      false,
    );
  });
});

describe("metas e fases", () => {
  it("calcula o progresso pelos números e formata pelo tipo", () => {
    expect(progressoDaMeta({ valor_alvo: 8000, valor_atual: 2000 })).toBe(25);
    expect(progressoDaMeta({ valor_alvo: 6, valor_atual: 3 })).toBe(50);
    expect(progressoDaMeta({ valor_alvo: 8000, valor_atual: 9000 })).toBe(100);
    expect(progressoDaMeta({ valor_alvo: 8000, valor_atual: null })).toBe(0);
    expect(progressoDaMeta({ valor_alvo: null, valor_atual: 3 })).toBeNull();
    expect(progressoDaMeta({ valor_alvo: 0, valor_atual: 3 })).toBeNull();

    const brl = formatarValorDaMeta(15000, "moeda", "", "pt-BR").replace(/\s/g, " ");
    expect(brl).toBe("R$ 15.000,00");
    expect(formatarValorDaMeta(1200, "numero", "leads", "pt-BR")).toBe("1.200 leads");
    expect(formatarValorDaMeta(35.5, "percentual", "", "pt-BR")).toBe("35,5%");
    expect(formatarValorDaMeta(null, "moeda", "", "pt-BR")).toBe("—");
  });

  it("lê o que a pessoa digitou", () => {
    expect(numeroDoTexto("R$ 15.000,50")).toBe(15000.5);
    expect(numeroDoTexto("1.200 leads")).toBe(1200);
    expect(numeroDoTexto("35,5%")).toBe(35.5);
    expect(numeroDoTexto("crescer")).toBeNull();
  });

  it("editar um campo da meta não reaplica os padrões dos outros", () => {
    expect(edicaoDeMetaSchema.parse({ valor_alvo: 5 })).toEqual({ valor_alvo: 5 });
    expect(metaSchema.parse({ titulo: "Leads" })).toMatchObject({
      tipo: "numero",
      valor_alvo: null,
    });
  });

  it("deriva as fases na ordem e a situação", () => {
    const itens = [
      item({ fase: "Estruturação", semana_inicio: 1, semana_fim: 2, status: "concluido" }),
      item({ fase: "Estruturação", semana_inicio: 2, semana_fim: 3, status: "concluido" }),
      item({ fase: "Aquisição", semana_inicio: 4, semana_fim: 6, status: "andamento" }),
      item({ fase: "Escala", semana_inicio: 7, semana_fim: 8 }),
      item({ fase: "" }),
    ];
    const fases = fasesDoCronograma(itens, 5);
    expect(fases.map((f) => f.nome)).toEqual(["Estruturação", "Aquisição", "Escala"]);
    expect(fases.map((f) => f.situacao)).toEqual(["feita", "ativa", "futura"]);
    expect(fases[0]).toMatchObject({ inicio: 1, fim: 3 });
  });
});

describe("tarefas da semana", () => {
  const agora = new Date("2026-10-14T15:00:00Z"); // quarta, 12:00 em Brasília

  it("situação: feita, atrasada, em andamento, a fazer", () => {
    expect(situacaoDaTarefa(tarefa({ status: "done" }), agora)).toBe("feita");
    expect(situacaoDaTarefa(tarefa({ due_date: "2026-10-10T15:00:00Z" }), agora)).toBe("atrasada");
    expect(
      situacaoDaTarefa(tarefa({ status: "in_progress", due_date: "2026-10-20T15:00:00Z" }), agora),
    ).toBe("andamento");
    expect(situacaoDaTarefa(tarefa({ due_date: "2026-10-20T15:00:00Z" }), agora)).toBe("a_fazer");
    expect(situacaoDaTarefa(tarefa({ status: "cancelled" }), agora)).toBe("cancelada");
  });

  it("mostra só as que vencem dentro da semana; o cancelado some", () => {
    const todas = [
      tarefa({ id: "na-semana", due_date: "2026-10-15T15:00:00Z" }),
      tarefa({ id: "feita-na-semana", status: "done", due_date: "2026-10-13T15:00:00Z" }),
      tarefa({ id: "atrasada-de-antes", due_date: "2026-10-02T15:00:00Z" }),
      tarefa({ id: "cancelada", status: "cancelled", due_date: "2026-10-15T15:00:00Z" }),
      tarefa({ id: "proxima", due_date: "2026-10-22T15:00:00Z" }),
      tarefa({ id: "sem-prazo", due_date: null }),
    ];
    const ids = tarefasDaSemana(todas, "2026-10-11").map((t) => t.id);
    expect(ids.sort()).toEqual(["feita-na-semana", "na-semana"]);
  });

  it("a tarefa atrasada fica na semana do prazo e não viaja para as seguintes", () => {
    const todas = [tarefa({ id: "atrasada", due_date: "2026-10-02T15:00:00Z" })];
    expect(tarefasDaSemana(todas, "2026-09-27").map((t) => t.id)).toEqual(["atrasada"]);
    expect(tarefasDaSemana(todas, "2026-10-11")).toEqual([]);
    expect(tarefasDaSemana(todas, "2026-10-18")).toEqual([]);
  });
});
