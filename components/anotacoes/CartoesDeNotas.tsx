"use client";

import { useT } from "@/hooks/i18n/useT";
import type { ResumoDaNota } from "@/lib/anotacoes/paginas";
import { ArrowRight, Eye, FileText, Plus } from "@/lib/ui/icons";

const MAXIMO_DE_ETIQUETAS_NO_CARTAO = 3;

function dataCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(d);
}

/**
 * A vista em CARTÕES das páginas de anotação — a mesma da Estratégia: ícone, título, etiquetas,
 * quantas subpáginas tem e quando foi mexida. Serve à tela inicial de Anotações (as páginas de
 * cima) e às subpáginas dentro de uma página.
 */
export function CartoesDeNotas({
  paginas,
  todas,
  podeEditar,
  aoAbrir,
  aoCriar,
  rotuloDoNovo,
}: {
  paginas: readonly ResumoDaNota[];
  /** A árvore inteira (para contar as subpáginas de cada cartão). */
  todas: readonly ResumoDaNota[];
  podeEditar: boolean;
  aoAbrir: (id: string) => void;
  /** Mostra o cartão "Nova página" no fim da grade. */
  aoCriar?: () => void;
  rotuloDoNovo?: string;
}) {
  const t = useT();
  const filhas = new Map<string, number>();
  for (const n of todas) {
    if (n.parent_id && !n.deleted_at) filhas.set(n.parent_id, (filhas.get(n.parent_id) ?? 0) + 1);
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {paginas.map((p) => {
        const subs = filhas.get(p.id) ?? 0;
        const etiquetas = p.tags.slice(0, MAXIMO_DE_ETIQUETAS_NO_CARTAO);
        const resto = p.tags.length - etiquetas.length;
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => aoAbrir(p.id)}
              className="group flex h-full w-full flex-col gap-2 rounded-2xl border-[1.5px] border-primary bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-hidden"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl leading-none text-primary">
                  {p.icon ? p.icon : <FileText size={24} aria-hidden />}
                </span>
                {podeEditar ? (
                  <span
                    className={
                      p.visible_to_client
                        ? "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                        : "inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    }
                  >
                    {p.visible_to_client ? (
                      <>
                        <Eye size={11} aria-hidden className="mr-1" />
                        {t("Visível ao cliente")}
                      </>
                    ) : (
                      t("Interna")
                    )}
                  </span>
                ) : null}
              </div>
              <h3 className="line-clamp-2 font-semibold">{p.title || t("Sem título")}</h3>
              {etiquetas.length ? (
                <div className="flex flex-wrap gap-1">
                  {etiquetas.map((e) => (
                    <span
                      key={e}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                    >
                      {e}
                    </span>
                  ))}
                  {resto > 0 ? (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                      +{resto}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {subs > 0 ? `${subs} ${subs === 1 ? t("subpágina") : t("subpáginas")} · ` : ""}
                {t("Atualizada em")} {dataCurta(p.updated_at)}
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary">
                {t("Abrir")}
                <ArrowRight
                  size={14}
                  weight="bold"
                  className="transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </span>
            </button>
          </li>
        );
      })}
      {aoCriar && podeEditar ? (
        <li>
          <button
            type="button"
            onClick={aoCriar}
            className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/10"
          >
            <Plus size={20} weight="bold" aria-hidden />
            {rotuloDoNovo ?? t("Nova página")}
          </button>
        </li>
      ) : null}
    </ul>
  );
}
