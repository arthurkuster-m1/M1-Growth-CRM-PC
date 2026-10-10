import type { Bloco } from "@/lib/marketing/blocos";
import { ArrowSquareOut } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Os blocos VISUAIS: pirâmide/funil, fluxo (processo) e matriz 2x2 (SWOT). Sem estado, só
 * desenho com as cores da marca da empresa (`--primary`), igual no painel, na apresentação e
 * no link público.
 */
type Piramide = Extract<Bloco, { tipo: "piramide" }>;
type Fluxo = Extract<Bloco, { tipo: "fluxo" }>;
type Matriz = Extract<Bloco, { tipo: "matriz" }>;
type Ficha = Extract<Bloco, { tipo: "ficha" }>;

/** A borda dos cartões: um contorno sólido na cor da marca, sem brilho nem sombra. */
export const BORDA_DA_MARCA = "border-[1.5px] border-primary";

/**
 * Pirâmide (ou funil) de verdade: cada nível é um trapézio e, empilhados, formam o triângulo.
 * O contorno é sólido na cor da marca e o preenchimento fica mais forte quanto mais importante
 * o nível (o topo, na pirâmide). O texto de cada nível fica ao lado, alinhado à sua faixa.
 */
export function Niveis({ bloco, slide }: { bloco: Piramide; slide: boolean }) {
  const itens = bloco.itens.filter((i) => i.titulo.trim() !== "" || i.texto.trim() !== "");
  const n = itens.length;
  if (n === 0) return null;
  const piramide = bloco.forma === "piramide";

  // Largura (em % da coluna) do topo e da base de cada faixa.
  const faixa = (i: number) => {
    const a = (i / n) * 100;
    const b = ((i + 1) / n) * 100;
    return piramide ? { topo: a, base: b } : { topo: 100 - a, base: 100 - b };
  };
  // `recuo` encolhe o polígono dos lados (o miolo do contorno); no vértice nunca se cruza.
  const poligono = (topo: number, base: number, recuo = 0) => {
    const esq = (largura: number) => Math.min(50 - largura / 2 + recuo, 50);
    const dir = (largura: number) => Math.max(50 + largura / 2 - recuo, 50);
    return `polygon(${esq(topo)}% 0, ${dir(topo)}% 0, ${dir(base)}% 100%, ${esq(base)}% 100%)`;
  };

  return (
    <ol
      className={cn(
        "grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] gap-x-4 sm:gap-x-8",
        slide ? "auto-rows-[5.5rem] sm:auto-rows-[6.5rem]" : "auto-rows-[4.75rem]",
      )}
    >
      {itens.map((item, i) => {
        const { topo, base } = faixa(i);
        // Mais importante = mais preenchido (topo da pirâmide / boca do funil).
        const forca = n === 1 ? 100 : 100 - (i / (n - 1)) * 72;
        const claro = forca < 55;
        return (
          <li key={i} className="contents">
            <div className="relative py-[2px]">
              <div
                aria-hidden
                style={{ clipPath: poligono(topo, base) }}
                className="absolute inset-x-0 inset-y-[2px] bg-primary"
              />
              <div
                style={{
                  clipPath: poligono(topo, base, 1.2),
                  backgroundColor: `color-mix(in srgb, var(--primary) ${forca}%, var(--card))`,
                }}
                className="absolute inset-x-0 inset-y-[4px] grid place-items-center"
              >
                <span
                  className={cn(
                    "font-mono text-sm font-bold tracking-widest",
                    slide && "text-xl",
                    claro ? "text-foreground" : "text-primary-foreground",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
            </div>
            <div className="flex flex-col justify-center border-l-[1.5px] border-primary pl-4">
              <h4
                className={cn(
                  "leading-snug font-semibold",
                  slide ? "text-lg sm:text-2xl" : "text-sm sm:text-base",
                )}
              >
                {item.titulo}
              </h4>
              {item.texto ? (
                <p
                  className={cn(
                    "mt-0.5 text-muted-foreground",
                    slide ? "text-base sm:text-lg" : "text-xs sm:text-sm",
                  )}
                >
                  {item.texto}
                </p>
              ) : null}
            </div>
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
            swot ? TOM_DA_CELULA[i] : BORDA_DA_MARCA,
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

/**
 * A FICHA da página: uma introdução curta e os links do assunto (site, landing page, redes).
 * Os links marcados como destaque viram botões grandes; os demais, etiquetas.
 */
export function FichaDaPagina({ bloco, slide }: { bloco: Ficha; slide: boolean }) {
  const links = bloco.links.filter((l) => l.url.trim() !== "");
  if (bloco.intro.trim() === "" && links.length === 0) return null;
  const destaques = links.filter((l) => l.destaque);
  const demais = links.filter((l) => !l.destaque);
  const nome = (l: { rotulo: string; url: string }) =>
    l.rotulo || l.url.replace(/^https?:\/\//, "");
  return (
    <div className={cn("flex flex-col gap-4 rounded-2xl bg-card p-5 sm:p-6", BORDA_DA_MARCA)}>
      {bloco.intro ? (
        <p
          className={cn(
            "max-w-3xl whitespace-pre-line",
            slide ? "text-lg leading-relaxed sm:text-2xl" : "text-base leading-relaxed",
          )}
        >
          {bloco.intro}
        </p>
      ) : null}
      {destaques.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {destaques.map((l, i) => (
            <a
              key={i}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 max-w-full items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              <span className="truncate">{nome(l)}</span>
              <ArrowSquareOut size={16} aria-hidden />
            </a>
          ))}
        </div>
      ) : null}
      {demais.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {demais.map((l, i) => (
            <li key={i} className="max-w-full">
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-xl border border-primary px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <span className="truncate">{nome(l)}</span>
                <ArrowSquareOut size={14} aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
