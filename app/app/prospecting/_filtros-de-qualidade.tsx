"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CaixaRedonda } from "@/components/ui/CaixaRedonda";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import {
  SEM_FILTRO,
  atendeAoFiltro,
  filtroEstaAtivo,
  type FiltroDeQualidade,
} from "@/lib/prospecting/qualidade";
import type { Prospect } from "@/lib/prospecting/schema";

interface Linha {
  id: string;
  data: Pick<Prospect, "phone" | "website" | "category" | "rating" | "reviews">;
  selected?: boolean;
}

const numeroOuNulo = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};

/**
 * QUALIDADE ANTES DE ABORDAR: nota mínima, avaliações mínimas, só com site, só celular (WhatsApp
 * não chega em telefone fixo) e categoria. Conta quantas empresas passam e, no botão, marca só
 * elas — as demais saem da fila (continuam na lista, desmarcadas, e dá para marcar de volta).
 */
export function FiltrosDeQualidade({
  linhas,
  ocupado,
  aoAplicar,
}: {
  /** As empresas que a caixa pode alterar agora. */
  linhas: readonly Linha[];
  ocupado: boolean;
  aoAplicar: (marcar: string[], desmarcar: string[]) => Promise<void>;
}) {
  const t = useT();
  const [filtro, setFiltro] = useState<FiltroDeQualidade>(SEM_FILTRO);
  const atendem = linhas.filter((l) => atendeAoFiltro(l.data, filtro));
  const ativo = filtroEstaAtivo(filtro);

  return (
    <details className="border-b px-5 py-3">
      <summary className="cursor-pointer text-sm font-medium">
        {t("Filtrar por qualidade")}
        {ativo ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {atendem.length} {t("de")} {linhas.length} {t("atendem")}
          </span>
        ) : null}
      </summary>
      <div className="mt-3 grid gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("Nota mínima")}
            <Input
              type="number"
              min={0}
              max={5}
              step={0.1}
              placeholder="4,0"
              value={filtro.notaMinima ?? ""}
              onChange={(e) => setFiltro({ ...filtro, notaMinima: numeroOuNulo(e.target.value) })}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("Avaliações mínimas")}
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="20"
              value={filtro.avaliacoesMinimas ?? ""}
              onChange={(e) =>
                setFiltro({ ...filtro, avaliacoesMinimas: numeroOuNulo(e.target.value) })
              }
            />
          </label>
          <label className="col-span-2 grid gap-1 text-xs text-muted-foreground">
            {t("Categoria contém")}
            <Input
              placeholder={t("Ex.: clínica")}
              value={filtro.categoria}
              onChange={(e) => setFiltro({ ...filtro, categoria: e.target.value })}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <CaixaRedonda
              checked={filtro.soComSite}
              onChange={(e) => setFiltro({ ...filtro, soComSite: e.target.checked })}
            />
            {t("Só com site")}
          </label>
          <label className="flex items-center gap-2">
            <CaixaRedonda
              checked={filtro.soCelular}
              onChange={(e) => setFiltro({ ...filtro, soCelular: e.target.checked })}
            />
            {t("Só celular (WhatsApp não chega em telefone fixo)")}
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={!ativo}
            onClick={() => setFiltro(SEM_FILTRO)}
          >
            {t("Limpar filtros")}
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            disabled={ocupado || !ativo || linhas.length === 0}
            onClick={() =>
              void aoAplicar(
                linhas
                  .filter((l) => atendeAoFiltro(l.data, filtro) && l.selected === false)
                  .map((l) => l.id),
                linhas
                  .filter((l) => !atendeAoFiltro(l.data, filtro) && l.selected !== false)
                  .map((l) => l.id),
              )
            }
          >
            {t("Marcar só as que atendem")} ({atendem.length})
          </Button>
        </div>
      </div>
    </details>
  );
}
