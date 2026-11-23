"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "@/components/financas/rota";
import { CheckCircle, CreditCard, MagnifyingGlass, Warning, X } from "@/lib/ui/icons";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  NavegadorDeMes,
  Page,
  Select,
  Skeleton,
  ValorInput,
  brl,
  useToast,
} from "@/components/financas/kit";
import {
  listarDaFatura,
  listarMovimentoDosCartoes,
  obterConferenciaFatura,
  removerConferenciaFatura,
  salvarConferenciaFatura,
  useFinancas,
  useLista,
  type Lancamento,
} from "@/lib/financas/dados";
import { semAcento } from "@/components/financas/kit/busca";
import {
  faturaPadrao,
  dataCurta,
  hoje,
  mesAnterior,
  mesAtual,
  mesCurto,
  mesValido,
  nomeDoMes,
  dataBR,
} from "@/lib/financas/formato";
import {
  faturasDosCartoes,
  faturasEmAberto,
  situacaoDaFatura,
  type FaturaDoCartao,
} from "@/lib/financas/faturas";
import { PagarFatura } from "./PagarFatura";
import { CobrancasDaMeta } from "./MetaCobrancas";
import { LancamentoItem } from "./LancamentoItem";
import { descreverFatura } from "./comuns";
import { EditarLancamento } from "./EditarLancamento";

export function Faturas() {
  const { contas, conta, categoria } = useFinancas();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const cartoes = useMemo(() => contas.filter((c) => c.tipo === "cartao" && c.ativa), [contas]);
  const cartao = cartoes.find((c) => c.id === params.get("cartao")) ?? cartoes[0];
  const mes = mesValido(params.get("mes"))
    ? params.get("mes")!
    : faturaPadrao(hoje(), cartao?.dia_fechamento ?? null, cartao?.dia_vencimento ?? null);
  const ir = (mudanca: { cartao?: string; mes?: string }) =>
    setParams(
      { cartao: mudanca.cartao ?? cartao?.id ?? "", mes: mudanca.mes ?? mes },
      { replace: true },
    );

  const { carregando, erro, itens, recarregar } = useLista(
    () => (cartao ? listarDaFatura(cartao.id, mes) : Promise.resolve([])),
    [cartao?.id, mes],
  );
  const [banco, setBanco] = useState(0);
  const [salvoNoBanco, setSalvoNoBanco] = useState<number | null>(null);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [erroConf, setErroConf] = useState<string | null>(null);
  // modo conferência: só visual (marcas em memória, não mexem nos lançamentos); sai do modo = apaga as marcas
  const [conferindo, setConferindo] = useState(false);
  const [vistos, setVistos] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [pagando, setPagando] = useState<FaturaDoCartao | null>(null);
  const [movimento, setMovimento] = useState<Lancamento[] | null>(null);
  const [versaoMov, setVersaoMov] = useState(0);
  // de 3 meses atrás em diante (ou do mês aberto, se for mais antigo): o que forma as faturas e o que já foi pago
  const desde = useMemo(() => {
    let m = mesAtual();
    for (let i = 0; i < 3; i++) m = mesAnterior(m);
    return mes < m ? mes : m;
  }, [mes]);
  const idsCartoes = cartoes.map((c) => c.id).join(",");
  useEffect(() => {
    let vivo = true;
    listarMovimentoDosCartoes(idsCartoes ? idsCartoes.split(",") : [], desde).then(
      (l) => vivo && setMovimento(l),
      () => vivo && setMovimento([]),
    );
    return () => {
      vivo = false;
    };
  }, [idsCartoes, desde, versaoMov]);
  const todas = useMemo(
    () => (movimento ? faturasDosCartoes({ cartoes, lancamentos: movimento, hoje: hoje() }) : []),
    [movimento, cartoes],
  );
  const abertas = useMemo(() => faturasEmAberto(todas), [todas]);
  const atual = todas.find((f) => f.cartao.id === cartao?.id && f.mes === mes);
  const depoisDePagar = () => {
    setVersaoMov((v) => v + 1);
    recarregar();
    toast("Pagamento lançado");
  };

  useEffect(() => {
    let vivo = true;
    setSalvoNoBanco(null);
    setBanco(0);
    setErroConf(null);
    setConferindo(false);
    setVistos(new Set());
    setBusca("");
    if (cartao)
      obterConferenciaFatura(cartao.id, mes).then(
        (c) => {
          if (vivo && c) {
            setSalvoNoBanco(c.total_banco_cents);
            setBanco(c.total_banco_cents);
          }
        },
        (e: Error) => vivo && setErroConf(e.message),
      );
    return () => {
      vivo = false;
    };
  }, [cartao?.id, mes]);

  if (cartoes.length === 0 || !cartao) {
    return (
      <Page wide>
        <h1 className="t-display">Faturas</h1>
        <Card>
          <EmptyState
            icon={<CreditCard size={30} />}
            title="Nenhum cartão cadastrado"
            action={
              <Link className="fi-btn fi-btn--primary fi-btn--sm" to="/financas/config?aba=cartoes">
                Cadastrar cartão
              </Link>
            }
          >
            Cadastre cada cartão em Configurações. Depois, ao lançar uma compra, escolha o cartão
            como conta e ela entra na fatura certa.
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const pagos = itens.filter((l) => l.status === "pago");
  const compras = pagos.filter((l) => l.tipo === "saida").reduce((a, l) => a + l.valor_cents, 0);
  const creditos = pagos.filter((l) => l.tipo === "entrada").reduce((a, l) => a + l.valor_cents, 0);
  const total = compras - creditos;
  const previstos = itens
    .filter((l) => l.status === "pendente")
    .reduce((a, l) => a + (l.tipo === "saida" ? l.valor_cents : -l.valor_cents), 0);
  const diferenca = total - banco;
  // soma só do que conta no "Total no app" (pagos): compras somam, créditos subtraem
  const somaVistos = pagos
    .filter((l) => vistos.has(l.id))
    .reduce((a, l) => a + (l.tipo === "saida" ? l.valor_cents : -l.valor_cents), 0);
  // busca (só no modo conferência): por valor, anotação, categoria ou data. Filtra só a lista; as marcas (vistos) não dependem dela
  const termos = conferindo ? semAcento(busca).split(/\s+/).filter(Boolean) : [];
  const textoDe = (l: Lancamento) =>
    semAcento(
      [
        categoria(l.category_id)?.nome ?? "Sem categoria",
        conta(l.account_id)?.nome ?? "",
        l.nota ?? "",
        dataBR(l.data),
        dataCurta(l.data),
        brl(l.valor_cents),
        String(l.valor_cents / 100).replace(".", ","),
      ].join(" | "),
    );
  const visiveis = termos.length
    ? itens.filter((l) => {
        const t = textoDe(l);
        return termos.every((x) => t.includes(x));
      })
    : itens;
  const vistosForaDaConta = itens.filter((l) => vistos.has(l.id) && l.status !== "pago").length;
  const tentouConferir = banco > 0;

  const alternarConferindo = () => {
    setConferindo((c) => !c);
    setVistos(new Set());
    setBusca("");
  };
  const alternarVisto = (id: string) =>
    setVistos((v) => {
      const n = new Set(v);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  async function guardar() {
    if (!cartao) return;
    setErroConf(null);
    try {
      await salvarConferenciaFatura(cartao.id, mes, banco);
      setSalvoNoBanco(banco);
      toast("Conferência salva");
    } catch (e) {
      setErroConf((e as Error).message);
    }
  }
  async function limpar() {
    if (!cartao) return;
    try {
      await removerConferenciaFatura(cartao.id, mes);
      setSalvoNoBanco(null);
      setBanco(0);
    } catch (e) {
      setErroConf((e as Error).message);
    }
  }

  return (
    <Page wide>
      <h1 className="t-display">Faturas</h1>
      <div
        className="fi-row fi-row--wrap seletores-topo"
        style={{ alignItems: "flex-end" }}
        data-testid="seletores-faturas"
      >
        <NavegadorDeMes rotulo="Fatura" value={mes} onChange={(m) => ir({ mes: m })} />
        <Field label="Cartão">
          <Select value={cartao.id} onChange={(e) => ir({ cartao: e.target.value })}>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p
        className="t-body-sm"
        style={{ textAlign: "center", margin: 0 }}
        data-testid="datas-fatura"
      >
        <strong>{descreverFatura(mes, cartao.dia_fechamento, cartao.dia_vencimento)}</strong>
        <span className="t-muted"> · a fatura leva o nome do mês em que é paga</span>
      </p>

      <CobrancasDaMeta />

      <Card className="fi-stack" data-testid="faturas-abertas">
        <h2 className="t-h3">Faturas em aberto</h2>
        {movimento === null ? (
          <Skeleton h={48} />
        ) : abertas.length === 0 ? (
          <p className="t-body t-muted">
            Nenhuma fatura em aberto (de {mesCurto(desde)} em diante). 🎉
          </p>
        ) : (
          <ul className="fat-abertas">
            {abertas.map((f) => (
              <li
                key={`${f.cartao.id}-${f.mes}`}
                className={f.vencida ? "is-vencida-linha" : undefined}
                data-testid={`fatura-aberta-${f.cartao.nome}-${f.mes}`}
              >
                <button
                  type="button"
                  className="fat-abertas__ver"
                  onClick={() => ir({ cartao: f.cartao.id, mes: f.mes })}
                  aria-label={`Ver a fatura ${f.cartao.nome} de ${mesCurto(f.mes)}`}
                >
                  <b>{f.cartao.nome}</b>
                  <span className="t-body-sm t-muted">
                    {mesCurto(f.mes)}
                    {f.paga ? ` · ${f.vencida ? "venceu" : "vence"} ${dataBR(f.paga, true)}` : ""}
                    {f.jaPaga > 0 ? ` · já pago ${brl(f.jaPaga)}` : ""}
                  </span>
                </button>
                <b className={`t-money${f.vencida ? "is-vencida" : ""}`}>{brl(f.restante)}</b>
                <Button size="sm" onClick={() => setPagando(f)}>
                  Pagar fatura
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="fi-grid fi-grid--duo">
        <Card tone="brand" className="fi-stack" style={{ gap: 4 }}>
          <p className="t-body-sm t-muted">Total no app</p>
          <div className="t-money t-money-xl">
            {carregando ? <Skeleton w={160} h={36} /> : brl(total)}
          </div>
          <p className="t-body-sm t-muted">
            {brl(compras)} em compras{creditos > 0 ? ` − ${brl(creditos)} em créditos` : ""}
          </p>
          {(() => {
            const sit = situacaoDaFatura(atual, brl, (d) => dataBR(d, true));
            return movimento === null ? null : (
              <Badge
                tone={
                  sit.tipo === "paga"
                    ? "success"
                    : sit.tipo === "vencida"
                      ? "error"
                      : sit.tipo === "sem_compras"
                        ? "neutral"
                        : "warning"
                }
                data-testid="status-fatura"
              >
                {sit.tipo === "paga" && <CheckCircle size={14} weight="fill" />}
                {sit.texto}
              </Badge>
            );
          })()}
          {previstos !== 0 && (
            <Badge tone="warning">+ {brl(previstos)} previstos (não contam ainda)</Badge>
          )}
        </Card>

        <Card className="fi-stack" data-testid="conferencia">
          <Field label="Total da fatura no banco">
            <ValorInput value={banco} onChange={setBanco} />
          </Field>
          {tentouConferir &&
            (diferenca === 0 ? (
              <Badge tone="success">
                <CheckCircle size={14} weight="fill" />
                Bate com o banco
              </Badge>
            ) : (
              <Badge tone="error">
                <Warning size={14} weight="fill" />
                Diferença de {brl(Math.abs(diferenca))} — o app tem{" "}
                {diferenca > 0 ? "a mais" : "a menos"}
              </Badge>
            ))}
          {erroConf && (
            <p className="fi-error-text" role="alert">
              {erroConf}
            </p>
          )}
          <div className="fi-row fi-row--wrap">
            <Button
              size="sm"
              onClick={() => void guardar()}
              disabled={!tentouConferir || banco === salvoNoBanco}
            >
              {salvoNoBanco === null ? "Salvar conferência" : "Atualizar"}
            </Button>
            {salvoNoBanco !== null && (
              <Button size="sm" variant="ghost" onClick={() => void limpar()}>
                Limpar
              </Button>
            )}
            <Button
              size="sm"
              variant={conferindo ? "primary" : "secondary"}
              onClick={alternarConferindo}
              aria-pressed={conferindo}
              data-testid="modo-conferencia"
            >
              {conferindo ? "Sair do modo conferência" : "Modo conferência"}
            </Button>
            {atual && atual.restante > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPagando(atual)}
                data-testid="pagar-fatura-atual"
              >
                Pagar fatura
              </Button>
            )}
          </div>
        </Card>
      </div>

      {erro && (
        <p className="fi-error-text" role="alert">
          Erro ao carregar: {erro}
        </p>
      )}
      {carregando ? (
        <Card className="fi-stack">
          <Skeleton h={48} />
          <Skeleton h={48} />
        </Card>
      ) : itens.length === 0 ? (
        <Card>
          <EmptyState icon={<CreditCard size={30} />} title="Nada nesta fatura">
            Compras lançadas com o {cartao.nome} como conta aparecem aqui, na fatura escolhida.
          </EmptyState>
        </Card>
      ) : (
        <>
          {conferindo && (
            <Card
              tone="brand"
              className="fi-stack"
              style={{ gap: 4, position: "sticky", top: 8, zIndex: 2 }}
              data-testid="contagem-conferencia"
            >
              <p className="t-body-sm t-muted">
                Conferidos: {vistos.size} de {itens.length} (só marcação visual, nada é alterado)
              </p>
              <p className="t-money t-money-xl" data-testid="soma-conferidos">
                {brl(somaVistos)}
              </p>
              <p className="t-body-sm t-muted">
                marcados de {brl(total)} no app · falta conferir {brl(total - somaVistos)}
                {tentouConferir ? ` · banco: ${brl(banco)}` : ""}
              </p>
              {vistosForaDaConta > 0 && (
                <p className="t-body-sm t-muted">
                  {vistosForaDaConta} marcado(s) previsto/cancelado não entram na soma.
                </p>
              )}
            </Card>
          )}
          {conferindo && (
            <div className="mes-busca" style={{ width: "100%" }}>
              <MagnifyingGlass size={16} aria-hidden />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar valor, anotação, categoria ou data…"
                aria-label="Buscar nos lançamentos da fatura"
                data-testid="busca-conferencia"
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
          )}
          {termos.length > 0 && (
            <p className="t-body-sm t-muted" data-testid="resultado-busca-conferencia">
              {visiveis.length} {visiveis.length === 1 ? "resultado" : "resultados"} para “
              {busca.trim()}” · as marcações feitas continuam e somam
            </p>
          )}
          {termos.length > 0 && visiveis.length === 0 && (
            <Card>
              <EmptyState icon={<MagnifyingGlass size={28} />} title="Nada encontrado">
                Nenhum lançamento desta fatura bate com essa busca.
              </EmptyState>
            </Card>
          )}
          <ul className="fi-list">
            {visiveis.map((l) => (
              <LancamentoItem
                key={l.id}
                l={l}
                mostrarData
                onAbrir={() => setEditando(l)}
                {...(conferindo
                  ? { marcado: vistos.has(l.id), onMarcar: () => alternarVisto(l.id) }
                  : {})}
              />
            ))}
          </ul>
        </>
      )}

      <PagarFatura fatura={pagando} onClose={() => setPagando(null)} onFeito={depoisDePagar} />
      <EditarLancamento l={editando} onClose={() => setEditando(null)} onMudou={recarregar} />
    </Page>
  );
}
