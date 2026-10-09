import { describe, expect, it } from "vitest";

import {
  agrupar,
  aplicarConsulta,
  consultaAtiva,
  consultaSchema,
  filtrar,
  ordenar,
  valoresDeNascimento,
  type CampoConsultavel,
} from "@/lib/motor/consulta";
import { preferenciasDaTabelaSchema } from "@/lib/motor/layout";

interface Linha {
  id: string;
  titulo: string;
  status: string | null;
  prazo: string | null;
  quem: string | null;
  feita: boolean;
  nota: number | null;
  tags: string[];
}

const L = (id: string, resto: Partial<Linha> = {}): Linha => ({
  id,
  titulo: id,
  status: null,
  prazo: null,
  quem: null,
  feita: false,
  nota: null,
  tags: [],
  ...resto,
});

const ORDEM_STATUS = ["fazer", "andando", "feito"];
const campos: CampoConsultavel<Linha>[] = [
  { id: "titulo", tipo: "texto", valorDe: (l) => l.titulo },
  {
    id: "status",
    tipo: "opcao",
    valorDe: (l) => l.status,
    ordemDoValor: (v) => ORDEM_STATUS.indexOf(v),
    rotuloDoValor: (v) => v.toUpperCase(),
  },
  { id: "prazo", tipo: "data", valorDe: (l) => l.prazo },
  {
    id: "quem",
    tipo: "pessoa",
    valorDe: (l) => l.quem,
    rotuloDoValor: (v) => ({ u1: "Zeca", u2: "Ana" })[v] ?? v,
  },
  { id: "feita", tipo: "caixa", valorDe: (l) => l.feita },
  { id: "nota", tipo: "numero", valorDe: (l) => l.nota },
  { id: "tags", tipo: "multi", valorDe: (l) => l.tags },
];
const contexto = { hoje: "2026-10-08" };
const ids = (ls: readonly Linha[]) => ls.map((l) => l.id);

describe("filtros", () => {
  it("texto: contém sem ligar para caixa nem acento", () => {
    const ls = [L("Reunião"), L("outra"), L("REUNIAO final")];
    const r = filtrar(
      ls,
      campos,
      [{ campo: "titulo", operador: "contem", valor: "reuniao" }],
      contexto,
    );
    expect(ids(r)).toEqual(["Reunião", "REUNIAO final"]);
    const n = filtrar(
      ls,
      campos,
      [{ campo: "titulo", operador: "nao_contem", valor: "reuniao" }],
      contexto,
    );
    expect(ids(n)).toEqual(["outra"]);
  });

  it("opção e pessoa: 'é' e 'não é' — e 'não é' inclui quem não tem valor", () => {
    const ls = [L("a", { status: "fazer" }), L("b", { status: "feito" }), L("c")];
    expect(
      ids(filtrar(ls, campos, [{ campo: "status", operador: "e", valor: ["fazer"] }], contexto)),
    ).toEqual(["a"]);
    expect(
      ids(
        filtrar(ls, campos, [{ campo: "status", operador: "nao_e", valor: ["fazer"] }], contexto),
      ),
    ).toEqual(["b", "c"]);
  });

  it("vazio e preenchido", () => {
    const ls = [L("a", { prazo: "2026-10-01" }), L("b"), L("c", { tags: [] })];
    expect(ids(filtrar(ls, campos, [{ campo: "prazo", operador: "vazio" }], contexto))).toEqual([
      "b",
      "c",
    ]);
    expect(
      ids(filtrar(ls, campos, [{ campo: "prazo", operador: "preenchido" }], contexto)),
    ).toEqual(["a"]);
    expect(ids(filtrar(ls, campos, [{ campo: "tags", operador: "vazio" }], contexto))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("data: antes, depois, o próprio dia, e 'hoje' vem do fuso da organização", () => {
    const ls = [
      L("ontem", { prazo: "2026-10-07" }),
      L("hoje", { prazo: "2026-10-08" }),
      L("amanha", { prazo: "2026-10-09" }),
      L("sem"),
    ];
    const f = (operador: "antes" | "depois" | "e", valor: string) =>
      ids(filtrar(ls, campos, [{ campo: "prazo", operador, valor }], contexto));
    expect(f("antes", "hoje")).toEqual(["ontem"]);
    expect(f("depois", "hoje")).toEqual(["amanha"]);
    expect(f("e", "hoje")).toEqual(["hoje"]);
    expect(f("antes", "2026-10-09")).toEqual(["ontem", "hoje"]);
  });

  it("número e caixa", () => {
    const ls = [L("a", { nota: 3 }), L("b", { nota: 10 }), L("c", { feita: true })];
    expect(
      ids(filtrar(ls, campos, [{ campo: "nota", operador: "maior", valor: 5 }], contexto)),
    ).toEqual(["b"]);
    expect(
      ids(filtrar(ls, campos, [{ campo: "nota", operador: "igual", valor: 3 }], contexto)),
    ).toEqual(["a"]);
    expect(ids(filtrar(ls, campos, [{ campo: "feita", operador: "marcado" }], contexto))).toEqual([
      "c",
    ]);
    expect(
      ids(filtrar(ls, campos, [{ campo: "feita", operador: "desmarcado" }], contexto)),
    ).toEqual(["a", "b"]);
  });

  it("seleção múltipla: contém qualquer das opções", () => {
    const ls = [L("a", { tags: ["x", "y"] }), L("b", { tags: ["z"] }), L("c")];
    expect(
      ids(
        filtrar(ls, campos, [{ campo: "tags", operador: "contem", valor: ["y", "z"] }], contexto),
      ),
    ).toEqual(["a", "b"]);
  });

  it("vários filtros valem juntos (E)", () => {
    const ls = [L("a", { status: "fazer", quem: "u1" }), L("b", { status: "fazer", quem: "u2" })];
    const r = filtrar(
      ls,
      campos,
      [
        { campo: "status", operador: "e", valor: ["fazer"] },
        { campo: "quem", operador: "e", valor: ["u2"] },
      ],
      contexto,
    );
    expect(ids(r)).toEqual(["b"]);
  });

  it("filtro inútil é ignorado: campo que sumiu, operador do tipo errado, valor faltando", () => {
    const ls = [L("a"), L("b")];
    expect(
      ids(filtrar(ls, campos, [{ campo: "apagado", operador: "e", valor: ["x"] }], contexto)),
    ).toEqual(["a", "b"]);
    expect(ids(filtrar(ls, campos, [{ campo: "titulo", operador: "marcado" }], contexto))).toEqual([
      "a",
      "b",
    ]);
    expect(ids(filtrar(ls, campos, [{ campo: "titulo", operador: "contem" }], contexto))).toEqual([
      "a",
      "b",
    ]);
    expect(
      ids(filtrar(ls, campos, [{ campo: "titulo", operador: "contem", valor: "  " }], contexto)),
    ).toEqual(["a", "b"]);
  });
});

describe("ordenação", () => {
  it("por lista fixa (status) e não por alfabeto", () => {
    const ls = [
      L("a", { status: "feito" }),
      L("b", { status: "fazer" }),
      L("c", { status: "andando" }),
    ];
    expect(ids(ordenar(ls, campos, [{ campo: "status", direcao: "asc" }]))).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(ids(ordenar(ls, campos, [{ campo: "status", direcao: "desc" }]))).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("vazios ficam no fim nas duas direções", () => {
    const ls = [L("sem"), L("a", { prazo: "2026-10-02" }), L("b", { prazo: "2026-10-01" })];
    expect(ids(ordenar(ls, campos, [{ campo: "prazo", direcao: "asc" }]))).toEqual([
      "b",
      "a",
      "sem",
    ]);
    expect(ids(ordenar(ls, campos, [{ campo: "prazo", direcao: "desc" }]))).toEqual([
      "a",
      "b",
      "sem",
    ]);
  });

  it("pessoa ordena pelo nome, não pelo id", () => {
    const ls = [L("a", { quem: "u1" }), L("b", { quem: "u2" })];
    expect(ids(ordenar(ls, campos, [{ campo: "quem", direcao: "asc" }]))).toEqual(["b", "a"]);
  });

  it("número ordena como número", () => {
    const ls = [L("a", { nota: 10 }), L("b", { nota: 9 })];
    expect(ids(ordenar(ls, campos, [{ campo: "nota", direcao: "asc" }]))).toEqual(["b", "a"]);
  });

  it("é estável e aceita desempate por uma segunda chave", () => {
    const ls = [
      L("a", { status: "fazer", prazo: "2026-10-05" }),
      L("b", { status: "fazer", prazo: "2026-10-01" }),
      L("c", { status: "fazer", prazo: "2026-10-01" }),
    ];
    expect(ids(ordenar(ls, campos, [{ campo: "status", direcao: "asc" }]))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(
      ids(
        ordenar(ls, campos, [
          { campo: "status", direcao: "asc" },
          { campo: "prazo", direcao: "asc" },
        ]),
      ),
    ).toEqual(["b", "c", "a"]);
  });

  it("não mexe na lista de entrada e ignora campo que sumiu", () => {
    const ls = [L("b"), L("a")];
    const r = ordenar(ls, campos, [{ campo: "apagado", direcao: "asc" }]);
    expect(ids(r)).toEqual(["b", "a"]);
    expect(r).not.toBe(ls);
  });
});

describe("agrupamento", () => {
  it("segue a ordem da lista fixa e deixa 'sem valor' por último", () => {
    const ls = [
      L("a", { status: "feito" }),
      L("b"),
      L("c", { status: "fazer" }),
      L("d", { status: "feito" }),
    ];
    const g = agrupar(
      ls,
      campos.find((c) => c.id === "status"),
    )!;
    expect(g.map((x) => x.chave)).toEqual(["fazer", "feito", ""]);
    expect(ids(g[1]!.linhas)).toEqual(["a", "d"]);
    expect(g[0]!.rotulo).toBe("FAZER");
  });

  it("caixa vira dois grupos; campo inexistente devolve null", () => {
    const g = agrupar(
      [L("a", { feita: true }), L("b")],
      campos.find((c) => c.id === "feita"),
    )!;
    expect(g.map((x) => x.chave).sort()).toEqual(["0", "1"]);
    expect(agrupar([L("a")], undefined)).toBeNull();
  });

  it("agrupa por QUALQUER tipo, como o filtro: texto, data, número e várias tags", () => {
    const ls = [
      L("a", { titulo: "Beta", prazo: "2026-10-09", nota: 10, tags: ["x", "y"] }),
      L("b", { titulo: "Alfa", prazo: "2026-10-02", nota: 2, tags: ["y"] }),
      L("c", { titulo: "Beta", nota: 2 }),
    ];
    const por = (id: string) =>
      agrupar(
        ls,
        campos.find((c) => c.id === id),
      )!;
    // texto: por valor, em ordem alfabética
    expect(por("titulo").map((x) => x.chave)).toEqual(["Alfa", "Beta"]);
    // data: cronológica, "sem valor" por último
    expect(por("prazo").map((x) => x.chave)).toEqual(["2026-10-02", "2026-10-09", ""]);
    // número: numérica (2 antes de 10), e não por texto ("10" < "2")
    expect(por("nota").map((x) => x.chave)).toEqual(["2", "10"]);
    // várias tags: a linha entra em UM grupo por tag; sem tag, "sem valor"
    const tags = por("tags");
    expect(tags.map((x) => x.chave)).toEqual(["x", "y", ""]);
    expect(ids(tags[1]!.linhas)).toEqual(["a", "b"]);
    expect(ids(tags[2]!.linhas)).toEqual(["c"]);
  });
});

describe("pipeline completo", () => {
  it("filtra, ordena e agrupa; a lista plana segue a ordem dos grupos", () => {
    const ls = [
      L("a", { status: "feito", prazo: "2026-10-03" }),
      L("b", { status: "fazer", prazo: "2026-10-02" }),
      L("c", { status: "feito", prazo: "2026-10-01" }),
      L("d", { status: "fazer", titulo: "ignorar" }),
    ];
    const r = aplicarConsulta(
      ls,
      campos,
      {
        filtros: [{ campo: "prazo", operador: "preenchido" }],
        ordenacao: [{ campo: "prazo", direcao: "asc" }],
        agrupar: "status",
      },
      contexto,
    );
    expect(ids(r.linhas)).toEqual(["b", "c", "a"]);
    expect(r.grupos?.map((g) => g.chave)).toEqual(["fazer", "feito"]);
  });

  it("consulta vazia devolve tudo, na ordem manual, sem grupos", () => {
    const ls = [L("b"), L("a")];
    const r = aplicarConsulta(ls, campos, undefined, contexto);
    expect(ids(r.linhas)).toEqual(["b", "a"]);
    expect(r.grupos).toBeNull();
  });

  it("agrupar por campo inexistente é ignorado", () => {
    const r = aplicarConsulta([L("a")], campos, { agrupar: "apagado" }, contexto);
    expect(r.grupos).toBeNull();
  });
});

describe("a consulta guardada", () => {
  it("consultaAtiva só é verdadeira quando algo foi pedido", () => {
    expect(consultaAtiva(undefined)).toBe(false);
    expect(consultaAtiva({})).toBe(false);
    expect(consultaAtiva({ filtros: [] })).toBe(false);
    expect(consultaAtiva({ agrupar: "status" })).toBe(true);
    expect(consultaAtiva({ ordenacao: [{ campo: "x", direcao: "asc" }] })).toBe(true);
  });

  it("a validação recusa campo desconhecido, operador inventado e lista grande demais", () => {
    expect(
      consultaSchema.safeParse({ filtros: [{ campo: "a", operador: "e", extra: 1 }] }).success,
    ).toBe(false);
    expect(
      consultaSchema.safeParse({ filtros: [{ campo: "a", operador: "parecido" }] }).success,
    ).toBe(false);
    expect(consultaSchema.safeParse({ ordenacao: [{ campo: "a", direcao: "cima" }] }).success).toBe(
      false,
    );
    expect(consultaSchema.safeParse({ outra: 1 }).success).toBe(false);
    const muitos = Array.from({ length: 21 }, () => ({ campo: "a", operador: "vazio" }));
    expect(consultaSchema.safeParse({ filtros: muitos }).success).toBe(false);
  });

  it("o layout guardado aceita colunas e consulta juntas — e continua estrito", () => {
    const ok = preferenciasDaTabelaSchema.safeParse({
      ordem: ["a"],
      larguras: { a: 120 },
      filtros: [{ campo: "status", operador: "e", valor: ["x"] }],
      ordenacao: [{ campo: "prazo", direcao: "desc" }],
      agrupar: "status",
    });
    expect(ok.success).toBe(true);
    expect(preferenciasDaTabelaSchema.safeParse({ intruso: true }).success).toBe(false);
  });
});

describe("valoresDeNascimento — a linha nova herda os filtros", () => {
  it("opção/pessoa 'é', caixa, data 'hoje', número e multi viram valores", () => {
    const v = valoresDeNascimento(
      [
        { campo: "status", operador: "e", valor: "andando" },
        { campo: "quem", operador: "e", valor: ["u1", "u2"] },
        { campo: "feita", operador: "marcado" },
        { campo: "prazo", operador: "e", valor: "hoje" },
        { campo: "nota", operador: "igual", valor: 7 },
        { campo: "tags", operador: "contem", valor: ["a", "b"] },
      ],
      campos,
      contexto,
    );
    expect(v).toEqual({
      status: "andando",
      quem: "u1",
      feita: true,
      prazo: "2026-10-08",
      nota: 7,
      tags: ["a", "b"],
    });
  });

  it("ignora o que não aponta para um valor certo (não é, antes, não contém, vazio, campo apagado)", () => {
    const v = valoresDeNascimento(
      [
        { campo: "status", operador: "nao_e", valor: "feito" },
        { campo: "prazo", operador: "antes", valor: "2026-10-01" },
        { campo: "titulo", operador: "nao_contem", valor: "x" },
        { campo: "quem", operador: "vazio" },
        { campo: "sumiu", operador: "e", valor: "z" },
        { campo: "status", operador: "e", valor: "" },
      ],
      campos,
      contexto,
    );
    expect(v).toEqual({});
  });

  it("dois filtros no mesmo campo: o último vence", () => {
    const v = valoresDeNascimento(
      [
        { campo: "status", operador: "e", valor: "fazer" },
        { campo: "status", operador: "e", valor: "feito" },
      ],
      campos,
      contexto,
    );
    expect(v).toEqual({ status: "feito" });
  });
});

describe("valoresDeNascimento — texto", () => {
  it("'título contém teste' faz a linha nascer com o texto 'teste'", () => {
    const v = valoresDeNascimento(
      [{ campo: "titulo", operador: "contem", valor: "  teste " }],
      campos,
      contexto,
    );
    expect(v).toEqual({ titulo: "teste" });
  });
});
