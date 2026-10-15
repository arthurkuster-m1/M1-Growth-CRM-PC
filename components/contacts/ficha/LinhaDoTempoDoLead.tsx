"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { BlocoDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { TimelineView } from "@/components/contacts/TimelineView";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  ACOES_DO_LEAD,
  RESULTADOS_DA_LIGACAO,
  type IdDaAcao,
} from "@/lib/leads/acoes-do-lead";
import { cn } from "@/lib/utils";

/**
 * A LINHA DO TEMPO: tudo o que aconteceu com o lead, num fluxo só (atividades, timeline, funis,
 * vendas, tarefas…), e os botões para registrar à mão uma ação (ligação + resultado, mensagem
 * enviada, remarcou…).
 */
export function LinhaDoTempoDoLead({
  contactId,
  podeEditar,
}: {
  contactId: string;
  podeEditar: boolean;
}) {
  const t = useT();
  return (
    <div className="grid gap-4">
      <RegistrarAcaoDoLead contactId={contactId} podeEditar={podeEditar} />
      <BlocoDaFicha titulo={t("Histórico")} cor="blue">
        <TimelineView contactId={contactId} />
      </BlocoDaFicha>
    </div>
  );
}

/** O bloco "Registrar ação" (ligação + resultado, mensagem enviada, remarcou…): usado aqui e na Visão geral. */
export function RegistrarAcaoDoLead({
  contactId,
  contactIds,
  podeEditar,
  semBloco = false,
  aoRegistrar,
}: {
  /** Um lead (a ficha). Em massa, passe `contactIds`. */
  contactId?: string;
  /** Vários leads de uma vez: a mesma ação é registrada na linha do tempo de cada um. */
  contactIds?: readonly string[];
  podeEditar: boolean;
  /** Sem o cartão da ficha em volta (para usar dentro de um popup). */
  semBloco?: boolean;
  aoRegistrar?: () => void;
}) {
  const alvos = contactIds ?? (contactId ? [contactId] : []);
  const t = useT();
  const qc = useQueryClient();
  const [acao, setAcao] = useState<IdDaAcao | null>(null);
  const [titulo, setTitulo] = useState("");
  const [resultado, setResultado] = useState("");
  const [comentario, setComentario] = useState("");
  const [comTag, setComTag] = useState(false);
  const [tag, setTag] = useState("");

  function escolher(id: IdDaAcao | null) {
    setAcao(id);
    const a = ACOES_DO_LEAD.find((x) => x.id === id);
    const padrao = a && "tagPadrao" in a ? a.tagPadrao : "";
    setComTag(Boolean(padrao));
    setTag(padrao);
    setTitulo("");
    setResultado("");
    setComentario("");
  }

  const registrar = useMutation({
    mutationFn: async () => {
      const corpo = {
        acao,
        ...(titulo.trim() ? { titulo: titulo.trim() } : {}),
        ...(resultado ? { resultado } : {}),
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
        ...(comTag && tag.trim() ? { tag: tag.trim() } : {}),
      };
      let tagFinal: string | null = null;
      let falhas = 0;
      for (const id of alvos) {
        try {
          const r = await apiClient.post<{ data: { tag: string | null } }>(
            `/api/v1/contacts/${id}/atividades`,
            corpo,
          );
          tagFinal = (r as { data?: { tag?: string | null } } | undefined)?.data?.tag ?? tagFinal;
        } catch {
          falhas += 1;
        }
      }
      return { tagFinal, falhas, total: alvos.length };
    },
    onSuccess: ({ tagFinal, falhas, total }) => {
      if (falhas === total) {
        toast.error(t("Não foi possível registrar a ação."));
        return;
      }
      if (total > 1) {
        toast.success(
          `${t("Ação registrada em")} ${total - falhas} ${t("leads")}${
            falhas > 0 ? ` · ${falhas} ${t("falharam")}` : ""
          }`,
        );
      } else {
        toast.success(
          tagFinal
            ? `${t("Ação registrada. Tag:")} ${tagFinal}`
            : t("Ação registrada no histórico"),
        );
      }
      void qc.invalidateQueries({ queryKey: ["contact"] });
      void qc.invalidateQueries({ queryKey: ["clientes"] });
      aoRegistrar?.();
      escolher(null);
      void qc.invalidateQueries({ queryKey: ["contact-timeline"] });
      void qc.invalidateQueries({ queryKey: ["timeline"] });
      void qc.invalidateQueries();
    },
    onError: showApiError,
  });
  const atual = ACOES_DO_LEAD.find((a) => a.id === acao);
  const exigeTitulo = Boolean(atual && "exigeTitulo" in atual && atual.exigeTitulo);
  const podeRegistrar = !exigeTitulo || titulo.trim().length >= 3;

  if (!podeEditar) return null;
  const envolver = (children: React.ReactNode) =>
    semBloco ? (
      <div>{children}</div>
    ) : (
      <BlocoDaFicha titulo={t("Registrar ação")} cor="purple">
        {children}
      </BlocoDaFicha>
    );
  return (
    <div className="grid gap-4">
      {podeEditar ? (
        envolver(
        <>
          <div className="flex flex-wrap gap-2">
            {ACOES_DO_LEAD.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => escolher(a.id === acao ? null : a.id)}
                className={cn(
                  "rounded-full border-[1.5px] px-3 py-1 text-xs font-medium transition-colors",
                  a.id === acao
                    ? "border-purple-500 bg-purple-500/15"
                    : "border-border hover:border-purple-400 hover:bg-secondary",
                )}
              >
                {t(a.rotulo)}
              </button>
            ))}
          </div>
          {atual ? (
            <div className="mt-3 grid gap-2">
              {exigeTitulo ? (
                <div className="grid gap-1">
                  <label className="text-xs font-medium">{t("O que foi feito? (obrigatório)")}</label>
                  <Input
                    value={titulo}
                    maxLength={80}
                    placeholder={t("Ex.: Visitou a loja, Enviou contrato…")}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>
              ) : null}
              {atual.comResultado ? (
                <div className="grid gap-1">
                  <label className="text-xs font-medium">{t("Resultado")}</label>
                  <Input
                    list="resultados-da-acao"
                    value={resultado}
                    maxLength={200}
                    placeholder={t("Escolha ou escreva o resultado")}
                    onChange={(e) => setResultado(e.target.value)}
                  />
                  <datalist id="resultados-da-acao">
                    {RESULTADOS_DA_LIGACAO.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>
              ) : null}
              <Textarea
                rows={2}
                value={comentario}
                maxLength={800}
                placeholder={t("Comentário do atendente (opcional)")}
                onChange={(e) => setComentario(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2 rounded-xl border p-2.5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={comTag}
                    onChange={(e) => setComTag(e.target.checked)}
                  />
                  {t("Marcar o lead com uma tag")}
                </label>
                {comTag ? (
                  <Input
                    value={tag}
                    maxLength={30}
                    placeholder={t("Nome da tag (ex.: No Show)")}
                    onChange={(e) => setTag(e.target.value)}
                    className="h-8 w-56"
                  />
                ) : null}
                {comTag && tag.trim() ? (
                  <span className="text-xs text-muted-foreground">
                    {t("Se o lead já tiver essa tag, ela vira")} “{tag.trim()}: 2x”.
                  </span>
                ) : null}
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => escolher(null)}>
                  {t("Cancelar")}
                </Button>
                <Button
                  size="sm"
                  disabled={registrar.isPending || !podeRegistrar}
                  onClick={() => registrar.mutate()}
                >
                  {registrar.isPending ? t("Registrando…") : t("Registrar no histórico")}
                </Button>
              </div>
            </div>
          ) : null}
        </>,
        )
      ) : null}
    </div>
  );
}
