"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

/**
 * A CAPTURA RÁPIDA: guarda um texto na Caixa de entrada. Usada na tela de Anotações e no cartão do Início.
 *
 * Depois de guardar, relê a árvore e esquece a página da Caixa de entrada que estivesse em cache;
 * `versao` sobe a cada captura, para quem mostra essa página remontar o editor (em vez de o
 * salvamento sozinho sobrescrever o que acabou de entrar).
 */
export function useCapturaDeNotas(aoAbrir: (id: string) => void) {
  const t = useT();
  const queryClient = useQueryClient();
  const [versao, setVersao] = useState(0);

  const capturar = useCallback(
    async (texto: string): Promise<boolean> => {
      try {
        const r = await apiClient.post<{ data: { page_id: string } }>("/api/v1/anotacoes/captura", {
          texto,
        });
        queryClient.removeQueries({ queryKey: ["anotacoes", "pagina", r.data.page_id] });
        await queryClient.invalidateQueries({ queryKey: ["anotacoes", "arvore"] });
        setVersao((v) => v + 1);
        toast.success(t("Guardado na Caixa de entrada."), {
          action: { label: t("Abrir"), onClick: () => aoAbrir(r.data.page_id) },
        });
        return true;
      } catch (erro) {
        showApiError(erro);
        return false;
      }
    },
    [queryClient, t, aoAbrir],
  );

  return { capturar, versao };
}
