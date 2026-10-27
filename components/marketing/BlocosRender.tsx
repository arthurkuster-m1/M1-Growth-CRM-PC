import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

import { CampoNoLugar, emEdicao, type EdicaoNoLugar } from "@/components/marketing/CampoNoLugar";

import type { Alinhamento, Bloco, LarguraDaImagem } from "@/lib/marketing/blocos";
import { OfertaDaPagina } from "@/components/marketing/OfertaDaPagina";
import {
  BORDA_DA_MARCA,
  CalculadoraDaMeta,
  FichaDaPagina,
  FluxoDeEtapas,
  MatrizDois,
  Niveis,
  TabelaDaPagina,
} from "@/components/marketing/VisuaisDosBlocos";
import { BASE_DAS_IMAGENS_DO_PAINEL } from "@/lib/marketing/imagens";
import { Check } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * O RENDERIZADOR dos blocos — a página como o cliente a lê. Sem estado e sem tradução de
 * conteúdo: o texto é DA AGÊNCIA (já está no idioma que ela escolheu); só os rótulos fixos
 * ("Antes", "Depois") vêm por `rotulos`, já traduzidos por quem chama. Por isso serve igual ao
 * painel logado, à apresentação em tela cheia e ao link público sem login.
 *
 * `escala`: "pagina" (rolagem, texto confortável) ou "slide" (apresentação, tudo maior).
 */
export interface RotulosDosBlocos {
  antes: string;
  depois: string;
  abrirLink: string;
  /** De onde a imagem vem: o painel logado (padrão) ou o link público (`/p/<token>/img/`). */
  baseDasImagens?: string;
}

const LARGURA_DA_IMAGEM: Record<LarguraDaImagem, string> = {
  pequena: "max-w-xs",
  media: "max-w-xl",
  grande: "max-w-3xl",
  total: "max-w-full",
};

const ALINHAMENTO_DO_BLOCO: Record<Alinhamento, string> = {
  esquerda: "mr-auto",
  centro: "mx-auto",
  direita: "ml-auto",
};

const ALINHAMENTO_DO_TEXTO: Record<Alinhamento, string> = {
  esquerda: "text-left",
  centro: "text-center",
  direita: "text-right",
};

function Imagem({
  arquivo,
  base,
  legenda,
  className,
}: {
  arquivo: string;
  base: string;
  legenda?: string;
  className?: string;
}) {
  if (!arquivo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagem da agência, servida pela rota própria
    <img
      src={`${base}${arquivo}`}
      alt={legenda ?? ""}
      loading="lazy"
      className={cn("h-auto w-full rounded-2xl border object-cover shadow-sm", className)}
    />
  );
}

const TOM_DO_DESTAQUE = {
  info: "border-primary/50 bg-primary/10",
  sucesso: "border-success/50 bg-success-bg",
  atencao: "border-warning/50 bg-warning-bg",
} as const;

function Paragrafos({ texto, className }: { texto: string; className?: string }) {
  const partes = texto.split(/\n{2,}/).filter((p) => p.trim() !== "");
  return (
    <div className={cn("space-y-3", className)}>
      {partes.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

export function BlocosRender({
  blocos,
  rotulos,
  escala = "pagina",
  edicao,
}: {
  blocos: readonly Bloco[];
  rotulos: RotulosDosBlocos;
  escala?: "pagina" | "slide";
  /** Só o editor visual passa isto: o bloco em edição troca os textos por campos no lugar. */
  edicao?: EdicaoNoLugar;
}) {
  const slide = escala === "slide";
  const base = rotulos.baseDasImagens ?? BASE_DAS_IMAGENS_DO_PAINEL;
  const corpo = slide ? "text-lg leading-relaxed sm:text-2xl" : "text-base leading-relaxed";

  return (
    <div className={cn("flex flex-col", slide ? "gap-6 sm:gap-8" : "gap-6")}>
      {blocos.map((b): ReactNode => {
        const digitando = emEdicao(edicao, b);
        /** O campo no lugar de um texto (só quando o bloco está em edição). */
        const campo = (
          caminho: (string | number)[],
          className: string,
          placeholder: string,
          opcoes?: {
            multilinha?: boolean;
            aoTeclar?: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
          },
        ): ReactNode =>
          digitando ? (
            <CampoNoLugar
              key={`${b.id}|${caminho.join(".")}`}
              edicao={edicao!}
              bloco={b}
              caminho={caminho}
              className={className}
              placeholder={placeholder}
              multilinha={opcoes?.multilinha}
              aoTeclar={opcoes?.aoTeclar}
            />
          ) : null;

        switch (b.tipo) {
          case "titulo": {
            const alinhado = ALINHAMENTO_DO_TEXTO[b.alinhamento ?? "esquerda"];
            if (b.nivel === 1) {
              const classe = cn(
                "font-bold tracking-tight",
                slide ? "text-3xl sm:text-5xl" : "border-b pb-2 text-2xl sm:text-3xl",
                alinhado,
              );
              return (
                campo(["texto"], classe, "Título") ?? (
                  <h2 key={b.id} className={classe}>
                    {b.texto}
                  </h2>
                )
              );
            }
            if (b.nivel === 2) {
              const classe = cn(
                "font-semibold",
                slide ? "text-2xl sm:text-3xl" : "text-xl",
                alinhado,
              );
              return (
                campo(["texto"], classe, "Subtítulo") ?? (
                  <h3 key={b.id} className={classe}>
                    {b.texto}
                  </h3>
                )
              );
            }
            const classe = cn("font-semibold", slide ? "text-xl sm:text-2xl" : "text-lg", alinhado);
            return (
              campo(["texto"], classe, "Título pequeno") ?? (
                <h4 key={b.id} className={classe}>
                  {b.texto}
                </h4>
              )
            );
          }

          case "toggle":
            return (
              <details
                key={b.id}
                open={slide || digitando}
                className={cn("group rounded-xl", corpo)}
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden
                    className="inline-block text-xs text-muted-foreground transition-transform group-open:rotate-90"
                  >
                    ▶
                  </span>
                  {campo(["titulo"], "font-medium", "Linha sempre visível") ?? b.titulo}
                </summary>
                {campo(["texto"], "mt-2 pl-5 text-muted-foreground", "Texto que aparece ao abrir", {
                  multilinha: true,
                }) ?? <Paragrafos texto={b.texto} className="mt-2 pl-5 text-muted-foreground" />}
              </details>
            );

          case "texto": {
            const classe = cn(
              corpo,
              "max-w-3xl",
              ALINHAMENTO_DO_TEXTO[b.alinhamento ?? "esquerda"],
              b.alinhamento === "centro" && "mx-auto",
              b.alinhamento === "direita" && "ml-auto",
            );
            return (
              campo(["texto"], classe, "Escreva o texto", { multilinha: true }) ?? (
                <Paragrafos key={b.id} texto={b.texto} className={classe} />
              )
            );
          }

          case "destaque":
            return (
              <div
                key={b.id}
                className={cn("rounded-2xl border-l-4 p-5", TOM_DO_DESTAQUE[b.tom], corpo)}
              >
                {campo(["texto"], "", "Escreva o destaque", { multilinha: true }) ?? (
                  <Paragrafos texto={b.texto} />
                )}
              </div>
            );

          case "lista": {
            // Digitando, todos os itens aparecem (inclusive os vazios) e Enter cria o próximo.
            const itens = b.itens
              .map((texto, idx) => ({ texto, idx }))
              .filter((i) => digitando || i.texto.trim() !== "");
            const teclasDoItem = (idx: number) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                const novos = [...b.itens];
                novos.splice(idx + 1, 0, "");
                edicao!.aoMudar({ ...b, itens: novos });
                edicao!.pedirFoco(`${b.id}|itens.${idx + 1}`);
                return true;
              }
              if (e.key === "Backspace" && b.itens[idx] === "" && b.itens.length > 1) {
                e.preventDefault();
                edicao!.aoMudar({ ...b, itens: b.itens.filter((_, k) => k !== idx) });
                edicao!.pedirFoco(`${b.id}|itens.${Math.max(0, idx - 1)}`);
                return true;
              }
              return false;
            };
            const conteudo = (i: { texto: string; idx: number }) =>
              campo(["itens", i.idx], "min-w-0 flex-1", "Item da lista", {
                aoTeclar: teclasDoItem(i.idx),
              }) ?? <span>{i.texto}</span>;
            if (b.estilo === "numerada") {
              return (
                <ol key={b.id} className={cn("ml-5 list-decimal space-y-2", corpo)}>
                  {itens.map((i) => (
                    <li key={i.idx}>{conteudo(i)}</li>
                  ))}
                </ol>
              );
            }
            return (
              <ul key={b.id} className={cn("space-y-2", corpo)}>
                {itens.map((i) => (
                  <li key={i.idx} className="flex gap-3">
                    {b.estilo === "check" ? (
                      <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground sm:mt-2">
                        <Check size={12} weight="bold" aria-hidden />
                      </span>
                    ) : (
                      <span
                        aria-hidden
                        className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-primary sm:mt-3.5"
                      />
                    )}
                    {conteudo(i)}
                  </li>
                ))}
              </ul>
            );
          }

          case "cards": {
            const itens = b.itens
              .map((item, idx) => ({ item, idx }))
              .filter(
                ({ item }) => digitando || item.titulo.trim() !== "" || item.texto.trim() !== "",
              );
            return (
              <div
                key={b.id}
                className={cn(
                  "grid gap-4",
                  // 4 cartões formam um 2x2; de 3, 5, 6 ou mais, três por linha.
                  itens.length === 4 || itens.length <= 2
                    ? "sm:grid-cols-2"
                    : "sm:grid-cols-2 lg:grid-cols-3",
                )}
              >
                {itens.map(({ item: i, idx }) => (
                  <div
                    key={idx}
                    className={cn("min-w-0 rounded-2xl bg-card p-4 sm:p-5", BORDA_DA_MARCA)}
                  >
                    {digitando || i.titulo
                      ? (campo(
                          ["itens", idx, "titulo"],
                          cn("font-semibold", slide ? "text-xl sm:text-2xl" : "text-base"),
                          "Título do cartão",
                        ) ?? (
                          <h4
                            className={cn(
                              "font-semibold",
                              slide ? "text-xl sm:text-2xl" : "text-base",
                            )}
                          >
                            {i.titulo}
                          </h4>
                        ))
                      : null}
                    {digitando || i.texto
                      ? (campo(
                          ["itens", idx, "texto"],
                          cn(
                            "mt-2 text-muted-foreground",
                            slide ? "text-base sm:text-lg" : "text-sm",
                          ),
                          "Texto do cartão",
                          { multilinha: true },
                        ) ?? (
                          <Paragrafos
                            texto={i.texto}
                            className={cn(
                              "mt-2 text-muted-foreground",
                              slide ? "text-base sm:text-lg" : "text-sm",
                            )}
                          />
                        ))
                      : null}
                  </div>
                ))}
              </div>
            );
          }

          case "metricas": {
            const itens = b.itens
              .map((item, idx) => ({ item, idx }))
              .filter(
                ({ item }) => digitando || item.valor.trim() !== "" || item.rotulo.trim() !== "",
              );
            return (
              <div key={b.id} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {itens.map(({ item: i, idx }) => (
                  <div
                    key={idx}
                    className={cn("min-w-0 rounded-2xl bg-card p-4 sm:p-5", BORDA_DA_MARCA)}
                  >
                    {campo(
                      ["itens", idx, "valor"],
                      cn(
                        // `min-w-0` + quebra em qualquer ponto + corpo menor no celular: valor
                        // comprido ("R$ 7.000.000", "Sob consulta") não pode sair do cartão.
                        "font-bold tracking-tight text-primary [overflow-wrap:anywhere]",
                        slide ? "text-3xl sm:text-6xl" : "text-2xl sm:text-3xl",
                      ),
                      "Número",
                    ) ?? (
                      <p
                        className={cn(
                          "font-bold tracking-tight [overflow-wrap:anywhere] text-primary",
                          slide ? "text-3xl sm:text-6xl" : "text-2xl sm:text-3xl",
                        )}
                      >
                        {i.valor}
                      </p>
                    )}
                    {campo(
                      ["itens", idx, "rotulo"],
                      cn("mt-1 font-medium", slide ? "text-lg" : "text-sm"),
                      "O que é",
                    ) ?? (
                      <p
                        className={cn(
                          "mt-1 font-medium [overflow-wrap:anywhere]",
                          slide ? "text-lg" : "text-sm",
                        )}
                      >
                        {i.rotulo}
                      </p>
                    )}
                    {digitando || i.detalhe
                      ? (campo(
                          ["itens", idx, "detalhe"],
                          cn("mt-0.5 text-muted-foreground", slide ? "text-base" : "text-xs"),
                          "Detalhe",
                        ) ?? (
                          <p
                            className={cn(
                              "mt-0.5 text-muted-foreground",
                              slide ? "text-base" : "text-xs",
                            )}
                          >
                            {i.detalhe}
                          </p>
                        ))
                      : null}
                  </div>
                ))}
              </div>
            );
          }

          case "antes-depois":
            return (
              <div key={b.id} className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border bg-secondary/50 p-5">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {rotulos.antes}
                  </span>
                  {digitando || b.antes.titulo
                    ? (campo(
                        ["antes", "titulo"],
                        cn("mt-1 font-semibold", slide ? "text-2xl" : "text-lg"),
                        "Título",
                      ) ?? (
                        <h4 className={cn("mt-1 font-semibold", slide ? "text-2xl" : "text-lg")}>
                          {b.antes.titulo}
                        </h4>
                      ))
                    : null}
                  <Imagem
                    arquivo={b.antes.imagem ?? ""}
                    base={base}
                    legenda={b.antes.titulo}
                    className="mt-3"
                  />
                  {campo(
                    ["antes", "texto"],
                    cn("mt-2 text-muted-foreground", slide ? "text-lg" : "text-sm"),
                    "Como é hoje",
                    { multilinha: true },
                  ) ?? (
                    <Paragrafos
                      texto={b.antes.texto}
                      className={cn("mt-2 text-muted-foreground", slide ? "text-lg" : "text-sm")}
                    />
                  )}
                </div>
                <div className="rounded-2xl border-2 border-primary/50 bg-primary/10 p-5">
                  <span className="text-xs font-semibold tracking-wider text-primary uppercase">
                    {rotulos.depois}
                  </span>
                  {digitando || b.depois.titulo
                    ? (campo(
                        ["depois", "titulo"],
                        cn("mt-1 font-semibold", slide ? "text-2xl" : "text-lg"),
                        "Título",
                      ) ?? (
                        <h4 className={cn("mt-1 font-semibold", slide ? "text-2xl" : "text-lg")}>
                          {b.depois.titulo}
                        </h4>
                      ))
                    : null}
                  <Imagem
                    arquivo={b.depois.imagem ?? ""}
                    base={base}
                    legenda={b.depois.titulo}
                    className="mt-3"
                  />
                  {campo(
                    ["depois", "texto"],
                    cn("mt-2", slide ? "text-lg" : "text-sm"),
                    "Como queremos",
                    {
                      multilinha: true,
                    },
                  ) ?? (
                    <Paragrafos
                      texto={b.depois.texto}
                      className={cn("mt-2", slide ? "text-lg" : "text-sm")}
                    />
                  )}
                </div>
              </div>
            );

          case "paleta": {
            const n = Math.min(Math.max(b.cores.length, 1), 6);
            return (
              <div
                key={b.id}
                style={{ "--colunas": n } as CSSProperties}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:[grid-template-columns:repeat(var(--colunas),minmax(0,1fr))]"
              >
                {b.cores.map((c, k) => (
                  <div key={k} className="min-w-0">
                    <div
                      style={{ backgroundColor: c.hex }}
                      className={cn("rounded-2xl border shadow-sm", slide ? "h-32" : "h-24")}
                    />
                    {campo(["cores", k, "nome"], "mt-2 text-sm font-medium", "Nome da cor") ?? (
                      <p className="mt-2 text-sm font-medium">{c.nome}</p>
                    )}
                    <p className="text-xs text-muted-foreground uppercase">{c.hex}</p>
                  </div>
                ))}
              </div>
            );
          }

          case "links": {
            const itens = b.itens
              .map((item, idx) => ({ item, idx }))
              .filter(({ item }) => digitando || item.url.trim() !== "");
            return (
              <ul key={b.id} className="flex flex-wrap gap-2">
                {itens.map(({ item: i, idx }) => (
                  <li key={idx} className="max-w-full min-w-0">
                    {digitando ? (
                      <span className="inline-flex max-w-full items-center rounded-xl border bg-card px-4 py-2 text-sm font-medium text-primary shadow-sm">
                        {campo(["itens", idx, "rotulo"], "min-w-24", "Nome do link")}
                      </span>
                    ) : (
                      <a
                        href={i.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={rotulos.abrirLink}
                        className="inline-flex max-w-full items-center rounded-xl border bg-card px-4 py-2 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-secondary"
                      >
                        <span className="[overflow-wrap:anywhere]">{i.rotulo || i.url}</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            );
          }

          case "citacao":
            return (
              <blockquote
                key={b.id}
                className={cn(
                  "border-l-4 border-primary pl-5 italic",
                  slide ? "text-2xl sm:text-4xl" : "text-xl",
                  ALINHAMENTO_DO_TEXTO[b.alinhamento ?? "esquerda"],
                )}
              >
                {campo(["texto"], "", "Escreva a citação", { multilinha: true }) ?? (
                  <Paragrafos texto={b.texto} />
                )}
                {digitando ? (
                  campo(["autor"], "mt-2 text-sm text-muted-foreground not-italic", "Quem disse")
                ) : b.autor ? (
                  <footer className="mt-2 text-sm text-muted-foreground not-italic">
                    — {b.autor}
                  </footer>
                ) : null}
              </blockquote>
            );

          case "imagem":
            return b.arquivo ? (
              <figure
                key={b.id}
                className={cn(
                  "w-full",
                  LARGURA_DA_IMAGEM[b.largura],
                  ALINHAMENTO_DO_BLOCO[b.alinhamento],
                )}
              >
                <Imagem arquivo={b.arquivo} base={base} legenda={b.legenda} />
                {digitando || b.legenda ? (
                  <figcaption
                    className={cn(
                      "mt-2 text-muted-foreground",
                      slide ? "text-base" : "text-sm",
                      ALINHAMENTO_DO_TEXTO[b.alinhamento],
                    )}
                  >
                    {campo(
                      ["legenda"],
                      cn(ALINHAMENTO_DO_TEXTO[b.alinhamento]),
                      "Legenda da imagem",
                    ) ?? b.legenda}
                  </figcaption>
                ) : null}
              </figure>
            ) : null;

          case "imagem-texto":
            return (
              <div key={b.id} className="grid items-center gap-6 sm:grid-cols-2 sm:gap-10">
                <div className={cn(b.lado === "direita" && "sm:order-2")}>
                  <Imagem arquivo={b.arquivo} base={base} legenda={b.titulo} />
                </div>
                <div className={cn(corpo)}>
                  {digitando || b.titulo
                    ? (campo(
                        ["titulo"],
                        cn("mb-2 font-semibold", slide ? "text-2xl sm:text-3xl" : "text-xl"),
                        "Título",
                      ) ?? (
                        <h3
                          className={cn(
                            "mb-2 font-semibold",
                            slide ? "text-2xl sm:text-3xl" : "text-xl",
                          )}
                        >
                          {b.titulo}
                        </h3>
                      ))
                    : null}
                  {campo(["texto"], "", "Escreva o texto", { multilinha: true }) ?? (
                    <Paragrafos texto={b.texto} />
                  )}
                </div>
              </div>
            );

          case "piramide":
            return <Niveis key={b.id} bloco={b} slide={slide} edicao={edicao} />;

          case "fluxo":
            return <FluxoDeEtapas key={b.id} bloco={b} slide={slide} edicao={edicao} />;

          case "matriz":
            return <MatrizDois key={b.id} bloco={b} slide={slide} edicao={edicao} />;

          case "ficha":
            return <FichaDaPagina key={b.id} bloco={b} slide={slide} edicao={edicao} />;

          case "tabela":
            return <TabelaDaPagina key={b.id} bloco={b} slide={slide} edicao={edicao} />;

          case "calculadora":
            return <CalculadoraDaMeta key={b.id} bloco={b} slide={slide} />;

          case "oferta":
            return <OfertaDaPagina key={b.id} oferta={b} slide={slide} base={base} />;

          case "separador":
            return <hr key={b.id} className="border-border" />;
        }
      })}
    </div>
  );
}
