"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";

import { BlocoDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { Trash } from "@/lib/ui/icons";

interface Anotacao {
  id: string;
  titulo: string;
  texto: string;
  criada_em: string;
}

/** ANOTAÇÕES: o que a equipe quer lembrar do lead. O agente de IA também lê estas anotações. */
export function AnotacoesDoLead({ contactId, podeEditar }: { contactId: string; podeEditar: boolean }) {
  const t = useT();
  const locale = useLocaleDeData();
  const qc = useQueryClient();
  const chave = ["anotacoes-do-lead", contactId] as const;
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");

  const lista = useQuery({
    queryKey: chave,
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: Anotacao[] }>(`/api/v1/contacts/${contactId}/anotacoes`)).data,
  });
  const adicionar = useMutation({
    mutationFn: async () =>
      apiClient.post(`/api/v1/contacts/${contactId}/anotacoes`, { titulo, texto }),
    onSuccess: () => {
      setTitulo("");
      setTexto("");
      void qc.invalidateQueries({ queryKey: chave });
    },
    onError: showApiError,
  });
  const remover = useMutation({
    mutationFn: async (id: string) =>
      apiClient.delete(`/api/v1/contacts/${contactId}/anotacoes/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chave }),
    onError: showApiError,
  });

  return (
    <div className="grid gap-4">
      {podeEditar ? (
        <BlocoDaFicha titulo={t("Nova anotação")} cor="yellow">
          <div className="grid gap-2">
            <Input
              value={titulo}
              maxLength={120}
              placeholder={t("Título (opcional)")}
              onChange={(e) => setTitulo(e.target.value)}
            />
            <Textarea
              rows={3}
              value={texto}
              maxLength={4000}
              placeholder={t("O que vale lembrar sobre este lead?")}
              onChange={(e) => setTexto(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!texto.trim() || adicionar.isPending}
                onClick={() => adicionar.mutate()}
              >
                {adicionar.isPending ? t("Salvando…") : t("Adicionar anotação")}
              </Button>
            </div>
          </div>
        </BlocoDaFicha>
      ) : null}

      <BlocoDaFicha titulo={`${t("Anotações")} (${lista.data?.length ?? 0})`} cor="orange">
        {lista.isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-secondary" />
        ) : (lista.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Nenhuma anotação ainda.")}</p>
        ) : (
          <ul className="grid gap-2">
            {(lista.data ?? []).map((n) => (
              <li key={n.id} className="rounded-xl border border-l-4 border-l-yellow-400 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {n.titulo ? <p className="text-sm font-semibold break-words">{n.titulo}</p> : null}
                    <p className="text-sm break-words whitespace-pre-wrap">{n.texto}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {format(new Date(n.criada_em), "dd/MM/yyyy HH:mm", { locale })}
                    </p>
                  </div>
                  {podeEditar ? (
                    <button
                      type="button"
                      aria-label={t("Apagar anotação")}
                      onClick={() => remover.mutate(n.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                    >
                      <Trash size={14} aria-hidden />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </BlocoDaFicha>
    </div>
  );
}
