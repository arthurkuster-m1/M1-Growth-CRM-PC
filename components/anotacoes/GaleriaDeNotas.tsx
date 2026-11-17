"use client";

import { useMemo, useState } from "react";

import { CartoesDeNotas } from "@/components/anotacoes/CartoesDeNotas";
import { useBuscaDeNotas } from "@/hooks/anotacoes/useBuscaDeNotas";
import { useT } from "@/hooks/i18n/useT";
import { dobrar } from "@/lib/anotacoes/busca";
import type { ResumoDaNota } from "@/lib/anotacoes/paginas";
import { MagnifyingGlass, Note, Plus, Tag, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * A tela inicial de ANOTAÇÕES, em cartões como as páginas da Estratégia: barra de pesquisa (título,
 * etiqueta e texto das páginas), filtro por etiqueta e a grade das páginas de cima. Com busca ou
 * etiqueta escolhida, procura em TODAS as páginas (também nas subpáginas).
 */
export function GaleriaDeNotas({
  notas,
  podeEditar,
  aoAbrir,
  aoCriar,
}: {
  notas: readonly ResumoDaNota[];
  podeEditar: boolean;
  aoAbrir: (id: string) => void;
  aoCriar: () => void;
}) {
  const t = useT();
  const [busca, setBusca] = useState("");
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const textual = useBuscaDeNotas(busca);

  const vivas = useMemo(() => notas.filter((n) => !n.deleted_at), [notas]);
  const etiquetas = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const n of vivas) for (const e of n.tags) contagem.set(e, (contagem.get(e) ?? 0) + 1);
    return [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [vivas]);

  const termo = dobrar(busca).trim();
  const filtrando = termo.length > 0 || etiqueta !== null;
  const idsDoTexto = useMemo(
    () => new Set(textual.resultados.map((r) => r.id)),
    [textual.resultados],
  );

  const lista = useMemo(() => {
    const base = filtrando
      ? vivas.filter((n) => {
          if (etiqueta && !n.tags.some((e) => e.toLowerCase() === etiqueta.toLowerCase())) {
            return false;
          }
          if (!termo) return true;
          return (
            dobrar(n.title).includes(termo) ||
            n.tags.some((e) => dobrar(e).includes(termo)) ||
            idsDoTexto.has(n.id)
          );
        })
      : vivas.filter((n) => n.parent_id === null || !vivas.some((m) => m.id === n.parent_id));
    return filtrando
      ? [...base].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      : [...base].sort((a, b) => a.position - b.position);
  }, [vivas, filtrando, etiqueta, termo, idsDoTexto]);

  return (
    <section aria-label={t("Páginas de anotações")} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Note size={20} aria-hidden className="text-primary" />
          {t("Suas páginas")}
        </h2>
        {podeEditar ? (
          <button
            type="button"
            onClick={aoCriar}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Nova página")}
          </button>
        ) : null}
      </div>

      <label className="relative block">
        <span className="sr-only">{t("Buscar página")}</span>
        <MagnifyingGlass
          size={16}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={t("Buscar por título, etiqueta ou texto")}
          className="h-10 w-full rounded-xl border bg-background pr-9 pl-9 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
        {busca ? (
          <button
            type="button"
            aria-label={t("Limpar busca")}
            onClick={() => setBusca("")}
            className="absolute top-1/2 right-2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
          >
            <X size={12} aria-hidden />
          </button>
        ) : null}
      </label>

      {etiquetas.length ? (
        <div role="group" aria-label={t("Filtrar por etiqueta")} className="flex flex-wrap gap-1.5">
          <Tag size={14} aria-hidden className="mt-1.5 text-muted-foreground" />
          {etiquetas.map(([nome, quantas]) => {
            const ativa = etiqueta?.toLowerCase() === nome.toLowerCase();
            return (
              <button
                key={nome}
                type="button"
                aria-pressed={ativa}
                onClick={() => setEtiqueta(ativa ? null : nome)}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium hover:bg-secondary",
                  ativa && "border-primary bg-primary/10 text-primary",
                )}
              >
                {nome}
                <span className="text-muted-foreground">{quantas}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {filtrando
            ? textual.procurando
              ? t("Buscando…")
              : t("Nada encontrado para essa busca.")
            : podeEditar
              ? t("Nenhuma página ainda. Crie a primeira em “Nova página”.")
              : t("Nenhuma página liberada para você ainda.")}
        </p>
      ) : (
        <CartoesDeNotas
          paginas={lista}
          todas={notas}
          podeEditar={podeEditar}
          aoAbrir={aoAbrir}
          aoCriar={filtrando ? undefined : aoCriar}
        />
      )}
    </section>
  );
}
