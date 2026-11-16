import { describe, expect, it } from "vitest";

import { colunasQueFaltam, moverColuna, mostrarColuna, ocultarColuna } from "./ordem-das-colunas";

describe("ordem das colunas", () => {
  const ids = ["titulo", "telefone", "email", "data_entrada"];

  it("soltar uma coluna no lugar de outra move para a frente ou para trás", () => {
    expect(moverColuna(ids, "email", "titulo")).toEqual([
      "email",
      "titulo",
      "telefone",
      "data_entrada",
    ]);
    expect(moverColuna(ids, "titulo", "data_entrada")).toEqual([
      "telefone",
      "email",
      "data_entrada",
      "titulo",
    ]);
    expect(moverColuna(ids, "telefone", "email")).toEqual([
      "titulo",
      "email",
      "telefone",
      "data_entrada",
    ]);
  });

  it("id desconhecido ou o mesmo não muda nada (e não altera a lista original)", () => {
    expect(moverColuna(ids, "x", "titulo")).toEqual(ids);
    expect(moverColuna(ids, "email", "email")).toEqual(ids);
    expect(ids).toEqual(["titulo", "telefone", "email", "data_entrada"]);
  });

  it("mostrar põe no fim (sem repetir) e ocultar tira qualquer uma, até o nome", () => {
    expect(mostrarColuna(ids, "origem")).toEqual([...ids, "origem"]);
    expect(mostrarColuna(ids, "email")).toEqual(ids);
    expect(ocultarColuna(ids, "titulo")).toEqual(["telefone", "email", "data_entrada"]);
    expect(ocultarColuna(["titulo"], "titulo")).toEqual([]);
  });

  it("diz o que falta para importar", () => {
    expect(colunasQueFaltam(ids)).toEqual({ nome: false, contato: false });
    expect(colunasQueFaltam(["telefone"])).toEqual({ nome: true, contato: false });
    expect(colunasQueFaltam(["titulo", "origem"])).toEqual({ nome: false, contato: true });
  });
});
