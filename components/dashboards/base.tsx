import { NumeroQueCabe } from "@/components/ui/NumeroQueCabe";
"use client";

import type { ReactNode } from "react";

import { ArrowDown, ArrowUp } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** Formatadores comuns dos dashboards (pt-BR). */
/** `null` (conta sem base, ex.: CPL sem leads) mostra "—", nunca "R$ 0,00". */
export const brl = (v: number | null | undefined) =>
  v === null ? "—" : (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const inteiro = (v: number | null | undefined) =>
  Math.round(v ?? 0).toLocaleString("pt-BR");
export const pct = (v: number | null | undefined, casas = 1) =>
  `${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
export const vezes = (v: number | null) =>
  v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;
export const dividir = (a: number, b: number) => (b > 0 ? a / b : null);

/** A cor de destaque é a da MARCA da empresa (token `primary`), nunca uma cor fixa. */
export const COR_DA_MARCA = "var(--primary)";
export const COR_DO_APOIO = "var(--muted-foreground)";

/** ▲▼ % contra o período anterior. `menorEMelhor` inverte o bom/ruim (CPL, CAC, tempo). */
export function Variacao({
  atual,
  anterior,
  menorEMelhor = false,
}: {
  atual: number | null;
  anterior: number | null;
  menorEMelhor?: boolean;
}) {
  if (atual === null || anterior === null || anterior === 0) return null;
  const v = ((atual - anterior) / Math.abs(anterior)) * 100;
  if (!Number.isFinite(v)) return null;
  const subiu = v >= 0;
  const bom = menorEMelhor ? !subiu : subiu;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        bom ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
      )}
      title="Comparado ao período anterior"
    >
      {subiu ? <ArrowUp size={11} weight="bold" aria-hidden /> : <ArrowDown size={11} weight="bold" aria-hidden />}
      {Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
    </span>
  );
}

export function Kpi({
  rotulo,
  valor,
  apoio,
  variacao,
  destaque = false,
  meta,
}: {
  rotulo: string;
  valor: string;
  apoio?: ReactNode;
  variacao?: ReactNode;
  destaque?: boolean;
  /** Meta × realizado (0–100): a barra fina embaixo do número. */
  meta?: { progresso: number; rotulo: string };
}) {
  const p = meta ? Math.max(0, Math.min(100, meta.progresso)) : 0;
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl"
      />
      <p className="relative text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </p>
      <div className="relative mt-1.5 flex flex-wrap items-baseline gap-x-2">
        <p
          className={cn(
            "min-w-0 flex-1 basis-32 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl",
            destaque && "text-primary",
          )}
        >
          <NumeroQueCabe>{valor}</NumeroQueCabe>
        </p>
        {variacao}
      </div>
      {apoio ? <p className="relative mt-1 text-xs text-muted-foreground">{apoio}</p> : null}
      {meta ? (
        <div className="relative mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full",
                p < 40 ? "bg-red-500" : p < 70 ? "bg-amber-500" : "bg-green-600",
              )}
              style={{ width: `${p}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{meta.rotulo}</p>
        </div>
      ) : null}
    </div>
  );
}

export function Painel({
  titulo,
  nota,
  acao,
  children,
  className,
}: {
  titulo: string;
  nota?: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <div className="flex items-center gap-2">
          {nota ? <span className="text-xs text-muted-foreground">{nota}</span> : null}
          {acao}
        </div>
      </div>
      {children}
    </section>
  );
}

/** A grade de números do "Funil completo" (cada célula: rótulo + valor). */
export function GradeDeNumeros({
  itens,
}: {
  itens: Array<{ rotulo: string; valor: string; destaque?: boolean }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
      {itens.map((i) => (
        <div key={i.rotulo} className="bg-card px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {i.rotulo}
          </p>
          <p className={cn("mt-1 text-lg font-semibold tabular-nums", i.destaque && "text-primary")}>
            {i.valor}
          </p>
        </div>
      ))}
    </div>
  );
}

/** O funil em degraus (largura proporcional ao 1º passo, com piso para o último ficar legível). */
export function FunilEmDegraus({
  etapas,
}: {
  etapas: Array<{ rotulo: string; valor: number; taxa?: string }>;
}) {
  const topo = Math.max(1, etapas[0]?.valor ?? 1);
  return (
    <div className="grid gap-1.5">
      {etapas.map((e, i) => {
        const largura = Math.max(14, Math.min(100, (e.valor / topo) * 100));
        return (
          <div key={e.rotulo} className="grid gap-0.5">
            {e.taxa && i > 0 ? (
              <p className="text-center text-[10px] text-muted-foreground">↓ {e.taxa}</p>
            ) : null}
            <div
              className="mx-auto flex h-11 items-center justify-between gap-3 rounded-lg px-3 text-sm text-primary-foreground"
              style={{
                width: `${largura}%`,
                minWidth: "9.5rem",
                background: `color-mix(in oklab, var(--primary) ${100 - i * 14}%, var(--background))`,
              }}
            >
              <span className="truncate text-xs font-medium">{e.rotulo}</span>
              <span className="font-bold tabular-nums">{inteiro(e.valor)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Abas internas de cada dashboard (visões). */
export function Visoes<T extends string>({
  valor,
  opcoes,
  aoMudar,
}: {
  valor: T;
  opcoes: Array<{ id: T; rotulo: string }>;
  aoMudar: (v: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-secondary p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={valor === o.id}
          onClick={() => aoMudar(o.id)}
          className={cn(
            "h-9 shrink-0 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
            valor === o.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Tabela simples dos dashboards: rolagem lateral, número à direita, total no rodapé. */
export function TabelaDeDados({
  colunas,
  linhas,
  rodape,
}: {
  colunas: Array<{ titulo: string; alinhar?: "left" | "right" }>;
  linhas: ReactNode[][];
  rodape?: ReactNode[];
}) {
  return (
    <div className="max-w-full overflow-x-auto rounded-xl border">
      <table className="w-full min-w-max text-sm">
        <thead className="bg-secondary/60 text-xs text-muted-foreground">
          <tr>
            {colunas.map((c, i) => (
              <th
                key={c.titulo}
                className={cn(
                  "px-3 py-2 font-medium whitespace-nowrap",
                  i === 0 || c.alinhar === "left" ? "text-left" : "text-right",
                )}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, k) => (
            <tr key={k} className="border-t">
              {l.map((cel, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-3 py-2 tabular-nums",
                    i === 0 || colunas[i]?.alinhar === "left" ? "text-left" : "text-right",
                  )}
                >
                  {cel}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {rodape ? (
          <tfoot className="border-t bg-secondary/40 font-semibold">
            <tr>
              {rodape.map((cel, i) => (
                <td key={i} className={cn("px-3 py-2 tabular-nums", i === 0 ? "text-left" : "text-right")}>
                  {cel}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
