"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@/components/financas/rota";
import { Bell, Bank, CreditCard, Scales } from "@/lib/ui/icons";
import { Badge, Button, Card, Page, Skeleton, Stat, brl } from "@/components/financas/kit";
import {
  listarLancamentos,
  listarParaHistorico,
  usePlano,
  listarPorFatura,
  listarSaldos,
  listarSaldosNoInicio,
  patrimonioMensal,
  useFinancas,
  type Conta,
  type Lancamento,
  type PatrimonioDoMes,
  type Saldo,
} from "@/lib/financas/dados";
import {
  faturaPadrao,
  hoje as hojeISO,
  intervaloDoMes,
  mesAnterior,
  mesAtual,
  mesCurto,
  mesSeguinte,
  nomeDoMes,
} from "@/lib/financas/formato";
import { calcularMes } from "@/lib/financas/mes";
import {
  itensDoHistorico,
  listaDeMeses,
  mediaJanela,
  resumoPorMes,
  totaisPorCategoria,
} from "@/lib/financas/historico";
import { ConferirSaldo } from "./ConferirSaldo";
import { AlertasMes } from "./AlertasMes";
import { GraficoLinha } from "./graficos";
import { rs } from "./comuns";
import { ritmoDiario } from "@/lib/financas/ritmo";
import { metaDoMes, tetoDoMes } from "@/lib/financas/teto";

const MESES = 12;
type Dados = {
  patrimonio: PatrimonioDoMes[];
  historico: Lancamento[];
  saldos: Saldo[];
  doMes: Lancamento[];
  daFatura: Lancamento[];
  inicio: Record<string, number>;
};
const textoRendimento = (c: Conta) =>
  !c.rendimento_base || c.rendimento_pct == null
    ? null
    : c.rendimento_base === "cdi"
      ? `${String(c.rendimento_pct).replace(".", ",")}% do CDI`
      : `${String(c.rendimento_pct).replace(".", ",")}% ao ano`;
const rotuloMes = (m: string) => mesCurto(m).slice(0, 3);

/** O modelo final não tem categoria "esporádica": o único orçamento de gastos é o teto do mês. */
const SEM_ESPORADICAS = new Set<string>();

export function Geral() {
  const { contas, categorias, carregando: carregandoBase } = useFinancas();
  const mes = mesAtual();
  const navegar = useNavigate();
  const plano = usePlano();
  const irParaMes = (m: string) => navegar(`/financas/mes?mes=${m}`);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [conferindo, setConferindo] = useState<Conta | null>(null);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    let de = mes;
    for (let i = 1; i < MESES; i++) de = mesAnterior(de);
    const { de: ini, ate: fim } = intervaloDoMes(mes);
    Promise.all([
      patrimonioMensal(mes, MESES),
      listarParaHistorico(de, mesSeguinte(mes)),
      listarSaldos(),
      listarLancamentos(ini, fim),
      listarPorFatura(mes),
      listarSaldosNoInicio(mes, false),
    ]).then(
      ([patrimonio, historico, saldos, doMes, daFatura, inicio]) => {
        if (!vivo) return;
        const d = { patrimonio, historico, saldos, doMes, daFatura, inicio };
        setDados(d);
        setErro(null);
      },
      (e: Error) => vivo && setErro(e.message),
    );
    return () => {
      vivo = false;
    };
  }, [mes, versao]);

  // Crédito: uma compra no cartão hoje cai na fatura de outro mês (pela data de fechamento) — o teto que vale é o desse mês
  const cartoesAtivos = useMemo(
    () => contas.filter((c) => c.ativa && c.tipo === "cartao" && c.dia_fechamento != null),
    [contas],
  );
  const mesCredito = useMemo(
    () =>
      cartoesAtivos.length
        ? cartoesAtivos
            .map((c) => faturaPadrao(hojeISO(), c.dia_fechamento, c.dia_vencimento))
            .sort()[0]
        : null,
    [cartoesAtivos],
  );
  const [extra, setExtra] = useState<{
    mes: string;
    doMes: Lancamento[];
    daFatura: Lancamento[];
    inicio: Record<string, number>;
  } | null>(null);
  useEffect(() => {
    if (!mesCredito || mesCredito === mes) return;
    let vivo = true;
    const { de: ini, ate: fim } = intervaloDoMes(mesCredito);
    Promise.all([
      listarLancamentos(ini, fim),
      listarPorFatura(mesCredito),
      listarSaldosNoInicio(mesCredito, false),
    ]).then(
      ([doMes, daFatura, inicio]) => vivo && setExtra({ mes: mesCredito, doMes, daFatura, inicio }),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [mesCredito, mes, versao]);

  const calc = useMemo(() => {
    if (!dados) return null;
    let de = mes;
    for (let i = 1; i < MESES; i++) de = mesAnterior(de);
    const ate = mesSeguinte(mes);
    const itens = itensDoHistorico({ contas, categorias, lancamentos: dados.historico, de, ate });
    const linhas = resumoPorMes(itens, listaDeMeses(de, ate));
    let de6 = mes;
    for (let i = 1; i < 6; i++) de6 = mesAnterior(de6);
    const itens6 = itens.filter((i) => i.mes >= de6);
    const gastos = totaisPorCategoria(itens6, "saida", categorias, 6).filter((t) => t.total > 0);
    // gasto acumulado do ano até o mês passado (base dos alertas de categoria pelo orçamento do ANO)
    const anoAcumulado: Record<string, number> = {};
    for (const i of itens)
      if (i.categoriaId && i.mes >= `${mes.slice(0, 4)}-01` && i.mes < mes)
        anoAcumulado[i.categoriaId] = (anoAcumulado[i.categoriaId] ?? 0) + i.valor;
    const atual = calcularMes({
      mes,
      hoje: hojeISO(),
      contas,
      categorias,
      doMes: dados.doMes,
      daFatura: dados.daFatura,
      inicio: dados.inicio,
      anoAcumulado,
      teto: tetoDoMes(plano, mes).valor,
      meta: metaDoMes(plano, mes).valor,
      esporadicas: SEM_ESPORADICAS,
    });
    // ano atual: o que mais pesou, contra o orçamento do ano, e a média por mês
    const ano = mes.slice(0, 4),
      mesesDecorridos = Number(mes.slice(5, 7));
    const ranking = totaisPorCategoria(
      itens.filter((i) => i.mes >= `${ano}-01` && i.mes <= mes),
      "saida",
      categorias,
      12,
    ).filter((t) => t.total > 0);
    // débito: o que ainda cabe no teto deste mês, por dia até o fim do mês
    const hoje = hojeISO();
    const debito = ritmoDiario({ mes, hoje, restante: atual.teto.restante, cartoes: [] });
    // crédito: o que ainda cabe no teto do mês em que a fatura aberta cai, por dia até o cartão virar
    let credito: { mes: string; restante: number; ritmo: ReturnType<typeof ritmoDiario> } | null =
      null;
    if (mesCredito) {
      const base =
        mesCredito === mes
          ? atual
          : extra && extra.mes === mesCredito
            ? calcularMes({
                mes: mesCredito,
                hoje,
                contas,
                categorias,
                doMes: extra.doMes,
                daFatura: extra.daFatura,
                inicio: extra.inicio,
                teto: tetoDoMes(plano, mesCredito).valor,
                meta: 0,
                esporadicas: SEM_ESPORADICAS,
              })
            : null;
      if (base)
        credito = {
          mes: mesCredito,
          restante: base.teto.restante,
          ritmo: ritmoDiario({
            mes: mesCredito,
            hoje,
            restante: base.teto.restante,
            cartoes: cartoesAtivos,
          }),
        };
    }
    const saldo = new Map(dados.saldos.map((s) => [s.account_id, s.saldo_atual_cents]));
    const naoCartao = contas.filter((c) => c.ativa && c.tipo !== "cartao");
    const cartoes = contas.filter((c) => c.ativa && c.tipo === "cartao");
    const emContas = naoCartao.reduce((a, c) => a + (saldo.get(c.id) ?? 0), 0);
    const faturaAberta = cartoes.reduce((a, c) => a + Math.max(-(saldo.get(c.id) ?? 0), 0), 0);
    // Patrimônio = dinheiro que está nas contas. Fatura de cartão em aberto NÃO entra: ela vira saída no mês em que for paga.
    const serie = dados.patrimonio.map((p) => ({ mes: p.mes, liquido: p.contas_cents }));
    const alertas = [...atual.alertas];
    for (const c of naoCartao.filter((x) => x.tipo === "corrente"))
      if ((saldo.get(c.id) ?? 0) < 0)
        alertas.unshift({
          id: `neg-${c.id}`,
          grupo: "aviso",
          tom: "error",
          texto: `${c.nome} está com saldo negativo (${brl(saldo.get(c.id) ?? 0)}).`,
          para: "/financas/config?aba=contas",
        });
    return {
      linhas,
      media: mediaJanela(linhas, mes, 4),
      meta: atual.metaEntradas,
      atual,
      debito,
      credito,
      ranking,
      mesesDecorridos,
      gastos,
      totalGastos: gastos.reduce((a, g) => a + g.total, 0),
      alertas,
      saldo,
      naoCartao,
      cartoes,
      emContas,
      faturaAberta,
      serie,
    };
  }, [
    dados,
    contas,
    categorias,
    mes,
    plano.tetoPadrao,
    plano.tetos,
    plano.metaPadrao,
    plano.metas,
    mesCredito,
    cartoesAtivos,
    extra,
  ]);

  return (
    <Page wide>
      <div className="fi-row fi-row--between fi-row--wrap">
        <h1 className="t-display">Visão geral</h1>
        <span className="t-body-sm t-muted">{nomeDoMes(mes)}</span>
      </div>
      {erro && (
        <p className="fi-error-text" role="alert">
          Erro ao carregar: {erro}
        </p>
      )}
      {carregandoBase || !calc || !dados ? (
        <Card className="fi-stack">
          <Skeleton h={18} w="40%" />
          <Skeleton h={56} w="60%" />
          <Skeleton h={160} />
        </Card>
      ) : (
        <>
          <Card className="mes-hero" data-testid="patrimonio-hoje">
            <p className="t-body-sm t-muted">Patrimônio hoje</p>
            <div className="mes-hero__valor t-money" data-testid="patrimonio-valor">
              {brl(calc.emContas)}
            </div>
            {calc.serie.length > 1 &&
              (() => {
                const mAnt = calc.serie[calc.serie.length - 2]!,
                  d = calc.emContas - mAnt.liquido;
                return (
                  <p
                    className="t-body-sm"
                    data-testid="patrimonio-comparacao"
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      color: d >= 0 ? "var(--color-success-fg)" : "var(--color-error-fg)",
                    }}
                  >
                    {d === 0
                      ? "Igual ao"
                      : `${d > 0 ? "+" : "−"} ${brl(Math.abs(d))} ${d > 0 ? "a mais" : "a menos"} que no`}{" "}
                    fim de {mesCurto(mAnt.mes)}
                  </p>
                );
              })()}
          </Card>

          <div className="fi-grid fi-grid--4" data-testid="medias">
            <Card>
              <Stat label="Entradas deste mês">
                <span className="t-money t-h2 t-money--fit is-in" data-testid="geral-entradas">
                  {brl(calc.atual.entradas.total)}
                </span>
                <span className="t-caption t-muted">
                  {calc.media
                    ? `Média dos 4 últimos meses: ${brl(calc.media.entradas)}`
                    : "ainda sem mês fechado para a média"}
                </span>
              </Stat>
            </Card>
            <Card>
              <Stat label="Saídas deste mês">
                <span className="t-money t-h2 t-money--fit" data-testid="geral-saidas">
                  {brl(calc.atual.saidas.total)}
                </span>
                <span className="t-caption t-muted">
                  {calc.media
                    ? `Média dos 4 últimos meses: ${brl(calc.media.saidas)}`
                    : "ainda sem mês fechado para a média"}
                </span>
              </Stat>
            </Card>
            <Card>
              <Stat label="Podemos gastar no débito">
                <span className="t-money t-h2 t-money--fit" data-testid="geral-debito">
                  {calc.atual.teto.definido ? brl(Math.max(calc.atual.teto.restante, 0)) : "—"}
                </span>
                <span className="t-caption t-muted" data-testid="geral-debito-dia">
                  {!calc.atual.teto.definido
                    ? "defina o teto na Visão do mês"
                    : calc.atual.teto.restante <= 0
                      ? "teto do mês esgotado"
                      : calc.debito
                        ? `${brl(calc.debito.porDia)} por dia até ${calc.debito.ate.slice(8, 10)}/${calc.debito.ate.slice(5, 7)}`
                        : ""}
                </span>
              </Stat>
            </Card>
            <Card>
              <Stat label="Podemos gastar no crédito">
                <span className="t-money t-h2 t-money--fit" data-testid="geral-credito">
                  {calc.credito ? brl(Math.max(calc.credito.restante, 0)) : "—"}
                </span>
                <span className="t-caption t-muted" data-testid="geral-credito-dia">
                  {!mesCredito
                    ? "nenhum cartão com fechamento cadastrado"
                    : !calc.credito
                      ? "calculando…"
                      : !tetoDoMes(plano, mesCredito).valor
                        ? `defina o teto de ${mesCurto(mesCredito)}`
                        : calc.credito.restante <= 0
                          ? `teto de ${mesCurto(calc.credito.mes)} esgotado`
                          : calc.credito.ritmo
                            ? `${brl(calc.credito.ritmo.porDia)} por dia até ${calc.credito.ritmo.ate.slice(8, 10)}/${calc.credito.ritmo.ate.slice(5, 7)} · entra em ${mesCurto(calc.credito.mes)}`
                            : ""}
                </span>
              </Stat>
            </Card>
          </div>

          <Card className="fi-stack">
            <h2 className="t-h3">Evolução do patrimônio</h2>
            <div className="ger-evolucao">
              <GraficoLinha
                largura={520}
                titulo="Patrimônio no fim de cada mês"
                pontos={calc.serie.map((p) => ({ rotulo: rotuloMes(p.mes), valor: p.liquido }))}
              />
              <div className="mes-tab__rolagem">
                <table className="mes-tab" style={{ minWidth: 0 }} data-testid="tabela-evolucao">
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th className="mes-tab__v">Entradas</th>
                      <th className="mes-tab__v">Saídas</th>
                      <th className="mes-tab__v">Resultado</th>
                      <th className="mes-tab__v">Patrimônio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.patrimonio.map((p) => {
                      const l = calc.linhas.find((x) => x.mes === p.mes);
                      const res = l ? l.entradas.total - l.saidas.total : null;
                      return (
                        <tr
                          key={p.mes}
                          className="ger-evolucao__linha"
                          tabIndex={0}
                          title="Dois cliques para abrir a Visão do mês"
                          aria-label={`${mesCurto(p.mes)}: dois cliques (ou Enter) abrem a Visão do mês`}
                          onDoubleClick={() => irParaMes(p.mes)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") irParaMes(p.mes);
                          }}
                          data-testid={`linha-${p.mes}`}
                        >
                          <td>{mesCurto(p.mes)}</td>
                          <td className="mes-tab__v t-money is-in">
                            {l ? rs(l.entradas.total) : "—"}
                          </td>
                          <td className="mes-tab__v t-money">{l ? rs(l.saidas.total) : "—"}</td>
                          <td
                            className={`mes-tab__v t-money ${res === null || res === 0 ? "" : res > 0 ? "is-lucro" : "is-prejuizo"}`}
                            data-testid="resultado-mes"
                          >
                            {res === null ? (
                              "—"
                            ) : (
                              <>
                                {res > 0 ? "+" : res < 0 ? "−" : ""}
                                {rs(Math.abs(res))}
                              </>
                            )}
                          </td>
                          <td className="mes-tab__v t-money">{rs(p.contas_cents)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="t-caption t-muted" style={{ margin: "6px 0 0" }}>
                  Dê dois cliques no mês para abrir a Visão do mês.
                </p>
              </div>
            </div>
          </Card>

          <AlertasMes alertas={calc.alertas} />

          <Card className="fi-stack">
            <h2 className="t-h3">Maiores gastos por categoria</h2>
            <p className="t-body-sm t-muted">
              Neste ano ({mes.slice(0, 4)}), com a média por mês (cartão pelo mês da fatura).
            </p>
            {calc.ranking.length === 0 ? (
              <p className="t-body t-muted">Nenhum gasto neste ano.</p>
            ) : (
              <ul className="ger-ranking" data-testid="ranking">
                {calc.ranking.slice(0, 8).map((g, i) => {
                  const largura =
                    calc.ranking[0]!.total > 0 ? (g.total / calc.ranking[0]!.total) * 100 : 0;
                  return (
                    <li key={g.categoriaId ?? "sem"} data-testid={`rank-${g.nome}`}>
                      <div className="ger-ranking__topo">
                        <span>
                          <b>{i + 1}.</b> {g.nome}
                        </span>
                        <span className="t-money">{brl(g.total)}</span>
                      </div>
                      <div className="ger-barra" aria-hidden>
                        <span
                          style={{
                            width: `${largura}%`,
                            background: g.cor
                              ? `var(--chart-${g.cor})`
                              : `var(--chart-${(i % 10) + 1})`,
                          }}
                        />
                      </div>
                      <span className="t-caption t-muted">
                        Média por mês:{" "}
                        <b className="t-money">{brl(Math.round(g.total / calc.mesesDecorridos))}</b>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="fi-stack">
            <div className="fi-row fi-row--between fi-row--wrap">
              <h2 className="t-h3 mes-titulo">
                <Bank size={18} weight="duotone" aria-hidden />
                Contas
              </h2>
              <Link className="fi-btn fi-btn--ghost fi-btn--sm" to="/financas/config?aba=contas">
                Configurar contas
              </Link>
            </div>
            {calc.naoCartao.length === 0 ? (
              <p className="t-body t-muted">Nenhuma conta cadastrada.</p>
            ) : (
              <ul className="ger-contas" data-testid="contas-atuais">
                {calc.naoCartao.map((c) => (
                  <li key={c.id}>
                    <span className="ger-contas__nome">
                      <b>{c.nome}</b>
                      <span className="t-caption t-muted">
                        {[
                          c.tipo === "corrente"
                            ? "Conta corrente"
                            : c.tipo === "investida"
                              ? "Investimento"
                              : c.tipo === "emprestada"
                                ? "Emprestada"
                                : "Bem",
                          textoRendimento(c),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <b className="t-money">{brl(calc.saldo.get(c.id) ?? 0)}</b>
                    <Button
                      onClick={() => setConferindo(c)}
                      size="sm"
                      variant="secondary"
                      icon={<Scales size={16} />}
                      aria-label={`Conferir saldo de ${c.nome}`}
                    >
                      Conferir
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {calc.cartoes.length > 0 && (
              <>
                <h3 className="t-h3 mes-titulo">
                  <CreditCard size={18} weight="duotone" aria-hidden />
                  Faturas em aberto
                </h3>
                <ul className="ger-contas" data-testid="cartoes-atuais">
                  {calc.cartoes.map((c) => (
                    <li key={c.id}>
                      <span className="ger-contas__nome">
                        <b>{c.nome}</b>
                        <span className="t-caption t-muted">gasto no cartão e ainda não pago</span>
                      </span>
                      <b className="t-money">{brl(Math.max(-(calc.saldo.get(c.id) ?? 0), 0))}</b>
                      <Link
                        className="fi-btn fi-btn--ghost fi-btn--sm"
                        to={`/financas/faturas?cartao=${c.id}`}
                      >
                        Ver fatura
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </>
      )}
      <ConferirSaldo
        conta={conferindo}
        saldoSistema={conferindo && calc ? (calc.saldo.get(conferindo.id) ?? 0) : 0}
        onClose={() => setConferindo(null)}
        onFeito={recarregar}
      />
    </Page>
  );
}
