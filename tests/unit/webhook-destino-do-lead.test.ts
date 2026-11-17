import { describe, expect, it } from "vitest";

import { destinoDoWebhook, ehFunilAntigo } from "@/lib/webhooks/destino-do-lead";

const funil = (p: Partial<Parameters<typeof ehFunilAntigo>[0]> = {}) => ({
  is_default: false,
  is_client_pipeline: false,
  is_archived: false,
  ehDeCampanha: false,
  ...p,
});

describe("webhook: o CRM novo é o único destino", () => {
  it("o funil padrão do sistema (Pedidos) e o arquivado são o funil antigo", () => {
    expect(ehFunilAntigo(funil({ is_default: true }))).toBe(true);
    expect(ehFunilAntigo(funil({ is_archived: true }))).toBe(true);
  });

  it("funil de clientes, funil de campanha e funil montado de propósito não são o antigo", () => {
    expect(ehFunilAntigo(funil({ is_default: true, is_client_pipeline: true }))).toBe(false);
    expect(ehFunilAntigo(funil({ is_default: true, ehDeCampanha: true }))).toBe(false);
    expect(ehFunilAntigo(funil({ is_archived: true, ehDeCampanha: true }))).toBe(false);
    expect(ehFunilAntigo(funil())).toBe(false);
  });
});

/** Um banco de brinquedo: só o que `destinoDoWebhook` consulta. */
function bancoDe(dados: {
  funis: Record<string, { is_default: boolean; is_client_pipeline: boolean; is_archived: boolean }>;
  campanhas?: string[];
  etapaDoFunilDeClientes?: string | null;
}) {
  const consulta = (tabela: string) => {
    const filtros: Record<string, unknown> = {};
    const q: Record<string, unknown> = {};
    const resultado = () => {
      if (tabela === "crm_pipelines") {
        if (filtros.is_client_pipeline === true) {
          const id = Object.entries(dados.funis).find(
            ([, f]) => f.is_client_pipeline && !f.is_archived,
          )?.[0];
          return { data: id ? { id } : null };
        }
        return { data: dados.funis[String(filtros.id)] ?? null };
      }
      if (tabela === "demand_campaigns") {
        return {
          data: dados.campanhas?.includes(String(filtros.pipeline_id)) ? { id: "c" } : null,
        };
      }
      if (tabela === "crm_stages") {
        return { data: dados.etapaDoFunilDeClientes ? { id: dados.etapaDoFunilDeClientes } : null };
      }
      return { data: null };
    };
    Object.assign(q, {
      select: () => q,
      eq: (k: string, v: unknown) => ((filtros[k] = v), q),
      order: () => q,
      limit: () => q,
      maybeSingle: async () => resultado(),
    });
    return q;
  };
  return { from: consulta } as never;
}

describe("destinoDoWebhook", () => {
  const FUNIS = {
    pedidos: { is_default: true, is_client_pipeline: false, is_archived: false },
    clientes: { is_default: false, is_client_pipeline: true, is_archived: false },
    campanha: { is_default: false, is_client_pipeline: false, is_archived: false },
  };

  it("fonte no funil antigo vai para o funil de clientes, primeira etapa", async () => {
    const r = await destinoDoWebhook(
      bancoDe({ funis: FUNIS, etapaDoFunilDeClientes: "etapa-1" }),
      "org",
      { pipelineId: "pedidos", stageId: "x" },
    );
    expect(r).toEqual({ pipelineId: "clientes", stageId: "etapa-1", redirecionado: true });
  });

  it("sem funil de clientes, o lead entra onde a fonte manda (nunca se perde)", async () => {
    const r = await destinoDoWebhook(
      bancoDe({ funis: { pedidos: FUNIS.pedidos }, etapaDoFunilDeClientes: null }),
      "org",
      { pipelineId: "pedidos", stageId: "x" },
    );
    expect(r).toEqual({ pipelineId: "pedidos", stageId: "x", redirecionado: false });
  });

  it("fonte num funil de campanha ou no de clientes não é mexida", async () => {
    const banco = bancoDe({ funis: FUNIS, campanhas: ["campanha"], etapaDoFunilDeClientes: "e" });
    expect(
      await destinoDoWebhook(banco, "org", { pipelineId: "campanha", stageId: "k" }),
    ).toMatchObject({
      pipelineId: "campanha",
      redirecionado: false,
    });
    expect(
      await destinoDoWebhook(banco, "org", { pipelineId: "clientes", stageId: "k" }),
    ).toMatchObject({
      pipelineId: "clientes",
      redirecionado: false,
    });
  });
});
