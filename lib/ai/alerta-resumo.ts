/**
 * O resumo curto de cada alerta — o que a lista do Início mostra. Um título de poucas palavras e,
 * no pop-up, uma explicação em linguagem comum do que está acontecendo.
 *
 * `satisfies Record<InboxKind, …>` é o que cobra: alerta novo no tipo sem resumo aqui = erro de
 * build. O título longo de `KIND_LABEL` continua sendo o da Central de avisos; este é o da vitrine.
 */
import type { InboxKind } from "@/lib/agent-engine/db/repository";

export interface ResumoDoAlerta {
  /** Poucas palavras: cabe numa linha, sem reticências. */
  curto: string;
  /** O que está acontecendo e por que importa, em uma ou duas frases. */
  oQueE: string;
}

export const RESUMO_DO_ALERTA = {
  case_stale: {
    curto: "Atendimento esperando",
    oQueE:
      "Um cliente pediu algo e o atendimento está parado há horas, esperando uma decisão da equipe.",
  },
  appointment_outcome_required: {
    curto: "Confirme a presença",
    oQueE:
      "O horário de um compromisso já passou e falta marcar se o cliente compareceu ou faltou.",
  },
  appointment_recovery_review: {
    curto: "Recuperar compromisso",
    oQueE: "Um cliente faltou ou desmarcou e o sistema precisa que você escolha o próximo passo.",
  },
  routing_unassigned: {
    curto: "Conversa sem responsável",
    oQueE: "Chegou uma conversa e nenhuma pessoa da equipe foi definida para atendê-la.",
  },
  qr_rescan: {
    curto: "WhatsApp desconectado",
    oQueE:
      "A conexão do WhatsApp caiu. Enquanto não escanear o QR code de novo, nada é enviado nem recebido.",
  },
  job_dead: {
    curto: "Tarefa automática falhou",
    oQueE: "Uma tarefa do assistente tentou várias vezes, não conseguiu e parou.",
  },
  event_dead: {
    curto: "Evento não processado",
    oQueE: "Um evento recebido não pôde ser processado. Quem administra precisa conferir o motivo.",
  },
  budget_exceeded: {
    curto: "Limite de IA atingido",
    oQueE: "O orçamento de IA acabou. O assistente deixa de responder até o limite ser ajustado.",
  },
  budget_warning: {
    curto: "Gasto de IA no limite",
    oQueE:
      "O gasto de IA passou do aviso que você definiu. O assistente ainda responde normalmente.",
  },
  handoff: {
    curto: "IA passou para humano",
    oQueE: "O assistente entendeu que precisa de uma pessoa e passou a conversa para a equipe.",
  },
  promotion_review: {
    curto: "Melhoria para revisar",
    oQueE: "O assistente sugeriu uma melhoria no próprio comportamento e aguarda a sua aprovação.",
  },
  judge_unaligned: {
    curto: "Avaliador desregulado",
    oQueE: "O avaliador de qualidade das respostas perdeu a calibragem e precisa ser ajustado.",
  },
  followup_dead: {
    curto: "Follow-up parado",
    oQueE: "Um fluxo de follow-up deixou de tentar falar com o cliente.",
  },
  snooze_expired: {
    curto: "Lead não respondeu",
    oQueE: "O prazo que você deu para o lead responder acabou sem retorno.",
  },
  next_action_ambiguous: {
    curto: "Escolha o negócio",
    oQueE:
      "O cliente tem mais de um negócio aberto e o sistema não sabe a qual deles a próxima ação pertence.",
  },
  risk_backlog_seeded: {
    curto: "Negócios parados",
    oQueE: "Há negócios que já estavam parados antes e precisam de uma decisão sua no Radar.",
  },
  reactivation_expired: {
    curto: "Retomada venceu",
    oQueE: "A sugestão de retomar o contato com um cliente passou do prazo sem decisão.",
  },
  capabilities_missing: {
    curto: "IA sem ferramentas",
    oQueE: "Um atendimento saiu sem as ferramentas que você ligou para o assistente.",
  },
  message_send_stuck: {
    curto: "Mensagem não enviada",
    oQueE:
      "Uma resposta ficou presa e não chegou ao cliente. O sistema não reenvia sozinho para não duplicar.",
  },
  midia_nao_lida: {
    curto: "Foto ou áudio não lido",
    oQueE: "O assistente não conseguiu ler uma foto ou um áudio que o cliente mandou.",
  },
  canal_mudo_sem_numero: {
    curto: "Canal em modo teste",
    oQueE: "O canal está em modo de teste e a IA não responde ninguém nele.",
  },
  channel_template_review: {
    curto: "Modelo mudou de situação",
    oQueE: "O WhatsApp aprovou, reprovou ou pausou um modelo de mensagem.",
  },
  channel_number_alert: {
    curto: "Número precisa de atenção",
    oQueE: "O WhatsApp sinalizou um problema no seu número (limite, qualidade ou verificação).",
  },
  promise_unfulfilled: {
    curto: "Promessa sem responsável",
    oQueE: "O assistente combinou algo com um cliente e ninguém ficou responsável por cumprir.",
  },
  contact_proposal_expired: {
    curto: "Informação sem conferir",
    oQueE: "O assistente ouviu uma informação de um cliente e ninguém conferiu a tempo.",
  },
  conhecimento_nao_indexado: {
    curto: "Material não aprendido",
    oQueE:
      "Um arquivo que você enviou não entrou na base de conhecimento, então a IA ainda não sabe o que há nele.",
  },
  voice_call_missed: {
    curto: "Ligação perdida",
    oQueE: "Alguém ligou e ninguém atendeu. Retorne quando puder.",
  },
  proposal_expired_notice: {
    curto: "Proposta venceu",
    oQueE: "A validade de uma proposta passou sem decisão do cliente.",
  },
  proposal_acceptance_rate_drop: {
    curto: "Menos propostas aceitas",
    oQueE: "A proporção de propostas aceitas caiu de forma sustentada.",
  },
  proposal_promised_not_created: {
    curto: "Proposta prometida",
    oQueE: "Foi prometida uma proposta ao cliente e ela ainda não foi criada.",
  },
  aviso_de_caso_nao_entregue: {
    curto: "Aviso não entregue",
    oQueE:
      "O aviso de um atendimento não chegou ao WhatsApp da equipe. O atendimento continua aberto.",
  },
  followup_sem_agente: {
    curto: "Follow-up não dispara",
    oQueE:
      "Um follow-up está publicado, mas nenhum agente o usa, então ninguém recebe as mensagens.",
  },
  jev_pedido_de_humano: {
    curto: "Cliente quer uma pessoa",
    oQueE:
      "O Jev percebeu que o cliente pediu para falar com uma pessoa. A conversa não foi passada sozinha.",
  },
  jev_parar_de_receber: {
    curto: "Cliente quer parar",
    oQueE:
      "O Jev percebeu um pedido para parar de receber mensagens. O contato ainda não foi bloqueado.",
  },
  proposta_travada: {
    curto: "Proposta travada",
    oQueE: "Uma proposta ficou presa no envio e voltou a rascunho. Nada foi reenviado.",
  },
  proposta_pronta_para_revisao: {
    curto: "Proposta para revisar",
    oQueE: "A IA rascunhou uma proposta e ela espera a sua revisão antes de ser enviada.",
  },
  org_reativada: {
    curto: "Conta reativada",
    oQueE:
      "A conta voltou de uma suspensão e há conversas que chegaram nesse período sem resposta.",
  },
  other: {
    curto: "Aviso do assistente",
    oQueE: "O assistente deixou um aviso que precisa da sua atenção.",
  },
} as const satisfies Record<InboxKind, ResumoDoAlerta>;

/** O resumo do alerta; kind desconhecido (clone com engine mais novo) cai no genérico. */
export function resumoDoAlerta(kind: string): ResumoDoAlerta {
  return (RESUMO_DO_ALERTA as Record<string, ResumoDoAlerta>)[kind] ?? RESUMO_DO_ALERTA.other;
}
