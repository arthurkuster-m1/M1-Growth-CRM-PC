import type pg from "pg";
import { describe, expect, it, vi } from "vitest";

import { verificarWhatsappDaCampanha } from "./verificar-whatsapp";

const ORG = "o1";
const CAMP = "c1";
const SESSAO = "s1";

/** Um pool de mentira que responde pela forma do SQL e anota o que foi gravado. */
function poolFalso(opts: {
  provider?: string;
  pendentes?: Array<{ id: string; phone: string }>;
  restantes?: number;
  semCampanha?: boolean;
  semSessao?: boolean;
}) {
  const gravados: Array<{ id: string; status: string }> = [];
  const consultas: string[] = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    consultas.push(sql);
    if (sql.includes("from prospecting_campaigns"))
      return { rows: opts.semCampanha ? [] : [{ id: CAMP }] };
    if (sql.includes("from channel_sessions"))
      return {
        rows: opts.semSessao
          ? []
          : [{ provider: opts.provider ?? "waha", waha_session_name: "default" }],
      };
    if (sql.includes("count(*)")) return { rows: [{ n: String(opts.restantes ?? 0) }] };
    if (sql.includes("from prospecting_candidates")) return { rows: opts.pendentes ?? [] };
    if (sql.includes("set whatsapp_status=$3"))
      gravados.push({ id: String(params[1]), status: String(params[2]) });
    return { rows: [] };
  });
  return { pool: { query } as unknown as pg.Pool, gravados, consultas };
}

describe("verificarWhatsappDaCampanha", () => {
  it("grava tem / não tem / incerto em cada empresa e conta o que sobrou", async () => {
    const { pool, gravados } = poolFalso({
      pendentes: [
        { id: "a", phone: "+5541988887777" },
        { id: "b", phone: "+5541977776666" },
        { id: "c", phone: "+5541966665555" },
      ],
      restantes: 7,
    });
    const respostas: Record<string, "tem" | "nao" | "erro"> = {
      "5541988887777": "tem",
      "554188887777": "tem",
      "5541977776666": "nao",
      "554177776666": "nao",
      "5541966665555": "erro",
      "554166665555": "erro",
    };
    const cliente = {
      checkContactExists: vi.fn(async (_s: string, d: string) => {
        const r = respostas[d] ?? "nao";
        if (r === "erro") throw new Error("waha_503");
        return { numberExists: r === "tem" };
      }),
    };
    const esperar = vi.fn(async () => undefined);
    const r = await verificarWhatsappDaCampanha(pool, ORG, CAMP, SESSAO, { cliente, esperar });
    expect(gravados).toEqual([
      { id: "a", status: "exists" },
      { id: "b", status: "missing" },
      { id: "c", status: "unknown" },
    ]);
    expect(r).toEqual({ verificadas: 3, tem: 1, nao_tem: 1, incerto: 1, restantes: 7 });
    // Pausa entre as consultas (2 pausas para 3 empresas), nunca em rajada.
    expect(esperar).toHaveBeenCalledTimes(2);
  });

  it("recusa conexão que não é WAHA, conexão de outra organização e campanha inexistente", async () => {
    const cliente = { checkContactExists: vi.fn() };
    await expect(
      verificarWhatsappDaCampanha(poolFalso({ provider: "meta_cloud" }).pool, ORG, CAMP, SESSAO, {
        cliente,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      verificarWhatsappDaCampanha(poolFalso({ semSessao: true }).pool, ORG, CAMP, SESSAO, {
        cliente,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      verificarWhatsappDaCampanha(poolFalso({ semCampanha: true }).pool, ORG, CAMP, SESSAO, {
        cliente,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(cliente.checkContactExists).not.toHaveBeenCalled();
  });

  it("sem o serviço de WhatsApp configurado, avisa em vez de marcar todo mundo como 'sem WhatsApp'", async () => {
    const { pool, gravados } = poolFalso({ pendentes: [{ id: "a", phone: "+5541988887777" }] });
    await expect(
      verificarWhatsappDaCampanha(pool, ORG, CAMP, SESSAO, { cliente: null }),
    ).rejects.toMatchObject({ status: 503 });
    expect(gravados).toHaveLength(0);
  });

  it("'refazer incertas' devolve as incertas à fila antes de começar", async () => {
    const { pool, consultas } = poolFalso({ pendentes: [] });
    await verificarWhatsappDaCampanha(pool, ORG, CAMP, SESSAO, {
      cliente: { checkContactExists: vi.fn() },
      refazerIncertas: true,
    });
    expect(
      consultas.some((s) => s.includes("set whatsapp_status=null") && s.includes("='unknown'")),
    ).toBe(true);
  });
});
