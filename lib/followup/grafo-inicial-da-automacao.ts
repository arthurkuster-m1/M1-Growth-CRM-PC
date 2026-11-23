/**
 * O rascunho com que nasce uma automação de CRM: gatilho → fim. A pessoa abre o editor já com um caminho
 * para continuar (clicar na seta e acrescentar passos) em vez de um canvas em branco.
 *
 * O GATILHO não vem escolhido: o publicar recusa até a pessoa dizer o que dispara a automação.
 */
import { flowGraphSchema, type FlowGraph } from "./graph-schema";

export function grafoInicialDaAutomacao(): FlowGraph {
  return flowGraphSchema.parse({
    nodes: [
      { id: "gatilho", type: "trigger", label: "Gatilho", position: { x: 0, y: 0 }, config: {} },
      {
        id: "fim",
        type: "end",
        label: "Fim",
        position: { x: 0, y: 160 },
        config: { outcome: "custom", note: "Automação concluída" },
      },
    ],
    edges: [
      { id: "gatilho->fim", source: "gatilho", target: "fim", condition: { type: "always" } },
    ],
  });
}
