import { chaveDoDia, somarDias } from "@/lib/inicio/datas";
import {
  domingoDe,
  FUSO_DO_CRONOGRAMA,
  type LadoDaTarefa,
  type TarefaDoCronograma,
} from "@/lib/marketing/cronograma";

export interface EventoDaSemana {
  id: string;
  task_id: string;
  tipo: string;
  de_prazo: string | null;
  para_prazo: string | null;
  motivo: string | null;
  created_at: string;
  titulo: string | null;
  lado: LadoDaTarefa;
}

export type SituacaoNaSemana = "feita" | "nao_feita" | "adiada" | "cancelada";

export interface ItemDaSemana {
  /** `id` da tarefa + situação: a mesma tarefa pode aparecer adiada numa semana e feita em outra. */
  chave: string;
  titulo: string;
  lado: LadoDaTarefa;
  situacao: SituacaoNaSemana;
  /** Feita: quando foi feita. Adiada: o novo prazo. Cancelada: quando foi cancelada. */
  data: string | null;
  motivo: string | null;
}

export interface ResumoDaSemana {
  semana_inicio: string;
  agencia: ItemDaSemana[];
  cliente: ItemDaSemana[];
  feitas: number;
  nao_feitas: number;
  /** Nota da autoavaliação (0–100); `null` = a semana não foi avaliada. */
  nota: number | null;
}

const semanaDe = (iso: string) => domingoDe(chaveDoDia(new Date(iso), FUSO_DO_CRONOGRAMA));
const ORDEM: Record<SituacaoNaSemana, number> = { feita: 0, adiada: 1, nao_feita: 2, cancelada: 3 };

/**
 * O histórico POR SEMANA (domingo a sábado), separado em tarefas da AGÊNCIA e do CLIENTE — para ver
 * se cada lado fez a sua parte. Cada tarefa entra na semana do prazo: feita (e quando), não feita,
 * cancelada ou ADIADA (o prazo foi empurrado para depois — ela aparece na semana de onde saiu, com o
 * novo prazo). Mais recente primeiro; só entram semanas com algo.
 */
export function resumoDasSemanas(
  tarefas: readonly TarefaDoCronograma[],
  eventos: readonly EventoDaSemana[],
  notas: ReadonlyArray<{ semana_inicio: string; nota: number }>,
  ateSemana: string,
): ResumoDaSemana[] {
  const limite = domingoDe(ateSemana);
  const mapa = new Map<string, ResumoDaSemana>();
  const da = (semana: string) => {
    let r = mapa.get(semana);
    if (!r) {
      r = { semana_inicio: semana, agencia: [], cliente: [], feitas: 0, nao_feitas: 0, nota: null };
      mapa.set(semana, r);
    }
    return r;
  };
  const poe = (semana: string, item: ItemDaSemana) => {
    if (semana > limite) return;
    const r = da(semana);
    (item.lado === "cliente" ? r.cliente : r.agencia).push(item);
  };
  // O evento mais recente de cada tipo, por tarefa (o evento vem do mais novo para o mais antigo).
  const ultimo = new Map<string, EventoDaSemana>();
  for (const e of eventos) {
    const k = `${e.tipo}:${e.task_id}`;
    if (!ultimo.has(k)) ultimo.set(k, e);
  }
  for (const t of tarefas) {
    if (!t.due_date) continue;
    const semana = semanaDe(t.due_date);
    const situacao: SituacaoNaSemana =
      t.status === "done" ? "feita" : t.status === "cancelled" ? "cancelada" : "nao_feita";
    const ev = ultimo.get(`${situacao === "feita" ? "concluida" : "cancelada"}:${t.id}`);
    poe(semana, {
      chave: `${t.id}:${situacao}`,
      titulo: t.title,
      lado: t.lado,
      situacao,
      data: situacao === "nao_feita" ? null : (ev?.created_at ?? null),
      motivo: situacao === "cancelada" ? (ev?.motivo ?? null) : null,
    });
  }
  // Adiamento: o prazo foi para depois — conta na semana de onde a tarefa saiu.
  for (const e of eventos) {
    if (e.tipo !== "prazo_alterado" || !e.de_prazo || !e.para_prazo) continue;
    if (e.para_prazo <= e.de_prazo) continue;
    const de = semanaDe(e.de_prazo);
    if (semanaDe(e.para_prazo) === de) continue;
    poe(de, {
      chave: `${e.id}:adiada`,
      titulo: e.titulo ?? "—",
      lado: e.lado,
      situacao: "adiada",
      data: e.para_prazo,
      motivo: e.motivo,
    });
  }
  for (const n of notas) if (n.semana_inicio <= limite) da(n.semana_inicio).nota = n.nota;
  const ordenar = (a: ItemDaSemana, b: ItemDaSemana) =>
    ORDEM[a.situacao] - ORDEM[b.situacao] || a.titulo.localeCompare(b.titulo);
  for (const r of mapa.values()) {
    r.agencia.sort(ordenar);
    r.cliente.sort(ordenar);
    const todos = [...r.agencia, ...r.cliente];
    r.feitas = todos.filter((i) => i.situacao === "feita").length;
    r.nao_feitas = todos.filter(
      (i) => i.situacao === "nao_feita" || i.situacao === "adiada",
    ).length;
  }
  return [...mapa.values()].sort((a, b) => b.semana_inicio.localeCompare(a.semana_inicio));
}

export const fimDaSemana = (inicio: string): string => somarDias(inicio, 6);
