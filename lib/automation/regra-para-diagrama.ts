/**
 * A regra de automação desenhada como DIAGRAMA (nós + setas com posição), para a tela da automação.
 * Só descreve: não executa nada e não muda a regra. É a Fase 1 do motor único
 * (docs/PLANO-MOTOR-UNICO-M1.md) — o mesmo desenho servirá depois para o grafo do motor novo.
 *
 * Layout: uma coluna principal (Quando → Se → Então, de cima para baixo). As opções do passo
 * "a IA decide" saem pela direita, cada uma com a sua seta rotulada, e a coluna principal segue.
 */
import { passosDaRegra, type PassoDaRegra } from "@/lib/automation/passos-da-regra";

export type TipoDoNo = PassoDaRegra["tipo"] | "ia";

export interface NoDoDiagrama {
  id: string;
  tipo: TipoDoNo;
  titulo: string;
  detalhe?: string;
  x: number;
  y: number;
}

export interface ArestaDoDiagrama {
  id: string;
  de: string;
  para: string;
  rotulo?: string;
}

export interface Diagrama {
  nos: NoDoDiagrama[];
  arestas: ArestaDoDiagrama[];
}

export const TITULO_DA_IA_DECIDE = "A IA decide";

const PASSO_Y = 130;
const COLUNA_DAS_OPCOES_X = 340;
const PASSO_DAS_OPCOES_Y = 96;

interface RegraParaDiagrama {
  trigger_event: string;
  conditions: ReadonlyArray<{ field: string; op: "eq" | "neq" | "contains"; value: string }>;
  actions: ReadonlyArray<{ type: string; config: Record<string, unknown> }>;
  trigger_config?: Record<string, unknown> | null;
}

const texto = (v: unknown): string => (typeof v === "string" ? v : "");

interface OpcaoLida {
  rotulo: string;
  acao: { type: string; config: Record<string, unknown> };
}

function opcoesDaIa(config: Record<string, unknown>): OpcaoLida[] {
  if (!Array.isArray(config.opcoes)) return [];
  const lidas: OpcaoLida[] = [];
  for (const o of config.opcoes) {
    if (!o || typeof o !== "object") continue;
    const { rotulo, acao } = o as { rotulo?: unknown; acao?: unknown };
    if (!acao || typeof acao !== "object") continue;
    const { type, config: cfg } = acao as { type?: unknown; config?: unknown };
    if (typeof type !== "string") continue;
    lidas.push({
      rotulo: texto(rotulo),
      acao: {
        type,
        config: cfg && typeof cfg === "object" ? (cfg as Record<string, unknown>) : {},
      },
    });
  }
  return lidas;
}

export function regraParaDiagrama(
  regra: RegraParaDiagrama,
  rotulos: { gatilho: (id: string) => string; acao: (id: string) => string },
): Diagrama {
  const passos = passosDaRegra(regra, rotulos);
  const nos: NoDoDiagrama[] = [];
  const arestas: ArestaDoDiagrama[] = [];

  let anterior: string | null = null;
  let indiceDaAcao = 0;
  let y = 0;

  passos.forEach((passo, i) => {
    const id =
      passo.tipo === "gatilho" ? "gatilho" : `${passo.tipo === "condicao" ? "se" : "acao"}-${i}`;
    const acaoDaRegra = passo.tipo === "acao" ? regra.actions[indiceDaAcao++] : undefined;
    const ehIa = acaoDaRegra?.type === "ai_decide";

    nos.push({
      id,
      tipo: ehIa ? "ia" : passo.tipo,
      titulo: ehIa ? TITULO_DA_IA_DECIDE : passo.titulo,
      detalhe: ehIa ? texto(acaoDaRegra?.config?.instrucao) || undefined : passo.detalhe,
      x: 0,
      y,
    });
    if (anterior) arestas.push({ id: `${anterior}->${id}`, de: anterior, para: id });

    if (ehIa && acaoDaRegra) {
      opcoesDaIa(acaoDaRegra.config).forEach((opcao, k) => {
        const idOpcao = `${id}-opcao-${k}`;
        nos.push({
          id: idOpcao,
          tipo: "acao",
          titulo: rotulos.acao(opcao.acao.type),
          x: COLUNA_DAS_OPCOES_X,
          y: y + k * PASSO_DAS_OPCOES_Y,
        });
        arestas.push({ id: `${id}->${idOpcao}`, de: id, para: idOpcao, rotulo: opcao.rotulo });
      });
    }

    anterior = id;
    y += PASSO_Y;
  });

  return { nos, arestas };
}
