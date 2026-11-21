/**
 * A regra de automação CONVERTIDA em fluxo do motor único (Fase 4a — docs/PLANO-MOTOR-UNICO-M1.md).
 *
 * PURO: não lê nem grava banco. Devolve o que o fluxo `crm_automation` seria — o gatilho (`event`, com as
 * condições e os parâmetros de tempo da regra) e o grafo (gatilho → uma ação por nó, na ordem → fim) — ou o
 * motivo de a regra NÃO converter. Quem grava (Fase 4c) só o faz depois de a SIMULAÇÃO ter listado, para toda
 * regra, "converte" ou "não converte, porque…".
 *
 * Fidelidade: o config de cada ação é copiado VERBATIM (inclusive o segredo já cifrado do webhook); as
 * condições são as da regra (todas valem); o grafo passa no MESMO `flowGraphSchema` e `validateFlowForPublish`
 * que o publicar usa, então o que converte aqui publica depois.
 */
import { ACOES_DO_CRM } from "./vocabulario";
import { triggerConfigSchema } from "./api-schemas";
import { flowGraphSchema, type FlowGraph } from "./graph-schema";
import { validateFlowForPublish } from "./validate-publish";

export interface RegraParaConverter {
  name: string;
  trigger_event: string;
  trigger_config?: Record<string, unknown> | null;
  conditions: ReadonlyArray<{ field: string; op: "eq" | "neq" | "contains"; value: string }>;
  actions: ReadonlyArray<{ type: string; config?: Record<string, unknown> }>;
}

export type FluxoDaRegra =
  | {
      ok: true;
      /** Nome do fluxo = nome da regra (a unicidade por organização é problema de quem grava). */
      nome: string;
      /** `trigger_config` do ponteiro. */
      trigger_config: Record<string, unknown>;
      graph: FlowGraph;
    }
  | { ok: false; motivo: string };

const PASSO_Y = 130;

export function regraParaFluxo(regra: RegraParaConverter): FluxoDaRegra {
  const config =
    regra.trigger_config && Object.keys(regra.trigger_config).length > 0
      ? regra.trigger_config
      : undefined;
  const gatilho = triggerConfigSchema.safeParse({
    kind: "event",
    params: {
      event_type: regra.trigger_event,
      conditions: regra.conditions,
      ...(config ? { config } : {}),
    },
  });
  if (!gatilho.success) {
    return { ok: false, motivo: `gatilho_invalido: ${gatilho.error.issues[0]?.message ?? "?"}` };
  }

  const nos: unknown[] = [
    { id: "gatilho", type: "trigger", label: "Gatilho", position: { x: 0, y: 0 }, config: {} },
  ];
  const arestas: unknown[] = [];
  let anterior = "gatilho";

  regra.actions.forEach((acao, i) => {
    const id = `acao-${i + 1}`;
    nos.push({
      id,
      type: "crm_action",
      label: (ACOES_DO_CRM[acao.type] ?? "Ação").slice(0, 60),
      position: { x: 0, y: (i + 1) * PASSO_Y },
      config: { action: { type: acao.type, config: acao.config ?? {} } },
    });
    arestas.push({
      id: `${anterior}->${id}`,
      source: anterior,
      target: id,
      condition: { type: "always" },
    });
    anterior = id;
  });

  nos.push({
    id: "fim",
    type: "end",
    label: "Fim",
    position: { x: 0, y: (regra.actions.length + 1) * PASSO_Y },
    config: { outcome: "custom", note: "Automação concluída" },
  });
  arestas.push({
    id: `${anterior}->fim`,
    source: anterior,
    target: "fim",
    condition: { type: "always" },
  });

  const grafo = flowGraphSchema.safeParse({ nodes: nos, edges: arestas });
  if (!grafo.success) {
    const problema = grafo.error.issues[0];
    return {
      ok: false,
      motivo: `acao_invalida: ${problema?.path.join(".") ?? ""} ${problema?.message ?? ""}`.trim(),
    };
  }

  const validacao = validateFlowForPublish(grafo.data, {
    surface: "crm_automation",
    eventoDoGatilho: regra.trigger_event,
  });
  if (!validacao.ok) {
    return {
      ok: false,
      motivo: `reprovada_no_publicar: ${validacao.errors.map((e) => e.code).join(", ")}`,
    };
  }

  return {
    ok: true,
    nome: regra.name.slice(0, 80),
    trigger_config: gatilho.data as unknown as Record<string, unknown>,
    graph: grafo.data,
  };
}
