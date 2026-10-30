import { chaveDoDia, somarDias } from "@/lib/inicio/datas";
import { FUSO_DO_CRONOGRAMA } from "@/lib/marketing/cronograma";

/**
 * As TAREFAS DA AGÊNCIA do modo agência: as tarefas da semana dos clientes marcadas como "da
 * agência" (`crm_tasks.cronograma_lado = 'agencia'`), reunidas numa lista só. Aqui só há a régua
 * de agrupamento; quem lê o banco é `tarefas-servidor.ts`.
 */
export interface TarefaDaAgencia {
  id: string;
  titulo: string;
  status: "pending" | "in_progress" | "done" | "cancelled";
  prazo: string | null;
  adiamentos: number;
  clienteId: string;
  cliente: string;
  /** A cor do cliente na agência (hex). */
  cor: string;
}

export type GrupoDeTarefas = "atrasadas" | "hoje" | "semana" | "depois" | "sem_prazo" | "feitas";

export const ROTULO_DO_GRUPO: Record<GrupoDeTarefas, string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  semana: "Nos próximos 7 dias",
  depois: "Depois",
  sem_prazo: "Sem prazo",
  feitas: "Concluídas recentemente",
};

export const ORDEM_DOS_GRUPOS: readonly GrupoDeTarefas[] = [
  "atrasadas",
  "hoje",
  "semana",
  "depois",
  "sem_prazo",
  "feitas",
];

export function grupoDaTarefa(
  t: Pick<TarefaDaAgencia, "status" | "prazo">,
  agora: Date = new Date(),
): GrupoDeTarefas {
  if (t.status === "done") return "feitas";
  if (!t.prazo) return "sem_prazo";
  const hoje = chaveDoDia(agora, FUSO_DO_CRONOGRAMA);
  const dia = chaveDoDia(new Date(t.prazo), FUSO_DO_CRONOGRAMA);
  if (dia < hoje) return "atrasadas";
  if (dia === hoje) return "hoje";
  return dia <= somarDias(hoje, 7) ? "semana" : "depois";
}

/** Agrupa e ordena: dentro de cada grupo, pelo prazo e depois pelo nome do cliente. */
export function agruparTarefas(
  tarefas: readonly TarefaDaAgencia[],
  agora: Date = new Date(),
): Array<{ grupo: GrupoDeTarefas; tarefas: TarefaDaAgencia[] }> {
  const porGrupo = new Map<GrupoDeTarefas, TarefaDaAgencia[]>();
  for (const t of tarefas) {
    if (t.status === "cancelled") continue;
    const g = grupoDaTarefa(t, agora);
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), t]);
  }
  return ORDEM_DOS_GRUPOS.flatMap((grupo) => {
    const lista = porGrupo.get(grupo);
    if (!lista || lista.length === 0) return [];
    lista.sort(
      (a, b) =>
        (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999") ||
        a.cliente.localeCompare(b.cliente, "pt-BR"),
    );
    return [{ grupo, tarefas: lista }];
  });
}
