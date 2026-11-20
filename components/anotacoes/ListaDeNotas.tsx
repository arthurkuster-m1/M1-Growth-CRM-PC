"use client";

import { useMemo, useState, type ReactNode } from "react";

import {
  Botao,
  ItemOrdenavel,
  ListaOrdenavel,
  OrdenavelRaiz,
  Segmentado,
  arrayMove,
  corDaNota,
  dataCurta,
} from "@/components/anotacoes/kit-visual";
import { useBuscaDeNotas } from "@/hooks/anotacoes/useBuscaDeNotas";
import { useT } from "@/hooks/i18n/useT";
import { dobrar } from "@/lib/anotacoes/busca";
import type { ResumoDaNota } from "@/lib/anotacoes/paginas";
import {
  DotsThree,
  FileText,
  MagnifyingGlass,
  Plus,
  ShareNetwork,
  SquaresFour,
  Star,
  Table,
  Tray,
  X,
} from "@/lib/ui/icons";

export type VisaoDasNotas = "tabela" | "cards";
const CHAVE_VISAO = "anotacoes.visao";
export function lerVisao(): VisaoDasNotas {
  try {
    return localStorage.getItem(CHAVE_VISAO) === "cards" ? "cards" : "tabela";
  } catch {
    return "tabela";
  }
}
function guardarVisao(v: VisaoDasNotas) {
  try {
    localStorage.setItem(CHAVE_VISAO, v);
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
}

function Icone({ n, tamanho = 18 }: { n: ResumoDaNota; tamanho?: number }) {
  if (n.icon) {
    return (
      <span className="an-lista-icone" style={{ fontSize: tamanho }}>
        {n.icon}
      </span>
    );
  }
  return n.kind === "inbox" ? (
    <Tray size={tamanho} aria-hidden />
  ) : (
    <FileText size={tamanho} aria-hidden />
  );
}

type Ordem = "manual" | "recentes" | "titulo";

/**
 * A tela inicial das ANOTAÇÕES — igual à do app da Família Kuster: todas as páginas numa TABELA
 * (como as do Notion) ou em CARDS coloridos, sem menu lateral. Clicar numa página a abre inteira;
 * a "⋯" de cada uma abre as opções (nova subpágina, mover, visibilidade, lixeira); arrastar pela
 * alça (⋮⋮) reordena.
 *
 * O que o CRM tem a mais: a busca também lê o texto das páginas, filtro por etiqueta, "Captura
 * rápida" e a visibilidade ao cliente (no lugar do "compartilhar com a outra pessoa").
 */
export function ListaDeNotas({
  notas,
  favoritas,
  podeEditar,
  rotuloSuperior,
  descricao,
  aoAbrir,
  aoCriar,
  aoCapturar,
  aoOpcoes,
  aoReordenar,
}: {
  notas: readonly ResumoDaNota[];
  favoritas: readonly string[];
  podeEditar: boolean;
  /** Linha pequena acima do título (ex.: "Modo agência"). */
  rotuloSuperior?: string;
  descricao: string;
  aoAbrir: (id: string) => void;
  aoCriar: () => void;
  aoCapturar?: () => void;
  aoOpcoes: (id: string) => void;
  aoReordenar: (mudancas: Array<{ id: string; position: number }>) => void;
}) {
  const t = useT();
  const [visao, setVisao] = useState<VisaoDasNotas>(lerVisao);
  const [busca, setBusca] = useState("");
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [soFavoritas, setSoFavoritas] = useState(false);
  const [comSub, setComSub] = useState(false);
  const [ordem, setOrdem] = useState<Ordem>("manual");
  const textual = useBuscaDeNotas(busca);
  const mudarVisao = (v: VisaoDasNotas) => {
    setVisao(v);
    guardarVisao(v);
  };

  const vivas = useMemo(() => notas.filter((n) => !n.deleted_at), [notas]);
  const porId = useMemo(() => new Map(vivas.map((n) => [n.id, n])), [vivas]);
  const nSub = vivas.filter((n) => n.parent_id && porId.has(n.parent_id)).length;
  const etiquetas = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const n of vivas) for (const e of n.tags) contagem.set(e, (contagem.get(e) ?? 0) + 1);
    return [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [vivas]);
  const idsDoTexto = useMemo(
    () => new Set(textual.resultados.map((r) => r.id)),
    [textual.resultados],
  );

  const termo = dobrar(busca).trim();
  const linhas = useMemo(() => {
    return vivas
      .filter((n) => comSub || termo || etiqueta || !(n.parent_id && porId.has(n.parent_id)))
      .filter((n) => !soFavoritas || favoritas.includes(n.id))
      .filter((n) => !etiqueta || n.tags.some((e) => e.toLowerCase() === etiqueta.toLowerCase()))
      .filter(
        (n) =>
          !termo ||
          dobrar(n.title || "sem titulo").includes(termo) ||
          n.tags.some((e) => dobrar(e).includes(termo)) ||
          idsDoTexto.has(n.id),
      )
      .sort((a, b) =>
        ordem === "manual"
          ? a.position - b.position || a.id.localeCompare(b.id)
          : ordem === "titulo"
            ? (a.title || "~").localeCompare(b.title || "~", "pt-BR")
            : b.updated_at.localeCompare(a.updated_at),
      );
  }, [vivas, porId, termo, etiqueta, soFavoritas, comSub, ordem, favoritas, idsDoTexto]);

  // Arrastar muda a ordem manual (a "position" entre irmãs: mesma página-mãe). Só vale na ordem manual.
  const podeArrastar = podeEditar && ordem === "manual";
  const contextoDe = (n: ResumoDaNota) => n.parent_id ?? "raiz";
  function soltou(contexto: string, idAtivo: string, idSobre: string) {
    const irmas = vivas
      .filter((n) => contextoDe(n) === contexto)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    const de = irmas.findIndex((n) => n.id === idAtivo);
    const para = irmas.findIndex((n) => n.id === idSobre);
    if (de < 0 || para < 0) return;
    aoReordenar(
      arrayMove(irmas, de, para)
        .map((n, i) => ({ id: n.id, position: i + 1 }))
        .filter(({ id, position }) => porId.get(id)?.position !== position),
    );
  }

  const nome = (n: ResumoDaNota) => n.title || t("Sem título");
  const dentroDe = (n: ResumoDaNota) => (n.parent_id ? porId.get(n.parent_id) : undefined);
  const marca = (n: ResumoDaNota) =>
    podeEditar && n.visible_to_client ? t("Visível ao cliente") : null;
  const filtrando = termo.length > 0 || etiqueta !== null;

  return (
    <div className="an-pilha" style={{ gap: 14 }} data-testid="lista-notas">
      <header className="an-lista-cab">
        <div>
          {rotuloSuperior ? (
            <p
              className="an-t-legenda an-t-mudo"
              style={{ fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}
            >
              {rotuloSuperior}
            </p>
          ) : null}
          <h1 className="an-t-display">{t("Anotações")}</h1>
          <p className="an-t-corpo-sm an-t-mudo">{descricao}</p>
        </div>
        {podeEditar ? (
          <div className="an-lista-cab__acoes">
            {aoCapturar ? (
              <Botao
                variant="secondary"
                icon={<Plus size={16} weight="bold" aria-hidden />}
                onClick={aoCapturar}
                data-testid="captura-rapida"
              >
                {t("Captura rápida")}
              </Botao>
            ) : null}
            <Botao
              icon={<Plus size={16} weight="bold" aria-hidden />}
              onClick={aoCriar}
              data-testid="nova-pagina"
            >
              {t("Nova página")}
            </Botao>
          </div>
        ) : null}
      </header>

      <div className="an-lista-barra">
        <Segmentado
          value={visao}
          onChange={mudarVisao}
          options={[
            { value: "tabela", label: t("Tabela") },
            { value: "cards", label: t("Cards") },
          ]}
          aria-label={t("Visualização")}
        />
        <div className="an-busca an-busca--larga">
          <MagnifyingGlass size={14} aria-hidden className="an-busca__lupa" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t("Buscar por título, etiqueta ou texto")}
            aria-label={t("Buscar por título, etiqueta ou texto")}
            data-testid="busca-anotacoes"
          />
          {busca ? (
            <button type="button" aria-label={t("Limpar busca")} onClick={() => setBusca("")}>
              <X size={12} aria-hidden />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="an-chip"
          aria-pressed={soFavoritas}
          onClick={() => setSoFavoritas((v) => !v)}
        >
          <Star size={14} weight={soFavoritas ? "fill" : "regular"} aria-hidden /> {t("Favoritas")}
        </button>
        {nSub > 0 ? (
          <button
            type="button"
            className="an-chip"
            aria-pressed={comSub}
            onClick={() => setComSub((v) => !v)}
          >
            {t("Subpáginas")} ({nSub})
          </button>
        ) : null}
        {etiquetas.map(([nomeDaEtiqueta, quantas]) => {
          const ativa = etiqueta?.toLowerCase() === nomeDaEtiqueta.toLowerCase();
          return (
            <button
              key={nomeDaEtiqueta}
              type="button"
              className="an-chip"
              aria-pressed={ativa}
              onClick={() => setEtiqueta(ativa ? null : nomeDaEtiqueta)}
            >
              {nomeDaEtiqueta}
              <small>{quantas}</small>
            </button>
          );
        })}
      </div>

      {linhas.length === 0 ? (
        <div className="an-cartao an-vazio-grande">
          <FileText size={36} className="an-t-mudo" aria-hidden />
          <p className="an-t-corpo an-t-mudo">
            {filtrando && textual.procurando
              ? t("Buscando…")
              : vivas.length === 0
                ? podeEditar
                  ? t("Você ainda não tem anotações.")
                  : t("Nenhuma página liberada para você ainda.")
                : t("Nenhuma página encontrada.")}
          </p>
          {vivas.length === 0 && podeEditar ? (
            <Botao
              icon={<Plus size={14} weight="bold" aria-hidden />}
              onClick={aoCriar}
              data-testid="nova-pagina-vazio"
            >
              {t("Nova página")}
            </Botao>
          ) : null}
        </div>
      ) : visao === "tabela" ? (
        <div
          className="an-tabela"
          role="table"
          aria-label={t("Páginas")}
          data-testid="tabela-notas"
        >
          <div className="an-tabela__cab" role="row">
            <span role="columnheader" aria-hidden className="an-col-alca" />
            <button
              type="button"
              role="columnheader"
              className="an-tabela__ord"
              onClick={() => setOrdem(ordem === "titulo" ? "manual" : "titulo")}
              aria-sort={ordem === "titulo" ? "ascending" : "none"}
            >
              {t("Título")}
              {ordem === "titulo" ? " ↑" : ""}
            </button>
            <span role="columnheader" className="an-col-dentro">
              {t("Dentro de")}
            </span>
            <button
              type="button"
              role="columnheader"
              className="an-tabela__ord an-col-data"
              onClick={() => setOrdem(ordem === "recentes" ? "manual" : "recentes")}
              aria-sort={ordem === "recentes" ? "descending" : "none"}
            >
              {t("Atualizada")}
              {ordem === "recentes" ? " ↓" : ""}
            </button>
            <span role="columnheader" className="an-col-marca">
              {t("Compartilhamento")}
            </span>
            <span role="columnheader" aria-hidden className="an-col-mais" />
          </div>
          <OrdenavelRaiz onSoltar={soltou}>
            <ListaOrdenavel ids={podeArrastar ? linhas.map((n) => n.id) : []}>
              {linhas.map((n) => {
                const mae = dentroDe(n);
                const m = marca(n);
                const conteudo = (alca: ReactNode) => (
                  <>
                    <span role="cell" className="an-col-alca">
                      {alca}
                    </span>
                    <button
                      type="button"
                      role="cell"
                      className="an-tabela__titulo"
                      onClick={() => aoAbrir(n.id)}
                    >
                      <Icone n={n} />
                      <span className="an-nome">{nome(n)}</span>
                      {favoritas.includes(n.id) ? (
                        <Star
                          size={13}
                          weight="fill"
                          className="an-favorito__ligado"
                          aria-label={t("Favorita")}
                        />
                      ) : null}
                      {n.tags.length ? (
                        <span className="an-tabela__etiquetas">
                          {n.tags.slice(0, 3).map((e) => (
                            <span key={e} className="an-pilula">
                              {e}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </button>
                    <span role="cell" className="an-col-dentro an-t-mudo">
                      {mae ? (
                        <span className="an-pilula">
                          {mae.icon ? `${mae.icon} ` : ""}
                          {nome(mae)}
                        </span>
                      ) : (
                        ""
                      )}
                    </span>
                    <span role="cell" className="an-col-data an-t-mudo">
                      {dataCurta(n.updated_at)}
                    </span>
                    <span role="cell" className="an-col-marca">
                      {m ? (
                        <span className="an-pilula an-pilula--azul">
                          <ShareNetwork size={11} aria-hidden /> {m}
                        </span>
                      ) : null}
                    </span>
                    <span role="cell" className="an-col-mais">
                      {podeEditar ? (
                        <button
                          type="button"
                          className="an-mais"
                          aria-label={`${t("Opções de")} ${nome(n)}`}
                          onClick={() => aoOpcoes(n.id)}
                        >
                          <DotsThree size={20} weight="bold" aria-hidden />
                        </button>
                      ) : null}
                    </span>
                  </>
                );
                return podeArrastar ? (
                  <ItemOrdenavel
                    key={n.id}
                    as="div"
                    id={n.id}
                    contexto={contextoDe(n)}
                    nome={nome(n)}
                    className="an-tabela__linha"
                    data-testid={`nota-${n.id}`}
                  >
                    {({ alca }) => conteudo(alca)}
                  </ItemOrdenavel>
                ) : (
                  <div
                    key={n.id}
                    className="an-tabela__linha"
                    role="row"
                    data-testid={`nota-${n.id}`}
                  >
                    {conteudo(null)}
                  </div>
                );
              })}
            </ListaOrdenavel>
          </OrdenavelRaiz>
          {podeEditar && !filtrando ? (
            <button type="button" className="an-tabela__nova" onClick={aoCriar}>
              <Plus size={14} aria-hidden /> {t("Nova página")}
            </button>
          ) : null}
        </div>
      ) : (
        <OrdenavelRaiz grade onSoltar={soltou}>
          <ListaOrdenavel grade ids={podeArrastar ? linhas.map((n) => n.id) : []}>
            <CardsDasNotas
              paginas={linhas}
              favoritas={favoritas}
              podeEditar={podeEditar}
              podeArrastar={podeArrastar}
              contextoDe={contextoDe}
              dentroDe={dentroDe}
              marca={marca}
              aoAbrir={aoAbrir}
              aoOpcoes={aoOpcoes}
            />
          </ListaOrdenavel>
        </OrdenavelRaiz>
      )}
      <p className="an-t-legenda an-t-mudo" aria-hidden>
        {visao === "tabela" ? <Table size={12} /> : <SquaresFour size={12} />} {linhas.length}{" "}
        {linhas.length === 1 ? t("página") : t("páginas")}
      </p>
    </div>
  );
}

/**
 * A grade de CARDS: capa em degradê (cor sempre a mesma para a mesma página), ícone grande
 * esmaecido, título, "dentro de" / visibilidade e a data. Serve à lista e às subpáginas de uma página.
 */
export function CardsDasNotas({
  paginas,
  favoritas,
  podeEditar,
  podeArrastar = false,
  contextoDe,
  dentroDe,
  marca,
  aoAbrir,
  aoOpcoes,
}: {
  paginas: readonly ResumoDaNota[];
  favoritas: readonly string[];
  podeEditar: boolean;
  podeArrastar?: boolean;
  contextoDe?: (n: ResumoDaNota) => string;
  dentroDe?: (n: ResumoDaNota) => ResumoDaNota | undefined;
  marca?: (n: ResumoDaNota) => string | null;
  aoAbrir: (id: string) => void;
  aoOpcoes: (id: string) => void;
}) {
  const t = useT();
  const nome = (n: ResumoDaNota) => n.title || t("Sem título");
  return (
    <ul className="an-cards" aria-label={t("Páginas")} data-testid="cards-notas">
      {paginas.map((n) => {
        const [c1, c2] = corDaNota(n.id);
        const mae = dentroDe?.(n);
        const m = marca?.(n) ?? null;
        const conteudo = (alca: ReactNode) => (
          <>
            {alca ? <span className="an-card__alca">{alca}</span> : null}
            <button
              type="button"
              className="an-card__abrir"
              onClick={() => aoAbrir(n.id)}
              aria-label={`${t("Abrir")} ${nome(n)}`}
            >
              <span
                className="an-card__capa"
                style={{ background: `linear-gradient(110deg, ${c1}, ${c2})` }}
              >
                <span className="an-card__marca" aria-hidden>
                  <Icone n={n} tamanho={64} />
                </span>
              </span>
              <span className="an-card__corpo">
                <span className="an-card__titulo">
                  <span style={{ color: c1 }}>
                    <Icone n={n} tamanho={16} />
                  </span>
                  <span className="an-nome">{nome(n)}</span>
                  {favoritas.includes(n.id) ? (
                    <Star
                      size={13}
                      weight="fill"
                      className="an-favorito__ligado"
                      aria-label={t("Favorita")}
                    />
                  ) : null}
                </span>
                {n.tags.length ? (
                  <span className="an-card__etiquetas">
                    {n.tags.slice(0, 3).map((e) => (
                      <span key={e} className="an-pilula">
                        {e}
                      </span>
                    ))}
                  </span>
                ) : null}
                <span className="an-card__rodape">
                  <span className="an-pilula" style={{ background: `${c1}22`, color: c1 }}>
                    {mae ? `${mae.icon ? `${mae.icon} ` : ""}${nome(mae)}` : (m ?? t("Página"))}
                  </span>
                  <span className="an-t-legenda an-t-mudo">{dataCurta(n.updated_at)}</span>
                </span>
              </span>
            </button>
            {podeEditar ? (
              <button
                type="button"
                className="an-mais an-card__mais"
                aria-label={`${t("Opções de")} ${nome(n)}`}
                onClick={() => aoOpcoes(n.id)}
              >
                <DotsThree size={20} weight="bold" aria-hidden />
              </button>
            ) : null}
          </>
        );
        return podeArrastar && contextoDe ? (
          <ItemOrdenavel
            key={n.id}
            as="li"
            id={n.id}
            contexto={contextoDe(n)}
            nome={nome(n)}
            className="an-card"
            data-testid={`nota-${n.id}`}
          >
            {({ alca }) => conteudo(alca)}
          </ItemOrdenavel>
        ) : (
          <li key={n.id} className="an-card" data-testid={`nota-${n.id}`}>
            {conteudo(null)}
          </li>
        );
      })}
    </ul>
  );
}
