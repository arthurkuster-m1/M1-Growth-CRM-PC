"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { AcaoDoAviso, CategoriaDeNotificacao } from "@/lib/notifications/aviso-pessoal";

export interface NotificacaoDaPessoa {
  id: string;
  categoria: CategoriaDeNotificacao;
  titulo: string;
  corpo: string;
  acoes: AcaoDoAviso[];
  tag: string | null;
  lida_em: string | null;
  created_at: string;
}

export interface NotificacoesDaPessoa {
  itens: NotificacaoDaPessoa[];
  nao_lidas: number;
  disponivel: boolean;
}

export const CHAVE_DAS_NOTIFICACOES = ["notificacoes-da-pessoa"] as const;

/**
 * A aba "Para você" do sino. Chega na hora pelo Realtime (`useNotificacoesPessoais` invalida
 * esta consulta a cada notificação nova); o intervalo é só a rede de segurança.
 */
export function useNotificacoesDaPessoa() {
  return useQuery({
    queryKey: CHAVE_DAS_NOTIFICACOES,
    refetchInterval: 120_000,
    queryFn: () =>
      apiClient
        .get<{ data: NotificacoesDaPessoa }>("/api/v1/notificacoes?limite=30")
        .then((r) => r.data),
  });
}

/** Marca como lidas as indicadas, ou todas. Otimista: o contador some na hora. */
export function useMarcarNotificacoesLidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alvo: { ids: string[] } | { todas: true }) =>
      apiClient.post("/api/v1/notificacoes/lidas", alvo),
    onMutate: async (alvo) => {
      await qc.cancelQueries({ queryKey: CHAVE_DAS_NOTIFICACOES });
      const antes = qc.getQueryData<NotificacoesDaPessoa>(CHAVE_DAS_NOTIFICACOES);
      if (antes) {
        const agora = new Date().toISOString();
        const marcar = (n: NotificacaoDaPessoa) =>
          n.lida_em || ("ids" in alvo && !alvo.ids.includes(n.id)) ? n : { ...n, lida_em: agora };
        const itens = antes.itens.map(marcar);
        const lidasAgora = antes.itens.filter((n, i) => !n.lida_em && itens[i]!.lida_em).length;
        qc.setQueryData<NotificacoesDaPessoa>(CHAVE_DAS_NOTIFICACOES, {
          ...antes,
          itens,
          nao_lidas: "todas" in alvo ? 0 : Math.max(0, antes.nao_lidas - lidasAgora),
        });
      }
      return { antes };
    },
    onError: (_erro, _alvo, contexto) => {
      if (contexto?.antes) qc.setQueryData(CHAVE_DAS_NOTIFICACOES, contexto.antes);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHAVE_DAS_NOTIFICACOES }),
  });
}
