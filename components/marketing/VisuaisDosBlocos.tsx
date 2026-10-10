import type { Bloco } from "@/lib/marketing/blocos";
import { cn } from "@/lib/utils";

/**
 * Os blocos VISUAIS: pirâmide/funil, fluxo (processo) e matriz 2x2 (SWOT). Sem estado, só
 * desenho com as cores da marca da empresa (`--primary`), igual no painel, na apresentação e
 * no link público.
 */
type Piramide = Extract<Bloco, { tipo: "piramide" }>;
type Fluxo = Extract<Bloco, { tipo: "fluxo" }>;
type Matriz = Extract<Bloco, { tipo: "matriz" }>;

/** A borda "neon" discreta dos cartões: contorno na cor da marca e um brilho suave. */
export const BORDA_NEON =
  "border border-primary/40 shadow-[0_0_22px_-9px_var(--primary)] transition-shadow hover:shadow-[0_0_28px_-6px_var(--primary)]";

export function Niveis({ bloco, slide }: { bloco: Piramide; slide: boolean }) {
  const itens = bloco.itens.filter((i) => i.titulo.trim() !== "" || i.texto.trim() !== "");
  const n = itens.length;
  if (n === 0) return null;
  return (
    <ol className="flex flex-col gap-2.5">
      {itens.map((item, i) => {
        const t = n === 1 ? 0 : i / (n - 1);
        // Pirâmide: estreita no topo e larga na base. Funil: o contrário.
        const largura = bloco.forma === "piramide" ? 40 + t * 60 : 100 - t * 55;
        const forca = 100 - t * 30;
        return (
          <li
            key={i}
            className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6"
          >
            <div className="flex justify-center">
              <div
                style={{
                  width: `${largura}%`,
                  backgroundColor: `color-mix(in srgb, var(--primary) ${forca}%, var(--card))`,
                }}
                className={cn(
                  "rounded-xl px-4 py-3 text-center font-semibold text-primary-foreground shadow-[0_0_22px_-10px_var(--primary)]",
                  slide ? "text-lg sm:text-2xl" : "text-sm sm:text-base",
                )}
              >
                {item.titulo || `${i + 1}`}
              </div>
            </div>
            {item.texto ? (
              <p
                className={cn("text-muted-foreground", slide ? "text-base sm:text-xl" : "text-sm")}
              >
                {item.texto}
              </p>
            ) : (
              <span />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function FluxoDeEtapas({ bloco, slide }: { bloco: Fluxo; slide: boolean }) {
  const itens = bloco.itens.filter((i) => i.titulo.trim() !== "" || i.texto.trim() !== "");
  if (itens.length === 0) return null;
  const seta =
    "polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)";
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-3">
      {itens.map((item, i) => (
        <li
          key={i}
          style={{ clipPath: i === 0 ? seta.replace("16px 50%)", "0 50%)") : seta }}
          className={cn(
            "flex min-w-40 flex-1 basis-40 flex-col justify-center bg-primary/12 py-3 pr-7 pl-8",
            slide ? "min-h-24" : "min-h-20",
          )}
        >
          <span className="text-[11px] font-semibold tracking-wider text-primary uppercase">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className={cn("leading-snug font-medium", slide ? "text-lg" : "text-sm")}>
            {item.titulo}
          </span>
          {item.texto ? (
            <span className={cn("text-muted-foreground", slide ? "text-base" : "text-xs")}>
              {item.texto}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

const LETRAS = ["S", "W", "O", "T"] as const;
const TOM_DA_CELULA = [
  "border-success/50 bg-success-bg",
  "border-warning/50 bg-warning-bg",
  "border-primary/50 bg-primary/10",
  "border-error/40 bg-error-bg",
] as const;

export function MatrizDois({ bloco, slide }: { bloco: Matriz; slide: boolean }) {
  const swot = bloco.estilo === "swot";
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      {bloco.celulas.map((c, i) => (
        <section
          key={i}
          className={cn(
            "flex min-h-32 flex-col gap-2 rounded-2xl border p-5",
            swot ? TOM_DA_CELULA[i] : BORDA_NEON,
          )}
        >
          <header className="flex items-center gap-3">
            {swot ? (
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card text-lg font-bold text-primary shadow-sm"
              >
                {LETRAS[i]}
              </span>
            ) : null}
            <h4 className={cn("font-semibold", slide ? "text-xl sm:text-2xl" : "text-base")}>
              {c.titulo}
            </h4>
          </header>
          {c.texto ? (
            <p
              className={cn(
                "whitespace-pre-line text-muted-foreground",
                slide ? "text-base sm:text-lg" : "text-sm",
              )}
            >
              {c.texto}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
