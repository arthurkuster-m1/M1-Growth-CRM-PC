import { chaveDoDia } from "@/lib/inicio/datas";
import type { TipoDeCampo, ValorDoCampo } from "@/lib/motor/consulta";

import type { CorDaOpcao, OpcaoDeStatus } from "./opcoes-de-status";
import { opcaoDaTarefa } from "./opcoes-de-status";
import { TIPOS_COM_OPCOES, type PropriedadeDaTarefa } from "./propriedades";
import type { Tarefa } from "./tipos";

/**
 * OS CAMPOS CONSULTÁVEIS DA TAREFA — a lista única de "o que se pode filtrar, ordenar e
 * agrupar", com o jeito de ler cada um numa tarefa.
 *
 * Mora aqui (e não dentro da tela) para o MESMO código servir a três coisas que não podem
 * divergir: a barra Filtrar/Ordenar/Agrupar, o motor de consulta, e a regra de "a tarefa
 * nova já nasce com o que os filtros pedem" (`nascer-com-filtros.ts`). Uma propriedade nova
 * entra aqui uma vez e passa a valer nos três.
 */
export interface MetaDeCampo {
  id: string;
  titulo: string;
  tipo: TipoDeCampo;
  /** Para opção e pessoa: as escolhas possíveis. */
  opcoes?: { id: string; rotulo: string; cor?: CorDaOpcao }[];
  valorDe: (tarefa: Tarefa) => ValorDoCampo;
}

export interface EntradaDosCampos {
  /** Traduz o título dos campos de fábrica. */
  t: (texto: string) => string;
  opcoes: readonly OpcaoDeStatus[];
  prioridades: readonly { id: string; rotulo: string; cor: CorDaOpcao }[];
  membros: readonly { id: string; nome: string }[];
  propriedades: readonly PropriedadeDaTarefa[];
  fuso: string;
}

const TIPO_DA_PROPRIEDADE: Record<PropriedadeDaTarefa["type"], TipoDeCampo> = {
  text: "texto",
  url: "texto",
  number: "numero",
  select: "opcao",
  multi_select: "multi",
  date: "data",
  checkbox: "caixa",
};

/** O dia (`YYYY-MM-DD`, no fuso da organização) de um instante, ou `null`. */
const diaDe = (iso: string | null | undefined, fuso: string): string | null =>
  iso ? chaveDoDia(new Date(iso), fuso) : null;

export function metasDaTarefa({
  t,
  opcoes,
  prioridades,
  membros,
  propriedades,
  fuso,
}: EntradaDosCampos): MetaDeCampo[] {
  return [
    { id: "titulo", titulo: t("Título"), tipo: "texto", valorDe: (x) => x.title },
    {
      id: "status",
      titulo: t("Status"),
      tipo: "opcao",
      valorDe: (x) => opcaoDaTarefa(x, [...opcoes])?.id,
      opcoes: opcoes.map((o) => ({ id: o.id, rotulo: o.name, cor: o.color })),
    },
    {
      id: "prioridade",
      titulo: t("Prioridade"),
      tipo: "opcao",
      valorDe: (x) => x.priority,
      opcoes: prioridades.map((p) => ({ id: p.id, rotulo: p.rotulo, cor: p.cor })),
    },
    {
      id: "inicio",
      titulo: t("Início"),
      tipo: "data",
      valorDe: (x) => diaDe(x.start_date, fuso),
    },
    { id: "prazo", titulo: t("Prazo"), tipo: "data", valorDe: (x) => diaDe(x.due_date, fuso) },
    {
      id: "responsavel",
      titulo: t("Responsável"),
      tipo: "pessoa",
      valorDe: (x) => x.assigned_to,
      opcoes: membros.map((m) => ({ id: m.id, rotulo: m.nome })),
    },
    { id: "descricao", titulo: t("Descrição"), tipo: "texto", valorDe: (x) => x.description },
    {
      id: "criada",
      titulo: t("Criada em"),
      tipo: "data",
      valorDe: (x) => diaDe(x.created_at, fuso),
    },
    ...propriedades.map((p): MetaDeCampo => ({
      id: `prop:${p.id}`,
      titulo: p.name,
      tipo: TIPO_DA_PROPRIEDADE[p.type],
      opcoes: TIPOS_COM_OPCOES.includes(p.type)
        ? p.options.map((o) => ({ id: o.id, rotulo: o.name, cor: o.color }))
        : undefined,
      valorDe: (x) => x.custom_fields?.[p.id] as ValorDoCampo,
    })),
  ];
}
