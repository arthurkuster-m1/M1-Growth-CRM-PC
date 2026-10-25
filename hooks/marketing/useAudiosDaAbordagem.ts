"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import { ApiError, type ApiErrorBody } from "@/lib/api/types";
import { randomId } from "@/lib/random-id";

export interface AudioDaBiblioteca {
  id: string;
  name: string;
  mime: string;
  size_bytes: number;
  created_at: string;
}

const KEY = ["audios-da-abordagem"] as const;
const id = randomId;

/** A biblioteca de áudios gravados da empresa: listar, enviar um arquivo de voz e remover. */
export function useAudiosDaAbordagem(ativo: boolean) {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: KEY,
    enabled: ativo,
    queryFn: async () =>
      (await apiClient.get<{ data: { audios: AudioDaBiblioteca[] } }>("/api/v1/approach-audios"))
        .data.audios,
    staleTime: 30_000,
  });
  const enviar = useMutation({
    mutationFn: async (a: { file: File; name?: string }) => {
      const form = new FormData();
      form.append("file", a.file);
      if (a.name) form.append("name", a.name);
      const res = await fetch("/api/v1/approach-audios", {
        method: "POST",
        headers: { "Idempotency-Key": id() },
        body: form,
        credentials: "same-origin",
      });
      const text = await res.text();
      const parsed = text ? JSON.parse(text) : null;
      if (!res.ok) {
        const e = (parsed as ApiErrorBody | null)?.error;
        throw new ApiError(
          res.status,
          e?.code ?? "unknown_error",
          e?.details,
          e?.request_id ?? id(),
          e?.message,
        );
      }
      return (parsed as { data: { audio: AudioDaBiblioteca } }).data.audio;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
    onError: (e) => showApiError(e),
  });
  const remover = useMutation({
    mutationFn: async (audioId: string) => apiClient.delete(`/api/v1/approach-audios/${audioId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
    onError: (e) => showApiError(e),
  });
  return { audios: consulta.data ?? [], carregando: consulta.isLoading, enviar, remover };
}
