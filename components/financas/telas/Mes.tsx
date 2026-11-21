"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Link, useSearchParams } from "@/components/financas/rota";
import {
  CaretDown,
  CaretUp,
  CaretUpDown,
  CreditCard,
  Funnel,
  MagnifyingGlass,
  Minus,
  PencilSimple,
  Plus,
  Wallet,
  X,
} from "@/lib/ui/icons";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  NavegadorDeMes,
  Page,
  Segmented,
  Skeleton,
  Stat,
  brl,
  useToast,
} from "@/components/financas/kit";
import {
  atualizarLancamento,
  patchPagar,
  listarLancamentos,
  listarParaHistorico,
  listarPorFatura,
  listarSaldosNoInicio,
  useFinancas,
  useLancamentosDoMes,
  useLista,
  usePlano,
  type Lancamento,
} from "@/lib/financas/dados";
import { metaDoMes, tetoDoMes } from "@/lib/financas/teto";
import { EditarTeto } from "./EditarTeto";
import {
  dataBR,
  dataCurta,
  intervaloDoMes,
  mesCurto,
  mesAnterior,
  mesAtual,
  mesSeguinte,
  mesValido,
  nomeDoMes,
  hoje as hojeISO,
} from "@/lib/financas/formato";
import { itensDoHistorico } from "@/lib/financas/historico";
import { ritmoDiario, ritmoGanho, type RitmoDiario, type RitmoGanho } from "@/lib/financas/ritmo";
import {
  calcularMes,
  type FatiaCategoria,
  type ItemConsumo,
  type TetoDoMes,
} from "@/lib/financas/mes";
import { projetarInicio } from "@/lib/financas/projecao";
import { EditarLancamento } from "./EditarLancamento";
import { rs } from "./comuns";
import { BarraSelecao, EditarEmMassa, emLotes } from "./EditarEmMassa";
import { AlertasMes } from "./AlertasMes";
import {
  FiltroLancamentos,
  SEM_FILTROS,
  contarFiltros,
  passaNosFiltros,
  type Filtros,
} from "./FiltroLancamentos";

const cor = (i: number) => `var(--chart-${(i % 10) + 1})`;
/** Cor escolhida na categoria; sem escolha, a cor automática pela posição. */
const corDe = (f: Pick<FatiaCategoria, "cor">, i: number) =>
  f.cor ? `var(--chart-${f.cor})` : cor(i);
const SEM = "_sem";
const chave = (id: string | null) => id ?? SEM;

/** O modelo final não tem categoria "esporádica": o único orçamento de gastos é o teto do mês. */
const SEM_ESPORADICAS = new Set<string>();

export function Mes() {
  const [params, setParams] = useSearchParams();
  const mes = mesValido(params.get("mes")) ? params.get("mes")! : mesAtual();
  const irPara = (m: string) => setParams({ mes: m }, { replace: true });
  const { de, ate } = intervaloDoMes(mes);
  const { contas, categorias, carregando: carregandoBase } = useFinancas();
  const [acumulado, setAcumulado] = useState<{ mes: string; v: Record<string, number> } | null>(
    null,
  );

  const doMes = useLancamentosDoMes(de, ate);
  const daFatura = useLista(() => listarPorFatura(mes), [mes]);
  const [inicio, setInicio] = useState<{ mes: string; v: Record<string, number> } | null>(null);
  const [erroSaldo, setErroSaldo] = useState<string | null>(null);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const plano = usePlano();
  const tetoResolvido = tetoDoMes(plano, mes);
  const metaResolvida = metaDoMes(plano, mes);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [editandoTeto, setEditandoTeto] = useState(false);
  const [vista, setVista] = useState<"saida" | "entrada">("saida");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [situacao, setSituacao] = useState<"todos" | "pendente" | "pago">("todos");
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS);
  useEffect(() => {
    setSituacao("todos");
    setFiltros(SEM_FILTROS);
  }, [vista, mes]);

  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    setErroSaldo(null);
    const agora = mesAtual();
    const base = listarSaldosNoInicio(mes <= agora ? mes : agora, false);
    (mes <= agora
      ? base
      : base.then((b) =>
          projetarInicio({
            de: agora,
            ate: mes,
            hoje: hojeISO(),
            inicioDe: b,
            contas,
            categorias,
            carregar: async (m) => {
              const { de: a, ate: z } = intervaloDoMes(m);
              const [doMes, daFatura] = await Promise.all([
                listarLancamentos(a, z),
                listarPorFatura(m),
              ]);
              return { doMes, daFatura };
            },
          }),
        )
    ).then(
      (v) => vivo && setInicio({ mes, v }),
      (e: Error) => vivo && setErroSaldo(e.message),
    );
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, versao, contas, categorias]);
  useEffect(() => setSel(new Set()), [mes, vista]);
  // gasto/ganho acumulado dos meses ANTERIORES do ano: é o que torna o orçamento anual flexível (o mês pode estourar, o ano não)
  useEffect(() => {
    let vivo = true;
    const ano = mes.slice(0, 4);
    if (mes.slice(5, 7) === "01") {
      setAcumulado({ mes, v: {} });
      return;
    }
    listarParaHistorico(`${ano}-01`, mes).then(
      (l) => {
        if (!vivo) return;
        const v: Record<string, number> = {};
        for (const i of itensDoHistorico({
          contas,
          categorias,
          lancamentos: l,
          de: `${ano}-01`,
          ate: mes,
        }))
          if (i.categoriaId) v[i.categoriaId] = (v[i.categoriaId] ?? 0) + i.valor;
        setAcumulado({ mes, v });
      },
      () => vivo && setAcumulado({ mes, v: {} }),
    );
    return () => {
      vivo = false;
    };
  }, [mes, contas, categorias]);

  const carregando =
    carregandoBase ||
    doMes.carregando ||
    daFatura.carregando ||
    !inicio ||
    inicio.mes !== mes ||
    !acumulado ||
    acumulado.mes !== mes;
  const erro = doMes.erro ?? daFatura.erro ?? erroSaldo;
  const r = useMemo(
    () =>
      inicio && inicio.mes === mes
        ? calcularMes({
            mes,
            hoje: hojeISO(),
            contas,
            categorias,
            doMes: doMes.itens,
            daFatura: daFatura.itens,
            inicio: inicio.v,
            anoAcumulado: acumulado?.v,
            teto: tetoResolvido.valor,
            meta: metaResolvida.valor,
            esporadicas: SEM_ESPORADICAS,
          })
        : null,
    [
      mes,
      contas,
      categorias,
      doMes.itens,
      daFatura.itens,
      inicio,
      acumulado,
      tetoResolvido.valor,
      metaResolvida.valor,
    ],
  );
  const recarregar = () => {
    doMes.recarregar();
    daFatura.recarregar();
    setVersao((v) => v + 1);
  };

  return (
    <Page wide>
      <div className="fi-row fi-row--between fi-row--wrap">
        <h1 className="t-display">Visão do mês</h1>
      </div>
      <div className="fi-row seletores-topo" data-testid="seletores-mes">
        <NavegadorDeMes value={mes} onChange={irPara} />
      </div>

      {erro && (
        <p className="fi-error-text" role="alert">
          Erro ao carregar: {erro}
        </p>
      )}
      {carregando || !r ? (
        <Card className="fi-stack">
          <Skeleton h={18} w="40%" />
          <Skeleton h={56} w="60%" />
          <Skeleton h={14} />
          <Skeleton h={120} />
        </Card>
      ) : (
        <>
          <div className="fi-grid fi-grid--duo">
            <PainelTeto
              teto={r.teto}
              origem={tetoResolvido.origem}
              faltaTabela={plano.faltaTabela}
              onEditar={() => setEditandoTeto(true)}
              ritmo={
                r.teto.valor > 0
                  ? ritmoDiario({
                      mes,
                      hoje: hojeISO(),
                      restante: r.teto.restante,
                      cartoes: contas.filter((c) => c.tipo === "cartao"),
                    })
                  : null
              }
            />
            <PainelMeta
              r={r}
              origem={metaResolvida.origem}
              faltaTabela={plano.faltaTabela}
              onEditar={() => setEditandoMeta(true)}
              ritmo={ritmoGanho({ mes, hoje: hojeISO(), restante: r.faltaGanhar })}
            />
          </div>

          <div className="fi-grid fi-grid--4" data-testid="cartoes-resumo">
            <Card>
              <Stat label="Entradas (pagas + previstas)">
                <span className="t-money t-h2 t-money--fit is-in" data-testid="total-entradas">
                  {brl(r.entradas.total)}
                </span>
                {r.entradas.previsto > 0 && (
                  <span className="t-caption t-muted">
                    {brl(r.entradas.pago)} pagas + {brl(r.entradas.previsto)} previstas
                  </span>
                )}
              </Stat>
            </Card>
            <Card>
              <Stat label="Saídas (pagas + previstas)">
                <span className="t-money t-h2 t-money--fit" data-testid="total-saidas">
                  {brl(r.saidas.total)}
                </span>
                {r.saidas.previsto > 0 && (
                  <span className="t-caption t-muted">
                    {brl(r.saidas.pago)} pagas + {brl(r.saidas.previsto)} previstas
                  </span>
                )}
              </Stat>
            </Card>
            <Card>
              <Stat label="Resultado do mês">
                <span className="t-money t-h2 t-money--fit">{brl(r.resultado.previsto)}</span>
                <span className="t-caption t-muted">{brl(r.resultado.realizado)} até agora</span>
              </Stat>
            </Card>
            <Card>
              <Stat label="Previsão de patrimônio">
                <span className="t-money t-h2 t-money--fit">{brl(r.patrimonio.previsto)}</span>
                <span className="t-caption t-muted">{brl(r.patrimonio.realizado)} hoje</span>
              </Stat>
            </Card>
          </div>

          <AlertasMes alertas={r.alertas} />

          <ContasToggle r={r} mes={mes} daFatura={daFatura.itens} />

          <Segmented
            block
            value={vista}
            onChange={setVista}
            options={[
              { value: "saida", label: "Saídas" },
              { value: "entrada", label: "Entradas" },
            ]}
          />
          <Categorias r={r} vista={vista} sel={sel} setSel={setSel} />
          <Tabela
            mes={mes}
            r={r}
            vista={vista}
            sel={sel}
            setSel={setSel}
            situacao={situacao}
            setSituacao={setSituacao}
            filtros={filtros}
            setFiltros={setFiltros}
            onAbrir={setEditando}
            onMudou={recarregar}
          />
        </>
      )}
      <EditarTeto
        mes={mes}
        atual={tetoResolvido}
        tetoPadrao={plano.tetoPadrao}
        aberto={editandoTeto}
        onClose={() => setEditandoTeto(false)}
        onSalvo={plano.recarregar}
      />
      <EditarTeto
        tipo="meta"
        mes={mes}
        atual={metaResolvida}
        tetoPadrao={plano.metaPadrao}
        aberto={editandoMeta}
        onClose={() => setEditandoMeta(false)}
        onSalvo={plano.recarregar}
      />
      <EditarLancamento l={editando} onClose={() => setEditando(null)} onMudou={recarregar} />
    </Page>
  );
}

/* ───── Painel "Ainda podemos gastar": o TETO do mês manda ───── */
function PainelTeto({
  teto,
  origem,
  faltaTabela,
  onEditar,
  ritmo,
}: {
  teto: TetoDoMes;
  origem: "mes" | "padrao" | "nenhum";
  faltaTabela: boolean;
  onEditar: () => void;
  ritmo: RitmoDiario | null;
}) {
  const total = teto.pago + teto.previsto + teto.reserva;
  const pct = teto.valor > 0 ? (total / teto.valor) * 100 : 0;
  const nivel = teto.valor <= 0 ? "" : pct >= 100 ? "bad" : pct >= 90 ? "warn" : "ok";
  const pReal = teto.valor > 0 ? Math.min(((teto.pago + teto.reserva) / teto.valor) * 100, 100) : 0;
  const pPrev = teto.valor > 0 ? Math.max(Math.min((total / teto.valor) * 100, 100) - pReal, 0) : 0;
  return (
    <Card
      className="mes-hero"
      data-nivel={nivel}
      data-testid="painel-gasto"
      aria-label="Ainda podemos gastar"
    >
      <p className="t-body-sm t-muted">
        {teto.valor > 0 && teto.restante < 0 ? "Passamos do teto do mês" : "Ainda podemos gastar"}
      </p>
      {teto.valor > 0 ? (
        <>
          <div className="mes-hero__valor t-money" data-testid="restante-gasto">
            {teto.restante < 0 ? brl(-teto.restante) : brl(teto.restante)}
          </div>
          <div
            className="mes-bar"
            role="img"
            aria-label={`${Math.round(pct)}% do teto do mês usado, contando o que está previsto`}
          >
            <span className="mes-bar__pago" style={{ width: `${pReal}%` }} />
            <span className="mes-bar__prev" style={{ width: `${pPrev}%` }} />
          </div>
          <div className="mes-hero__stats t-body-sm t-muted">
            <span>
              Gastamos: <b>{brl(teto.pago)}</b>
            </span>
            {teto.previsto > 0 && (
              <span>
                Previsto: <b>{brl(teto.previsto)}</b>
              </span>
            )}
            <span>
              {teto.restante < 0 ? `Passou ${brl(-teto.restante)}` : `${Math.round(pct)}% do teto`}
            </span>
            <span className="mes-teto-linha">
              {teto.definido ? "Teto do mês" : "Referência"}:{" "}
              <b data-testid="teto-valor">{brl(teto.valor)}</b>
              <small className="t-caption" data-testid="teto-origem">
                {origem === "mes"
                  ? "só este mês"
                  : origem === "padrao"
                    ? "padrão"
                    : "soma das categorias ÷ 12"}
              </small>
              <button
                type="button"
                className="mes-teto-edit"
                onClick={onEditar}
                data-testid="editar-teto"
                aria-label={teto.definido ? "Alterar o teto do mês" : "Definir o teto fixo do mês"}
                title={teto.definido ? "Alterar o teto" : "Definir o teto fixo"}
              >
                <PencilSimple size={11} weight="bold" aria-hidden />
              </button>
            </span>
          </div>
          {ritmo && (
            <div className="mes-ritmo" data-testid="ritmo-diario">
              {ritmo.esgotado ? (
                <span className="is-vencida">Teto do mês esgotado.</span>
              ) : ritmo.fase === "cartao" ? (
                <span data-testid="ritmo-cartao">
                  <b className="t-money">{brl(ritmo.porDia)}</b> por dia até o cartão virar{" "}
                  <span className="t-muted">
                    ({dataBR(ritmo.ate, true)} · {ritmo.dias} {ritmo.dias === 1 ? "dia" : "dias"})
                  </span>
                </span>
              ) : (
                <span data-testid="ritmo-fim">
                  <b className="t-money">{brl(ritmo.porDia)}</b> por dia até o fim do mês{" "}
                  <span className="t-muted">
                    ({ritmo.dias} {ritmo.dias === 1 ? "dia" : "dias"}
                    {ritmo.faturaAberta ? " · só Pix/débito: o cartão já virou" : ""})
                  </span>
                </span>
              )}
              {ritmo.faturaAberta && (
                <small className="t-caption t-muted" data-testid="aviso-fatura-aberta">
                  {" "}
                  Compras no cartão agora entram em{" "}
                  <Link to={`/financas/mes?mes=${ritmo.faturaAberta}`}>
                    {mesCurto(ritmo.faturaAberta)}
                  </Link>
                  .
                </small>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="t-body">
            Defina quanto você quer gastar neste mês: um valor fixo, que vale daqui para a frente.
          </p>
          {faltaTabela ? (
            <p className="t-body-sm t-muted">
              Falta criar as tabelas do teto no banco (veja docs/SQL-PENDENTE.sql).
            </p>
          ) : (
            <Button size="sm" onClick={onEditar} data-testid="editar-teto">
              Definir teto do mês
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

/* ───── Painel "Ainda falta ganhar": a META do mês manda (par do painel do teto) ───── */
function PainelMeta({
  r,
  origem,
  faltaTabela,
  onEditar,
  ritmo,
}: {
  r: ReturnType<typeof calcularMes>;
  origem: "mes" | "padrao" | "nenhum";
  faltaTabela: boolean;
  onEditar: () => void;
  ritmo: RitmoGanho | null;
}) {
  const real = r.entradas.pago,
    previsto = r.entradas.previsto,
    meta = r.metaEntradas;
  // o previsto é dinheiro certo: já entra na conta de quanto falta para a meta
  const batida = meta > 0 && real + previsto >= meta;
  const pct = meta > 0 ? ((real + previsto) / meta) * 100 : 0;
  const pReal = meta > 0 ? Math.min(pct, 100) : 0;
  const pPrev = meta > 0 ? Math.max(Math.min(((real + previsto) / meta) * 100, 100) - pReal, 0) : 0;
  return (
    <Card
      className="mes-hero"
      data-nivel={meta > 0 ? "ok" : ""}
      data-testid="painel-ganho"
      aria-label="Ainda falta ganhar"
    >
      <p className="t-body-sm t-muted">
        {batida ? "Meta de ganhos batida" : "Ainda falta ganhar (já contando o previsto)"}
      </p>
      {meta > 0 ? (
        <>
          <div className="mes-hero__valor t-money" data-testid="restante-ganho">
            {batida ? brl(real + previsto) : brl(Math.max(r.faltaGanhar, 0))}
          </div>
          <div
            className="mes-bar"
            role="img"
            aria-label={`${Math.round(pct)}% da meta de ganhos, contando o que está previsto`}
          >
            <span className="mes-bar__pago" style={{ width: `${pReal}%` }} />
            <span className="mes-bar__prev" style={{ width: `${pPrev}%` }} />
          </div>
          <div className="mes-hero__stats t-body-sm t-muted">
            <span>
              Ganhamos: <b>{brl(real)}</b>
            </span>
            {previsto > 0 && (
              <span>
                Previsto: <b>{brl(previsto)}</b>
              </span>
            )}
            <span>{Math.round(pct)}% da meta (com o previsto)</span>
            <span className="mes-teto-linha">
              {r.metaDefinida ? "Meta do mês" : "Referência"}:{" "}
              <b data-testid="meta-valor">{brl(meta)}</b>
              <small className="t-caption" data-testid="meta-origem">
                {origem === "mes"
                  ? "só este mês"
                  : origem === "padrao"
                    ? "padrão"
                    : "soma das categorias"}
              </small>
              <button
                type="button"
                className="mes-teto-edit"
                onClick={onEditar}
                data-testid="editar-meta"
                aria-label={r.metaDefinida ? "Alterar a meta do mês" : "Definir a meta fixa do mês"}
                title={r.metaDefinida ? "Alterar a meta" : "Definir a meta fixa"}
              >
                <PencilSimple size={11} weight="bold" aria-hidden />
              </button>
            </span>
          </div>
          {ritmo && (
            <div className="mes-ritmo" data-testid="ritmo-ganho">
              {ritmo.batida ? (
                <span>Meta do mês batida.</span>
              ) : (
                <span>
                  <b className="t-money">{brl(ritmo.porDia)}</b> por dia até o fim do mês{" "}
                  <span className="t-muted">
                    ({ritmo.dias} {ritmo.dias === 1 ? "dia" : "dias"})
                  </span>
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="t-body">
            Defina quanto você quer ganhar neste mês: um valor fixo, que vale daqui para a frente.
          </p>
          {faltaTabela ? (
            <p className="t-body-sm t-muted">
              Falta criar as tabelas da meta no banco (veja docs/SQL-PENDENTE.sql).
            </p>
          ) : (
            <Button size="sm" onClick={onEditar} data-testid="editar-meta">
              Definir meta do mês
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

/* ───── Contas e faturas, recolhidas até a pessoa querer ver ───── */
function ContasToggle({
  r,
  mes,
  daFatura,
}: {
  r: ReturnType<typeof calcularMes>;
  mes: string;
  daFatura: Lancamento[];
}) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  if (r.contas.length === 0 && r.faturas.length === 0) return null;
  return (
    <Card className="mes-toggle" data-testid="contas-toggle">
      <button
        type="button"
        className="mes-toggle__cab"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((v) => !v)}
      >
        <Wallet size={20} weight="duotone" aria-hidden />
        <span className="mes-toggle__titulo">Contas{r.faturas.length > 0 ? " e faturas" : ""}</span>
        <span className="t-body-sm t-muted mes-toggle__resumo">
          {r.contas.length} {r.contas.length === 1 ? "conta" : "contas"}
        </span>
        <CaretDown size={18} weight="bold" className="mes-toggle__seta" aria-hidden />
      </button>
      {aberto && (
        <div id={id} className="fi-stack" style={{ marginTop: 12 }}>
          <div className="mes-contas" role="table" aria-label="Contas no mês">
            <div className="mes-contas__linha mes-contas__cab" role="row">
              <span role="columnheader">Conta</span>
              <span role="columnheader">Início</span>
              <span role="columnheader">Agora</span>
              <span role="columnheader">Fecha em</span>
            </div>
            {r.contas.map((c) => (
              <div className="mes-contas__linha" role="row" key={c.conta.id}>
                <span role="cell">
                  <b>{c.conta.nome}</b>
                  {c.faturaRestante > 0 && (
                    <span className="t-caption t-muted"> − fatura {brl(c.faturaRestante)}</span>
                  )}
                </span>
                <span role="cell" data-rotulo="Início" className="t-money">
                  {brl(c.inicio)}
                </span>
                <span role="cell" data-rotulo="Agora" className="t-money">
                  {brl(c.realizado)}
                </span>
                <span
                  role="cell"
                  data-rotulo="Fecha em"
                  className="t-money"
                  style={{ fontWeight: 700 }}
                >
                  {brl(c.previsto)}
                </span>
              </div>
            ))}
            <div className="mes-contas__linha mes-contas__total" role="row">
              <span role="cell">
                <b>Patrimônio</b>
              </span>
              <span role="cell" data-rotulo="Início" className="t-money">
                {brl(r.patrimonio.inicio)}
              </span>
              <span role="cell" data-rotulo="Agora" className="t-money">
                {brl(r.patrimonio.realizado)}
              </span>
              <span
                role="cell"
                data-rotulo="Fecha em"
                className="t-money"
                style={{ fontWeight: 700 }}
              >
                {brl(r.patrimonio.previsto)}
              </span>
            </div>
          </div>
          {r.faturas.length > 0 && (
            <>
              <h3 className="t-h3 mes-titulo">
                <CreditCard size={18} weight="duotone" aria-hidden />
                Faturas que saem neste mês
              </h3>
              <ul className="mes-faturas">
                {r.faturas.map((f) => (
                  <li key={f.cartao.id} data-testid="fatura-do-mes">
                    <Link to={`/financas/faturas?cartao=${f.cartao.id}&mes=${mes}`}>
                      <span>
                        <b>{f.cartao.nome}</b>
                        <span className="t-body-sm t-muted">
                          {" "}
                          · {f.paga ? `paga em ${dataBR(f.paga, true)}` : "sem vencimento"}
                          {f.fecha ? ` · fecha em ${dataBR(f.fecha, true)}` : ""}
                        </span>
                      </span>
                      <span className="mes-faturas__vals">
                        <b className="t-money">{brl(f.total)}</b>
                        {f.restante === 0 ? (
                          <Badge tone="success">paga</Badge>
                        ) : f.jaPaga > 0 ? (
                          <Badge tone="warning">faltam {brl(f.restante)}</Badge>
                        ) : (
                          <Badge tone="neutral">a pagar</Badge>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/* ───── Pizza por categoria ───── */
const LIMITE_FATIA = 0.03; // fatias menores que 3% do total se juntam em "Outras" no desenho (a lista ao lado mostra todas)

function Categorias({
  r,
  vista,
  sel,
  setSel,
}: {
  r: ReturnType<typeof calcularMes>;
  vista: "saida" | "entrada";
  sel: Set<string>;
  setSel: (s: Set<string>) => void;
}) {
  const lista = (vista === "saida" ? r.categoriasSaida : r.categoriasEntrada).filter(
    (c) => c.total > 0,
  );
  const total = lista.reduce((a, c) => a + c.total, 0);
  const [todasNaLegenda, setTodasNaLegenda] = useState(false);
  const titulo = vista === "saida" ? "Gastos por categoria" : "Entradas por categoria";
  if (!total)
    return (
      <Card>
        <h2 className="t-h3">{titulo}</h2>
        <p className="t-body t-muted" style={{ padding: "16px 0" }}>
          {vista === "saida" ? "Nenhuma despesa neste mês." : "Nenhuma entrada neste mês."}
        </p>
      </Card>
    );
  const R = 120,
    C = 130;
  const alternar = (ks: string[]) => {
    const n = new Set(sel);
    const todas = ks.every((k) => n.has(k));
    ks.forEach((k) => (todas ? n.delete(k) : n.add(k)));
    setSel(n);
  };
  const escolhidas = lista.filter((c) => sel.has(chave(c.categoriaId)));
  const somaSel = escolhidas.reduce((a, c) => a + c.total, 0);
  // desenho: fatias grandes + "Outras" (se sobrar mais de uma pequena)
  const grandes = lista.filter((c) => c.total / total >= LIMITE_FATIA);
  const pequenas = lista.filter((c) => c.total / total < LIMITE_FATIA);
  const juntar = pequenas.length >= 2;
  type Fatia = { chaves: string[]; nome: string; valor: number; cor: string };
  const fatias: Fatia[] = [
    ...(juntar ? grandes : lista).map((c) => ({
      chaves: [chave(c.categoriaId)],
      nome: c.nome,
      valor: c.total,
      cor: corDe(c, lista.indexOf(c)),
    })),
    ...(juntar
      ? [
          {
            chaves: pequenas.map((c) => chave(c.categoriaId)),
            nome: `Outras (${pequenas.length})`,
            valor: pequenas.reduce((a, c) => a + c.total, 0),
            cor: "var(--chart-9)",
          },
        ]
      : []),
  ];
  let ang = -Math.PI / 2;
  const caminhos = fatias.map((f, i) => {
    const arco = (f.valor / total) * Math.PI * 2;
    const p = (a: number) =>
      `${(C + R * Math.cos(a)).toFixed(2)} ${(C + R * Math.sin(a)).toFixed(2)}`;
    const d =
      fatias.length === 1
        ? `M${C - R} ${C}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`
        : `M${C} ${C}L${p(ang)}A${R} ${R} 0 ${arco > Math.PI ? 1 : 0} 1 ${p(ang + arco)}Z`;
    ang += arco;
    const marcada = f.chaves.every((k) => sel.has(k));
    return (
      <path
        key={f.chaves.join("|") + i}
        d={d}
        fill={f.cor}
        className={sel.size ? (marcada ? "is-sel" : "is-dim") : undefined}
        onClick={() => alternar(f.chaves)}
        aria-hidden
      >
        <title>
          {f.nome}: {brl(f.valor)}
        </title>
      </path>
    );
  });
  return (
    <Card className="fi-stack" data-testid="pizza">
      <div className="fi-row fi-row--between fi-row--wrap">
        <h2 className="t-h3">{titulo}</h2>
        <span className="t-caption t-muted">
          Marque uma ou mais categorias para filtrar e somar
        </span>
      </div>
      <div className="mes-pizza">
        <svg
          viewBox="0 0 260 260"
          className="mes-pizza__svg"
          role="img"
          aria-label={`${titulo}: total ${brl(total)}`}
        >
          {caminhos}
          <circle cx={C} cy={C} r="62" className="mes-pizza__furo" pointerEvents="none" />
          <text
            x={C}
            y={C + 2}
            className="mes-pizza__total"
            textAnchor="middle"
            pointerEvents="none"
          >
            {brl(sel.size ? somaSel : total)}
          </text>
          <text
            x={C}
            y={C + 20}
            className="mes-pizza__sub"
            textAnchor="middle"
            pointerEvents="none"
          >
            {sel.size === 0
              ? "total do mês"
              : escolhidas.length === 1
                ? escolhidas[0]!.nome
                : `${escolhidas.length} categorias`}
          </text>
        </svg>
        <ul className="mes-leg-lista" data-testid="legenda">
          {(sel.size > 0 && !todasNaLegenda
            ? lista.filter((c) => sel.has(chave(c.categoriaId)))
            : lista
          ).map((c) => (
            <Legenda
              key={chave(c.categoriaId)}
              c={c}
              i={lista.indexOf(c)}
              total={total}
              sel={sel.has(chave(c.categoriaId))}
              onClick={() => alternar([chave(c.categoriaId)])}
              ganho={vista === "entrada"}
            />
          ))}
        </ul>
      </div>
      {sel.size > 0 && lista.length > escolhidas.length && (
        <button
          type="button"
          className="mes-chip mes-leg-todas"
          data-testid="legenda-todas"
          onClick={() => setTodasNaLegenda((v) => !v)}
        >
          {todasNaLegenda
            ? "Mostrar só as selecionadas"
            : `Mostrar todas as categorias (${lista.length})`}
        </button>
      )}
    </Card>
  );
}

function Legenda({
  c,
  i,
  total,
  sel,
  onClick,
  ganho,
}: {
  c: FatiaCategoria;
  i: number;
  total: number;
  sel: boolean;
  onClick: () => void;
  ganho: boolean;
}) {
  const nivel =
    c.uso === null ? null : ganho ? "ok" : c.uso >= 1 ? "bad" : c.uso >= 0.8 ? "warn" : "ok";
  return (
    <li>
      <button
        type="button"
        className={sel ? "mes-leg-item is-sel" : "mes-leg-item"}
        aria-pressed={sel}
        onClick={onClick}
      >
        <span className="mes-dot" style={{ background: corDe(c, i) }} aria-hidden />
        <span className="mes-leg-item__nome">
          {c.nome}
          {c.previsto > 0 && (
            <span className="t-caption t-muted"> · {brl(c.previsto)} previsto</span>
          )}
          {c.esporadica && <span className="t-caption t-muted"> · esporádica</span>}
          {c.uso !== null &&
            (ganho ? (
              <span className="mes-leg-item__orc" data-tone={nivel}>
                {Math.round(c.uso * 100)}% da meta de {brl(c.orcamento)}
              </span>
            ) : (
              <span className="mes-leg-item__orc" data-tone={nivel}>
                No ano: {brl(c.acumuladoAno)} de {brl(c.orcamentoAnual)} ({Math.round(c.uso * 100)}
                %)
              </span>
            ))}
        </span>
        <span className="t-money">{brl(c.total)}</span>
        <span className="mes-leg-item__pct t-caption t-muted">
          {Math.round((c.total / total) * 100)}%
        </span>
      </button>
    </li>
  );
}

/* ───── Tabela ───── */
type ColunaOrdem = "data" | "conta" | "categoria" | "valor" | "nota" | "status";
type Ordem = { col: ColunaOrdem; dir: "asc" | "desc" } | null;

function Tabela({
  mes,
  r,
  vista,
  sel,
  setSel,
  situacao,
  setSituacao,
  filtros,
  setFiltros,
  onAbrir,
  onMudou,
}: {
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
  situacao: "todos" | "pendente" | "pago";
  setSituacao: (s: "todos" | "pendente" | "pago") => void;
  mes: string;
  r: ReturnType<typeof calcularMes>;
  vista: "saida" | "entrada";
  sel: Set<string>;
  setSel: (s: Set<string>) => void;
  onAbrir: (l: Lancamento) => void;
  onMudou: () => void;
}) {
  const { conta, categoria } = useFinancas();
  const [ordem, setOrdem] = useState<Ordem>(null);
  useEffect(() => setOrdem(null), [vista]);
  const base = vista === "saida" ? r.itensSaida : r.itensEntrada;
  const cats = (vista === "saida" ? r.categoriasSaida : r.categoriasEntrada).filter(
    (c) => c.total > 0,
  );
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [emMassa, setEmMassa] = useState<Lancamento[] | null>(null);
  useEffect(() => {
    setSelecionando(false);
    setMarcados(new Set());
  }, [vista]);
  const marcar = (id: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toast = useToast();
  const [pagando, setPagando] = useState<Set<string>>(new Set());
  const pagar = async (ls: Lancamento[]) => {
    const alvo = ls.filter((l) => l.status === "pendente");
    if (alvo.length === 0) return;
    setPagando((s) => new Set([...s, ...alvo.map((l) => l.id)]));
    const { ok, falhas } = await emLotes(alvo, (l) => atualizarLancamento(l.id, patchPagar(l)));
    setPagando(new Set());
    if (ok) toast(`${ok} ${ok === 1 ? "lançamento marcado" : "lançamentos marcados"} como pago.`);
    if (falhas.length) toast(`Não consegui marcar ${falhas.length}: ${falhas[0]}`);
    setMarcados(new Set());
    onMudou();
  };
  const [busca, setBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    setBusca("");
    setBuscando(false);
  }, [vista]);
  const norm = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const termos = norm(busca).split(/\s+/).filter(Boolean);
  const [abrindoFiltro, setAbrindoFiltro] = useState(false);
  const nFiltros = contarFiltros(filtros);
  const porCategoria = base.filter(
    (i) =>
      passaNosFiltros(filtros, {
        data: i.l.data,
        valor: i.valor,
        nota: i.l.nota,
        contaId: i.l.account_id,
        categoriaId: i.categoriaId,
        grupo: categoria(i.l.category_id)?.grupo ?? null,
      }) &&
      (sel.size === 0 || sel.has(chave(i.categoriaId))) &&
      (situacao === "todos" ||
        (situacao === "pendente" ? i.l.status === "pendente" : i.l.status !== "pendente")),
  );
  const texto = (i: ItemConsumo) =>
    norm(
      [
        categoria(i.l.category_id)?.nome ?? "Sem categoria",
        conta(i.l.account_id)?.nome ?? "",
        i.l.nota ?? "",
        dataBR(i.l.data),
        brl(Math.abs(i.valor)),
        String(Math.abs(i.valor) / 100).replace(".", ","),
        i.l.status === "pendente" ? "previsto" : "",
      ].join(" | "),
    );
  const filtrados = termos.length
    ? porCategoria.filter((i) => {
        const t = texto(i);
        return termos.every((x) => t.includes(x));
      })
    : porCategoria;
  const nomeConta = (i: ItemConsumo) => conta(i.l.account_id)?.nome ?? "";
  const nomeCat = (i: ItemConsumo) => categoria(i.l.category_id)?.nome ?? "Sem categoria";
  const chaves: Record<ColunaOrdem, (i: ItemConsumo) => string | number> = {
    data: (i) => i.l.data,
    conta: nomeConta,
    categoria: nomeCat,
    valor: (i) => i.valor,
    nota: (i) => i.l.nota ?? "",
    status: (i) => (i.l.status === "pendente" ? "1 previsto" : "2 pago"),
  };
  const itens = ordem
    ? [...filtrados].sort((a, b) => {
        const x = chaves[ordem.col](a),
          y = chaves[ordem.col](b);
        const c =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y), "pt-BR", { numeric: true, sensitivity: "base" });
        return ordem.dir === "asc" ? c : -c;
      })
    : filtrados;
  /** 1 clique = crescente, 2 = decrescente, 3 = sem ordenar (volta à ordem do mês). */
  const ciclar = (col: ColunaOrdem) =>
    setOrdem((o) =>
      !o || o.col !== col ? { col, dir: "asc" } : o.dir === "asc" ? { col, dir: "desc" } : null,
    );
  const corLinha = (id: string | null) => {
    const k = cats.findIndex((c) => chave(c.categoriaId) === chave(id));
    return k < 0 ? cor(0) : corDe(cats[k]!, k);
  };
  const escolhidas = cats.filter((c) => sel.has(chave(c.categoriaId)));
  const somaFiltro = filtrados.reduce((a, i) => a + i.valor, 0);
  const rotuloValor = vista === "saida" ? "Custo" : "Valor";
  const cab = ({ col, texto, classe }: { col: ColunaOrdem; texto: string; classe?: string }) => {
    const ativo = ordem?.col === col ? ordem.dir : null;
    return (
      <th
        className={classe}
        aria-sort={ativo === "asc" ? "ascending" : ativo === "desc" ? "descending" : "none"}
      >
        <button
          type="button"
          className={`mes-tab__ord${ativo ? "is-ativo" : ""}`}
          onClick={() => ciclar(col)}
          title={
            ativo === "asc"
              ? "Ordenado do menor para o maior. Clique para inverter."
              : ativo === "desc"
                ? "Ordenado do maior para o menor. Clique para tirar a ordem."
                : "Clique para ordenar"
          }
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
  const linha = (i: ItemConsumo) => {
    const l = i.l;
    const nome = nomeCat(i);
    return (
      <tr
        key={l.id}
        className={marcados.has(l.id) ? "is-marcado" : undefined}
        onClick={() => (selecionando ? marcar(l.id) : onAbrir(l))}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (selecionando) marcar(l.id);
            else onAbrir(l);
          }
        }}
        aria-label={`${selecionando ? "Selecionar" : "Editar"} ${nome}, ${brl(Math.abs(i.valor))}`}
      >
        {selecionando && (
          <td className="mes-tab__sel" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              className="ano-tab__check"
              checked={marcados.has(l.id)}
              onChange={() => marcar(l.id)}
              aria-label={`Selecionar ${nome}, ${brl(Math.abs(i.valor))}`}
            />
          </td>
        )}
        <td className="mes-tab__d">{dataCurta(l.data)}</td>
        <td className="mes-tab__c">{nomeConta(i) || "—"}</td>
        <td>
          <span className="mes-tag">
            <span className="mes-dot" style={{ background: corLinha(i.categoriaId) }} aria-hidden />
            {nome}
            {l.parcela_total ? (
              <span className="t-caption t-muted">
                {" "}
                {l.parcela_atual}/{l.parcela_total}
              </span>
            ) : null}
          </span>
          <span className="mes-tab__sub t-caption t-muted">
            {[conta(l.account_id)?.nome, l.nota].filter(Boolean).join(" · ")}
          </span>
        </td>
        <td
          className="mes-tab__v t-money"
          style={i.valor < 0 ? { color: "var(--color-success-fg)" } : undefined}
        >
          {i.valor < 0 ? "+ " : ""}
          {brl(Math.abs(i.valor))}
        </td>
        <td className="mes-tab__n t-muted">{l.nota ?? ""}</td>
        <td className="mes-tab__s" data-testid="status-linha">
          {l.status === "pendente" ? (
            <span className="mes-status">
              <Badge tone="warning">previsto</Badge>{" "}
              <button
                type="button"
                className="mes-pagar"
                data-testid="pagar-linha"
                disabled={pagando.has(l.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  void pagar([l]);
                }}
                aria-label={`Marcar ${nome}, ${brl(Math.abs(i.valor))} como pago`}
              >
                {pagando.has(l.id) ? "…" : "Pagar"}
              </button>
            </span>
          ) : (
            <Badge tone="success">pago</Badge>
          )}
        </td>
      </tr>
    );
  };
  const filtrado = nFiltros > 0 || sel.size > 0 || situacao !== "todos" || termos.length > 0;
  const somaItens = itens.reduce((a, i) => a + i.valor, 0);
  const totalPrev = itens.filter((i) => i.l.status === "pendente").reduce((a, i) => a + i.valor, 0);
  const totalPago = somaItens - totalPrev;
  const temMisto =
    itens.some((i) => i.l.status === "pendente") && itens.some((i) => i.l.status !== "pendente");
  const tituloBase = vista === "saida" ? "Despesas" : "Entradas";
  return (
    <Card className="fi-stack" data-testid="tabela-mes">
      <div className="fi-row fi-row--between fi-row--wrap">
        <h2 className="t-h3">
          {sel.size === 0
            ? vista === "saida"
              ? "Despesas do mês"
              : "Entradas do mês"
            : escolhidas.length === 1
              ? `${tituloBase}: ${escolhidas[0]!.nome}`
              : `${tituloBase}: ${escolhidas.length} categorias`}
        </h2>
        <div className="fi-row fi-row--wrap">
          <Link
            className="fi-btn fi-btn--secondary fi-btn--sm"
            to={`/financas/lancar?mes=${mes}&tipo=saida`}
            data-testid="lancar-saida-mes"
          >
            <Minus size={16} weight="bold" aria-hidden />
            Lançar saída
          </Link>
          <Link
            className="fi-btn fi-btn--secondary fi-btn--sm"
            to={`/financas/lancar?mes=${mes}&tipo=entrada`}
            data-testid="lancar-entrada-mes"
          >
            <Plus size={16} weight="bold" aria-hidden />
            Lançar entrada
          </Link>
          <button
            type="button"
            className={`mes-chip${selecionando ? "is-ativo" : ""}`}
            aria-pressed={selecionando}
            data-testid="editar-varios-mes"
            onClick={() => {
              setSelecionando((v) => !v);
              setMarcados(new Set());
            }}
          >
            <PencilSimple size={16} aria-hidden />
            {selecionando ? "Sair da seleção" : "Editar vários"}
          </button>
          {buscando ? (
            <div className="mes-busca">
              <MagnifyingGlass size={16} aria-hidden />
              <input
                autoFocus
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setBusca("");
                    setBuscando(false);
                  }
                }}
                placeholder="Buscar categoria, conta, anotação, valor…"
                aria-label="Buscar nas despesas do mês"
                data-testid="busca-mes"
              />
              <button
                type="button"
                className="mes-busca__x"
                aria-label="Fechar busca"
                onClick={() => {
                  setBusca("");
                  setBuscando(false);
                }}
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="mes-chip"
              aria-label="Buscar"
              data-testid="abrir-busca"
              onClick={() => setBuscando(true)}
            >
              <MagnifyingGlass size={16} aria-hidden />
              Buscar
            </button>
          )}
          {sel.size > 0 && (
            <button type="button" className="mes-chip" onClick={() => setSel(new Set())}>
              <X size={14} weight="bold" aria-hidden />
              Limpar filtro{escolhidas.length > 1 ? ` (${escolhidas.length})` : ""}
            </button>
          )}
        </div>
      </div>
      <div
        className="fi-row fi-row--wrap"
        role="group"
        aria-label="Filtrar por situação"
        data-testid="filtro-situacao"
      >
        {(
          [
            ["todos", "Todos"],
            ["pendente", "Previstos"],
            ["pago", "Pagos"],
          ] as const
        ).map(([k, t]) => (
          <button
            key={k}
            type="button"
            className={`mes-chip${situacao === k ? "is-ativo" : ""}`}
            aria-pressed={situacao === k}
            data-testid={`situacao-${k}`}
            onClick={() => setSituacao(k)}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          className={`mes-chip${nFiltros ? "is-ativo" : ""}`}
          data-testid="abrir-filtro"
          onClick={() => setAbrindoFiltro(true)}
        >
          <Funnel size={16} aria-hidden />
          Filtrar{nFiltros ? ` (${nFiltros})` : ""}
        </button>
        {nFiltros > 0 && (
          <button
            type="button"
            className="mes-chip"
            data-testid="limpar-filtros"
            onClick={() => setFiltros(SEM_FILTROS)}
          >
            <X size={14} weight="bold" aria-hidden />
            Limpar filtros
          </button>
        )}
      </div>
      {selecionando && (
        <BarraSelecao
          n={marcados.size}
          onPagar={() => void pagar(itens.filter((i) => marcados.has(i.l.id)).map((i) => i.l))}
          onEditar={() => setEmMassa(itens.filter((i) => marcados.has(i.l.id)).map((i) => i.l))}
          onLimpar={() => setMarcados(new Set())}
        />
      )}
      {termos.length > 0 && (
        <p className="t-body-sm t-muted" data-testid="soma-busca">
          {filtrados.length} {filtrados.length === 1 ? "resultado" : "resultados"} para “
          {busca.trim()}” · soma <b className="t-money">{brl(somaFiltro)}</b>
        </p>
      )}
      {sel.size > 0 && (
        <p className="t-body-sm t-muted" data-testid="soma-filtro">
          {escolhidas.map((c) => c.nome).join(", ")} · {filtrados.length}{" "}
          {filtrados.length === 1 ? "lançamento" : "lançamentos"} · soma{" "}
          <b className="t-money">{brl(somaFiltro)}</b>
        </p>
      )}
      {itens.length === 0 ? (
        <EmptyState icon={<CreditCard size={28} />} title="Nada para mostrar">
          {termos.length
            ? "Nenhum lançamento encontrado para essa busca."
            : `Sem lançamentos neste mês${sel.size ? " nessas categorias" : ""}${situacao === "pendente" ? " previstos" : situacao === "pago" ? " pagos" : ""}.`}
        </EmptyState>
      ) : (
        <div className="mes-tab__rolagem">
          <table className="mes-tab mes-tab--lanc">
            <thead>
              <tr>
                {selecionando && (
                  <th className="mes-tab__sel">
                    <input
                      type="checkbox"
                      className="ano-tab__check"
                      checked={itens.length > 0 && itens.every((i) => marcados.has(i.l.id))}
                      onChange={(e) =>
                        setMarcados(
                          e.target.checked ? new Set(itens.map((i) => i.l.id)) : new Set(),
                        )
                      }
                      aria-label="Selecionar todos os lançamentos da tabela"
                    />
                  </th>
                )}
                {cab({ col: "data", texto: "Data" })}
                {cab({ col: "conta", texto: "Conta" })}
                {cab({ col: "categoria", texto: "Categoria" })}
                {cab({ col: "valor", texto: rotuloValor, classe: "mes-tab__v" })}
                {cab({ col: "nota", texto: "Anotação", classe: "mes-tab__n" })}
                {cab({ col: "status", texto: "Status", classe: "mes-tab__s" })}
              </tr>
            </thead>
            <tbody>{itens.map(linha)}</tbody>
            <tfoot>
              <tr className="mes-total" data-testid="total-filtrado">
                {selecionando && <td className="mes-tab__sel" />}
                <td className="mes-tab__d">
                  <b>Total</b>
                </td>
                <td className="mes-tab__c" data-testid="total-contagem">
                  <b>
                    {itens.length} {itens.length === 1 ? "lançamento" : "lançamentos"}
                  </b>
                </td>
                <td className="t-caption t-muted">
                  {filtrado ? "do filtro" : "da tabela"}
                  {temMisto ? ` · ${brl(totalPago)} pagos + ${brl(totalPrev)} previstos` : ""}
                  <span className="mes-tab__sub">
                    <b>
                      {itens.length} {itens.length === 1 ? "lançamento" : "lançamentos"}
                    </b>
                  </span>
                </td>
                <td className="mes-tab__v t-money">
                  <b data-testid="total-filtrado-valor">{brl(somaItens)}</b>
                </td>
                <td className="mes-tab__n" />
                <td className="mes-tab__s" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <FiltroLancamentos
        aberto={abrindoFiltro}
        onClose={() => setAbrindoFiltro(false)}
        filtros={filtros}
        onAplicar={setFiltros}
        contas={[
          ...new Map(
            base
              .filter((i) => i.l.account_id)
              .map((i) => [
                i.l.account_id as string,
                { id: i.l.account_id as string, nome: conta(i.l.account_id)?.nome ?? "Conta" },
              ]),
          ).values(),
        ].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))}
        grupos={[...new Set(base.map((i) => categoria(i.l.category_id)?.grupo ?? "Sem grupo"))]
          .sort((a, b) => a.localeCompare(b, "pt-BR"))
          .map((g) => ({ id: g, nome: g }))}
        categorias={cats
          .map((c) => ({ id: chave(c.categoriaId), nome: c.nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))}
      />
      <EditarEmMassa
        itens={emMassa}
        onClose={() => setEmMassa(null)}
        onMudou={() => {
          setMarcados(new Set());
          setSelecionando(false);
          onMudou();
        }}
      />
    </Card>
  );
}
