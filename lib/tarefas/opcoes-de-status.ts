import { SITUACOES_DA_TAREFA, type SituacaoDaTarefa, type Tarefa } from "./tipos";

/**
 * AS OPÇÕES DE STATUS — o "Status" do Notion: nome e cor livres, por organização.
 *
 * Cada opção pertence a um GRUPO, que é o `crm_tasks.status` de sempre
 * (`pending`, `in_progress`, `done`, `cancelled`). É o grupo que mantém Início, a
 * tela de Tarefas atual e o contador de atrasadas verdadeiros sem mudar uma
 * linha deles. A decisão de "opção manda no status" mora no trigger do banco
 * (migration 0582), não aqui.
 *
 * ⚠️ A FORMA de `CORES_DA_OPCAO` é requisito de instrumento, não estilo: o
 * extrator de `tests/invariants/vocabulario-banco-x-typescript.test.ts` lê
 * `const X = [...] as const`.
 */
export const CORES_DA_OPCAO = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;
export type CorDaOpcao = (typeof CORES_DA_OPCAO)[number];

/** Uma linha de `crm_task_status_options`, como a API a devolve. */
export interface OpcaoDeStatus {
  id: string;
  organization_id: string;
  name: string;
  color: CorDaOpcao;
  grupo: SituacaoDaTarefa;
  position: number;
}

export const GRUPOS_DA_OPCAO = SITUACOES_DA_TAREFA;

/** Nome de grupo que a tela mostra quando a organização ainda não tem opção nenhuma. */
export const COR_PADRAO_DO_GRUPO: Record<SituacaoDaTarefa, CorDaOpcao> = {
  pending: "gray",
  in_progress: "blue",
  done: "green",
  cancelled: "red",
};

/**
 * A opção que vale para uma tarefa: a escolhida, ou — para a tarefa criada por tela
 * antiga, antes de o trigger preenchê-la — a primeira do grupo dela.
 *
 * Devolve `undefined` só se a organização não tem opção nenhuma no grupo, e a tela
 * então cai para o nome cru do grupo em vez de esconder o status.
 */
export function opcaoDaTarefa(
  tarefa: Pick<Tarefa, "status" | "status_option_id">,
  opcoes: readonly OpcaoDeStatus[],
): OpcaoDeStatus | undefined {
  const escolhida = tarefa.status_option_id
    ? opcoes.find((o) => o.id === tarefa.status_option_id)
    : undefined;
  if (escolhida && escolhida.grupo === tarefa.status) return escolhida;
  return opcoes.find((o) => o.grupo === tarefa.status);
}
