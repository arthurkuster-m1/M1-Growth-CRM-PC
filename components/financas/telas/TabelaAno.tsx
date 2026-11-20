"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  CaretDown,
  CaretUp,
  CaretUpDown,
  FolderSimple,
  MagnifyingGlass,
  PencilSimple,
  Tag,
  X,
} from "@/lib/ui/icons";
import {
  ItemOrdenavel,
  ListaOrdenavel,
  OrdenavelRaiz,
  Segmented,
  Skeleton,
  ValorInput,
  arrayMove,
  brl,
  Button,
  useToast,
} from "@/components/financas/kit";
import {
  atualizarCategoria,
  atualizarGrupo,
  listarParaHistorico,
  useFinancas,
} from "@/lib/financas/dados";
import { planejarReordem, porOrdem } from "@/lib/financas/ordem";
import {
  agruparDetalhes,
  detalharCategorias,
  type DetalheCategoria,
  type GrupoDetalhe,
} from "@/lib/financas/anual";
import { itensDoHistorico } from "@/lib/financas/historico";
import { mesCurto } from "@/lib/financas/formato";
import { anualEfetivo } from "@/lib/financas/orcamentos";
import {
  achatar,
  chaveCat,
  chaveGrupo,
  diferenca,
  filtrarGrupos,
  ordenar,
  porMesDoGrupo,
  serie,
  seriesPorChave,
  type ColunaTabela,
  type Serie,
  type SentidoOrdem,
} from "@/lib/financas/tabelaAno";
import { corDaCategoria } from "./FormCategoria";
import { rs } from "./comuns";

const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
const nomeMes = (ano: number, m: number) =>
  mesCurto(`${ano}-${String(m).padStart(2, "0")}`).slice(0, 3);
const celula = (v: number) => (v === 0 ? <span className="t-muted">—</span> : rs(v));
type Ordem = { col: ColunaTabela; dir: SentidoOrdem } | null;

/**
 * Renda por fonte / Gasto por categoria em TABELA: linha do grupo (abre e mostra as categorias), colunas de resumo e, num toggle,
 * os 12 meses; reordenar arrastando, ordenar por coluna, ver sem grupos, buscar e comparar categorias (inclusive com o ano anterior).
 */
export function TabelaAno({
  titulo,
  tipo,
  ano,
  grupos: lista,
  totalGeral,
  corDe,
  vazio,
  esporadicas,
}: {
  esporadicas: ReadonlySet<string>;
  titulo: string;
  tipo: "entrada" | "saida";
  ano: number;
  grupos: GrupoDetalhe[];
  totalGeral: number;
  corDe: (id: string | null) => string;
  vazio: string;
}) {
  const { contas, categorias, categoriasDoAno, grupos, aplicarOrdem, recarregar } = useFinancas();
  const [modo, setModo] = useState<"grupos" | "categorias">("grupos");
  const [busca, setBusca] = useState("");
  const [mesAMes, setMesAMes] = useState(false);
  const [ordem, setOrdem] = useState<Ordem>(null);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string[]>([]);
  const [comAnterior, setComAnterior] = useState(false);
  const [anterior, setAnterior] = useState<{ ano: number; series: Map<string, number[]> } | null>(
    null,
  );
  const [erro, setErro] = useState<string | null>(null);
  const toast = useToast();
  const rotuloOrc = tipo === "entrada" ? "Meta do ano" : "Orçamento do ano";
  const chave = (g: GrupoDetalhe) => g.grupoId ?? "sem";
  const visiveis = useMemo(() => grupos.filter((g) => !g.sistema).sort(porOrdem), [grupos]);
  const termo = busca.trim();
  const filtrados = useMemo(() => filtrarGrupos(lista, termo), [lista, termo]);
  const podeArrastar = modo === "grupos" && !ordem && !termo;
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);

  useEffect(() => setAnterior(null), [ano]);
  useEffect(() => {
    if (!comAnterior || (anterior && anterior.ano === ano - 1)) return;
    let vivo = true;
    setErro(null);
    const cats = categoriasDoAno(ano - 1);
    listarParaHistorico(`${ano - 1}-01`, `${ano}-01`).then(
      (l) => {
        if (!vivo) return;
        const itens = itensDoHistorico({
          contas,
          categorias: cats,
          lancamentos: l,
          de: `${ano - 1}-01`,
          ate: `${ano}-01`,
        });
        const det = detalharCategorias(itens, cats, 12).filter(
          (d) => d.tipo === tipo && (d.ativa || d.total !== 0),
        );
        setAnterior({
          ano: ano - 1,
          series: seriesPorChave(
            agruparDetalhes(
              det,
              grupos.filter((g) => !g.sistema),
              12,
            ),
          ),
        });
      },
      (e: Error) => vivo && setErro(e.message),
    );
    return () => {
      vivo = false;
    };
  }, [comAnterior, anterior, ano, contas, categoriasDoAno, grupos, tipo]);

  function soltou(contexto: string, idAtivo: string, idSobre: string) {
    const [tipoDeLista, , gk] = contexto.split("|") as ["grp" | "cat", string, string | undefined];
    const limpa = (x: string) => x.slice(x.lastIndexOf(":") + 1);
    const ativo = limpa(idAtivo),
      sobre = limpa(idSobre);
    let completa: { id: string; ordem: number; nome: string }[],
      dentro: { id: string; ordem: number; nome: string }[];
    if (tipoDeLista === "grp") {
      completa = visiveis;
      dentro = lista
        .filter((g) => g.grupoId)
        .map((g) => visiveis.find((v) => v.id === g.grupoId)!)
        .filter(Boolean);
    } else {
      completa = categorias.filter((c) => c.tipo === tipo && c.grupo !== "Sistema");
      const g = lista.find((x) => chave(x) === gk);
      dentro = (g?.categorias ?? [])
        .filter((d) => d.id)
        .map((d) => completa.find((c) => c.id === d.id)!)
        .filter(Boolean);
    }
    const de = dentro.findIndex((x) => x.id === ativo),
      para = dentro.findIndex((x) => x.id === sobre);
    if (de < 0 || para < 0) return;
    const plano = planejarReordem(completa, arrayMove(dentro, de, para));
    if (plano.length === 0) return;
    aplicarOrdem(tipoDeLista === "grp" ? "grupo" : "categoria", plano);
    const gravar = tipoDeLista === "grp" ? atualizarGrupo : atualizarCategoria;
    Promise.all(plano.map((x) => gravar(x.id, { ordem: x.ordem }))).catch(() => recarregar());
  }

  const ciclar = (col: ColunaTabela) =>
    setOrdem((o) =>
      !o || o.col !== col
        ? { col, dir: col === "nome" ? "asc" : "desc" }
        : o.dir === (col === "nome" ? "asc" : "desc")
          ? { col, dir: col === "nome" ? "desc" : "asc" }
          : null,
    );
  const cab = ({ col, texto, num }: { col: ColunaTabela; texto: string; num?: boolean }) => {
    const ativo = ordem?.col === col ? ordem.dir : null;
    return (
      <th
        className={num ? "mes-tab__v" : undefined}
        aria-sort={ativo === "asc" ? "ascending" : ativo === "desc" ? "descending" : "none"}
      >
        <button
          type="button"
          className={`mes-tab__ord${ativo ? "is-ativo" : ""}`}
          onClick={() => ciclar(col)}
          title="Clique para ordenar; de novo para inverter; mais uma vez para voltar à ordem do app"
        >
          {texto}
          <span className="mes-tab__seta" aria-hidden>
            {ativo === "asc" ? (
              <CaretUp size={12} weight="bold" />
            ) : ativo === "desc" ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretUpDown size={12} />
            )}
          </span>
        </button>
      </th>
    );
  };

  const alternarSel = (k: string) =>
    setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const alternarAberto = (k: string) =>
    setAbertos((a) => {
      const n = new Set(a);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const aberto = (k: string) => !!termo || abertos.has(k);
  const todos = filtrados.map(chave);
  const tudoAberto = todos.length > 0 && todos.every((k) => abertos.has(k));

  type Dado = {
    nome: string;
    total: number;
    previsto?: number;
    media: number;
    orcamentoAno: number;
    usado: number | null;
    maiorMes: { mes: number; valor: number } | null;
    porMes: number[];
  };
  const dadosGrupo = (g: GrupoDetalhe): Dado => ({
    ...g,
    porMes: porMesDoGrupo(g),
    maiorMes: porMesDoGrupo(g).reduce<{ mes: number; valor: number } | null>(
      (m, v, i) => (v > (m?.valor ?? 0) ? { mes: i + 1, valor: v } : m),
      null,
    ),
  });
  const numeros = (d: Dado, orcFechado = true, editavelId: string | null = null) => (
    <>
      <td className="mes-tab__v t-money">
        {rs(d.total)}
        {!!d.previsto && d.previsto > 0 && (
          <small className="ano-prev" data-testid="inclui-previsto">
            inclui {brl(d.previsto)} prev.
          </small>
        )}
      </td>
      <td className="mes-tab__v t-money">{rs(d.media)}</td>
      <td className="mes-tab__v">
        {totalGeral > 0 ? `${Math.round((d.total / totalGeral) * 100)}%` : "—"}
      </td>
      <td className="mes-tab__v">
        {d.maiorMes ? (
          <>
            {nomeMes(ano, d.maiorMes.mes)} · {rs(d.maiorMes.valor)}
          </>
        ) : (
          "—"
        )}
      </td>
      {mesAMes &&
        d.porMes.map((v, i) => (
          <td key={i} className="mes-tab__v t-money ano-tab__mes">
            {celula(v)}
          </td>
        ))}
    </>
  );
  const colunas = 5 + (mesAMes ? 12 : 0);

  const linhaCat = (
    d: DetalheCategoria & { grupoNome?: string },
    k: string,
    arrastavel: boolean,
  ) => {
    const ck = chaveCat(d.id);
    const conteudo = (alca: React.ReactNode) => (
      <>
        <td className="ano-tab__nome">
          <div className="ano-tab__celula ano-tab__celula--cat">
            {arrastavel && d.id ? alca : <span className="fi-alca fi-alca--vazia" aria-hidden />}
            <input
              type="checkbox"
              className="ano-tab__check"
              checked={sel.includes(ck)}
              onChange={() => alternarSel(ck)}
              aria-label={`Selecionar ${d.nome} para comparar`}
            />
            <Tag
              size={16}
              weight="fill"
              style={{ color: d.id ? corDe(d.id) : corDaCategoria(d.cor), flex: "none" }}
              aria-hidden
            />
            <span className="ano-tab__txt">
              <b>{d.nome}</b>
              {(d.grupoNome || (d.id && esporadicas.has(d.id))) && (
                <span className="t-caption t-muted">
                  {[d.grupoNome, d.id && esporadicas.has(d.id) ? "esporádica" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </span>
          </div>
        </td>
        {numeros(d, true, d.id)}
      </>
    );
    return arrastavel && d.id ? (
      <ItemOrdenavel
        key={d.id}
        as="tr"
        id={`c:${d.id}`}
        contexto={`cat|${tipo}|${k}`}
        nome={d.nome}
        className="ano-tab__cat"
        data-testid={`ano-cat-${d.nome}`}
      >
        {({ alca }) => conteudo(alca)}
      </ItemOrdenavel>
    ) : (
      <tr key={d.id ?? `sem-${d.nome}`} className="ano-tab__cat" data-testid={`ano-cat-${d.nome}`}>
        {conteudo(null)}
      </tr>
    );
  };

  const orcamentoTotal = lista.reduce((a, g) => a + g.orcamentoAno, 0);
  const gruposOrdenados = ordem ? ordenar(filtrados, ordem.col, ordem.dir) : filtrados;
  const planas = (() => {
    const a = achatar(filtrados);
    return ordem ? ordenar(a, ordem.col, ordem.dir) : a;
  })();

  /* ── comparação ── */
  const todasSeries = useMemo(() => seriesPorChave(lista), [lista]);
  const nomeDe = (k: string) => {
    if (k.startsWith("grp:")) {
      const g = lista.find((x) => chaveGrupo(x.grupoId) === k);
      return `Grupo ${g?.nome ?? ""}`.trim();
    }
    return (
      lista.flatMap((g) => g.categorias).find((c) => chaveCat(c.id) === k)?.nome ?? "Categoria"
    );
  };
  const selecionadas = sel.filter((k) => todasSeries.has(k));
  const atuais: Serie[] = selecionadas.map((k) => serie(k, nomeDe(k), todasSeries.get(k)!));
  type Bloco = { linhas: Serie[]; dif?: { de: Serie; para: Serie } };
  const blocos: Bloco[] =
    comAnterior && anterior
      ? atuais.map((s) => {
          const p = serie(
            `${s.chave}@ant`,
            `${s.rotulo} · ${ano - 1}`,
            anterior.series.get(s.chave) ?? Array(12).fill(0),
          );
          const c = { ...s, rotulo: `${s.rotulo} · ${ano}` };
          return { linhas: [p, c], dif: { de: p, para: c } };
        })
      : atuais.length === 2
        ? [{ linhas: atuais, dif: { de: atuais[0]!, para: atuais[1]! } }]
        : [{ linhas: atuais }];
  const corDif = (v: number) =>
    v === 0
      ? undefined
      : {
          color:
            v > 0 === (tipo === "entrada") ? "var(--color-success-fg)" : "var(--color-error-fg)",
        };
  const sinal = (v: number) => (v > 0 ? "+ " : v < 0 ? "− " : "");

  return (
    <OrdenavelRaiz onSoltar={soltou}>
      <section className="fi-card fi-stack" aria-label={titulo} data-testid={`detalhe-${tipo}`}>
        <div className="fi-row fi-row--between fi-row--wrap">
          <h2 className="t-h3">{titulo}</h2>
          <span className="t-body-sm t-muted ano-resumo" data-testid={`resumo-${tipo}`}>
            <span>
              {tipo === "entrada" ? "Ganhamos" : "Gastamos"} no ano:{" "}
              <b className="t-money">{brl(totalGeral)}</b>
            </span>
            {false && orcamentoTotal > 0 && (
              <span data-testid={`orcamento-total-${tipo}`}>
                {rotuloOrc}: <b className="t-money">{brl(orcamentoTotal)}</b>{" "}
                <span
                  className={
                    tipo === "saida" && totalGeral > orcamentoTotal ? "is-vencida" : undefined
                  }
                >
                  · {Math.round((totalGeral / orcamentoTotal) * 100)}%
                </span>
              </span>
            )}
          </span>
        </div>
        {lista.length === 0 ? (
          <p className="t-body t-muted">{vazio}</p>
        ) : (
          <>
            <div className="fi-row fi-row--between fi-row--wrap ano-tab__barra">
              <div className="fi-row fi-row--wrap">
                <Segmented<"grupos" | "categorias">
                  value={modo}
                  onChange={(v) => {
                    setModo(v);
                    setOrdem(null);
                  }}
                  options={[
                    { value: "grupos", label: "Por grupo" },
                    { value: "categorias", label: "Sem grupos" },
                  ]}
                />
                <button
                  type="button"
                  className={`mes-chip${mesAMes ? "is-ativo" : ""}`}
                  aria-pressed={mesAMes}
                  onClick={() => setMesAMes((v) => !v)}
                  data-testid={`mes-a-mes-${tipo}`}
                >
                  Mês a mês
                </button>
                {modo === "grupos" && !termo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAbertos(tudoAberto ? new Set() : new Set(todos))}
                  >
                    {tudoAberto ? "Recolher tudo" : "Abrir tudo"}
                  </Button>
                )}
              </div>
              <div className="mes-busca">
                <MagnifyingGlass size={16} aria-hidden />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar categoria ou grupo…"
                  aria-label={`Buscar em ${titulo}`}
                  data-testid={`busca-${tipo}`}
                />
                {busca && (
                  <button
                    type="button"
                    className="mes-busca__x"
                    aria-label="Limpar busca"
                    onClick={() => setBusca("")}
                  >
                    <X size={14} weight="bold" />
                  </button>
                )}
              </div>
            </div>

            {selecionadas.length > 0 && (
              <div className="ano-comp" data-testid={`comparar-${tipo}`}>
                <div className="fi-row fi-row--between fi-row--wrap">
                  <h3 className="t-h3">Comparar ({selecionadas.length})</h3>
                  <div className="fi-row fi-row--wrap">
                    <label className="ano-comp__ant">
                      <input
                        type="checkbox"
                        checked={comAnterior}
                        onChange={(e) => setComAnterior(e.target.checked)}
                        data-testid={`comparar-anterior-${tipo}`}
                      />{" "}
                      Comparar com {ano - 1}
                    </label>
                    <button type="button" className="mes-chip" onClick={() => setSel([])}>
                      <X size={14} weight="bold" aria-hidden />
                      Limpar seleção
                    </button>
                  </div>
                </div>
                {erro && (
                  <p className="fi-error-text" role="alert">
                    {erro}
                  </p>
                )}
                {comAnterior && !anterior && !erro ? (
                  <Skeleton h={90} />
                ) : (
                  <>
                    <div className="mes-tab__rolagem">
                      <table
                        className="mes-tab mes-tab--compacta ano-tab ano-tab--comp"
                        style={{ minWidth: 0 }}
                      >
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th className="mes-tab__v">Total</th>
                            <th className="mes-tab__v">Média/mês</th>
                            {meses.map((m) => (
                              <th key={m} className="mes-tab__v">
                                {nomeMes(ano, m)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        {blocos.map((b, i) => (
                          <tbody key={i}>
                            {b.linhas.map((s) => (
                              <tr key={s.chave}>
                                <td className="ano-tab__nome">
                                  <b>{s.rotulo}</b>
                                </td>
                                <td className="mes-tab__v t-money">{brl(s.total)}</td>
                                <td className="mes-tab__v t-money">
                                  {brl(Math.round(s.total / 12))}
                                </td>
                                {s.porMes.map((v, k) => (
                                  <td key={k} className="mes-tab__v t-money">
                                    {celula(v)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {b.dif &&
                              (() => {
                                const d = diferenca(b.dif.de, b.dif.para);
                                return (
                                  <tr className="ano-tab__dif" data-testid={`dif-${tipo}`}>
                                    <td className="ano-tab__nome">
                                      <b>Diferença</b>{" "}
                                      <span className="t-caption t-muted">
                                        {d.pct === null
                                          ? ""
                                          : `${sinal(d.pct)}${Math.abs(d.pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                                      </span>
                                    </td>
                                    <td className="mes-tab__v t-money" style={corDif(d.total)}>
                                      {sinal(d.total)}
                                      {brl(Math.abs(d.total))}
                                    </td>
                                    <td className="mes-tab__v t-money" style={corDif(d.total)}>
                                      {sinal(d.total)}
                                      {brl(Math.abs(Math.round(d.total / 12)))}
                                    </td>
                                    {d.porMes.map((v, k) => (
                                      <td key={k} className="mes-tab__v t-money" style={corDif(v)}>
                                        {v === 0 ? (
                                          <span className="t-muted">—</span>
                                        ) : (
                                          `${sinal(v)}${brl(Math.abs(v))}`
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })()}
                          </tbody>
                        ))}
                      </table>
                    </div>
                    {blocos.some((b) => b.dif) && (
                      <ul className="t-body-sm" data-testid={`frases-${tipo}`}>
                        {blocos
                          .filter((b) => b.dif)
                          .map((b, i) => {
                            const d = diferenca(b.dif!.de, b.dif!.para);
                            if (d.total === 0)
                              return (
                                <li key={i}>
                                  {b.dif!.para.rotulo} e {b.dif!.de.rotulo} têm o mesmo total.
                                </li>
                              );
                            return (
                              <li key={i}>
                                <b>{b.dif!.para.rotulo}</b>{" "}
                                {tipo === "entrada" ? "rendeu" : "custou"} {brl(Math.abs(d.total))}{" "}
                                {d.total > 0 ? "a mais" : "a menos"} que <b>{b.dif!.de.rotulo}</b>
                                {d.pct !== null
                                  ? ` (${Math.abs(d.pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`
                                  : ""}
                                .
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}

            {filtrados.length === 0 ? (
              <p className="t-body t-muted">Nada encontrado para “{termo}”.</p>
            ) : (
              <div className="mes-tab__rolagem">
                <table
                  className="mes-tab mes-tab--compacta ano-tab"
                  style={{ minWidth: 0 }}
                  data-testid={`tabela-${tipo}`}
                >
                  <thead>
                    <tr>
                      {cab({
                        col: "nome",
                        texto: modo === "grupos" ? "Grupo / categoria" : "Categoria",
                      })}
                      {cab({ col: "total", texto: "Total do ano", num: true })}
                      {cab({ col: "media", texto: "Média/mês", num: true })}
                      {cab({ col: "pct", texto: "% do total", num: true })}
                      {cab({ col: "maior", texto: "Maior mês", num: true })}
                      {mesAMes &&
                        meses.map((m) => (
                          <th key={m} className="mes-tab__v ano-tab__mes">
                            {nomeMes(ano, m)}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  {modo === "grupos" ? (
                    <ListaOrdenavel ids={gruposOrdenados.map((g) => `g:${tipo}:${chave(g)}`)}>
                      {gruposOrdenados.map((g) => {
                        const k = chave(g),
                          ab = aberto(k),
                          gk = chaveGrupo(g.grupoId),
                          arrasta = podeArrastar && !!g.grupoId;
                        const cats = ordem
                          ? ordenar(g.categorias, ordem.col, ordem.dir)
                          : g.categorias;
                        const cab = (alca: React.ReactNode) => (
                          <tr className="ano-tab__grupo" data-testid={`ano-grupo-${g.nome}`}>
                            <td className="ano-tab__nome">
                              <div className="ano-tab__celula">
                                {arrasta ? (
                                  alca
                                ) : (
                                  <span className="fi-alca fi-alca--vazia" aria-hidden />
                                )}
                                <input
                                  type="checkbox"
                                  className="ano-tab__check"
                                  checked={sel.includes(gk)}
                                  onChange={() => alternarSel(gk)}
                                  aria-label={`Selecionar o grupo ${g.nome} para comparar`}
                                />
                                <button
                                  type="button"
                                  className="ano-tab__abrir"
                                  aria-expanded={ab}
                                  onClick={() => alternarAberto(k)}
                                  disabled={!!termo}
                                >
                                  <CaretDown
                                    size={14}
                                    weight="bold"
                                    className="mes-toggle__seta"
                                    aria-hidden
                                  />
                                  <FolderSimple
                                    size={18}
                                    weight="duotone"
                                    aria-hidden
                                    className="ano-tab__pasta"
                                  />
                                  <span className="ano-tab__txt">
                                    <b>{g.nome}</b>
                                    <span className="t-caption t-muted">
                                      {g.categorias.length}{" "}
                                      {g.categorias.length === 1 ? "categoria" : "categorias"}
                                    </span>
                                  </span>
                                </button>
                              </div>
                            </td>
                            {numeros(dadosGrupo(g), true)}
                          </tr>
                        );
                        return (
                          <ItemOrdenavel
                            key={k}
                            as="tbody"
                            id={`g:${tipo}:${k}`}
                            contexto={`grp|${tipo}`}
                            nome={`o grupo ${g.nome}`}
                            className={ab ? "ano-tab__aberto" : undefined}
                          >
                            {({ alca }) => (
                              <>
                                {cab(alca)}
                                {ab && (
                                  <ListaOrdenavel
                                    ids={cats.filter((d) => d.id).map((d) => `c:${d.id}`)}
                                  >
                                    {cats.map((d) => (
                                      <Fragment key={d.id ?? "sem"}>
                                        {linhaCat(d, k, podeArrastar)}
                                      </Fragment>
                                    ))}
                                  </ListaOrdenavel>
                                )}
                              </>
                            )}
                          </ItemOrdenavel>
                        );
                      })}
                    </ListaOrdenavel>
                  ) : (
                    <tbody>{planas.map((d) => linhaCat(d, "plana", false))}</tbody>
                  )}
                  {!termo && (
                    <tfoot>
                      <tr>
                        <th>Total</th>
                        <th className="mes-tab__v t-money">{rs(totalGeral)}</th>
                        <th className="mes-tab__v t-money">
                          {rs(lista.reduce((a, g) => a + g.media, 0))}
                        </th>
                        <th className="mes-tab__v">100%</th>
                        <th />
                        <th />
                        {mesAMes &&
                          meses.map((m) => (
                            <th key={m} className="mes-tab__v t-money ano-tab__mes">
                              {rs(lista.reduce((a, g) => a + porMesDoGrupo(g)[m - 1]!, 0))}
                            </th>
                          ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
            <p className="t-caption t-muted">
              {podeArrastar
                ? "Arraste pela alça para ordenar (vale também em Configurações e em Lançar). "
                : "Para arrastar, use “Por grupo”, sem busca e sem coluna ordenada. "}
              Marque as caixas para comparar categorias ou grupos
              {colunas > 5 ? "; arraste a tabela para o lado para ver todos os meses" : ""}.
            </p>
          </>
        )}
      </section>
    </OrdenavelRaiz>
  );
}
