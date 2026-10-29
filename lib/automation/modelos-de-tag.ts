/**
 * MODELOS PRONTOS de automação de tag: o operador escolhe um, a tela abre o editor já preenchido e
 * ele só ajusta o texto, o número e o nome da tag. Cada modelo usa gatilhos e ações que o motor já
 * tem — nenhum caminho paralelo:
 *
 *  - texto da mensagem: `message.received` + condição de "texto contém" (a página de obrigado manda
 *    o botão do WhatsApp com uma frase/código combinado; quem enviar fica marcado);
 *  - N mensagens: `message.received` + "nº da mensagem do cliente na conversa" igual a N (casa uma
 *    vez só por conversa);
 *  - sem atendimento: `lead.silent_for` na direção `sem_atendimento` (o cliente escreveu e ninguém
 *    respondeu em N horas).
 *
 * É dado puro, lido pela tela e pelo teste que os valida contra o MESMO schema da API.
 */
import type { ActionType, TriggerEvent } from "@/app/app/webhooks/_components/labels";

export interface ModeloDeRegra {
  id: string;
  titulo: string;
  descricao: string;
  regra: {
    name: string;
    trigger_event: TriggerEvent;
    conditions: Array<{ field: string; op: "eq" | "neq" | "contains"; value: string }>;
    actions: Array<{ type: ActionType; config: Record<string, unknown> }>;
    trigger_config?: Record<string, unknown>;
  };
}

export const MODELOS_DE_TAG: readonly ModeloDeRegra[] = [
  {
    id: "tag-por-texto",
    titulo: "Marcar quem enviar um texto",
    descricao:
      "Ex.: o botão de WhatsApp da página de obrigado manda \"#obrigado\"; quem enviar ganha a tag.",
    regra: {
      name: "Tag para quem enviou o texto da página de obrigado",
      trigger_event: "message.received",
      conditions: [{ field: "event.body_preview", op: "contains", value: "#obrigado" }],
      actions: [{ type: "add_tag", config: { tags: ["obrigado"] } }],
    },
  },
  {
    id: "tag-por-n-mensagens",
    titulo: "Marcar quem mandar N mensagens",
    descricao: "Ao chegar a 5ª mensagem do cliente na conversa, ele ganha a tag (ajuste o número).",
    regra: {
      name: "Tag para quem mandou 5 mensagens",
      trigger_event: "message.received",
      conditions: [{ field: "conversation.inbound_count", op: "eq", value: "5" }],
      actions: [{ type: "add_tag", config: { tags: ["engajado"] } }],
    },
  },
  {
    id: "tag-sem-atendimento",
    titulo: "Marcar quem ficou sem atendimento",
    descricao: "O cliente escreveu e ninguém respondeu em 24 horas: o lead ganha a tag.",
    regra: {
      name: "Tag para lead sem atendimento em 24h",
      trigger_event: "lead.silent_for",
      conditions: [],
      actions: [{ type: "add_tag", config: { tags: ["sem atendimento"], alvo: "contato" } }],
      trigger_config: {
        dias: 24,
        unidade: "horas",
        direcao: "sem_atendimento",
        proteger_pela_agenda: false,
      },
    },
  },
];
