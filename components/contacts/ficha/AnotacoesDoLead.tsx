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
import { Star, Trash } from "@/lib/ui/icons";

interface Anotacao {
  id: string;
  titulo: string;
  texto: string;
  fixada: boolean;
  criada_em: string;
  /** A oportunidade em que foi escrita (nulo = do contato). */
  lead_id?: string | null;
  funil?: string | null;
  campanha?: string | null;
}

/**
 * ANOTAÇÕES: o que a equipe quer lembrar do lead. O agente de IA também lê estas anotações.
 * É a MESMA lista no perfil do lead (todas as oportunidades, cada anotação marcada com o funil e a
 * campanha de onde veio) e na página da oportunidade (`leadId`: só as dela).
 */
export function AnotacoesDoLead({
  contactId,
  leadId,
  podeEditar,
  semBloco = false,
  semLista = false,
  aoAdicionar,
}: {
  contactId: string;
  /** Só as anotações desta oportunidade (e as novas nascem presas a ela). */
  leadId?: string;
  podeEditar: boolean;
  /** Sem os cartões da ficha em volta (para usar dentro do popup da oportunidade). */
  semBloco?: boolean;
  /** Só o formulário de nova anotação (para o atalho do topo da ficha). */
  semLista?: boolean;
  aoAdicionar?: () => void;
}) {
  const t = useT();
  const locale = useLocaleDeData();
  const qc = useQueryClient();
  const base = ["anotacoes-do-lead", contactId] as const;
  const chave = [...base, leadId ?? "todas"] as const;
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");

  const lista = useQuery({
    queryKey: chave,
    staleTime: 10_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: Anotacao[] }>(
          `/api/v1/contacts/${contactId}/anotacoes${leadId ? `?lead_id=${leadId}` : ""}`,
        )
      ).data,
  });
  const adicionar = useMutation({
    mutationFn: async () =>
      apiClient.post(`/api/v1/contacts/${contactId}/anotacoes`, {
        titulo,
        texto,
        ...(leadId ? { lead_id: leadId } : {}),
      }),
    onSuccess: () => {
      setTitulo("");
      setTexto("");
      void qc.invalidateQueries({ queryKey: base });
      aoAdicionar?.();
    },
    onError: showApiError,
  });
  const fixar = useMutation({
    mutationFn: async (n: { id: string; fixada: boolean }) =>
      apiClient.patch(`/api/v1/contacts/${contactId}/anotacoes/${n.id}`, { fixada: n.fixada }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: base }),
    onError: showApiError,
  });
  const remover = useMutation({
    mutationFn: async (id: string) =>
      apiClient.delete(`/api/v1/contacts/${contactId}/anotacoes/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: base }),
    onError: showApiError,
  });

  // Função (e não componente declarado aqui dentro): um componente novo a cada render remontaria os
  // campos e tiraria o foco de quem está digitando.
  const cartao = (tituloDoCartao: string, cor: "yellow" | "orange", children: React.ReactNode) =>
    semBloco ? (
      <div className="grid gap-2">
        {tituloDoCartao ? (
          <p className="text-xs font-medium text-muted-foreground">{tituloDoCartao}</p>
        ) : null}
        {children}
      </div>
    ) : (
      <BlocoDaFicha titulo={tituloDoCartao} cor={cor}>
        {children}
      </BlocoDaFicha>
    );

  return (
    <div className="grid gap-4">
      {podeEditar
        ? cartao(
            semBloco ? "" : t("Nova anotação"),
            "yellow",
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
            </div>,
          )
        : null}

      {cartao(
        `${t("Anotações")} (${lista.data?.length ?? 0})`,
        "orange",
        <>
          {lista.isLoading ? (
            <div className="h-16 animate-pulse rounded-lg bg-secondary" />
          ) : (lista.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Nenhuma anotação ainda.")}</p>
          ) : (
            <ul className="grid gap-2">
              {(lista.data ?? []).map((n) => (
                <li
                  key={n.id}
                  className={`rounded-xl border border-l-4 p-3 ${n.fixada ? "border-l-yellow-500 bg-yellow-500/5" : "border-l-gray-300"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {!leadId && (n.funil || n.campanha) ? (
                        <p className="mb-1 inline-flex flex-wrap items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {[n.funil, n.campanha].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      {n.titulo ? (
                        <p className="text-sm font-semibold break-words">{n.titulo}</p>
                      ) : null}
                      <p className="text-sm break-words whitespace-pre-wrap">{n.texto}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {format(new Date(n.criada_em), "dd/MM/yyyy HH:mm", { locale })}
                      </p>
                    </div>
                    {podeEditar ? (
                      <button
                        type="button"
                        aria-label={n.fixada ? t("Desafixar anotação") : t("Fixar como importante")}
                        title={
                          n.fixada
                            ? t("Importante — clique para desafixar")
                            : t("Marcar como importante")
                        }
                        onClick={() => fixar.mutate({ id: n.id, fixada: !n.fixada })}
                        className={
                          n.fixada
                            ? "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-yellow-500 hover:bg-secondary"
                            : "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-yellow-500"
                        }
                      >
                        <Star size={14} weight={n.fixada ? "fill" : "regular"} aria-hidden />
                      </button>
                    ) : null}
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
        </>,
      )}
    </div>
  );
}
