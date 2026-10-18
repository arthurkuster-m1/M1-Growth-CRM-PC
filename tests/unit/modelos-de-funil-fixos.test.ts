import { describe, expect, it } from "vitest";

import { slugDeNome } from "@/lib/leads/stage-editing";
import { criarFunilDaCampanhaSchema, etapaDoModeloSchema } from "@/lib/marketing/modelos-de-funil";
import {
  MODELOS_DE_FUNIL_FIXOS,
  idDoModeloFixo,
  modeloFixoDoId,
} from "@/lib/marketing/modelos-de-funil-fixos";

describe("modelos de funil fixos", () => {
  it("são os três combinados, na ordem", () => {
    expect(MODELOS_DE_FUNIL_FIXOS.map((m) => m.chave)).toEqual([
      "trafego-pago-com-reuniao",
      "trafego-pago-sem-reuniao",
      "prospeccao-ativa",
    ]);
  });

  it.each(MODELOS_DE_FUNIL_FIXOS.map((m) => [m.chave, m] as const))(
    "%s obedece às regras de funil do CRM",
    (_chave, m) => {
      for (const e of m.stages) expect(etapaDoModeloSchema.safeParse(e).success, e.name).toBe(true);
      // Uma etapa de ganho e uma de perda (o banco só aceita uma de cada por funil).
      expect(m.stages.filter((e) => e.is_won)).toHaveLength(1);
      expect(m.stages.filter((e) => e.is_lost)).toHaveLength(1);
      // Nome único e slug válido para cada etapa (como a rota os gera).
      const slugs: string[] = [];
      for (const e of m.stages) {
        const slug = slugDeNome(e.name, slugs);
        expect(slug, e.name).toMatch(/^[a-z0-9_-]{2,40}$/);
        slugs.push(slug);
      }
      expect(new Set(m.stages.map((e) => e.name)).size).toBe(m.stages.length);
      // Tem onde o lead vira MQL e onde se desqualifica, e ganho/perda não carregam qualificação.
      expect(m.stages.filter((e) => e.qualification === "mql")).toHaveLength(1);
      expect(m.stages.filter((e) => e.qualification === "disqualified")).toHaveLength(1);
      for (const e of m.stages.filter((x) => x.is_won || x.is_lost)) {
        expect(e.qualification).toBeNull();
      }
    },
  );

  it("o tráfego com reunião passa por agendamento e reunião; o sem reunião, não", () => {
    const nomes = (chave: string) =>
      MODELOS_DE_FUNIL_FIXOS.find((m) => m.chave === chave)!.stages.map((e) => e.name);
    expect(nomes("trafego-pago-com-reuniao")).toEqual(
      expect.arrayContaining(["Novo lead", "Reunião agendada", "Reunião realizada", "Comprou"]),
    );
    expect(nomes("trafego-pago-sem-reuniao").join("|")).not.toMatch(/Reunião/);
    expect(nomes("prospeccao-ativa")).toEqual(
      expect.arrayContaining(["Primeiro contato", "Contato com o decisor"]),
    );
  });

  it("o id da API é `fixo:<chave>` e a rota o aceita ao lado dos uuids", () => {
    const id = idDoModeloFixo("prospeccao-ativa");
    expect(id).toBe("fixo:prospeccao-ativa");
    expect(modeloFixoDoId(id)?.nome).toBe("Prospecção ativa");
    expect(modeloFixoDoId("fixo:nao-existe")).toBeUndefined();
    expect(modeloFixoDoId("c0a8012e-3f1b-4c5e-9d7a-1b2c3d4e5f60")).toBeUndefined();
    expect(criarFunilDaCampanhaSchema.safeParse({ template_id: id }).success).toBe(true);
    expect(
      criarFunilDaCampanhaSchema.safeParse({ template_id: "c0a8012e-3f1b-4c5e-9d7a-1b2c3d4e5f60" })
        .success,
    ).toBe(true);
    expect(criarFunilDaCampanhaSchema.safeParse({ template_id: "fixo:../x" }).success).toBe(false);
    expect(criarFunilDaCampanhaSchema.safeParse({}).success).toBe(true);
  });
});
