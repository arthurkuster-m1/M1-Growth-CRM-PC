import { z } from "zod";

import { aplicarVariaveis } from "@/lib/leads/mensagem-de-prospeccao";

/**
 * O FLUXO DE CONVERSA de uma abordagem de WhatsApp (migration 0663): uma sequência de passos que
 * a conversa percorre — mensagem, áudio gravado, aguardar a resposta do lead e encaminhar ao
 * atendente. Nesta fase só se DESENHA e se SIMULA; nada é enviado. Cada passo tem correspondente
 * direto nos nós do fluxo de follow-up (mensagem, espera por resposta, entrega a uma pessoa), que
 * é por onde a execução virá.
 *
 * ⚠️ A FORMA de `TIPOS_DE_PASSO_DO_FLUXO` é requisito do extrator de `vocabulario-banco-x-typescript`.
 */
export const TIPOS_DE_PASSO_DO_FLUXO = ["mensagem", "audio", "aguardar", "encaminhar"] as const;
export type TipoDePassoDoFluxo = (typeof TIPOS_DE_PASSO_DO_FLUXO)[number];

export const MAXIMO_DE_PASSOS_DO_FLUXO = 12;

export const passoDoFluxoSchema = z.object({
  kind: z.enum(TIPOS_DE_PASSO_DO_FLUXO),
  /** O texto da mensagem; com `ai_personalize`, o que a IA deve conseguir dizer (opcional). */
  body: z.string().trim().max(1500),
  /** A IA escreve a mensagem de cada lead a partir da ideia central da abordagem. */
  ai_personalize: z.boolean(),
  /** O nome do arquivo de voz gravado (a gravação em si é anexada na fase de execução). */
  audio_label: z.string().trim().max(120),
  /** Quanto esperar a resposta (horas); nulo = sem prazo. Só vale em `aguardar`. */
  wait_hours: z.number().int().min(1).max(720).nullable(),
});
export type PassoDoFluxo = z.infer<typeof passoDoFluxoSchema>;

export const fluxoDaAbordagemSchema = z.object({
  steps: z.array(passoDoFluxoSchema).max(MAXIMO_DE_PASSOS_DO_FLUXO),
});

export const PASSO_NOVO_DO_FLUXO = (kind: TipoDePassoDoFluxo): PassoDoFluxo => ({
  kind,
  body: "",
  ai_personalize: false,
  audio_label: "",
  wait_hours: kind === "aguardar" ? 48 : null,
});

/** O que o desenho ainda precisa para fazer sentido (avisos, nunca bloqueio). */
export function avisosDoFluxo(passos: readonly PassoDoFluxo[], ideiaCentral: string): string[] {
  const avisos: string[] = [];
  if (passos.length === 0) return avisos;
  if (passos[0]!.kind === "aguardar")
    avisos.push("A conversa começa esperando: ponha uma mensagem antes.");
  passos.forEach((p, i) => {
    const n = i + 1;
    if (p.kind === "mensagem" && !p.ai_personalize && p.body.trim() === "") {
      avisos.push(`Passo ${n}: escreva a mensagem ou deixe a IA personalizar.`);
    }
    if (p.kind === "audio" && p.audio_label.trim() === "") {
      avisos.push(`Passo ${n}: diga qual áudio gravado vai aqui.`);
    }
  });
  if (passos.some((p) => p.ai_personalize) && ideiaCentral.trim() === "") {
    avisos.push("Há mensagem da IA: escreva a ideia central da abordagem.");
  }
  for (let i = 1; i < passos.length; i++) {
    if (passos[i]!.kind === "aguardar" && passos[i - 1]!.kind === "aguardar") {
      avisos.push(`Passo ${i + 1}: duas esperas seguidas.`);
    }
  }
  if (passos[passos.length - 1]!.kind === "aguardar") {
    avisos.push("A conversa termina esperando: decida o que acontece depois da resposta.");
  }
  return avisos;
}

export interface BolhaDaSimulacao {
  de: "nos" | "lead" | "sistema";
  texto: string;
}

export interface EstadoDaSimulacao {
  bolhas: BolhaDaSimulacao[];
  /** Índice do passo `aguardar` em que a conversa parou, ou null se terminou. */
  esperandoEm: number | null;
  terminou: boolean;
}

export const RESPOSTA_DE_EXEMPLO = "(o lead respondeu)";

/**
 * Percorre o fluxo a partir de `de` até o próximo "aguardar" (que para) ou o fim. A simulação
 * é só um ensaio: mostra o que sairia, com a mensagem da IA descrita (não escrita).
 */
export function simularConversa(
  passos: readonly PassoDoFluxo[],
  contexto: { nomeDoLead: string; ideiaCentral: string },
  de = 0,
  anterior: BolhaDaSimulacao[] = [],
): EstadoDaSimulacao {
  const bolhas = [...anterior];
  for (let i = de; i < passos.length; i++) {
    const p = passos[i]!;
    if (p.kind === "mensagem") {
      bolhas.push({
        de: "nos",
        texto: p.ai_personalize
          ? `✨ A IA escreve para ${contexto.nomeDoLead}, a partir da ideia central: “${
              contexto.ideiaCentral.trim() || "—"
            }”${p.body.trim() ? ` (${p.body.trim()})` : ""}`
          : aplicarVariaveis(p.body, { nome: contexto.nomeDoLead }),
      });
    } else if (p.kind === "audio") {
      bolhas.push({ de: "nos", texto: `🎙️ Áudio gravado: ${p.audio_label.trim() || "—"}` });
    } else if (p.kind === "encaminhar") {
      bolhas.push({ de: "sistema", texto: "→ A conversa vai para o atendente." });
    } else {
      bolhas.push({
        de: "sistema",
        texto: p.wait_hours
          ? `⏳ Aguardando a resposta (até ${p.wait_hours} h)`
          : "⏳ Aguardando a resposta",
      });
      return { bolhas, esperandoEm: i, terminou: false };
    }
  }
  return { bolhas, esperandoEm: null, terminou: true };
}

/** O lead respondeu: registra a resposta e continua do passo seguinte à espera. */
export function continuarAposResposta(
  passos: readonly PassoDoFluxo[],
  contexto: { nomeDoLead: string; ideiaCentral: string },
  estado: EstadoDaSimulacao,
): EstadoDaSimulacao {
  if (estado.esperandoEm === null) return estado;
  return simularConversa(passos, contexto, estado.esperandoEm + 1, [
    ...estado.bolhas,
    { de: "lead", texto: RESPOSTA_DE_EXEMPLO },
  ]);
}
