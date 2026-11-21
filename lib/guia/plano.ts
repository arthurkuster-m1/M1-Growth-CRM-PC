/**
 * O PLANO DO CLIENTE — funções PURAS: que passos entram no plano padrão e como cada item do plano
 * se cruza com o diagnóstico e com a tarefa ligada. O plano é o conjunto de passos do mapa que a
 * agência escolheu fazer, com quem faz (agência ou cliente) e até quando.
 */
import { passoPorId } from "./catalogo";
import type {
  Diagnostico,
  ItemDoPlano,
  ItemDoPlanoVisao,
  LadoDoPlano,
  SituacaoDaTarefa,
  SugestaoDoPlano,
} from "./tipos";

export const MAXIMO_DO_PLANO_PADRAO = 12;

const ESTADOS_DO_PLANO = new Set(["falta", "em_andamento", "bloqueado", "desatualizado"]);
const ESTADOS_ENCERRADOS = new Set(["feito", "dispensado", "nao_se_aplica"]);
const TAREFA_ABERTA = new Set(["pending", "in_progress"]);

export const ladoPadraoDoPasso = (passoId: string): LadoDoPlano =>
  passoPorId(passoId)?.lado ?? "agencia";

/**
 * O plano padrão: os passos ESSENCIAIS que ainda não estão prontos (incluindo os bloqueados, que
 * entram na ordem certa), na ordem do mapa — que já respeita as dependências. Recomendado e
 * opcional ficam de fora: entram quando a agência escolhe. No máximo `max`.
 */
export function planoPadrao(d: Diagnostico, max = MAXIMO_DO_PLANO_PADRAO): string[] {
  return d.passos
    .filter((p) => p.classificacao === "E" && ESTADOS_DO_PLANO.has(p.estado))
    .sort((a, b) => a.ordem - b.ordem)
    .slice(0, max)
    .map((p) => p.id);
}

/** O prazo (data) vira o instante da tarefa: meio-dia em São Paulo, para nunca cair no dia errado. */
export const prazoParaTarefa = (prazo: string): string => `${prazo}T12:00:00-03:00`;

/** O instante da tarefa → a data (YYYY-MM-DD) no fuso de São Paulo. */
export function prazoDaTarefa(instante: string | null): string | null {
  if (!instante) return null;
  const t = Date.parse(instante);
  if (Number.isNaN(t)) return null;
  return new Date(t - 3 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Cada item do plano cruzado com o diagnóstico e a tarefa, na ordem do plano. `hoje` é
 * YYYY-MM-DD. Itens cujo passo não existe mais no catálogo são descartados.
 */
export function visaoDoPlano(
  d: Diagnostico,
  plano: readonly ItemDoPlano[],
  tarefas: Readonly<Record<string, SituacaoDaTarefa>>,
  hoje: string,
): ItemDoPlanoVisao[] {
  const porId = new Map(d.passos.map((p) => [p.id, p]));
  return [...plano]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((item): ItemDoPlanoVisao[] => {
      const passo = porId.get(item.passoId);
      if (!passo) return [];
      const tarefa = item.tarefaId ? (tarefas[item.tarefaId] ?? null) : null;
      const encerrado = ESTADOS_ENCERRADOS.has(passo.estado);
      const tarefaFeita = tarefa?.status === "done";

      let sugestao: SugestaoDoPlano | null = null;
      if (tarefaFeita && ESTADOS_DO_PLANO.has(passo.estado)) sugestao = "confirmar_passo";
      else if (encerrado && tarefa && TAREFA_ABERTA.has(tarefa.status))
        sugestao = "concluir_tarefa";

      return [
        {
          item,
          passo,
          lado: item.lado ?? ladoPadraoDoPasso(item.passoId),
          tarefa,
          atrasado: !!item.prazo && item.prazo < hoje && !encerrado && !tarefaFeita,
          sugestao,
        },
      ];
    });
}
