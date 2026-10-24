"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { CHAVE_DAS_TAXAS, useTaxasDePagamento } from "@/hooks/financeiro/useTaxasDePagamento";
import { apiClient } from "@/lib/api/client";
import { rotuloDaFormaComTaxas } from "@/lib/financeiro/taxas";
import { rotuloDaForma } from "@/lib/vendas";
import { Check, Plus } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Props {
  valor: string;
  aoEscolher: (forma: string) => void;
  className?: string;
}

/**
 * A forma de pagamento num popup (o mesmo desenho do seletor de períodos): Pix, Cartão de Crédito,
 * Cartão de Débito e "Outra". As formas "Outra" criadas ficam cadastradas no Financeiro.
 */
export function SeletorDaFormaDePagamento({ valor, aoEscolher, className }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const taxas = useTaxasDePagamento();
  const [aberto, setAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const lista = taxas.data ?? [];
  const personalizadas = lista.filter((x) => x.is_custom);
  const principais: Array<{ id: string; rotulo: string }> = [
    { id: "pix", rotulo: t("Pix") },
    { id: "cartao_credito", rotulo: t("Cartão de Crédito") },
    { id: "cartao_debito", rotulo: t("Cartão de Débito") },
  ];
  const rotuloAtual = valor
    ? (principais.find((p) => p.id === valor)?.rotulo ??
      rotuloDaFormaComTaxas(t, valor, lista) ??
      rotuloDaForma(t, valor))
    : t("Escolher…");

  async function criar() {
    const limpo = nome.trim();
    if (limpo.length < 2) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await apiClient.put<{ data: { forma: string } }>("/api/v1/financeiro/taxas", {
        forma: limpo,
        name: limpo,
        payer: "company",
      });
      await qc.invalidateQueries({ queryKey: CHAVE_DAS_TAXAS });
      aoEscolher(r.data.forma);
      setNome("");
      setCriando(false);
      setAberto(false);
    } catch {
      setErro(t("Não foi possível criar a forma de pagamento."));
    } finally {
      setSalvando(false);
    }
  }

  const item = (id: string, rotulo: string) => (
    <button
      key={id}
      type="button"
      onClick={() => {
        aoEscolher(id);
        setAberto(false);
      }}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary",
        id === valor && "bg-secondary",
      )}
    >
      <span>{rotulo}</span>
      {id === valor ? <Check size={14} className="text-primary" aria-hidden /> : null}
    </button>
  );

  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) {
          setCriando(false);
          setErro(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("Forma de pagamento")}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-xl border bg-card px-3 text-left text-sm hover:bg-secondary/50",
            className,
          )}
        >
          <span className={cn(!valor && "text-muted-foreground")}>{rotuloAtual}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        <div className="space-y-0.5">
          {principais.map((p) => item(p.id, p.rotulo))}
          {personalizadas.length > 0 ? (
            <div className="my-1 border-t pt-1">
              {personalizadas.map((p) =>
                item(p.forma, p.name ?? rotuloDaFormaComTaxas(t, p.forma, lista) ?? p.forma),
              )}
            </div>
          ) : null}
          <div className="mt-1 border-t pt-1">
            {criando ? (
              <div className="space-y-1.5 p-1">
                <input
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void criar();
                  }}
                  placeholder={t("Nome da nova forma de pagamento")}
                  className="h-9 w-full rounded-lg border bg-card px-2 text-sm outline-hidden focus:border-primary/60"
                />
                {erro ? <p className="text-xs text-error-fg">{erro}</p> : null}
                <button
                  type="button"
                  disabled={salvando || nome.trim().length < 2}
                  onClick={() => void criar()}
                  className="h-8 w-full rounded-lg bg-primary text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {t("Criar e usar")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCriando(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
              >
                <Plus size={14} aria-hidden />
                {t("Outra…")}
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
