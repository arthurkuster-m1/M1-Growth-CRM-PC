import { apiClient } from "@/lib/api/client";

/**
 * Registra o resultado de uma ligação na oportunidade (linha do tempo) e, quando há, marca o
 * próximo passo (texto + data). Usado pelos botões da tabela e pelo modo prospecção.
 */
export async function aplicarResultadoRapido(args: {
  leadId: string;
  contactId: string;
  resultado: string;
  proximo?: { texto: string; em: string };
  /** O que foi conversado (obrigatório quando o lead atendeu). */
  comentario?: string;
  /** Por onde foi a abordagem (padrão: ligação). */
  meio?: "ligacao" | "whatsapp" | "instagram" | "email" | "outro";
  /** A abordagem (roteiro) em uso. */
  abordagemId?: string;
}): Promise<void> {
  const meio = args.meio ?? "ligacao";
  await apiClient.post(`/api/v1/contacts/${args.contactId}/atividades`, {
    acao: meio === "ligacao" ? "ligacao" : meio === "email" ? "email" : "mensagem",
    meio,
    ...(args.abordagemId ? { abordagem_id: args.abordagemId } : {}),
    resultado: args.resultado,
    lead_id: args.leadId,
    ...(args.comentario?.trim() ? { comentario: args.comentario.trim() } : {}),
  });
  if (args.proximo) {
    await apiClient.put(`/api/v1/leads/${args.leadId}/proxima-acao`, {
      proxima_acao: args.proximo.texto,
      proxima_acao_em: args.proximo.em,
    });
  }
}
