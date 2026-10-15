"use client";

import { useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { BASE_DA_COR } from "@/lib/motor/cores";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { CaretDown, CaretRight } from "@/lib/ui/icons";

export interface EtapaDoQuadro {
  /** Chave da etapa no grupo (a posição). */
  chave: string;
  nome: string;
  cor: CorDaOpcao;
  n: number;
  /** As etapas (ids) dos funis do grupo que esta posição representa. */
  ids: string[];
  /** A etapa de cada funil do grupo nesta posição (funil → etapa). */
  porFunil?: Record<string, string>;
}

export interface GrupoDeEtapas {
  chave: string;
  /** Nomes dos funis que têm exatamente estas etapas. */
  funis: string[];
  etapas: EtapaDoQuadro[];
}

interface Props {
  grupos: readonly GrupoDeEtapas[];
  /** Ids de etapa que filtram a lista (null = sem filtro). */
  escolhidas: ReadonlySet<string> | null;
  aoEscolher: (ids: string[] | null) => void;
  /** Com mais de um grupo (aba Todas), cada grupo vira um toggle. */
  emToggle: boolean;
}

function Cadeia({
  etapas,
  escolhidas,
  aoEscolher,
}: {
  etapas: readonly EtapaDoQuadro[];
  escolhidas: ReadonlySet<string> | null;
  aoEscolher: (ids: string[] | null) => void;
}) {
  const t = useT();
  return (
    <ol className="flex w-full items-stretch overflow-x-auto pb-1">
      {etapas.map((e, i) => {
        const cor = BASE_DA_COR[e.cor];
        const ativo = escolhidas !== null && e.ids.every((id) => escolhidas.has(id));
        const apagado = escolhidas !== null && !ativo;
        return (
          <li key={e.chave} className="min-w-[8.5rem] flex-1" style={{ marginLeft: i === 0 ? 0 : -10 }}>
            <button
              type="button"
              aria-pressed={ativo}
              title={t("Filtrar a lista por esta etapa")}
              onClick={() => aoEscolher(ativo ? null : e.ids)}
              className="relative flex h-16 w-full flex-col justify-center text-left transition-opacity hover:opacity-90"
              style={{
                clipPath:
                  i === 0
                    ? "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)"
                    : "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)",
                backgroundColor: `color-mix(in srgb, ${cor} ${ativo ? 38 : 20}%, transparent)`,
                opacity: apagado ? 0.5 : 1,
                paddingLeft: i === 0 ? 14 : 24,
                paddingRight: 18,
              }}
            >
              <span className="truncate text-[11px] font-semibold tracking-wide uppercase">
                {e.nome}
              </span>
              <span className="text-xl leading-tight font-semibold tabular-nums">{e.n}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * As ETAPAS do funil como filtro (o mesmo desenho do ciclo de vida). Em "Todas", funis com as mesmas
 * etapas dividem um desenho; funis com etapas diferentes ganham um desenho cada, em toggle.
 */
export function QuadroDeEtapas({ grupos, escolhidas, aoEscolher, emToggle }: Props) {
  const t = useT();
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  if (grupos.length === 0) return null;
  return (
    <section aria-label={t("Etapas do funil")} className="min-w-0 max-w-full rounded-2xl border bg-card px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t("Etapas do funil")}
        </p>
        {escolhidas ? (
          <button
            type="button"
            onClick={() => aoEscolher(null)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t("Mostrar todas")}
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            {t("Clique numa etapa para filtrar a lista")}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {grupos.map((g) => {
          if (!emToggle) {
            return (
              <Cadeia key={g.chave} etapas={g.etapas} escolhidas={escolhidas} aoEscolher={aoEscolher} />
            );
          }
          const aberto = abertos.has(g.chave);
          const total = g.etapas.reduce((s, e) => s + e.n, 0);
          return (
            <div key={g.chave} className="min-w-0 rounded-xl border">
              <button
                type="button"
                aria-expanded={aberto}
                onClick={() =>
                  setAbertos((a) => {
                    const novo = new Set(a);
                    if (novo.has(g.chave)) novo.delete(g.chave);
                    else novo.add(g.chave);
                    return novo;
                  })
                }
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/50"
              >
                {aberto ? <CaretDown size={14} aria-hidden /> : <CaretRight size={14} aria-hidden />}
                <span className="min-w-0 flex-1 truncate font-medium">{g.funis.join(" · ")}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {g.funis.length === 1 ? t("1 funil") : `${g.funis.length} ${t("funis")}`} · {total}
                </span>
              </button>
              {aberto ? (
                <div className="px-3 pb-2">
                  <Cadeia etapas={g.etapas} escolhidas={escolhidas} aoEscolher={aoEscolher} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
