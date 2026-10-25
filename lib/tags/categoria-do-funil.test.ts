// @vitest-environment node
import { describe, expect, it } from "vitest";

import { categoriaDaTag, corDaCategoria, lerConfigDeCategorias } from "./categorias";
import { corDoFunil, garantirCategoriaDoFunil, idDaCategoriaDoFunil } from "./categoria-do-funil";

const ORG = "o1";
const FUNIL = "5dec6b65-e781-4ddc-9ccb-d561a028b807";

function fake(settings: Record<string, unknown>) {
  let atual = settings;
  const from = () => {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.maybeSingle = async () => ({ data: { settings: atual } });
    c.update = (patch: { settings: Record<string, unknown> }) => {
      atual = patch.settings;
      return c;
    };
    c.then = (ok: (v: unknown) => void) => ok({ data: null });
    return c;
  };
  return { admin: { from } as never, settings: () => atual };
}

describe("garantirCategoriaDoFunil", () => {
  it("cria a categoria com o nome do funil e uma cor, e põe a tag nela", async () => {
    const f = fake({});
    await garantirCategoriaDoFunil(f.admin, {
      organizationId: ORG,
      pipelineId: FUNIL,
      nomeDoFunil: "[TESTE] Campanha Prospecção",
      tags: ["Abordagem: Teste - abordagem completa"],
    });
    const config = lerConfigDeCategorias(f.settings());
    const cat = categoriaDaTag("Abordagem: Teste - abordagem completa: 3x", config);
    expect(cat?.id).toBe(idDaCategoriaDoFunil(FUNIL));
    expect(cat?.nome).toBe("[TESTE] Campanha Prospecção");
    expect(corDaCategoria("Abordagem: Teste - abordagem completa", config)).toBe(corDoFunil(FUNIL));
  });

  it("é idempotente e não perde as categorias que já existiam", async () => {
    const f = fake({
      categorias_de_tags: { categorias: [{ id: "x", nome: "Minha", cor: "#3e63dd" }], tags: {} },
    });
    const entrada = {
      organizationId: ORG,
      pipelineId: FUNIL,
      nomeDoFunil: "Funil A",
      tags: ["Abordagem: A"],
    };
    await garantirCategoriaDoFunil(f.admin, entrada);
    const primeira = JSON.stringify(f.settings());
    await garantirCategoriaDoFunil(f.admin, entrada);
    expect(JSON.stringify(f.settings())).toBe(primeira);
    expect(lerConfigDeCategorias(f.settings()).categorias.map((c) => c.id)).toContain("x");
  });

  it("a cor do mesmo funil é sempre a mesma", () => {
    expect(corDoFunil(FUNIL)).toBe(corDoFunil(FUNIL));
    expect(idDaCategoriaDoFunil(FUNIL).length).toBeLessThanOrEqual(40);
  });
});
