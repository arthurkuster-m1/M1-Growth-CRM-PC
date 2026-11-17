"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import { useT } from "@/hooks/i18n/useT";
import { CaretDown, CheckCircle, Circle } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * As peças visuais das páginas da campanha (Cadastro e Visão geral): o mesmo vocabulário em
 * tudo — cartão com ícone colorido, título, uma linha de ajuda e o estado ("Completo", "Falta
 * preencher", "Opcional") — para ficar claro onde mexer e o que é importante.
 */

export type TomVisual = "blue" | "emerald" | "violet" | "amber" | "teal" | "rose" | "slate";

export const ICONE_DO_TOM: Record<TomVisual, string> = {
  blue: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  teal: "bg-teal-500/12 text-teal-600 dark:text-teal-400",
  rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  slate: "bg-secondary text-muted-foreground",
};

export const BARRA_DO_TOM: Record<TomVisual, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  teal: "bg-teal-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

type Icone = ComponentType<{
  size?: number;
  weight?: "duotone" | "bold" | "regular";
  className?: string;
}>;

/** O quadradinho colorido com o ícone. */
export function IconeDoCartao({
  icone: Icone,
  tom,
  className,
}: {
  icone: Icone;
  tom: TomVisual;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
        ICONE_DO_TOM[tom],
        className,
      )}
    >
      <Icone size={20} weight="duotone" />
    </span>
  );
}

/**
 * O título de uma SEÇÃO da campanha (Dia a dia, Funil, Criativos…): o mesmo ícone colorido dos
 * cartões do Cadastro, o nome e, se houver, uma linha de ajuda.
 */
export function TituloDaSecao({
  icone,
  tom,
  children,
  ajuda,
}: {
  icone: Icone;
  tom: TomVisual;
  children: ReactNode;
  ajuda?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <IconeDoCartao icone={icone} tom={tom} className="h-9 w-9" />
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{children}</h2>
        {ajuda ? <p className="text-sm text-muted-foreground">{ajuda}</p> : null}
      </div>
    </div>
  );
}

export type EstadoDoPasso = "completo" | "pendente" | "opcional";

/** A etiqueta de estado do canto do cartão. */
export function SeloDeEstado({ estado }: { estado: EstadoDoPasso }) {
  const t = useT();
  if (estado === "completo") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success-fg">
        <CheckCircle size={14} weight="fill" aria-hidden />
        {t("Completo")}
      </span>
    );
  }
  if (estado === "pendente") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning-fg">
        <Circle size={12} weight="bold" aria-hidden />
        {t("Falta preencher")}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {t("Opcional")}
    </span>
  );
}

/**
 * Um PASSO do cadastro: número, ícone, título, a linha que explica para que serve e o estado.
 * O corpo é o formulário. `id` é a âncora da lista de progresso.
 */
export function CartaoDePasso({
  id,
  numero,
  icone,
  tom,
  titulo,
  descricao,
  estado,
  children,
}: {
  id?: string;
  numero?: number;
  icone: Icone;
  tom: TomVisual;
  titulo: string;
  descricao: string;
  estado: EstadoDoPasso;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="grid min-w-0 scroll-mt-24 gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <header className="flex items-start gap-3">
        <IconeDoCartao icone={icone} tom={tom} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {numero ? (
              <span className="text-xs font-medium text-text-subtle tabular-nums">
                {String(numero).padStart(2, "0")}
              </span>
            ) : null}
            {titulo}
          </h2>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
        <SeloDeEstado estado={estado} />
      </header>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

/** Um campo com rótulo e uma linha de ajuda opcional. */
export function Campo({
  rotulo,
  ajuda,
  obrigatorio,
  children,
}: {
  rotulo: string;
  ajuda?: string;
  obrigatorio?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-center gap-1 text-sm font-medium">
        {rotulo}
        {obrigatorio ? (
          <span aria-hidden className="text-error-fg">
            *
          </span>
        ) : null}
      </span>
      {children}
      {ajuda ? <span className="mt-1 block text-xs text-muted-foreground">{ajuda}</span> : null}
    </label>
  );
}

export interface ItemDoProgresso {
  id: string;
  rotulo: string;
  feito: boolean;
  /** Obrigatório para a campanha funcionar? Os pendentes obrigatórios ganham destaque. */
  importante?: boolean;
  /** Em vez de rolar até um cartão, abre outra página da campanha. */
  aoClicar?: () => void;
}

/** "Cadastro: 3 de 5" com a barra e os atalhos para o que falta. */
export function ProgressoDoCadastro({ itens }: { itens: ItemDoProgresso[] }) {
  const t = useT();
  const feitos = itens.filter((i) => i.feito).length;
  const pct = itens.length === 0 ? 0 : Math.round((feitos / itens.length) * 100);
  const tudo = feitos === itens.length;
  const ir = (i: ItemDoProgresso) => {
    if (i.aoClicar) return i.aoClicar();
    document.getElementById(i.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <section
      aria-label={t("Andamento do cadastro")}
      className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">
          {tudo ? t("Cadastro completo") : t("Falta pouco para a campanha ficar pronta")}
        </h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {feitos} {t("de")} {itens.length} {t("etapas")}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("Andamento do cadastro")}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            tudo ? "bg-emerald-500" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="flex flex-wrap gap-2">
        {itens.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => ir(i)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors hover:bg-secondary",
                i.feito
                  ? "border-transparent bg-success-bg text-success-fg"
                  : i.importante
                    ? "border-warning/50 bg-warning-bg text-warning-fg"
                    : "text-muted-foreground",
              )}
            >
              {i.feito ? (
                <CheckCircle size={14} weight="fill" aria-hidden />
              ) : (
                <Circle size={14} weight="bold" aria-hidden />
              )}
              {i.rotulo}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Um indicador grande: ícone, rótulo, valor, uma linha de contexto e (opcional) a barra de progresso. */
export function Indicador({
  icone,
  tom,
  rotulo,
  valor,
  detalhe,
  progresso,
  situacao,
}: {
  icone: Icone;
  tom: TomVisual;
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  /** 0–100; `null`/ausente = sem barra. */
  progresso?: number | null;
  situacao?: "bom" | "ruim" | null;
}) {
  const p = progresso == null ? null : Math.max(0, Math.min(100, progresso));
  return (
    <div className="grid min-w-0 gap-2 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <IconeDoCartao icone={icone} tom={tom} className="h-9 w-9" />
        <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">{rotulo}</p>
      </div>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          situacao === "bom" && "text-success-fg",
          situacao === "ruim" && "text-error-fg",
        )}
      >
        {valor}
      </p>
      {p !== null ? (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuenow={Math.round(p)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={rotulo}
        >
          <div
            className={cn("h-full rounded-full", BARRA_DO_TOM[tom])}
            style={{ width: `${p}%` }}
          />
        </div>
      ) : null}
      {detalhe ? <p className="truncate text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}

const CHAVE_DAS_SECOES = "m1:campanha:secoes-abertas";

function lerAbertas(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_DAS_SECOES) ?? "{}") as Record<
      string,
      boolean
    >;
  } catch {
    return {};
  }
}

/**
 * Uma seção de detalhe que ABRE E FECHA, com ícone e título grandes. Lembra, neste navegador, o
 * que a pessoa abriu. `abertaPorPadrao` vale só até ela escolher.
 */
export function SecaoDeDetalhe({
  titulo,
  nota,
  icone,
  tom,
  resumo,
  abertaPorPadrao = false,
  children,
}: {
  titulo: string;
  nota?: string;
  icone: Icone;
  tom: TomVisual;
  resumo?: ReactNode;
  abertaPorPadrao?: boolean;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(abertaPorPadrao);
  useEffect(() => {
    const guardada = lerAbertas()[titulo];
    if (typeof guardada === "boolean") setAberta(guardada);
  }, [titulo]);
  function alternar() {
    const nova = !aberta;
    setAberta(nova);
    try {
      window.localStorage.setItem(
        CHAVE_DAS_SECOES,
        JSON.stringify({ ...lerAbertas(), [titulo]: nova }),
      );
    } catch {
      /* sem armazenamento: só não lembra */
    }
  }
  return (
    <section className="grid min-w-0 gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <button
        type="button"
        aria-expanded={aberta}
        onClick={alternar}
        className="flex w-full items-center gap-3 text-left"
      >
        <IconeDoCartao icone={icone} tom={tom} className="h-9 w-9" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-semibold">{titulo}</span>
          {nota ? <span className="truncate text-xs text-muted-foreground">{nota}</span> : null}
        </span>
        <CaretDown
          size={16}
          aria-hidden
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            !aberta && "-rotate-90",
          )}
        />
      </button>
      {resumo}
      {aberta ? <div className="grid gap-4 border-t pt-4">{children}</div> : null}
    </section>
  );
}
