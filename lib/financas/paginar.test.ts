import { describe, expect, it } from "vitest";
import { buscarTodas } from "./paginar";

/** Servidor de mentira: no máximo 1000 linhas por pedido, como o PostgREST do Supabase. */
const servidor = (n: number) => async (de: number, ate: number) =>
  Array.from({ length: Math.min(ate, n - 1) - de + 1 }, (_, i) => de + i).filter((i) => i < n);
describe("buscarTodas", () => {
  it("traz as 1054 linhas de um ano, não só as 1000 primeiras", async () =>
    expect((await buscarTodas(servidor(1054))).length).toBe(1054));
  it("exatamente 1000 → faz um pedido a mais e termina", async () =>
    expect((await buscarTodas(servidor(1000))).length).toBe(1000));
  it("poucas linhas, vazio e 2500", async () => {
    expect((await buscarTodas(servidor(7))).length).toBe(7);
    expect((await buscarTodas(servidor(0))).length).toBe(0);
    const t = await buscarTodas(servidor(2500));
    expect(t.length).toBe(2500);
    expect(new Set(t).size).toBe(2500);
  });
});
