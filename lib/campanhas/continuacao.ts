import type { PassoDoFluxo } from "@/lib/cadencia/fluxo-da-abordagem";

/**
 * A CONTINUAÇÃO DA CONVERSA de um disparo (migration 0666): depois da abertura, o fluxo da
 * abordagem segue quando o lead responde. Cada passo seguinte vira uma PROPOSTA que uma pessoa
 * aprova (ou edita, ou pula) — nada sai sozinho.
 *
 * ⚠️ A FORMA dos dois vocabulários abaixo é requisito do extrator de `vocabulario-banco-x-typescript`.
 */
export const ESTADOS_DO_FLUXO = [
  "aguardando_resposta",
  "proposta_pendente",
  "concluido",
  "encaminhado",
  "parado",
] as const;
export type EstadoDoFluxo = (typeof ESTADOS_DO_FLUXO)[number];

export const TIPOS_DE_PROPOSTA = ["mensagem", "audio"] as const;
export type TipoDeProposta = (typeof TIPOS_DE_PROPOSTA)[number];

/** Por que um fluxo parou ou terminou sem chegar ao fim do desenho. */
export const MOTIVOS_DE_PARADA = ["opt_out", "descartado", "sem_resposta", "sem_dono"] as const;
export type MotivoDeParada = (typeof MOTIVOS_DE_PARADA)[number];

export type DecisaoDoPasso =
  | { tipo: "fim" }
  | { tipo: "aguardar"; indice: number; horas: number | null }
  | { tipo: "mensagem"; indice: number; passo: PassoDoFluxo }
  | { tipo: "audio"; indice: number; passo: PassoDoFluxo }
  | { tipo: "encaminhar"; indice: number };

/** O que o fluxo faz a partir do passo `deIndice` (inclusive): o primeiro passo que pede ação ou espera. */
export function proximoPasso(passos: readonly PassoDoFluxo[], deIndice: number): DecisaoDoPasso {
  const p = passos[deIndice];
  if (!p) return { tipo: "fim" };
  if (p.kind === "aguardar") return { tipo: "aguardar", indice: deIndice, horas: p.wait_hours };
  if (p.kind === "mensagem") return { tipo: "mensagem", indice: deIndice, passo: p };
  if (p.kind === "audio") return { tipo: "audio", indice: deIndice, passo: p };
  return { tipo: "encaminhar", indice: deIndice };
}

/** O prazo da espera (null = sem prazo). */
export function prazoDaEspera(horas: number | null, agora: Date): Date | null {
  return horas ? new Date(agora.getTime() + horas * 3_600_000) : null;
}

export const SISTEMA_DA_CONTINUACAO = [
  "Você escreve a PRÓXIMA mensagem de WhatsApp de uma conversa comercial que já começou, em português do Brasil.",
  "O lead acabou de responder. Responda ao que ele disse, de forma natural e humana, e leve a conversa um passo adiante na direção da ideia central.",
  "Regras: no máximo 3 frases curtas; sem markdown; sem aspas; sem assinatura; sem emojis em excesso.",
  "NUNCA invente fatos, preços ou prazos: use só o que está nos dados. Se o lead pediu para parar, não escreva nada além de um agradecimento curto.",
  "Responda SÓ com o texto da mensagem.",
].join("\n");

export interface DadosDaContinuacao {
  ideiaCentral: string;
  instrucao: string;
  nomeDaAbordagem: string;
  nomeDoLead: string;
  /** A abertura que saiu. */
  abertura: string;
  /** As últimas mensagens do lead, da mais antiga para a mais nova. */
  respostasDoLead: readonly string[];
}

export function montarPedidoDaContinuacao(d: DadosDaContinuacao): string {
  const respostas = d.respostasDoLead
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(-3)
    .map((r) => `- ${r.slice(0, 500)}`)
    .join("\n");
  const partes = [
    `Abordagem: ${d.nomeDaAbordagem || "(sem nome)"}`,
    `Ideia central: ${d.ideiaCentral.trim() || "(não informada)"}`,
    d.instrucao.trim() ? `Instrução para esta mensagem: ${d.instrucao.trim()}` : "",
    `Lead: ${d.nomeDoLead.trim() || "(sem nome)"}`,
    `Mensagem que nós enviamos antes:\n${d.abertura.trim() || "(não disponível)"}`,
    `O que o lead respondeu:\n${respostas || "(sem texto)"}`,
  ];
  return partes.filter(Boolean).join("\n\n");
}
