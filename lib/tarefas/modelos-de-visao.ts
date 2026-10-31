import type { Filtro } from "@/lib/motor/consulta";
import type { PreferenciasDaTabela } from "@/lib/motor/layout";
import type { TipoDeVisualizacao } from "@/lib/motor/visualizacoes";
import type { OpcaoDeStatus } from "@/lib/tarefas/opcoes-de-status";

/**
 * AS VISÕES PRONTAS DE TAREFAS — abas que a pessoa cria com um clique no "+" (como o Radar do CRM),
 * em vez de montar o filtro. Cada uma é só um nome, um tipo e a `config` de uma aba salva comum:
 * depois de criada, é editável e se apaga como qualquer outra. Se a aba já existe, o clique a abre.
 *
 * "Em aberto" = a situação NÃO é concluída nem cancelada. O status da tarefa é uma opção por
 * organização, então o filtro lista as opções dos grupos que encerram (`done`, `cancelled`) no
 * momento em que a aba é criada.
 */
export interface ModeloDeVisaoDeTarefas {
  id: string;
  nome: string;
  descricao: string;
  tipo: TipoDeVisualizacao;
  config: PreferenciasDaTabela;
}

export interface ContextoDosModelos {
  /** As opções de status da organização (cada uma com o grupo a que pertence). */
  opcoes: ReadonlyArray<Pick<OpcaoDeStatus, "id" | "grupo">>;
  /** Quem está logado: "Minhas tarefas" filtra por ele. */
  usuarioId: string;
  /** A coluna Cronograma (agência × cliente) existe para esta pessoa? (Só a gestão a vê.) */
  comCronograma: boolean;
}

const ENCERRAM = ["done", "cancelled"] as const;

function idsDosGrupos(ctx: ContextoDosModelos, grupos: readonly string[]): string[] {
  return ctx.opcoes.filter((o) => grupos.includes(o.grupo)).map((o) => o.id);
}

/** Filtro "só o que está em aberto". Vazio (organização sem opção encerrada) = sem filtro. */
function emAberto(ctx: ContextoDosModelos): Filtro[] {
  const ids = idsDosGrupos(ctx, ENCERRAM);
  return ids.length > 0 ? [{ campo: "status", operador: "nao_e", valor: ids }] : [];
}

const porPrazo = [{ campo: "prazo", direcao: "asc" as const }];

export function modelosDeVisaoDeTarefas(ctx: ContextoDosModelos): ModeloDeVisaoDeTarefas[] {
  const lista: ModeloDeVisaoDeTarefas[] = [
    {
      id: "pendentes",
      nome: "Pendentes",
      descricao: "O que está em aberto e já venceu, vence hoje ou vence nos próximos 2 dias.",
      tipo: "tabela",
      config: {
        filtros: [
          ...emAberto(ctx),
          { campo: "prazo", operador: "ate", valor: "depois_de_amanha", juncao: "e" },
        ],
        ordenacao: porPrazo,
      },
    },
    {
      id: "minhas-tarefas",
      nome: "Minhas tarefas",
      descricao: "As tarefas designadas a mim que ainda estão em aberto.",
      tipo: "tabela",
      config: {
        filtros: [
          { campo: "responsavel", operador: "e", valor: [ctx.usuarioId] },
          ...emAberto(ctx).map((f) => ({ ...f, juncao: "e" as const })),
        ],
        ordenacao: porPrazo,
      },
    },
    {
      id: "atrasadas",
      nome: "Atrasadas",
      descricao: "Em aberto e com o prazo já vencido.",
      tipo: "tabela",
      config: {
        filtros: [...emAberto(ctx), { campo: "prazo", operador: "antes", valor: "hoje", juncao: "e" }],
        ordenacao: porPrazo,
      },
    },
    {
      id: "esta-semana",
      nome: "Esta semana",
      descricao: "O que vence de segunda a domingo, agrupado por dia.",
      tipo: "tabela",
      config: {
        filtros: [{ campo: "prazo", operador: "periodo", valor: "esta_semana" }],
        ordenacao: porPrazo,
        agrupar: "prazo",
        agruparPor: "dia",
      },
    },
    {
      id: "sem-responsavel",
      nome: "Sem responsável",
      descricao: "Em aberto e sem ninguém designado.",
      tipo: "tabela",
      config: {
        filtros: [
          ...emAberto(ctx),
          { campo: "responsavel", operador: "vazio", juncao: "e" },
        ],
        ordenacao: porPrazo,
      },
    },
    {
      id: "por-cliente",
      nome: "Por cliente",
      descricao: "O que está em aberto, agrupado por cliente.",
      tipo: "tabela",
      config: { filtros: emAberto(ctx), ordenacao: porPrazo, agrupar: "cliente" },
    },
    {
      id: "concluidas",
      nome: "Concluídas",
      descricao: "As tarefas já concluídas, as de prazo mais recente primeiro.",
      tipo: "tabela",
      config: {
        filtros: [{ campo: "status", operador: "e", valor: idsDosGrupos(ctx, ["done"]) }],
        ordenacao: [{ campo: "prazo", direcao: "desc" }],
      },
    },
  ];
  if (ctx.comCronograma) {
    lista.splice(
      5,
      0,
      {
        id: "aguardando-o-cliente",
        nome: "Aguardando o cliente",
        descricao: "As tarefas do lado do cliente no cronograma que ainda estão em aberto.",
        tipo: "tabela",
        config: {
          filtros: [
            { campo: "cronograma", operador: "e", valor: ["cliente"] },
            ...emAberto(ctx).map((f) => ({ ...f, juncao: "e" as const })),
          ],
          ordenacao: porPrazo,
        },
      },
      {
        id: "da-agencia",
        nome: "Da agência",
        descricao: "As tarefas do lado da agência no cronograma que ainda estão em aberto.",
        tipo: "tabela",
        config: {
          filtros: [
            { campo: "cronograma", operador: "e", valor: ["agencia"] },
            ...emAberto(ctx).map((f) => ({ ...f, juncao: "e" as const })),
          ],
          ordenacao: porPrazo,
        },
      },
    );
  }
  return lista;
}
