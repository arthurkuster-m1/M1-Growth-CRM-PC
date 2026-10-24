"use client";
/**
 * AS TAXAS DAS FORMAS DE PAGAMENTO. Cada forma tem a sua taxa e diz quem paga: o cliente final ou
 * a empresa. A taxa paga pela empresa é custo variável (aparece no dashboard Business) e dá o valor
 * líquido do que entra. No cartão de crédito a taxa muda com o número de parcelas.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { CHAVE_DAS_TAXAS, useTaxasDePagamento } from "@/hooks/financeiro/useTaxasDePagamento";
import { apiClient } from "@/lib/api/client";
import type { QuemPaga, TaxaDaForma } from "@/lib/financeiro/taxas";

const PARCELAS = Array.from({ length: 12 }, (_, i) => i + 1);

const bpsParaTexto = (bps: number | undefined) =>
  bps === undefined ? "" : (bps / 100).toFixed(2).replace(".", ",");
const textoParaBps = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
};
const centavosParaTexto = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const textoParaCentavos = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
};

function Linha({ taxa, podeEditar }: { taxa: TaxaDaForma; podeEditar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const credito = taxa.forma === "cartao_credito";
  const [payer, setPayer] = useState<QuemPaga>(taxa.payer);
  const [pct, setPct] = useState(bpsParaTexto(taxa.percent_bps));
  const [fixo, setFixo] = useState(centavosParaTexto(taxa.fixed_cents));
  const [porParcela, setPorParcela] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(taxa.installment_bps).map(([k, v]) => [k, bpsParaTexto(v)]),
    ),
  );
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const titulo =
    taxa.name ??
    (taxa.forma === "pix"
      ? t("Pix")
      : taxa.forma === "cartao_credito"
        ? t("Cartão de Crédito")
        : t("Cartão de Débito"));

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      const installment_bps: Record<string, number> = {};
      if (credito) {
        for (const [k, v] of Object.entries(porParcela)) {
          if (v.trim() !== "") installment_bps[k] = textoParaBps(v);
        }
      }
      await apiClient.put("/api/v1/financeiro/taxas", {
        forma: taxa.forma,
        name: taxa.name,
        payer,
        percent_bps: textoParaBps(pct),
        fixed_cents: textoParaCentavos(fixo),
        installment_bps,
      });
      await qc.invalidateQueries({ queryKey: CHAVE_DAS_TAXAS });
      setMsg(t("Salvo."));
    } catch {
      setMsg(t("Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    await apiClient.delete(`/api/v1/financeiro/taxas?forma=${encodeURIComponent(taxa.forma)}`);
    await qc.invalidateQueries({ queryKey: CHAVE_DAS_TAXAS });
  }

  const campo =
    "h-9 w-24 rounded-lg border bg-card px-2 text-right text-sm tabular-nums disabled:opacity-60";

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {taxa.is_custom && podeEditar ? (
          <button
            type="button"
            onClick={() => void remover()}
            className="text-xs text-muted-foreground hover:text-error-fg"
          >
            {t("Remover forma")}
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("Quem paga a taxa")}
          <select
            value={payer}
            disabled={!podeEditar}
            onChange={(e) => setPayer(e.target.value as QuemPaga)}
            className="h-9 rounded-xl border bg-card px-2 text-sm"
          >
            <option value="company">{t("Nós (a empresa)")}</option>
            <option value="client">{t("O cliente final")}</option>
          </select>
        </label>
        {!credito ? (
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("Taxa (%)")}
            <input
              value={pct}
              disabled={!podeEditar}
              inputMode="decimal"
              onChange={(e) => setPct(e.target.value.replace(/[^\d.,]/g, ""))}
              className={campo}
            />
          </label>
        ) : null}
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("Taxa fixa por cobrança (R$)")}
          <input
            value={fixo}
            disabled={!podeEditar}
            inputMode="decimal"
            onChange={(e) => setFixo(e.target.value.replace(/[^\d.,]/g, ""))}
            className={campo}
          />
        </label>
      </div>
      {credito ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {t("Taxa (%) de cada número de parcelas. Deixe em branco para usar a anterior.")}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {PARCELAS.map((n) => (
              <label key={n} className="grid gap-1 text-xs text-muted-foreground">
                {n}x
                <input
                  value={porParcela[String(n)] ?? ""}
                  disabled={!podeEditar}
                  inputMode="decimal"
                  onChange={(e) =>
                    setPorParcela((a) => ({
                      ...a,
                      [String(n)]: e.target.value.replace(/[^\d.,]/g, ""),
                    }))
                  }
                  className="h-9 w-full rounded-xl border bg-card px-2 text-right text-sm tabular-nums"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}
      {podeEditar ? (
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={salvando} onClick={() => void salvar()}>
            {t("Salvar taxa")}
          </Button>
          {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function TaxasDePagamento({ podeEditar }: { podeEditar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const taxas = useTaxasDePagamento();
  const [nome, setNome] = useState("");

  async function criar() {
    const limpo = nome.trim();
    if (limpo.length < 2) return;
    await apiClient.put("/api/v1/financeiro/taxas", { forma: limpo, name: limpo, payer: "company" });
    setNome("");
    await qc.invalidateQueries({ queryKey: CHAVE_DAS_TAXAS });
  }

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">{t("Taxas das formas de pagamento")}</h2>
      <p className="text-sm text-text-muted">
        {t(
          "A taxa de cada forma ajuda a saber o valor líquido que recebemos. Quando a empresa paga a taxa, ela vira custo variável e aparece no dashboard Business. No cartão de crédito a taxa muda com o número de parcelas.",
        )}
      </p>
      {taxas.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>
      ) : (
        <div className="space-y-3">
          {(taxas.data ?? []).map((x) => (
            <Linha key={`${x.forma}:${x.payer}:${x.percent_bps}:${x.fixed_cents}`} taxa={x} podeEditar={podeEditar} />
          ))}
        </div>
      )}
      {podeEditar ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void criar();
            }}
            placeholder={t("Nova forma de pagamento (Outra)")}
            className="h-9 w-64 rounded-xl border bg-card px-2 text-sm"
          />
          <Button size="sm" variant="outline" onClick={() => void criar()} disabled={nome.trim().length < 2}>
            {t("Adicionar forma")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
