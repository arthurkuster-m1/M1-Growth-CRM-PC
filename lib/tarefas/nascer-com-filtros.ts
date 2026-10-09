import { inicioDoDia } from "@/lib/inicio/datas";

import type { OpcaoDeStatus } from "./opcoes-de-status";
import { validarValor, type PropriedadeDaTarefa } from "./propriedades";
import { PRIORIDADES_DA_TAREFA, type NovaTarefa } from "./tipos";

/**
 * A TAREFA QUE NASCE COM O QUE A TELA PEDE.
 *
 * Recebe os valores que os filtros e o grupo exigem (`valoresDeNascimento` + o valor do
 * grupo onde se clicou no "+") e devolve a tarefa a criar, no formato que a API aceita:
 * os campos de fábrica vão na criação; as propriedades personalizadas vão à parte, porque a
 * rota de criação não as aceita (entram numa edição logo em seguida).
 *
 * Valor que não cabe — opção de status que não existe mais, prioridade fora da lista,
 * propriedade apagada, link inválido — é DESCARTADO em vez de derrubar a criação: a tarefa
 * nasce sem aquele campo, e a pessoa vê (em vez de ficar sem tarefa nenhuma).
 *
 * "Criada em" não entra: é a data do banco, ninguém a escolhe.
 */
export interface ContextoDoNascimento {
  opcoes: readonly OpcaoDeStatus[];
  propriedades: readonly PropriedadeDaTarefa[];
  fuso: string;
  /** O título de uma tarefa nova quando os filtros não dão um. */
  tituloPadrao: string;
  /** O dia em que a pessoa clicou (Calendário): vira o prazo e vale mais que o filtro. */
  dia?: string;
}

export type ValoresHerdados = Record<string, string | number | boolean | string[]>;

export interface TarefaQueNasce {
  tarefa: Omit<NovaTarefa, "position">;
  personalizados: Record<string, unknown>;
  /** O título veio de um filtro ("nome contém teste"): não há o que digitar. */
  tituloVeioDoFiltro: boolean;
}

export function tarefaQueNasce(
  herdados: ValoresHerdados,
  ctx: ContextoDoNascimento,
): TarefaQueNasce {
  const texto = (id: string): string | null => {
    const v = herdados[id];
    return typeof v === "string" && v !== "" ? v : null;
  };

  const titulo = texto("titulo")?.slice(0, 255) ?? null;
  const tarefa: Omit<NovaTarefa, "position"> = { title: titulo ?? ctx.tituloPadrao };

  const descricao = texto("descricao");
  if (descricao) tarefa.description = descricao.slice(0, 5000);

  const opcao = ctx.opcoes.find((o) => o.id === texto("status"));
  if (opcao) tarefa.status_option_id = opcao.id;

  const prioridade = PRIORIDADES_DA_TAREFA.find((p) => p === texto("prioridade"));
  if (prioridade) tarefa.priority = prioridade;

  const responsavel = texto("responsavel");
  if (responsavel) tarefa.assigned_to = responsavel;

  const diaDoPrazo = ctx.dia ?? texto("prazo");
  if (diaDoPrazo) tarefa.due_date = inicioDoDia(diaDoPrazo, ctx.fuso).toISOString();
  const diaDoInicio = texto("inicio");
  if (diaDoInicio) tarefa.start_date = inicioDoDia(diaDoInicio, ctx.fuso).toISOString();

  const personalizados: Record<string, unknown> = {};
  for (const p of ctx.propriedades) {
    const valor = herdados[`prop:${p.id}`];
    if (valor === undefined) continue;
    const valida = validarValor(p, valor);
    if (valida.ok && valida.valor !== null) personalizados[p.id] = valida.valor;
  }

  return { tarefa, personalizados, tituloVeioDoFiltro: titulo !== null };
}
