"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { useDadosDosNegocios } from "@/components/contacts/ficha/dados-da-ficha";
import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { toast } from "sonner";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { corDaEtapa as corDaEtapaDoFunil } from "@/lib/funil/cores-da-etapa";
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

  const negocios = useDadosDosNegocios(venda.lead_id ? [venda.lead_id] : []);
  const negocio = negocios.dados[0];
  const etapas = negocio?.negocio.etapas ?? [];
  const etapaAtualId = negocio?.negocio.etapa_id ?? venda.etapa_id ?? "";
  const corDaEtapa = (e: { nome: string; color?: string | null; ganho: boolean; perdido: boolean }) =>
    corDaEtapaDoFunil({ name: e.nome, color: e.color, is_won: e.ganho, is_lost: e.perdido });

  /** Etapa em andamento: move aqui mesmo. Ganho e perda pedem pagamento/motivo — abrem a oportunidade. */
  async function mudarEtapa(id: string) {
    if (!id || id === etapaAtualId) return;
    const alvo = etapas.find((e) => e.id === id);
    if (alvo?.ganho || alvo?.perdido) {
      toast.info(t("Para concluir (ganho ou perdido) abra a oportunidade."));
      aoAbrir();
      return;
    }
    try {
      await apiClient.post(`/api/v1/leads/${venda.lead_id}/move`, {
        stage_id: id,
        position_in_stage: Date.now(),
        expected_updated_at: negocio?.sistema.atualizado_em,
      });
      negocios.recarregar();
      void qc.invalidateQueries({ queryKey: ["vendas-do-cliente", contactId] });
      void qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(t("Etapa atualizada"));
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <div className="min-w-0 rounded-xl border bg-card">
      <button
        type="button"
        onClick={aoAbrir}
        title={t("Abrir a oportunidade")}
        className="block w-full min-w-0 rounded-t-xl px-3 pt-2 text-left hover:bg-secondary/50"
      >
        <span className="block text-sm font-medium break-words">
          {nomeDaVenda(venda) || t("Oportunidade")}
        </span>
        <span className="block text-xs break-words text-muted-foreground">
          {[venda.funil, venda.origem].filter(Boolean).join(" · ") || "—"}
        </span>
      </button>
      <div className="grid gap-1 px-3 pt-1.5 pb-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t("Etapa")}
        </p>
        {etapas.length > 0 ? (
          <SeletorEmPopup
            rotulo={t("Etapa da oportunidade")}
            valor={etapaAtualId}
            desabilitado={!podeEditar}
            opcoes={etapas.map((e) => ({ id: e.id, rotulo: e.nome, cor: corDaEtapa(e) }))}
            aoEscolher={(id) => void mudarEtapa(id)}
            className="w-full"
          />
        ) : venda.etapa ? (
          <Etiqueta ponto cor="blue">
            {venda.etapa}
          </Etiqueta>
        ) : null}
      </div>
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
