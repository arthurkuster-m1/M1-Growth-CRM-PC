"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  salvarRegraMetaDaEtapa,
  type RegraMetaDaEtapa,
} from "@/app/actions/settings/regraMetaDaEtapa";
import { SelectDoApp } from "@/components/ui/SelectDoApp";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/hooks/i18n/useT";
import {
  ehNomeDeEventoValido,
  EVENTOS_DA_META,
  eventoRecomendadoParaMeta,
  rotuloDoEventoDaMeta,
} from "@/lib/conversoes/regras-meta";
import { cn } from "@/lib/utils";

const NOVO = "__novo__";

const ERRO: Record<string, string> = {
  forbidden_role: "Só um administrador da empresa pode mudar os eventos da Meta CAPI.",
  mfa_required: "Confirme o segundo fator para salvar esta mudança.",
  etapa_invalida: "Esta etapa não envia evento (ganho é a compra; perda não é conversão).",
  validation_failed: "Nome inválido: comece com letra e use só letras, números e _ (até 40).",
  unauthenticated: "Sua sessão expirou. Entre de novo.",
};

/**
 * O BLOQUINHO "Meta CAPI" de cada etapa do Funil de conversão: liga o envio de um evento da Meta
 * quando o negócio ENTRA na etapa e escolhe qual — um dos padrões da Meta ou um evento
 * personalizado que a própria pessoa cria aqui (e que depois aparece na lista de todas as etapas).
 */
export function EventoMetaDaEtapa({
  etapa,
  regra,
  personalizados,
  conectada,
  ligada,
  podeEditar,
  aoSalvar,
}: {
  etapa: { id: string; name: string; is_won: boolean; is_lost: boolean };
  regra: RegraMetaDaEtapa | null;
  personalizados: readonly string[];
  conectada: boolean;
  ligada: boolean;
  podeEditar: boolean;
  /** A regra foi gravada: o pai atualiza a lista (e a de eventos personalizados). */
  aoSalvar: (regra: RegraMetaDaEtapa) => void;
}) {
  const t = useT();
  const [pendente, iniciar] = useTransition();
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  if (etapa.is_won || etapa.is_lost) {
    return (
      <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground sm:col-span-2">
        {etapa.is_won
          ? t("Meta CAPI: ao ganhar, a venda sai sozinha como Compra (Purchase), com o valor.")
          : t("Meta CAPI: perda não é conversão — esta etapa não envia evento.")}
      </div>
    );
  }

  const ativa = regra?.enabled === true;
  const atual = regra?.metaEvent ?? eventoRecomendadoParaMeta(etapa.name) ?? "LeadSubmitted";
  const padrao = EVENTOS_DA_META.some((e) => e.valor === atual);
  const lista =
    personalizados.includes(atual) || padrao ? personalizados : [...personalizados, atual];

  function gravar(enabled: boolean, metaEvent: string) {
    iniciar(async () => {
      const r = await salvarRegraMetaDaEtapa({
        stage_id: etapa.id,
        enabled,
        meta_event: metaEvent,
      });
      if (r.ok) {
        aoSalvar({ stageId: etapa.id, enabled, metaEvent });
        toast.success(
          enabled
            ? `${t("Esta etapa envia")} “${rotuloDoEventoDaMeta(metaEvent)}” ${t("à Meta CAPI.")}`
            : t("Esta etapa não envia mais evento à Meta."),
        );
        return;
      }
      toast.error(t(ERRO[r.error] ?? "Não consegui salvar agora."));
    });
  }

  function criar() {
    const nome = novoNome.trim();
    if (!ehNomeDeEventoValido(nome)) {
      toast.error(t(ERRO.validation_failed!));
      return;
    }
    setCriando(false);
    setNovoNome("");
    gravar(true, nome);
  }

  return (
    <div
      className="grid gap-2 rounded-xl border p-3 sm:col-span-2"
      data-testid={`meta-capi-${etapa.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t("Meta CAPI — evento desta etapa")}</p>
          <p className="text-xs text-muted-foreground">
            {ativa
              ? `${t("Quando um negócio entrar aqui, envia")} “${rotuloDoEventoDaMeta(atual)}”.`
              : t("Não envia evento à Meta quando um negócio entra aqui.")}
          </p>
        </div>
        <Switch
          checked={ativa}
          disabled={!podeEditar || pendente}
          onCheckedChange={(v) => gravar(v, atual)}
          aria-label={`${t("Enviar evento à Meta CAPI ao entrar em")} «${etapa.name}»`}
        />
      </div>

      {ativa || criando ? (
        <div className="grid gap-2 sm:max-w-md">
          <SelectDoApp
            aria-label={t("Evento enviado à Meta")}
            value={criando ? NOVO : atual}
            disabled={!podeEditar || pendente}
            className="h-10 rounded-xl border bg-background px-3 text-sm"
            onChange={(e) => {
              if (e.target.value === NOVO) {
                setCriando(true);
                return;
              }
              setCriando(false);
              gravar(true, e.target.value);
            }}
          >
            <optgroup label={t("Eventos padrão da Meta")}>
              {EVENTOS_DA_META.map((ev) => (
                <option key={ev.valor} value={ev.valor}>
                  {t(ev.rotulo)} ({ev.valor})
                </option>
              ))}
            </optgroup>
            {lista.length > 0 ? (
              <optgroup label={t("Meus eventos personalizados")}>
                {lista.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome} ({t("personalizado")})
                  </option>
                ))}
              </optgroup>
            ) : null}
            <option value={NOVO}>{t("+ Criar evento personalizado…")}</option>
          </SelectDoApp>

          {criando ? (
            <div className="grid gap-1.5">
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={novoNome}
                  maxLength={40}
                  placeholder="AgendouVisita"
                  aria-label={t("Nome do evento personalizado")}
                  onChange={(e) => setNovoNome(e.target.value.replace(/\s/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      criar();
                    }
                  }}
                  className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={criar}
                  disabled={pendente || !ehNomeDeEventoValido(novoNome)}
                  className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {t("Criar e usar")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCriando(false);
                    setNovoNome("");
                  }}
                  className="h-10 rounded-xl border px-3 text-sm hover:bg-secondary"
                >
                  {t("Cancelar")}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Letras, números e _ (começa com letra, até 40). Evento personalizado chega à Meta e aparece nos relatórios, mas não alimenta a otimização padrão do anúncio.",
                )}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {!conectada || !ligada ? (
        <p className={cn("rounded-lg px-3 py-2 text-xs", "bg-warning-bg text-warning-fg")}>
          {!conectada
            ? t(
                "A Meta CAPI ainda não está conectada: o evento só sai depois de preencher o dataset e o token em",
              )
            : t("A Meta CAPI está pausada: o evento só sai depois de ligá-la em")}{" "}
          <Link className="font-medium underline" href="/app/connections?aba=meta-ads">
            {t("Conexões › Meta Ads")}
          </Link>
          .
        </p>
      ) : null}
      {!podeEditar ? (
        <p className="text-xs text-muted-foreground">
          {t("Só um administrador da empresa muda o evento da Meta CAPI.")}
        </p>
      ) : null}
    </div>
  );
}
