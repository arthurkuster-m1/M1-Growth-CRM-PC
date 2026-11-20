"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "@/components/financas/rota";
import { CaretLeft, CaretRight, PencilSimple, X } from "@/lib/ui/icons";
import { Button, Card, MultiSelect, Page, Skeleton, Stat, brl } from "@/components/financas/kit";
import {
  listarParaHistorico,
  patrimonioMensal,
  useFinancas,
  usePlano,
  type Lancamento,
  type PatrimonioDoMes,
} from "@/lib/financas/dados";
import { hoje, mesAtual, mesCurto, nomeDoMes } from "@/lib/financas/formato";
import {
  agruparDetalhes,
  detalharCategorias,
  empilharPorMes,
  mesesComInformacao,
  patrimonioPrevisto,
} from "@/lib/financas/anual";
import { itensDoHistorico, listaDeMeses, resumoPorMes } from "@/lib/financas/historico";
import { TabelaAno } from "./TabelaAno";
import { PizzaAno } from "./PizzaAno";
import { rs } from "./comuns";
import { EditarTeto } from "./EditarTeto";
import { tetoDoAno } from "@/lib/financas/teto";
import { achatar } from "@/lib/financas/tabelaAno";
import { tetoDoMes } from "@/lib/financas/teto";
import { anualEfetivo } from "@/lib/financas/orcamentos";
import { CompararAnos } from "./CompararAnos";
import { GraficoEmpilhado, type SelecaoBarra } from "./graficos";

const rotulo = (m: string) => mesCurto(m).slice(0, 3);

export function Ano() {
  const [params, setParams] = useSearchParams();
  const atual = Number(mesAtual().slice(0, 4));
  const pedido = Number(params.get("ano"));
  const ano = pedido >= 2000 && pedido <= 2100 ? pedido : atual;
  const { contas, categoriasDoAno, grupos, carregando: carregandoBase } = useFinancas();
  const plano = usePlano();
  const [tetoMes, setTetoMes] = useState<string | null>(null);
  const categorias = useMemo(() => categoriasDoAno(ano), [categoriasDoAno, ano]);
  const [dados, setDados] = useState<{
    ano: number;
    historico: Lancamento[];
    patrimonio: PatrimonioDoMes[];
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string[]>([]);
  const [selecao, setSelecao] = useState<SelecaoBarra>(null);

  useEffect(() => {
    let vivo = true;
    setErro(null);
    setSelecao(null);
    // 13 meses de patrimônio: o de dezembro do ano anterior é a base da variação do ano
    Promise.all([
      listarParaHistorico(`${ano}-01`, `${ano + 1}-01`),
      patrimonioMensal(`${ano}-12`, 13),
    ]).then(
      ([historico, patrimonio]) => vivo && setDados({ ano, historico, patrimonio }),
      (e: Error) => vivo && setErro(e.message),
    );
    return () => {
      vivo = false;
    };
  }, [ano]);

  const calc = useMemo(() => {
    if (!dados || dados.ano !== ano) return null;
    const meses = listaDeMeses(`${ano}-01`, `${ano + 1}-01`);
    const itens = itensDoHistorico({
      contas,
      categorias,
      lancamentos: dados.historico,
      de: `${ano}-01`,
      ate: `${ano + 1}-01`,
    });
    const linhas = resumoPorMes(itens, meses);
    // gasto que conta no teto de cada mês: tudo que saiu
    const usadoTeto = meses.map((m) =>
      itens.filter((i) => i.tipo === "saida" && i.mes === m).reduce((a, i) => a + i.valor, 0),
    );
    const hojeMes = mesAtual();
    // Patrimônio = dinheiro nas contas no fim do mês. Fatura em aberto não entra: vira saída no mês em que for paga.
    const pat = new Map(dados.patrimonio.map((p) => [p.mes, p.contas_cents]));
    const base = pat.get(`${ano - 1}-12`) ?? null;
    const patMeses = meses.map((m) => ({
      mes: m,
      valor: m <= hojeMes ? (pat.get(m) ?? null) : null,
    }));
    const ultimo = [...patMeses].reverse().find((p) => p.valor !== null);
    const patPrev = patrimonioPrevisto(
      linhas,
      patMeses.map((p) => p.valor),
      base,
    );
    const soma = (f: (l: (typeof linhas)[number]) => number) =>
      linhas.reduce((a, l) => a + f(l), 0);
    const n = Math.max(mesesComInformacao(linhas), 1);
    const nEnt = Math.max(mesesComInformacao(linhas, "entradas"), 1),
      nSai = Math.max(mesesComInformacao(linhas, "saidas"), 1);
    const ordemCat = new Map(categorias.map((c, i) => [c.id, i]));
    const detalhes = detalharCategorias(itens, categorias, n)
      .filter((d) => d.ativa || d.total !== 0)
      .sort((a, b) => (ordemCat.get(a.id ?? "") ?? 9999) - (ordemCat.get(b.id ?? "") ?? 9999));
    const gruposOrdenados = grupos.filter((g) => !g.sistema);
    const por = (tipo: "entrada" | "saida") =>
      agruparDetalhes(
        detalhes.filter((d) => d.tipo === tipo),
        gruposOrdenados,
        n,
      );
    // cor de cada categoria no ano: a escolhida, ou a automática pela posição entre as maiores
    const cores = new Map<string | null, string>();
    for (const tipo of ["entrada", "saida"] as const)
      detalhes
        .filter((d) => d.tipo === tipo)
        .sort((a, b) => b.total - a.total)
        .forEach((d, i) =>
          cores.set(d.id, d.cor ? `var(--chart-${d.cor})` : `var(--chart-${(i % 10) + 1})`),
        );
    return {
      meses,
      itens,
      linhas,
      patMeses,
      base,
      ultimo,
      cores,
      patPrev,
      usadoTeto,
      nMedia: n,
      nEnt,
      nSai,
      caixa: dados.patrimonio.filter((p) => p.mes <= hojeMes).slice(-1)[0] ?? null,
      entradas: { pago: soma((l) => l.entradas.pago), previsto: soma((l) => l.entradas.previsto) },
      saidas: { pago: soma((l) => l.saidas.pago), previsto: soma((l) => l.saidas.previsto) },
      renda: por("entrada"),
      gastos: por("saida"),
    };
  }, [dados, ano, contas, categorias, grupos, plano.esporadicas]);

  const empilhado = useMemo(
    () => (calc ? empilharPorMes(calc.itens, categorias, calc.meses, filtro) : []),
    [calc, categorias, filtro],
  );
  const irPara = (a: number) => setParams({ ano: String(a) }, { replace: true });
  const totalEnt = calc ? calc.entradas.pago + calc.entradas.previsto : 0;
  const totalSai = calc ? calc.saidas.pago + calc.saidas.previsto : 0;
  const filtradas = categorias.filter((c) => filtro.includes(c.id));
  const nomeFiltro =
    filtradas.length <= 2
      ? filtradas.map((c) => c.nome).join(" + ")
      : `${filtradas.length} categorias`;
  const anoEnt = empilhado.reduce((a, m) => a + m.totalEntradas, 0),
    anoSai = empilhado.reduce((a, m) => a + m.totalSaidas, 0);
  const barra = selecao ? empilhado.find((m) => m.mes === selecao.mes) : undefined;
  const segs = barra ? (selecao!.lado === "entradas" ? barra.entradas : barra.saidas) : [];
  const totalBarra = barra
    ? selecao!.lado === "entradas"
      ? barra.totalEntradas
      : barra.totalSaidas
    : 0;

  return (
    <Page wide>
      <h1 className="t-display">Visão do ano</h1>
      <div className="fi-row fi-row--wrap seletores-topo" data-testid="seletores-ano">
        <div className="fi-monthnav" role="group" aria-label="Ano">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ano anterior"
            onClick={() => irPara(ano - 1)}
          >
            <CaretLeft size={20} weight="bold" />
          </Button>
          <span>{ano}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Próximo ano"
            onClick={() => irPara(ano + 1)}
          >
            <CaretRight size={20} weight="bold" />
          </Button>
        </div>
      </div>
      {erro && (
        <p className="fi-error-text" role="alert">
          Erro ao carregar: {erro}
        </p>
      )}
      {carregandoBase || !calc ? (
        <Card className="fi-stack">
          <Skeleton h={18} w="40%" />
          <Skeleton h={56} w="60%" />
          <Skeleton h={180} />
        </Card>
      ) : (
        <>
          <div className="fi-grid fi-grid--4" data-testid="cartoes-ano">
            <Card>
              <Stat label="Entradas no ano">
                <span className="t-money t-h2 t-money--fit is-in" data-testid="total-entradas-ano">
                  {brl(totalEnt)}
                </span>
                <span className="t-caption t-muted ano-detalhe" data-testid="detalhe-entradas-ano">
                  <span>Recebido {brl(calc.entradas.pago)}</span>
                  <span>Previsto {brl(calc.entradas.previsto)}</span>
                </span>
                <span className="t-caption t-muted" data-testid="media-entradas">
                  Média por mês: {brl(Math.round(totalEnt / calc.nEnt))}
                </span>
              </Stat>
            </Card>
            <Card>
              <Stat label="Saídas no ano">
                <span className="t-money t-h2 t-money--fit" data-testid="total-saidas-ano">
                  {brl(totalSai)}
                </span>
                <span className="t-caption t-muted ano-detalhe" data-testid="detalhe-saidas-ano">
                  <span>Pago {brl(calc.saidas.pago)}</span>
                  <span>Previsto {brl(calc.saidas.previsto)}</span>
                </span>
                <span className="t-caption t-muted" data-testid="media-saidas">
                  Média por mês: {brl(Math.round(totalSai / calc.nSai))}
                </span>
              </Stat>
            </Card>
            <Card>
              <Stat label="Resultado do ano">
                <span className="t-money t-h2 t-money--fit" data-testid="total-resultado-ano">
                  {brl(totalEnt - totalSai)}
                </span>
                <span className="t-caption t-muted ano-detalhe" data-testid="detalhe-resultado-ano">
                  <span>Realizado {brl(calc.entradas.pago - calc.saidas.pago)}</span>
                  <span>Previsto {brl(calc.entradas.previsto - calc.saidas.previsto)}</span>
                </span>
                <span className="t-caption t-muted" data-testid="media-resultado">
                  Média por mês: {brl(Math.round((totalEnt - totalSai) / calc.nMedia))}
                </span>
              </Stat>
            </Card>
            {(() => {
              // Patrimônio previsto = o do último mês do ano na tabela "Mês a mês" (realizado hoje + tudo o que ainda é previsto e o que já está lançado até o fim do ano)
              const atual = calc.caixa?.contas_cents ?? null;
              const fim = calc.patPrev[calc.patPrev.length - 1]?.previsto ?? null;
              const previstoLiquido = atual !== null && fim !== null ? fim - atual : 0;
              return (
                <Card>
                  <Stat label="Patrimônio previsto">
                    <span className="t-money t-h2 t-money--fit" data-testid="patrimonio-previsto">
                      {fim !== null ? brl(fim) : atual !== null ? brl(atual) : "—"}
                    </span>
                    {atual !== null && (
                      <span
                        className="t-caption t-muted ano-detalhe"
                        data-testid="detalhe-patrimonio"
                      >
                        <span>Atual {brl(atual)}</span>
                        <span>
                          {previstoLiquido < 0 ? "−" : "+"} Previsto{" "}
                          {brl(Math.abs(previstoLiquido))}
                        </span>
                      </span>
                    )}
                  </Stat>
                </Card>
              );
            })()}
          </div>

          <Card className="fi-stack" data-testid="grafico-ano">
            <div className="fi-row fi-row--between fi-row--wrap">
              <h2 className="t-h3">Entradas × saídas por mês</h2>
              {filtradas.length > 0 && (
                <button type="button" className="mes-chip" onClick={() => setFiltro([])}>
                  <X size={14} weight="bold" aria-hidden />
                  Filtrando: {nomeFiltro}
                </button>
              )}
            </div>
            <div className="ano-filtro ano-filtro--grafico" data-testid="filtro-grafico">
              <MultiSelect
                aria-label="Filtrar o gráfico por uma ou mais categorias"
                values={filtro}
                onChange={(v) => {
                  setFiltro(v);
                  setSelecao(null);
                }}
                grupos={[
                  {
                    label: "Entradas",
                    opcoes: categorias
                      .filter((c) => c.tipo === "entrada" && c.grupo !== "Sistema" && c.ativa)
                      .map((c) => ({ value: c.id, label: c.nome })),
                  },
                  {
                    label: "Saídas",
                    opcoes: categorias
                      .filter((c) => c.tipo === "saida" && c.grupo !== "Sistema" && c.ativa)
                      .map((c) => ({ value: c.id, label: c.nome })),
                  },
                ]}
              />
            </div>
            <GraficoEmpilhado
              meses={empilhado}
              mostrarLucro={filtro.length === 0}
              selecao={selecao}
              onSelecionar={setSelecao}
              rotuloDoMes={rotulo}
              nomeDoMes={nomeDoMes}
            />
            <p className="ano-total-grafico t-body-sm" data-testid="total-ano-grafico">
              <b>{filtradas.length ? nomeFiltro : "Todas as categorias"}</b> · soma dos 12 meses:
              {(filtradas.length === 0 || anoEnt > 0) && (
                <>
                  {" "}
                  entradas <b className="t-money is-in">{brl(anoEnt)}</b>
                </>
              )}
              {(filtradas.length === 0 || anoSai > 0) && (
                <>
                  {" "}
                  · saídas <b className="t-money">{brl(anoSai)}</b>
                </>
              )}
              {filtradas.length === 0 || (anoEnt > 0 && anoSai > 0) ? (
                <>
                  {" "}
                  · resultado{" "}
                  <b className="t-money">
                    {anoEnt - anoSai < 0 ? "−" : ""}
                    {brl(Math.abs(anoEnt - anoSai))}
                  </b>
                </>
              ) : null}
            </p>
            {selecao && barra && (
              <div className="ano-divisao" data-testid="divisao-barra" aria-live="polite">
                <b>
                  {nomeDoMes(selecao.mes)} ·{" "}
                  {selecao.lado === "entradas" ? "Entradas por fonte" : "Saídas por categoria"} ·{" "}
                  {brl(totalBarra)}
                </b>
                {segs.length === 0 ? (
                  <span className="t-body-sm t-muted">Nada neste mês.</span>
                ) : (
                  <ul>
                    {segs.map((s) => (
                      <li key={s.categoriaId ?? "sem"}>
                        <span>
                          <span
                            className="mes-dot"
                            style={{
                              background: calc.cores.get(s.categoriaId) ?? "var(--chart-9)",
                            }}
                            aria-hidden
                          />{" "}
                          {s.nome}
                        </span>
                        <span className="t-money">
                          {brl(s.pago + s.previsto)}{" "}
                          <span className="t-caption t-muted">
                            {totalBarra > 0
                              ? Math.round(((s.pago + s.previsto) / totalBarra) * 100)
                              : 0}
                            %{s.previsto > 0 ? " · inclui previsto" : ""}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>

          <CompararAnos anoInicial={ano} />

          <Card className="fi-stack">
            <h2 className="t-h3">Mês a mês</h2>
            <p className="t-caption t-muted" style={{ margin: 0 }}>
              As médias dividem o valor cheio (pago + previsto) pelos meses com lançamento: de
              janeiro até o último mês cadastrado (resultado e categorias: {calc.nMedia}{" "}
              {calc.nMedia === 1 ? "mês" : "meses"}; entradas: {calc.nEnt}; saídas: {calc.nSai}).
            </p>
            <div className="mes-tab__rolagem">
              <table
                className="mes-tab mes-tab--compacta"
                style={{ minWidth: 0 }}
                data-testid="tabela-ano"
              >
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th className="mes-tab__v">Entradas</th>
                    <th className="mes-tab__v">Saídas</th>
                    <th className="mes-tab__v">Resultado</th>
                    <th className="mes-tab__v">
                      Patrimônio<small className="ano-prev">previsto</small>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calc.linhas.map((l, i) => (
                    <tr key={l.mes}>
                      <td>
                        <Link to={`/financas/mes?mes=${l.mes}`}>{mesCurto(l.mes)}</Link>
                      </td>
                      <td className="mes-tab__v t-money">
                        {rs(l.entradas.total)}
                        {l.entradas.previsto !== 0 && (
                          <small className="ano-prev">
                            inclui {brl(l.entradas.previsto)} prev.
                          </small>
                        )}
                      </td>
                      <td className="mes-tab__v t-money">
                        {rs(l.saidas.total)}
                        {l.saidas.previsto !== 0 && (
                          <small className="ano-prev">inclui {brl(l.saidas.previsto)} prev.</small>
                        )}
                        {(() => {
                          const tr = tetoDoMes(plano, l.mes);
                          const passou = tr.valor > 0 && calc.usadoTeto[i]! > tr.valor;
                          return (
                            <button
                              type="button"
                              className={`ano-teto${passou ? "is-estouro" : ""}`}
                              onClick={() => setTetoMes(l.mes)}
                              title={`Teto de gastos de ${nomeDoMes(l.mes)}: clique para alterar`}
                              data-testid={`teto-${l.mes}`}
                            >
                              teto{" "}
                              {tr.valor > 0 ? (
                                <>
                                  <span className="mes-tab__rs">R$&nbsp;</span>
                                  {Math.round(tr.valor / 100).toLocaleString("pt-BR")}
                                </>
                              ) : (
                                "—"
                              )}
                              {passou && " ▲"}
                              <PencilSimple size={10} aria-hidden />
                            </button>
                          );
                        })()}
                      </td>
                      <td
                        className="mes-tab__v t-money"
                        data-testid="resultado-mes-ano"
                        style={{
                          color:
                            l.resultado > 0
                              ? "var(--color-success-fg)"
                              : l.resultado < 0
                                ? "var(--color-error-fg)"
                                : undefined,
                        }}
                      >
                        {l.resultado > 0 ? "+" : l.resultado < 0 ? "−" : ""}
                        {rs(Math.abs(l.resultado))}
                      </td>
                      <td
                        className="mes-tab__v t-money"
                        data-testid={`patrimonio-previsto-${l.mes}`}
                      >
                        {calc.patPrev[i]!.previsto !== null
                          ? rs(calc.patPrev[i]!.previsto as number)
                          : "—"}
                        {calc.patPrev[i]!.atual !== null &&
                          calc.patPrev[i]!.atual !== calc.patPrev[i]!.previsto && (
                            <small className="ano-prev">
                              atual {brl(calc.patPrev[i]!.atual as number)}
                            </small>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <PizzaAno
            ano={ano}
            renda={calc.renda}
            gastos={calc.gastos}
            corDe={(id) => calc.cores.get(id) ?? "var(--chart-9)"}
          />

          <TabelaAno
            esporadicas={plano.esporadicas}
            titulo="Renda por fonte"
            tipo="entrada"
            ano={ano}
            grupos={calc.renda}
            totalGeral={totalEnt}
            corDe={(id) => calc.cores.get(id) ?? "var(--chart-9)"}
            vazio={`Nenhuma entrada em ${ano}.`}
          />
          <TabelaAno
            esporadicas={plano.esporadicas}
            titulo="Gasto por categoria"
            tipo="saida"
            ano={ano}
            grupos={calc.gastos}
            totalGeral={totalSai}
            corDe={(id) => calc.cores.get(id) ?? "var(--chart-9)"}
            vazio={`Nenhuma saída em ${ano}.`}
          />
        </>
      )}
      <EditarTeto
        mes={tetoMes ?? `${ano}-01`}
        atual={tetoDoMes(plano, tetoMes ?? `${ano}-01`)}
        tetoPadrao={plano.tetoPadrao}
        aberto={tetoMes !== null}
        onClose={() => setTetoMes(null)}
        onSalvo={plano.recarregar}
      />
    </Page>
  );
}
