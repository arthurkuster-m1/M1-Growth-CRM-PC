"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { PreferenciasDaTabela } from "@/lib/motor/layout";

/** Quanto esperar parado antes de gravar: arrastar uma coluna não pode virar 40 gravações. */
const ESPERA_PARA_SALVAR_MS = 700;

const SEM_PREFERENCIAS: PreferenciasDaTabela = {};

/**
 * Como ESTA pessoa vê a tabela `chaveDaTela` (ordem, largura e visibilidade das colunas).
 *
 * Guardada na conta (`user_view_preferences`), e não no navegador, para a escolha seguir a
 * pessoa entre o computador e o celular. A tela muda NA HORA (cache otimista) e a
 * gravação sai depois de uma pausa; ao sair da tela o que estiver pendente é enviado.
 *
 * Enquanto a leitura não volta, a tabela usa o padrão — que é sempre um estado seguro.
 */
export function useVisualizacao(chaveDaTela: string) {
  const queryClient = useQueryClient();
  const chave = ["view-preferences", chaveDaTela] as const;
  const rota = `/api/v1/view-preferences/${chaveDaTela}`;

  const query = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { config: PreferenciasDaTabela } }>(rota);
      return r.data.config;
    },
    // Esta tela é a única que escreve: reler ao voltar o foco só atropelaria uma edição
    // que ainda está esperando para ser gravada.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const pendente = useRef<PreferenciasDaTabela | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const enviar = useCallback(async () => {
    const alvo = pendente.current;
    if (!alvo) return;
    pendente.current = null;
    try {
      await apiClient.put(rota, { config: alvo });
    } catch (erro) {
      showApiError(erro);
    }
  }, [rota]);

  // Saiu da tela com gravação pendente: envia agora, não perde a escolha.
  useEffect(
    () => () => {
      if (temporizador.current) {
        clearTimeout(temporizador.current);
        void enviar();
      }
    },
    [enviar],
  );

  const atualizar = useCallback(
    (mudar: (atual: PreferenciasDaTabela) => PreferenciasDaTabela) => {
      const atual = queryClient.getQueryData<PreferenciasDaTabela>(chave) ?? SEM_PREFERENCIAS;
      const novo = mudar(atual);
      queryClient.setQueryData(chave, novo);
      pendente.current = novo;
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        temporizador.current = undefined;
        void enviar();
      }, ESPERA_PARA_SALVAR_MS);
    },
    // `chave` é recriada a cada render com o mesmo conteúdo; a identidade que importa é a da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, chaveDaTela, enviar],
  );

  return {
    preferencias: query.data ?? SEM_PREFERENCIAS,
    carregando: query.isLoading,
    atualizar,
  };
}
