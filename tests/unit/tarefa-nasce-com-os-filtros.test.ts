/**
 * A TAREFA NOVA NASCE PASSANDO NOS FILTROS — de TODAS as propriedades.
 *
 * O defeito que este arquivo cerca: com um filtro ligado ("Prazo é hoje", "Nome contém
 * teste", "Início é hoje"…), criar uma tarefa produzia uma linha SEM o valor do filtro, e
 * ela sumia da tela no instante em que nascia — várias tarefas "criadas" que ninguém via.
 *
 * Em vez de testar uma propriedade por vez (e esquecer a próxima), o teste percorre a
 * MATRIZ: cada campo (de fábrica e personalizado, de todos os tipos) × cada condição que
 * aponta para um valor × valores de verdade. Para cada combinação, monta a tarefa que nasce
 * (`valoresDeNascimento` → `tarefaQueNasce`) e exige que ela passe no MESMO filtro.
 * Propriedade nova em `metasDaTarefa` entra na matriz sozinha.
 */
import { describe, expect, it } from "vitest";

import {
  OPERADORES_DO_TIPO,
  filtrar,
  valoresDeNascimento,
  type CampoConsultavel,
  type Filtro,
  type TipoDeCampo,
} from "@/lib/motor/consulta";
import { metasDaTarefa } from "@/lib/tarefas/campos-da-tarefa";
import { tarefaQueNasce } from "@/lib/tarefas/nascer-com-filtros";
import type { OpcaoDeStatus } from "@/lib/tarefas/opcoes-de-status";
import type { PropriedadeDaTarefa } from "@/lib/tarefas/propriedades";
import type { Tarefa } from "@/lib/tarefas/tipos";

const FUSO = "America/Sao_Paulo";
const HOJE = "2026-10-09";
const ORG = "00000000-0000-4000-8000-000000000001";
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

const opcao = (
  id: string,
  name: string,
  grupo: OpcaoDeStatus["grupo"],
  position: number,
): OpcaoDeStatus => ({
  id,
  organization_id: ORG,
  name,
  color: "gray",
  grupo,
  position,
});
const OPCOES = [
  opcao("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Não iniciada", "pending", 1),
  opcao("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Em andamento", "in_progress", 2),
  opcao("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "Concluída", "done", 3),
];

const prop = (
  id: string,
  type: PropriedadeDaTarefa["type"],
  options: PropriedadeDaTarefa["options"] = [],
): PropriedadeDaTarefa => ({
  id,
  organization_id: ORG,
  name: `Prop ${type}`,
  type,
  options,
  position: 1,
});
const PROPS: PropriedadeDaTarefa[] = [
  prop("p-texto", "text"),
  prop("p-numero", "number"),
  prop("p-sel", "select", [
    { id: "o1", name: "Um", color: "blue" },
    { id: "o2", name: "Dois", color: "red" },
  ]),
  prop("p-multi", "multi_select", [
    { id: "m1", name: "A", color: "blue" },
    { id: "m2", name: "B", color: "red" },
  ]),
  prop("p-data", "date"),
  prop("p-caixa", "checkbox"),
];

const metas = metasDaTarefa({
  t: (x) => x,
  opcoes: OPCOES,
  prioridades: [
    { id: "low", rotulo: "Baixa", cor: "gray" },
    { id: "medium", rotulo: "Média", cor: "blue" },
    { id: "high", rotulo: "Alta", cor: "orange" },
    { id: "urgent", rotulo: "Urgente", cor: "red" },
  ],
  membros: [
    { id: U1, nome: "Ana" },
    { id: U2, nome: "Beto" },
  ],
  propriedades: PROPS,
  fuso: FUSO,
});
const campos: CampoConsultavel<Tarefa>[] = metas.map((m) => ({
  id: m.id,
  tipo: m.tipo,
  valorDe: m.valorDe,
}));
const contexto = { hoje: HOJE };

/** Os campos que NÃO se podem preencher na criação. */
const NAO_NASCEM = new Set(["criada"]);

/** Valores de verdade para cada tipo (o que a pessoa escolheria na barra de filtros). */
function valoresDe(meta: (typeof metas)[number]): Filtro["valor"][] {
  switch (meta.tipo) {
    case "texto":
      return ["teste", "  Revisão  "];
    case "numero":
      return [7, 0, -3];
    case "data":
      return ["hoje", "2026-10-15", "2026-03-01"];
    case "caixa":
      return [undefined];
    case "opcao":
    case "pessoa":
    case "multi":
      return (meta.opcoes ?? []).map((o) => [o.id]);
  }
}

/** As condições que apontam para um valor (as outras — "não é", "vazio"… — deixam o campo vazio). */
const CONDICOES_QUE_NASCEM: Record<TipoDeCampo, string[]> = {
  texto: ["contem"],
  opcao: ["e"],
  pessoa: ["e"],
  multi: ["contem"],
  data: ["e", "antes", "depois"],
  numero: ["igual", "maior", "menor"],
  caixa: ["marcado", "desmarcado"],
};

/** A tarefa como o servidor a devolveria depois de criada com o que `tarefaQueNasce` montou. */
function linhaCriada(filtros: Filtro[], dia?: string): Tarefa {
  const herdados = valoresDeNascimento(filtros, campos, contexto);
  const { tarefa, personalizados } = tarefaQueNasce(herdados, {
    opcoes: OPCOES,
    propriedades: PROPS,
    fuso: FUSO,
    tituloPadrao: "Sem título",
    dia,
  });
  return {
    id: "nova",
    organization_id: ORG,
    title: tarefa.title,
    description: tarefa.description ?? null,
    due_date: tarefa.due_date ?? null,
    start_date: tarefa.start_date ?? null,
    priority: tarefa.priority ?? "medium",
    // O trigger do banco (0582) faz o `status` acompanhar o grupo da opção escolhida.
    status: OPCOES.find((o) => o.id === tarefa.status_option_id)?.grupo ?? "pending",
    lead_id: null,
    contact_id: null,
    assigned_to: tarefa.assigned_to ?? null,
    created_by: null,
    created_at: "2026-10-09T12:00:00Z",
    updated_at: "2026-10-09T12:00:00Z",
    status_option_id: tarefa.status_option_id ?? null,
    position: 1,
    custom_fields: personalizados,
  };
}

describe("a tarefa nova passa no filtro que a criou — todas as propriedades", () => {
  for (const meta of metas.filter((m) => !NAO_NASCEM.has(m.id))) {
    for (const operador of CONDICOES_QUE_NASCEM[meta.tipo]) {
      // Só as condições que o tipo realmente oferece.
      if (!(OPERADORES_DO_TIPO[meta.tipo] as readonly string[]).includes(operador)) continue;
      for (const valor of valoresDe(meta)) {
        const rotuloDoValor = JSON.stringify(valor);
        it(`${meta.id} (${meta.tipo}) ${operador} ${rotuloDoValor}`, () => {
          const filtro = {
            campo: meta.id,
            operador,
            ...(valor !== undefined ? { valor } : {}),
          } as Filtro;
          const linha = linhaCriada([filtro]);
          expect(
            filtrar([linha], campos, [filtro], contexto),
            "a tarefa nasceu e sumiu da tela: ela não passa no filtro que a criou",
          ).toHaveLength(1);
        });
      }
    }
  }
});

describe("filtros combinados e casos de borda", () => {
  const f = (campo: string, operador: string, valor?: Filtro["valor"]): Filtro =>
    ({ campo, operador, ...(valor !== undefined ? { valor } : {}) }) as Filtro;

  it("vários filtros ao mesmo tempo: todos valem na tarefa que nasce", () => {
    const filtros = [
      f("prazo", "e", "hoje"),
      f("inicio", "e", "hoje"),
      f("titulo", "contem", "teste"),
      f("prioridade", "e", ["high"]),
      f("responsavel", "e", [U1]),
      f("status", "e", [OPCOES[1]!.id]),
      f("prop:p-sel", "e", ["o2"]),
      f("prop:p-caixa", "marcado"),
    ];
    const linha = linhaCriada(filtros);
    expect(linha.title).toBe("teste");
    expect(linha.priority).toBe("high");
    expect(linha.assigned_to).toBe(U1);
    expect(linha.status_option_id).toBe(OPCOES[1]!.id);
    expect(linha.due_date).toBe("2026-10-09T03:00:00.000Z");
    expect(linha.start_date).toBe("2026-10-09T03:00:00.000Z");
    expect(linha.custom_fields).toMatchObject({ "p-sel": "o2", "p-caixa": true });
    expect(filtrar([linha], campos, filtros, contexto)).toHaveLength(1);
  });

  it("'Prazo é hoje' dá o dia de hoje no fuso da organização (meia-noite, só a data)", () => {
    expect(linhaCriada([f("prazo", "e", "hoje")]).due_date).toBe("2026-10-09T03:00:00.000Z");
  });

  it("'Prazo antes de hoje' dá ontem; 'depois de hoje' dá amanhã (a tarefa fica à vista)", () => {
    expect(linhaCriada([f("prazo", "antes", "hoje")]).due_date).toBe("2026-10-08T03:00:00.000Z");
    expect(linhaCriada([f("prazo", "depois", "hoje")]).due_date).toBe("2026-10-10T03:00:00.000Z");
  });

  it("o dia clicado no Calendário vale mais que o filtro de prazo", () => {
    expect(linhaCriada([f("prazo", "e", "hoje")], "2026-10-20").due_date).toBe(
      "2026-10-20T03:00:00.000Z",
    );
  });

  it("valor que não existe mais é descartado em vez de derrubar a criação", () => {
    const linha = linhaCriada([
      f("status", "e", ["opcao-apagada"]),
      f("prioridade", "e", ["inexistente"]),
      f("prop:p-sel", "e", ["opcao-que-sumiu"]),
    ]);
    expect(linha.status_option_id).toBeNull();
    expect(linha.priority).toBe("medium");
    expect(linha.custom_fields).toEqual({});
  });

  it("condições sem valor certo ('não é', 'não contém', 'está preenchido') deixam o campo vazio", () => {
    const linha = linhaCriada([
      f("status", "nao_e", [OPCOES[2]!.id]),
      f("titulo", "nao_contem", "x"),
      f("prazo", "preenchido"),
    ]);
    expect(linha.title).toBe("Sem título");
    expect(linha.due_date).toBeNull();
  });

  it("filtro 'ou': só o primeiro grupo diz o que a tarefa tem", () => {
    const linha = linhaCriada([
      f("prioridade", "e", ["high"]),
      { ...f("prioridade", "e", ["low"]), juncao: "ou" },
    ]);
    expect(linha.priority).toBe("high");
  });
});
