/**
 * AS CATEGORIAS da Central de Automações: o jeito de a pessoa achar o que existe por FUNÇÃO
 * ("o que cuida do no-show?"), e não por nome de gatilho. Dado puro, lido pela tela.
 *
 * Cada regra de automação cai em UMA categoria, decidida pelo gatilho e pelas ações (sem coluna nova no
 * banco). Os fluxos de follow up caem em Follow-up por padrão, ou em Agenda e no-show quando o nome
 * fala de falta, confirmação ou lembrete — uma regra de nome que pode ser trocada por uma coluna
 * própria quando os dois motores forem unificados.
 */
export const CATEGORIAS_DE_AUTOMACAO = [
  {
    id: "captacao",
    titulo: "Captação",
    descricao: "O que acontece quando um lead ou contato novo chega.",
  },
  {
    id: "followup",
    titulo: "Follow-up e atendimento",
    descricao: "Retomar quem não respondeu, quem esfriou ou ficou sem atendimento.",
  },
  {
    id: "agenda",
    titulo: "Agenda e no-show",
    descricao: "Confirmação, lembretes, faltas e reagendamentos de compromissos.",
  },
  {
    id: "vendas",
    titulo: "Vendas e pós-venda",
    descricao: "Mudança de etapa, negócio ganho ou perdido, e o que vem depois.",
  },
  {
    id: "interno",
    titulo: "Organização interna",
    descricao: "Tags, responsáveis, tarefas e lembretes para a equipe.",
  },
  {
    id: "integracoes",
    titulo: "Integrações",
    descricao: "Avisar outros sistemas (n8n, planilhas, ferramentas) quando algo acontece.",
  },
] as const;

export type CategoriaDeAutomacao = (typeof CATEGORIAS_DE_AUTOMACAO)[number]["id"];

const DO_GATILHO: Record<string, CategoriaDeAutomacao> = {
  "lead.created": "captacao",
  "lead.stage_changed": "vendas",
  "lead.won": "vendas",
  "lead.lost": "vendas",
  "lead.reopened": "vendas",
  "lead.assigned": "interno",
  "message.received": "followup",
  "message.failed": "interno",
  "lead.tag_added": "interno",
  "contact.tag_added": "interno",
  "appointment.created": "agenda",
  "appointment.confirmed": "agenda",
  "appointment.rescheduled": "agenda",
  "appointment.cancelled": "agenda",
  "appointment.completed": "agenda",
  "appointment.no_show": "agenda",
  "contact.birthday": "interno",
  "lead.date_field_due": "vendas",
  "lead.silent_for": "followup",
  "lead.stage_stale": "followup",
};

/** A categoria de uma regra: quem avisa outro sistema é Integração; senão manda o gatilho. */
export function categoriaDaRegra(regra: {
  trigger_event: string;
  actions: ReadonlyArray<{ type: string }>;
}): CategoriaDeAutomacao {
  if (regra.actions.some((a) => a.type === "call_webhook")) return "integracoes";
  return DO_GATILHO[regra.trigger_event] ?? "interno";
}

/** A categoria de um fluxo de follow up, pelo nome (ver o cabeçalho). */
export function categoriaDoFluxo(nome: string): CategoriaDeAutomacao {
  return /no[\s-]?show|falt|confirma|lembrete|reagend|compareceu/i.test(nome)
    ? "agenda"
    : "followup";
}

export function tituloDaCategoria(id: CategoriaDeAutomacao): string {
  return CATEGORIAS_DE_AUTOMACAO.find((c) => c.id === id)?.titulo ?? id;
}
