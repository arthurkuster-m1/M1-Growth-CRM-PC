"use client";

import { useT } from "@/hooks/i18n/useT";
import type { ResumoDaNota } from "@/lib/anotacoes/paginas";
import { FileText, Star } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

function Lista({
  titulo,
  icone,
  ids,
  notas,
  selecionada,
  aoAbrir,
}: {
  titulo: string;
  icone?: React.ReactNode;
  ids: string[];
  notas: ResumoDaNota[];
  selecionada: string | null;
  aoAbrir: (id: string) => void;
}) {
  const t = useT();
  const vivas = ids
    .map((id) => notas.find((n) => n.id === id && !n.deleted_at))
    .filter((n): n is ResumoDaNota => n !== undefined);
  if (vivas.length === 0) return null;
  return (
    <section className="mb-2">
      <h2 className="flex items-center gap-1.5 px-2 pb-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {icone}
        {titulo}
      </h2>
      <ul className="flex flex-col gap-px">
        {vivas.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => aoAbrir(n.id)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[13px]",
                selecionada === n.id
                  ? "bg-card font-medium shadow-sm ring-1 ring-border/70"
                  : "hover:bg-card/70",
              )}
            >
              {n.icon ? (
                <span className="shrink-0 text-sm leading-none">{n.icon}</span>
              ) : (
                <FileText size={14} className="shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="truncate">{n.title || t("Sem título")}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Os atalhos no alto da lateral: as páginas favoritas e as abertas há pouco. */
export function AtalhosDeNotas({
  favoritas,
  recentes,
  notas,
  selecionada,
  aoAbrir,
}: {
  favoritas: string[];
  recentes: string[];
  notas: ResumoDaNota[];
  selecionada: string | null;
  aoAbrir: (id: string) => void;
}) {
  const t = useT();
  // O que já é favorito não se repete em "Recentes".
  const recentesSemFavoritas = recentes.filter((id) => !favoritas.includes(id)).slice(0, 5);
  return (
    <div className="mb-2 border-b pb-2 empty:hidden">
      <Lista
        titulo={t("Favoritas")}
        icone={<Star size={11} weight="fill" aria-hidden />}
        ids={favoritas}
        notas={notas}
        selecionada={selecionada}
        aoAbrir={aoAbrir}
      />
      <Lista
        titulo={t("Recentes")}
        ids={recentesSemFavoritas}
        notas={notas}
        selecionada={selecionada}
        aoAbrir={aoAbrir}
      />
    </div>
  );
}
