"use client";

import { useState } from "react";

import { BlocosRender, type RotulosDosBlocos } from "@/components/marketing/BlocosRender";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import type { Bloco } from "@/lib/marketing/blocos";
import type { VersaoDaPagina } from "@/lib/marketing/historico";
import { Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * O HISTÓRICO de uma página: a lista de retratos datados do que estava publicado, a leitura de
 * cada um e a comparação lado a lado com a versão de hoje. A agência também salva e apaga
 * retratos aqui; o cliente (e quem abre o link sem login) só lê.
 */
export function HistoricoDaPagina({
  aberto,
  aoFechar,
  versoes,
  carregando,
  atual,
  rotulos,
  agencia,
}: {
  aberto: boolean;
  aoFechar: () => void;
  versoes: readonly VersaoDaPagina[];
  carregando?: boolean;
  /** O que está publicado hoje (para comparar). */
  atual: readonly Bloco[] | null;
  rotulos: RotulosDosBlocos;
  /** Só a agência: salvar um retrato novo e apagar. */
  agencia?: {
    aoSalvar: (nota: string) => Promise<boolean>;
    aoApagar: (id: string) => Promise<boolean>;
    podeSalvar: boolean;
  };
}) {
  const t = useT();
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [comparar, setComparar] = useState(false);
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);

  const versao = versoes.find((v) => v.id === escolhida) ?? versoes[0] ?? null;
  const data = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  async function salvar() {
    if (!agencia) return;
    setSalvando(true);
    if (await agencia.aoSalvar(nota)) {
      setNota("");
      setEscolhida(null);
    }
    setSalvando(false);
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => (o ? null : aoFechar())}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-6xl overflow-hidden p-0">
        <div className="flex max-h-[92dvh] flex-col">
          <div className="border-b p-4 pr-12 sm:p-5">
            <DialogTitle className="text-lg font-semibold">{t("Histórico da página")}</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {t("Como esta página estava em cada data registrada.")}
            </DialogDescription>
            {agencia ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={nota}
                  maxLength={200}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder={t("Observação (opcional): o que mudou?")}
                  aria-label={t("Observação do retrato")}
                  className="h-9 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  disabled={salvando || !agencia.podeSalvar}
                  onClick={() => void salvar()}
                  className="h-9 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("Salvar retrato de hoje")}
                </button>
                {!agencia.podeSalvar ? (
                  <p className="w-full text-xs text-muted-foreground">
                    {t("Publique a página para poder salvar um retrato.")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {carregando ? (
            <p className="p-6 text-sm text-muted-foreground">{t("Carregando…")}</p>
          ) : versoes.length === 0 || !versao ? (
            <p className="p-6 text-sm text-muted-foreground">
              {t("Ainda não há retratos salvos desta página.")}
            </p>
          ) : (
            <div className="grid min-h-0 flex-1 sm:grid-cols-[14rem_1fr]">
              <ul
                aria-label={t("Datas registradas")}
                className="flex gap-1 overflow-x-auto border-b p-2 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0"
              >
                {versoes.map((v) => (
                  <li key={v.id} className="flex shrink-0 items-center gap-1 sm:shrink">
                    <button
                      type="button"
                      aria-pressed={v.id === versao.id}
                      onClick={() => setEscolhida(v.id)}
                      className={cn(
                        "min-w-0 flex-1 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                        v.id === versao.id ? "bg-primary/10 font-medium" : "hover:bg-secondary",
                      )}
                    >
                      <span className="block">{data(v.taken_at)}</span>
                      {v.note ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {v.note}
                        </span>
                      ) : null}
                    </button>
                    {agencia ? (
                      <button
                        type="button"
                        aria-label={t("Apagar retrato")}
                        title={t("Apagar retrato")}
                        onClick={() => void agencia.aoApagar(v.id)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                      >
                        <Trash size={14} aria-hidden />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>

              <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
                {atual ? (
                  <label className="mb-4 inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={comparar}
                      onChange={(e) => setComparar(e.target.checked)}
                    />
                    {t("Comparar com a versão de hoje")}
                  </label>
                ) : null}
                {comparar && atual ? (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <section aria-label={data(versao.taken_at)}>
                      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                        {data(versao.taken_at)}
                      </h3>
                      <BlocosRender blocos={versao.blocos} rotulos={rotulos} />
                    </section>
                    <section aria-label={t("Hoje")}>
                      <h3 className="mb-3 text-sm font-semibold text-primary">{t("Hoje")}</h3>
                      <BlocosRender blocos={atual} rotulos={rotulos} />
                    </section>
                  </div>
                ) : (
                  <BlocosRender blocos={versao.blocos} rotulos={rotulos} />
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
