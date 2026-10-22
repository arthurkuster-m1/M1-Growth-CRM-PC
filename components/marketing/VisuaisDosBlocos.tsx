import { CampoNoLugar, emEdicao, type EdicaoNoLugar } from "@/components/marketing/CampoNoLugar";
import type { Bloco } from "@/lib/marketing/blocos";
import { calcular, moeda } from "@/lib/marketing/calculadora";
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
type Tabela = Extract<Bloco, { tipo: "tabela" }>;
type Calculadora = Extract<Bloco, { tipo: "calculadora" }>;

/** A borda dos cartões: um contorno sólido na cor da marca, sem brilho nem sombra. */
export const BORDA_DA_MARCA = "border-[1.5px] border-primary";

/**
 * Pirâmide (ou funil) de verdade: cada nível é um trapézio e, empilhados, formam o triângulo.
 * O contorno é sólido na cor da marca e o preenchimento fica mais forte quanto mais importante
 * o nível (o topo, na pirâmide). O texto de cada nível fica ao lado, alinhado à sua faixa.
 */
export function Niveis({
  bloco,
  slide,
  edicao,
}: {
  bloco: Piramide;
  slide: boolean;
  edicao?: EdicaoNoLugar;
}) {
  const digitando = emEdicao(edicao, bloco);
  const itens = bloco.itens
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => digitando || item.titulo.trim() !== "" || item.texto.trim() !== "");
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
      {itens.map(({ item, idx }, i) => {
        const { topo, base } = faixa(i);
        // Mais importante = mais preenchido (topo da pirâmide / boca do funil).
        const forca = n === 1 ? 100 : 100 - (i / (n - 1)) * 72;
        const claro = forca < 55;
        return (
          <li key={idx} className="contents">
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
              {digitando ? (
                <>
                  <CampoNoLugar
                    edicao={edicao!}
                    bloco={bloco}
                    caminho={["itens", idx, "titulo"]}
                    placeholder="Nível"
                    className="text-sm leading-snug font-semibold sm:text-base"
                  />
                  <CampoNoLugar
                    edicao={edicao!}
                    bloco={bloco}
                    caminho={["itens", idx, "texto"]}
                    placeholder="Descrição"
                    multilinha
                    className="mt-0.5 text-xs text-muted-foreground sm:text-sm"
                  />
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function FluxoDeEtapas({
  bloco,
  slide,
  edicao,
}: {
  bloco: Fluxo;
  slide: boolean;
  edicao?: EdicaoNoLugar;
}) {
  const digitando = emEdicao(edicao, bloco);
  const itens = bloco.itens
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => digitando || item.titulo.trim() !== "" || item.texto.trim() !== "");
  if (itens.length === 0) return null;
  const seta =
    "polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)";
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-3">
      {itens.map(({ item, idx }, i) => (
        <li
          key={idx}
          style={{ clipPath: i === 0 ? seta.replace("16px 50%)", "0 50%)") : seta }}
          className={cn(
            "flex min-w-40 flex-1 basis-40 flex-col justify-center bg-primary/12 py-3 pr-7 pl-8",
            slide ? "min-h-24" : "min-h-20",
          )}
        >
          <span className="text-[11px] font-semibold tracking-wider text-primary uppercase">
            {String(i + 1).padStart(2, "0")}
          </span>
          {digitando ? (
            <>
              <CampoNoLugar
                edicao={edicao!}
                bloco={bloco}
                caminho={["itens", idx, "titulo"]}
                placeholder="Etapa"
                className="text-sm leading-snug font-medium"
              />
              <CampoNoLugar
                edicao={edicao!}
                bloco={bloco}
                caminho={["itens", idx, "texto"]}
                placeholder="Detalhe"
                className="text-xs text-muted-foreground"
              />
            </>
          ) : (
            <>
              <span className={cn("leading-snug font-medium", slide ? "text-lg" : "text-sm")}>
                {item.titulo}
              </span>
              {item.texto ? (
                <span className={cn("text-muted-foreground", slide ? "text-base" : "text-xs")}>
                  {item.texto}
                </span>
              ) : null}
            </>
          )}
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

export function MatrizDois({
  bloco,
  slide,
  edicao,
}: {
  bloco: Matriz;
  slide: boolean;
  edicao?: EdicaoNoLugar;
}) {
  const digitando = emEdicao(edicao, bloco);
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
            {digitando ? (
              <CampoNoLugar
                edicao={edicao!}
                bloco={bloco}
                caminho={["celulas", i, "titulo"]}
                placeholder="Título"
                className="text-base font-semibold"
              />
            ) : (
              <h4 className={cn("font-semibold", slide ? "text-xl sm:text-2xl" : "text-base")}>
                {c.titulo}
              </h4>
            )}
          </header>
          {digitando ? (
            <CampoNoLugar
              edicao={edicao!}
              bloco={bloco}
              caminho={["celulas", i, "texto"]}
              placeholder="Escreva aqui"
              multilinha
              className="text-sm text-muted-foreground"
            />
          ) : c.texto ? (
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
export function FichaDaPagina({
  bloco,
  slide,
  edicao,
}: {
  bloco: Ficha;
  slide: boolean;
  edicao?: EdicaoNoLugar;
}) {
  const digitando = emEdicao(edicao, bloco);
  const links = bloco.links.filter((l) => l.url.trim() !== "");
  if (!digitando && bloco.intro.trim() === "" && links.length === 0) return null;
  const destaques = links.filter((l) => l.destaque);
  const demais = links.filter((l) => !l.destaque);
  const nome = (l: { rotulo: string; url: string }) =>
    l.rotulo || l.url.replace(/^https?:\/\//, "");
  return (
    <div className={cn("flex flex-col gap-4 rounded-2xl bg-card p-5 sm:p-6", BORDA_DA_MARCA)}>
      {digitando ? (
        <CampoNoLugar
          edicao={edicao!}
          bloco={bloco}
          caminho={["intro"]}
          placeholder="Quem é, o que faz…"
          multilinha
          className="max-w-3xl text-base leading-relaxed"
        />
      ) : bloco.intro ? (
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

/** Uma tabela simples: cabeçalho na cor da marca, primeira coluna em destaque, rola no celular. */
export function TabelaDaPagina({
  bloco,
  slide,
  edicao,
}: {
  bloco: Tabela;
  slide: boolean;
  edicao?: EdicaoNoLugar;
}) {
  const digitando = emEdicao(edicao, bloco);
  return (
    <div className={cn("overflow-x-auto rounded-2xl bg-card", BORDA_DA_MARCA)}>
      <table
        className={cn(
          "w-full min-w-[32rem] border-collapse text-left",
          slide ? "text-base sm:text-lg" : "text-sm",
        )}
      >
        <thead>
          <tr className="bg-primary/10">
            {bloco.colunas.map((c, i) => (
              <th key={i} scope="col" className="px-4 py-3 font-semibold">
                {digitando ? (
                  <CampoNoLugar
                    edicao={edicao!}
                    bloco={bloco}
                    caminho={["colunas", i]}
                    placeholder="Coluna"
                    className="font-semibold"
                  />
                ) : (
                  c
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloco.linhas.map((linha, r) => (
            <tr key={r} className="border-t">
              {bloco.colunas.map((_, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-4 py-2.5 align-top whitespace-pre-line",
                    i === 0 && "font-medium",
                  )}
                >
                  {digitando ? (
                    <CampoNoLugar
                      edicao={edicao!}
                      bloco={bloco}
                      caminho={["linhas", r, i]}
                      placeholder="—"
                      multilinha
                      valor={linha[i] ?? ""}
                      gravar={(v) => ({
                        ...bloco,
                        linhas: bloco.linhas.map((l, k) =>
                          k === r ? bloco.colunas.map((_, c) => (c === i ? v : (l[c] ?? ""))) : l,
                        ),
                      })}
                      className={i === 0 ? "font-medium" : ""}
                    />
                  ) : (
                    (linha[i] ?? "")
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A calculadora da meta: mostra as entradas e o que elas exigem (vendas, leads, investimento…). */
export function CalculadoraDaMeta({ bloco, slide }: { bloco: Calculadora; slide: boolean }) {
  const r = calcular(bloco);
  const traco = "—";
  const peca = (rotulo: string, valor: string, detalhe?: string) => ({ rotulo, valor, detalhe });
  const entradas = [
    peca("Meta de faturamento", bloco.meta || traco),
    peca("Ticket médio", bloco.ticket || traco),
    peca("Conversão de lead em venda", bloco.conversao || traco),
    peca("Custo por lead", bloco.cpl || traco),
    peca("Margem de contribuição", bloco.margem || traco),
    peca("Meses de retenção", bloco.retencao || traco),
  ];
  const saidas = [
    peca("Vendas necessárias", r.vendas === null ? traco : String(r.vendas), "no período"),
    peca("Leads necessários", r.leads === null ? traco : String(r.leads), "para essas vendas"),
    peca("Investimento em mídia", r.investimento === null ? traco : moeda(r.investimento)),
    peca("CAC", r.cac === null ? traco : moeda(r.cac), "custo para conquistar um cliente"),
    peca(
      "Retorno sobre o investimento",
      r.roas === null ? traco : `${r.roas.toFixed(1)}x`,
      "faturamento ÷ investimento",
    ),
    peca("Lucro estimado", r.lucro === null ? traco : moeda(r.lucro), "margem − investimento"),
    peca("LTV", r.ltv === null ? traco : moeda(r.ltv), "ticket × meses de retenção"),
    peca(
      "LTV ÷ CAC",
      r.ltvSobreCac === null ? traco : `${r.ltvSobreCac.toFixed(1)}x`,
      "acima de 3x é saudável",
    ),
  ];
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2">
        {entradas.map((e) => (
          <li key={e.rotulo} className={cn("rounded-xl bg-card px-3 py-2", BORDA_DA_MARCA)}>
            <span className="block text-[11px] tracking-wide text-muted-foreground uppercase">
              {e.rotulo}
            </span>
            <span className={cn("font-semibold", slide ? "text-xl" : "text-base")}>{e.valor}</span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {saidas.map((s) => (
          <div key={s.rotulo} className="rounded-2xl bg-primary/10 p-4">
            <span className="block text-xs font-medium text-muted-foreground">{s.rotulo}</span>
            <span
              className={cn(
                "mt-1 block font-bold tracking-tight text-primary",
                slide ? "text-3xl sm:text-4xl" : "text-2xl",
              )}
            >
              {s.valor}
            </span>
            {s.detalhe ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">{s.detalhe}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
