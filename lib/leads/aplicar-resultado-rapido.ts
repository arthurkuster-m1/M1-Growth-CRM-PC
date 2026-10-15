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
}): Promise<void> {
  await apiClient.post(`/api/v1/contacts/${args.contactId}/atividades`, {
    acao: "ligacao",
    resultado: args.resultado,
    lead_id: args.leadId,
  });
  if (args.proximo) {
    await apiClient.put(`/api/v1/leads/${args.leadId}/proxima-acao`, {
      proxima_acao: args.proximo.texto,
      proxima_acao_em: args.proximo.em,
    });
  }
}
