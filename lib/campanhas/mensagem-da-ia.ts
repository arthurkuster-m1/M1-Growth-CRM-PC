import type { PassoDoFluxo } from "@/lib/cadencia/fluxo-da-abordagem";

/**
 * A MENSAGEM DA IA de um disparo (migration 0665): a abertura da abordagem escrita pela IA para
 * cada lead, a partir da ideia central. Fica congelada em `rendered_body` como qualquer mensagem
 * preparada, e só sai depois que a pessoa aprova.
 *
 * ⚠️ A FORMA de `STATUS_DA_MENSAGEM_DA_IA` é requisito do extrator de `vocabulario-banco-x-typescript`.
 */
export const STATUS_DA_MENSAGEM_DA_IA = ["gerada", "editada", "falhou"] as const;
export type StatusDaMensagemDaIA = (typeof STATUS_DA_MENSAGEM_DA_IA)[number];

/** Teto inicial de leads num disparo com mensagem da IA (decisão de 25/10/2026): provar com poucos. */
export const TETO_DE_LEADS_COM_IA = 20;
/** Quantos leads a IA escreve ao mesmo tempo. */
export const CONCORRENCIA_DA_IA = 4;
export const TAMANHO_MAXIMO_DA_MENSAGEM = 1000;

/** A abertura do fluxo é mensagem da IA? Então o disparo precisa de aprovação antes de iniciar. */
export function aberturaEhDaIA(passos: readonly PassoDoFluxo[] | null | undefined): boolean {
  const p = passos?.[0];
  return Boolean(p && p.kind === "mensagem" && p.ai_personalize);
}

export interface DadosParaOPedido {
  ideiaCentral: string;
  /** A instrução extra do passo (opcional). */
  instrucao: string;
  nomeDaAbordagem: string;
  roteiroDeApoio: string;
  lead: { nome: string; titulo: string; extras: Record<string, string> };
}

export const SISTEMA_DA_MENSAGEM = [
  "Você escreve a PRIMEIRA mensagem de WhatsApp de uma abordagem comercial, em português do Brasil.",
  "Regras: no máximo 3 frases curtas; tom natural e humano, como uma pessoa escreveria; sem emojis em excesso; sem markdown; sem aspas; sem assinatura.",
  "Use o primeiro nome do lead se ele existir. NUNCA invente fatos sobre o lead ou a empresa dele: use só os dados dados.",
  "Não prometa nada que não esteja na ideia central. Termine com uma pergunta simples e fácil de responder.",
  "Responda SÓ com o texto da mensagem.",
].join("\n");

/** O pedido para a IA: a ideia central e os dados do lead, nunca mais que isso. */
export function montarPedidoDaMensagem(d: DadosParaOPedido): string {
  const extras = Object.entries(d.lead.extras)
    .filter(([, v]) => v.trim() !== "")
    .map(([k, v]) => `- ${k}: ${v.trim()}`)
    .join("\n");
  const partes = [
    `Abordagem: ${d.nomeDaAbordagem || "(sem nome)"}`,
    `Ideia central: ${d.ideiaCentral.trim() || "(não informada)"}`,
    d.instrucao.trim() ? `Instrução para esta mensagem: ${d.instrucao.trim()}` : "",
    d.roteiroDeApoio.trim()
      ? `Roteiro de apoio (não copie, use como referência de tom):\n${d.roteiroDeApoio.trim()}`
      : "",
    `Lead: ${d.lead.nome.trim() || "(sem nome)"}${
      d.lead.titulo.trim() && d.lead.titulo.trim() !== d.lead.nome.trim()
        ? ` — ${d.lead.titulo.trim()}`
        : ""
    }`,
    extras ? `Dados do lead:\n${extras}` : "",
  ];
  return partes.filter(Boolean).join("\n\n");
}

/** O texto que a IA devolveu, pronto para guardar: sem aspas, sem markdown solto, dentro do teto. */
export function limparMensagemDaIA(bruto: string): string {
  let t = bruto.trim();
  t = t.replace(/^```[a-z]*\n?|```$/gi, "").trim();
  t = t.replace(/^["“”']+|["“”']+$/g, "").trim();
  t = t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/gm, "");
  return t.slice(0, TAMANHO_MAXIMO_DA_MENSAGEM).trim();
}

/** Os dados extras do lead que valem como contexto: só texto curto, no máximo 6, nada de PII solta. */
export function extrasDoLead(
  custom: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [k, v] of Object.entries(custom ?? {})) {
    if (typeof v !== "string") continue;
    const valor = v.trim();
    if (!valor || valor.length > 120) continue;
    // Telefone, e-mail e documentos não entram no pedido: a IA não precisa deles para escrever.
    if (/@|\d{8,}/.test(valor)) continue;
    saida[k.slice(0, 40)] = valor;
    if (Object.keys(saida).length >= 6) break;
  }
  return saida;
}
