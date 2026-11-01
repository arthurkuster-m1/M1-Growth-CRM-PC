/**
 * MODELOS PRONTOS por categoria, para a Central de Automações. Só usam gatilhos e ações que o motor
 * já tem e que NÃO dependem de escolher canal, agente ou pessoa (lembretes e tags): por isso nascem
 * válidos e a pessoa só ajusta texto e prazo. As mensagens ao cliente (WhatsApp) ficam nos
 * follow-ups, que passam pelo agente e pela janela de envio.
 *
 * É dado puro, conferido pelo teste contra o MESMO schema da API.
 */
import { MODELOS_DE_TAG, type ModeloDeRegra } from "@/lib/automation/modelos-de-tag";
import type { CategoriaDeAutomacao } from "@/lib/automation/categorias";

export interface ModeloDaCentral extends ModeloDeRegra {
  categoria: CategoriaDeAutomacao;
}

const tarefa = (
  titulo: string,
  vence_em_dias: number,
  prioridade: "low" | "medium" | "high" | "urgent" = "medium",
) => ({
  type: "create_task" as const,
  config: { titulo, vence_em_dias, atribuir_a: "dono_do_lead" as const, prioridade },
});

export const MODELOS_NOVOS: readonly ModeloDaCentral[] = [
  {
    id: "lead-novo-primeiro-contato",
    categoria: "captacao",
    titulo: "Lead novo: lembrar o primeiro contato",
    descricao: "Quando um lead entra, cria a tarefa de falar com ele hoje e marca como novo.",
    regra: {
      name: "Primeiro contato com lead novo",
      trigger_event: "lead.created",
      conditions: [],
      actions: [
        tarefa("Primeiro contato com {{contact.name}}", 0, "urgent"),
        { type: "add_tag", config: { tags: ["novo"] } },
      ],
    },
  },
  {
    id: "lead-sem-resposta-retomar",
    categoria: "followup",
    titulo: "Lead que não respondeu: retomar",
    descricao: "O cliente ficou 2 dias sem responder: cria a tarefa de retomar o contato.",
    regra: {
      name: "Retomar lead que não respondeu",
      trigger_event: "lead.silent_for",
      conditions: [],
      actions: [tarefa("Retomar contato com {{contact.name}} (não respondeu)", 0, "high")],
      trigger_config: {
        dias: 2,
        unidade: "dias",
        direcao: "do_cliente",
        proteger_pela_agenda: true,
      },
    },
  },
  {
    id: "lead-parado-na-etapa",
    categoria: "followup",
    titulo: "Lead parado na mesma etapa",
    descricao: "5 dias sem sair da etapa: cria a tarefa de dar o próximo passo.",
    regra: {
      name: "Lead parado há 5 dias na etapa",
      trigger_event: "lead.stage_stale",
      conditions: [],
      actions: [tarefa("{{contact.name}} está parado na etapa: dar o próximo passo", 0, "medium")],
      trigger_config: { dias: 5, proteger_pela_agenda: true },
    },
  },
  {
    id: "no-show-recuperar",
    categoria: "agenda",
    titulo: "Anti-No-show: recuperar quem faltou",
    descricao:
      "Quando alguém falta à reunião: marca a tag e cria a tarefa de ligar e remarcar hoje.",
    regra: {
      name: "Recuperar quem faltou à reunião",
      trigger_event: "appointment.no_show",
      conditions: [],
      actions: [
        { type: "add_tag", config: { tags: ["faltou"], alvo: "contato" } },
        tarefa("Ligar para {{contact.name}} e remarcar a reunião", 0, "high"),
      ],
    },
  },
  {
    id: "reuniao-marcada-confirmar",
    categoria: "agenda",
    titulo: "Reunião marcada: confirmar com o lead",
    descricao: "Quando um horário é marcado, cria a tarefa de confirmar a presença com o lead.",
    regra: {
      name: "Confirmar presença na reunião marcada",
      trigger_event: "appointment.created",
      conditions: [],
      actions: [tarefa("Confirmar a reunião com {{contact.name}}", 1, "medium")],
    },
  },
  {
    id: "compareceu-followup",
    categoria: "agenda",
    titulo: "Compareceu: fazer o follow-up da reunião",
    descricao:
      "Quem compareceu ganha a tarefa de follow-up no dia seguinte (proposta, dúvidas, fechamento).",
    regra: {
      name: "Follow-up de quem compareceu à reunião",
      trigger_event: "appointment.completed",
      conditions: [],
      actions: [tarefa("Follow-up da reunião com {{contact.name}}", 1, "high")],
    },
  },
  {
    id: "negocio-ganho-pos-venda",
    categoria: "vendas",
    titulo: "Negócio ganho: iniciar o pós-venda",
    descricao:
      "Marca como cliente e cria a tarefa de dar as boas-vindas e acompanhar nos primeiros dias.",
    regra: {
      name: "Pós-venda do negócio ganho",
      trigger_event: "lead.won",
      conditions: [],
      actions: [
        { type: "add_tag", config: { tags: ["cliente"], alvo: "contato" } },
        tarefa("Boas-vindas e acompanhamento de {{contact.name}}", 1, "high"),
      ],
    },
  },
  {
    id: "negocio-perdido-reativar",
    categoria: "vendas",
    titulo: "Negócio perdido: reativar depois",
    descricao: "Marca como perdido e cria a tarefa de tentar de novo daqui a 30 dias.",
    regra: {
      name: "Reativar negócio perdido em 30 dias",
      trigger_event: "lead.lost",
      conditions: [],
      actions: [
        { type: "add_tag", config: { tags: ["perdido"], alvo: "contato" } },
        tarefa("Reativar {{contact.name}} (negócio perdido há 30 dias)", 30, "low"),
      ],
    },
  },
  {
    id: "aniversario-parabenizar",
    categoria: "interno",
    titulo: "Aniversário: lembrar de parabenizar",
    descricao: "No aniversário do contato, cria a tarefa de mandar os parabéns.",
    regra: {
      name: "Parabenizar no aniversário",
      trigger_event: "contact.birthday",
      conditions: [],
      actions: [tarefa("Parabenizar {{contact.name}} pelo aniversário", 0, "low")],
    },
  },
];

/** Os modelos de tag que já existiam entram como "Organização interna". */
const MODELOS_DE_TAG_NA_CENTRAL: readonly ModeloDaCentral[] = MODELOS_DE_TAG.map((m) => ({
  ...m,
  categoria: "interno" as const,
}));

export const MODELOS_DA_CENTRAL: readonly ModeloDaCentral[] = [
  ...MODELOS_NOVOS,
  ...MODELOS_DE_TAG_NA_CENTRAL,
];
