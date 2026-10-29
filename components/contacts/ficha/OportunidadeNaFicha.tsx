"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { nomeDaVenda, type Venda } from "@/lib/vendas";

/**
 * O CARTÃOZINHO DA OPORTUNIDADE ABERTA na ficha: nome, etapa, funil e canal, e embaixo a PRÓXIMA
 * AÇÃO — editável ali mesmo (texto e data), gravada na oportunidade pela mesma rota do pop-up.
 * Clicar no nome/etapa abre a oportunidade.
 */
export function OportunidadeNaFicha({
  venda,
  contactId,
  podeEditar,
  aoAbrir,
}: {
  venda: Venda;
  contactId: string;
  podeEditar: boolean;
  aoAbrir: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [texto, setTexto] = useState(venda.proxima_acao ?? "");
  const [dia, setDia] = useState((venda.proxima_acao_em ?? "").slice(0, 10));
  const gravado = useRef({
    texto: (venda.proxima_acao ?? "").trim(),
    dia: (venda.proxima_acao_em ?? "").slice(0, 10),
  });

  // O que veio do servidor (outra aba, o pop-up) passa a valer quando a própria pessoa não está editando.
  useEffect(() => {
    gravado.current = {
      texto: (venda.proxima_acao ?? "").trim(),
      dia: (venda.proxima_acao_em ?? "").slice(0, 10),
    };
    setTexto(venda.proxima_acao ?? "");
    setDia((venda.proxima_acao_em ?? "").slice(0, 10));
  }, [venda.proxima_acao, venda.proxima_acao_em]);

  async function gravar(novoTexto: string, novoDia: string) {
    const limpo = novoTexto.trim();
    if (limpo === gravado.current.texto && novoDia === gravado.current.dia) return;
    try {
      await apiClient.put(`/api/v1/leads/${venda.lead_id}/proxima-acao`, {
        proxima_acao: limpo,
        proxima_acao_em: novoDia ? new Date(`${novoDia}T09:00:00`).toISOString() : null,
      });
      gravado.current = { texto: limpo, dia: novoDia };
      void qc.invalidateQueries({ queryKey: ["vendas-do-cliente", contactId] });
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <div className="min-w-0 rounded-xl border bg-card">
      <button
        type="button"
        onClick={aoAbrir}
        className="flex w-full min-w-0 items-start justify-between gap-2 rounded-t-xl px-3 py-2 text-left hover:bg-secondary/50"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {nomeDaVenda(venda) || t("Oportunidade")}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[venda.funil, venda.origem].filter(Boolean).join(" · ") || "—"}
          </span>
        </span>
        {venda.etapa ? (
          <Etiqueta ponto cor="blue">
            {venda.etapa}
          </Etiqueta>
        ) : null}
      </button>
      <div className="grid gap-1.5 border-t px-3 py-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t("Próxima ação")}
        </p>
        <input
          value={texto}
          maxLength={300}
          disabled={!podeEditar}
          placeholder={t("O que fazer a seguir?")}
          aria-label={t("Próxima ação")}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => void gravar(texto, dia)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-8 w-full min-w-0 rounded-lg border bg-background px-2 text-sm outline-hidden focus:border-primary/60"
        />
        <CampoDeData
          valor={dia}
          aoMudar={(novo) => {
            setDia(novo);
            void gravar(texto, novo);
          }}
          rotulo={t("Data da próxima ação")}
          placeholder={t("Escolher data")}
          desabilitado={!podeEditar}
          className="w-full"
        />
      </div>
    </div>
  );
}
