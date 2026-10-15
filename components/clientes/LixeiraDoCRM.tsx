"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ROLE_RANK } from "@/lib/auth/types";
import { Trash } from "@/lib/ui/icons";

interface ItemDaLixeira {
  id: string;
  contact_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  resumo: { oportunidades?: number; parcelas?: number; pago_cents?: number; mensagens?: number };
  excluido_em: string;
  expira_em: string;
}

const moeda = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * A LIXEIRA do CRM: os clientes excluídos ficam aqui por 7 dias, com tudo que saiu junto
 * (oportunidades, vendas, conversas, compromissos), e podem ser restaurados. Passados 7 dias,
 * somem de vez, sozinhos.
 */
export function LixeiraDoCRM() {
  const t = useT();
  const queryClient = useQueryClient();
  const org = useActiveOrg();
  const podeApagarDeVez = ROLE_RANK[org?.role ?? "viewer"] >= ROLE_RANK.manager;

  const consulta = useQuery({
    queryKey: ["lixeira"],
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { itens: ItemDaLixeira[] } }>("/api/v1/lixeira")).data.itens,
  });

  const recarregar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["lixeira"] });
    await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    await queryClient.invalidateQueries({ queryKey: ["vendas"] });
  };
  const restaurar = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/lixeira/${id}/restaurar`, {}),
    onSuccess: async () => {
      await recarregar();
      toast.success(t("Cliente restaurado, com tudo que saiu junto"));
    },
    onError: showApiError,
  });
  const apagar = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/lixeira/${id}`),
    onSuccess: recarregar,
    onError: showApiError,
  });

  const itens = consulta.data ?? [];
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [emLote, setEmLote] = useState(false);
  const marcadosVivos = itens.filter((i) => marcados.has(i.id));
  const alternar = (id: string) =>
    setMarcados((a) => {
      const novo = new Set(a);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  /** Restaurar ou apagar de vez vários de uma vez; o que falhar fica marcado e é avisado. */
  async function emMassa(acao: "restaurar" | "apagar") {
    if (marcadosVivos.length === 0) return;
    if (
      acao === "apagar" &&
      !window.confirm(
        t("Apagar de vez os {n} selecionados? Isso não pode ser desfeito.").replace(
          "{n}",
          String(marcadosVivos.length),
        ),
      )
    ) {
      return;
    }
    setEmLote(true);
    let falhas = 0;
    const falharam = new Set<string>();
    for (const i of marcadosVivos) {
      try {
        if (acao === "restaurar") await apiClient.post(`/api/v1/lixeira/${i.id}/restaurar`, {});
        else await apiClient.delete(`/api/v1/lixeira/${i.id}`);
      } catch {
        falhas += 1;
        falharam.add(i.id);
      }
    }
    setMarcados(falharam);
    await recarregar();
    setEmLote(false);
    const feitos = marcadosVivos.length - falhas;
    if (feitos > 0) {
      toast.success(
        acao === "restaurar"
          ? `${feitos} ${t("restaurado(s)")}`
          : `${feitos} ${t("apagado(s) de vez")}`,
      );
    }
    if (falhas > 0) toast.error(`${falhas} ${t("não puderam ser processados.")}`);
  }
  // "Agora" fixado na montagem: a tela não recalcula o relógio a cada render.
  const [agora] = useState(() => Date.now());
  const diasPara = (iso: string) =>
    Math.max(0, Math.ceil((new Date(iso).getTime() - agora) / 86_400_000));

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Lixeira")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Clientes excluídos ficam aqui por 7 dias, com as oportunidades, vendas e conversas deles, para o caso de uma exclusão por engano. Passado esse prazo, são excluídos permanentemente. Se o lead já voltou a falar, ao restaurar o histórico antigo é mesclado ao cadastro novo.",
          )}
        </p>
      </header>

      {consulta.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>
      ) : itens.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          {t("A lixeira está vazia.")}
        </p>
      ) : (
        <>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card px-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={itens.length > 0 && marcadosVivos.length === itens.length}
              onChange={(e) =>
                setMarcados(e.target.checked ? new Set(itens.map((i) => i.id)) : new Set())
              }
            />
            {marcadosVivos.length > 0
              ? `${marcadosVivos.length} ${t("selecionado(s)")}`
              : t("Selecionar todos")}
          </label>
          {marcadosVivos.length > 0 ? (
            <>
              <Button size="sm" disabled={emLote} onClick={() => void emMassa("restaurar")}>
                {t("Restaurar selecionados")}
              </Button>
              {podeApagarDeVez ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-error-fg hover:text-error-fg"
                  disabled={emLote}
                  onClick={() => void emMassa("apagar")}
                >
                  <Trash size={14} aria-hidden className="mr-1" />
                  {t("Apagar de vez selecionados")}
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setMarcados(new Set())}>
                {t("Limpar seleção")}
              </Button>
            </>
          ) : null}
        </div>
        <ul className="grid gap-2">
          {itens.map((i) => {
            const dias = diasPara(i.expira_em);
            return (
              <li
                key={i.id}
                className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-2xl border bg-card p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
              >
                <input
                  type="checkbox"
                  aria-label={`${t("Selecionar")} ${i.nome}`}
                  checked={marcados.has(i.id)}
                  onChange={() => alternar(i.id)}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[i.telefone, i.email].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("Excluído em")} {new Date(i.excluido_em).toLocaleDateString("pt-BR")} ·{" "}
                    <span className={dias <= 1 ? "font-medium text-error-fg" : ""}>
                      {dias <= 0
                        ? t("Será excluído permanentemente hoje")
                        : dias === 1
                          ? t("Será excluído permanentemente em 1 dia")
                          : `${t("Será excluído permanentemente em")} ${dias} ${t("dias")}`}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(i.resumo.oportunidades ?? 0)} {t("oportunidade(s)")} ·{" "}
                    {(i.resumo.parcelas ?? 0)} {t("parcela(s)")}
                    {(i.resumo.pago_cents ?? 0) > 0
                      ? ` · ${moeda(i.resumo.pago_cents ?? 0)} ${t("pagos")}`
                      : ""}
                    {(i.resumo.mensagens ?? 0) > 0
                      ? ` · ${i.resumo.mensagens} ${t("mensagem(ns)")}`
                      : ""}
                  </p>
                </div>
                <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
                  <Button
                    size="sm"
                    disabled={restaurar.isPending}
                    onClick={() => restaurar.mutate(i.id)}
                  >
                    {t("Restaurar")}
                  </Button>
                  {podeApagarDeVez ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-error-fg hover:text-error-fg"
                      disabled={apagar.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            t("Apagar de vez? Isso não pode ser desfeito e leva tudo que ficou aqui."),
                          )
                        )
                          apagar.mutate(i.id);
                      }}
                    >
                      <Trash size={14} aria-hidden className="mr-1" />
                      {t("Apagar de vez")}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}
    </div>
  );
}
