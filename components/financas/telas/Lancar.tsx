"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "@/components/financas/rota";
import {
  Button,
  Card,
  Combobox,
  Field,
  DateField,
  Input,
  Page,
  Segmented,
  Select,
  ValorInput,
  brl,
  useToast,
} from "@/components/financas/kit";
import {
  ERRO_PAGO_FUTURO,
  criarLancamento,
  criarLancamentos,
  listarRecentes,
  atualizarLancamento,
  patchPagar,
  useFinancas,
  type Lancamento,
  type StatusLancamento,
  type TipoLancamento,
} from "@/lib/financas/dados";
import {
  datasDaFatura,
  dataBR,
  faturaPadrao,
  hoje,
  mesCurto,
  mesValido,
  nomeDoMes,
} from "@/lib/financas/formato";
import { dataNoMes, mesQueCai } from "@/lib/financas/mesDoLancamento";
import { MAX_PARCELAS, gerarParcelas, totalDasParcelas } from "@/lib/financas/parcelas";
import { OpcoesContas, SeletorFatura } from "./comuns";
import { LancamentoItem } from "./LancamentoItem";
import { EditarLancamento } from "./EditarLancamento";
import { CriarCategoriaSheet } from "./FormCategoria";

const CHAVE_CONTA = "kuster.fin.conta";
const ROTULO: Record<TipoLancamento, string> = {
  saida: "Saída",
  entrada: "Entrada",
  transferencia: "Transferência",
};

function contaSalva(): string | null {
  try {
    return localStorage.getItem(CHAVE_CONTA);
  } catch {
    return null;
  }
}
function salvarConta(id: string) {
  try {
    localStorage.setItem(CHAVE_CONTA, id);
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

export function Lancar() {
  const { contas, categorias } = useFinancas();
  const toast = useToast();
  const contasUteis = useMemo(() => contas.filter((c) => c.ativa && c.tipo !== "bem"), [contas]);

  const [params] = useSearchParams(); // permite chegar aqui já preenchido (ex.: pagar a fatura)
  const pTipo = params.get("tipo");
  const pMes = mesValido(params.get("mes")) ? params.get("mes") : null; // vindo da Visão do mês: o lançamento já nasce para cair nesse mês
  const [tipo, setTipo] = useState<TipoLancamento>(
    pTipo === "entrada" || pTipo === "transferencia" ? pTipo : "saida",
  );
  const [valor, setValor] = useState(() =>
    Math.max(0, parseInt(params.get("valor") ?? "0", 10) || 0),
  );
  const [catId, setCatId] = useState<string | null>(null);
  const [contaId, setContaId] = useState(() => {
    const de = params.get("de");
    if (de && contas.some((c) => c.id === de)) return de;
    const s = contaSalva();
    return s && contas.some((c) => c.id === s)
      ? s
      : (contasUteis.find((c) => c.tipo !== "cartao" && c.tipo !== "investida")?.id ??
          contasUteis.find((c) => c.tipo !== "cartao")?.id ??
          "");
  });
  const [destinoId, setDestinoId] = useState(() => {
    const p = params.get("para");
    return p && contas.some((c) => c.id === p) ? p : "";
  });
  const [faturaManual, setFaturaManual] = useState<string | null>(null);
  const [data, setData] = useState(() => (pMes ? dataNoMes(pMes) : hoje()));
  const [status, setStatus] = useState<StatusLancamento>("pago");
  const [statusManual, setStatusManual] = useState(false);
  const [nota, setNota] = useState(() => params.get("nota") ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [criandoCat, setCriandoCat] = useState<string | null>(null); // texto digitado que virou "Criar categoria"
  const [parcelado, setParcelado] = useState(false);
  const [nParcelas, setNParcelas] = useState("2");
  const [modoValor, setModoValor] = useState<"total" | "parcela">("total");
  const [recentes, setRecentes] = useState<Lancamento[]>([]);
  const [editando, setEditando] = useState<Lancamento | null>(null);

  const carregarRecentes = () => listarRecentes(50).then(setRecentes, () => setRecentes([]));
  useEffect(() => {
    void carregarRecentes();
  }, []);

  // Data no futuro => previsto (a menos que a pessoa já tenha escolhido o status à mão).
  useEffect(() => {
    if (!statusManual) setStatus(data > hoje() ? "pendente" : "pago");
  }, [data, statusManual]);

  const cats = useMemo(
    () =>
      tipo === "transferencia"
        ? []
        : categorias.filter((c) => c.tipo === tipo && c.ativa && c.grupo !== "Sistema"),
    [categorias, tipo],
  );
  const sugestoes = useMemo(
    () => [...new Set(recentes.map((r) => r.nota).filter((n): n is string => !!n))].slice(0, 30),
    [recentes],
  );

  // O aviso de erro some assim que a pessoa mexe em qualquer campo (senão fica uma bronca velha na tela).
  useEffect(() => {
    setErro(null);
  }, [valor, catId, contaId, destinoId, tipo, data]);

  const contaSel = contas.find((c) => c.id === contaId);
  const ehCartao = contaSel?.tipo === "cartao" && tipo !== "transferencia";
  useEffect(() => {
    setFaturaManual(null);
  }, [contaId]);
  const comParcelas = ehCartao && tipo === "saida" && parcelado;
  const faturaInicial = contaSel
    ? (faturaManual ?? pMes ?? faturaPadrao(data, contaSel.dia_fechamento, contaSel.dia_vencimento))
    : "";
  const cai = mesQueCai({
    data,
    tipo,
    conta: contaSel,
    faturaMes: ehCartao ? faturaInicial : null,
  });
  // cálculo barato: sem `useMemo` (o React Compiler cuida de não refazer à toa)
  const parcelas = comParcelas
    ? gerarParcelas({
        data,
        faturaInicial,
        n: Number(nParcelas),
        modo: modoValor,
        valor_cents: valor,
      })
    : [];

  function trocarTipo(t: TipoLancamento) {
    setTipo(t);
    setCatId(null);
    setErro(null);
  }

  async function lancarParcelado() {
    if (!contaSel || !catId) return setErro(!catId ? "Escolha a categoria." : "Escolha o cartão.");
    if (valor <= 0) return setErro("Informe um valor maior que zero.");
    if (!/^\d+$/.test(nParcelas) || Number(nParcelas) < 2 || Number(nParcelas) > MAX_PARCELAS)
      return setErro(`Parcelas: de 2 a ${MAX_PARCELAS}.`);
    setErro(null);
    setEnviando(true);
    try {
      await criarLancamentos(
        parcelas.map((p) => ({
          tipo: "saida",
          valor_cents: p.valor_cents,
          data: p.data,
          status: p.data > hoje() ? "pendente" : "pago",
          nota: nota.trim() || null,
          account_id: contaSel.id,
          category_id: catId,
          account_destino_id: null,
          fatura_mes: `${p.fatura}-01`,
          parcela_atual: p.numero,
          parcela_total: p.total,
        })),
      );
      salvarConta(contaId);
      toast(`Compra de ${brl(totalDasParcelas(parcelas))} em ${parcelas.length}× lançada`);
      setValor(0);
      setNota("");
      setCatId(null);
      setFaturaManual(null);
      setParcelado(false);
      setNParcelas("2");
      setModoValor("total");
      void carregarRecentes();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function lancar() {
    if (comParcelas) return lancarParcelado();
    if (valor <= 0) return setErro("Informe um valor maior que zero.");
    if (status === "pago" && data > hoje()) return setErro(ERRO_PAGO_FUTURO);
    if (!contaId) return setErro("Escolha a conta.");
    if (tipo === "transferencia") {
      if (!destinoId) return setErro("Escolha a conta de destino.");
      if (destinoId === contaId) return setErro("Origem e destino precisam ser contas diferentes.");
    } else if (!catId) return setErro("Escolha a categoria.");
    setErro(null);
    setEnviando(true);
    try {
      await criarLancamento({
        tipo,
        valor_cents: valor,
        data,
        status,
        nota: nota.trim() || null,
        account_id: contaId,
        category_id: tipo === "transferencia" ? null : catId,
        account_destino_id: tipo === "transferencia" ? destinoId : null,
        fatura_mes: ehCartao && contaSel ? `${faturaInicial}-01` : null,
      });
      salvarConta(contaId);
      toast(`${ROTULO[tipo]} de ${brl(valor)} lançada`);
      setValor(0);
      setNota("");
      setCatId(null);
      setStatusManual(false);
      setFaturaManual(null); // o próximo lançamento volta ao padrão (pago, ou previsto se a data for futura)
      void carregarRecentes();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function pagar(l: Lancamento) {
    try {
      await atualizarLancamento(l.id, patchPagar(l));
      toast("Marcado como pago");
      void carregarRecentes();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Page wide>
      <div className="fi-row fi-row--between fi-lancar__topo">
        <h1 className="t-display">Lançar</h1>
        <Link
          className="fi-btn fi-btn--secondary fi-btn--sm fi-so-desktop"
          to="/financas/lancamentos?vista=massa"
        >
          Lançar em massa
        </Link>
      </div>
      {pMes && (
        <p className="t-body-sm fi-lancar__mes" data-testid="lancar-no-mes">
          Lançando em <b>{nomeDoMes(pMes)}</b> · vai cair em{" "}
          <b data-testid="cai-em">{mesCurto(cai)}</b>
          {cai !== pMes && (
            <span style={{ color: "var(--color-warning-fg, var(--color-error-fg))" }}>
              {" "}
              (outro mês: confira a data{ehCartao ? " e a fatura" : ""})
            </span>
          )}
          {" · "}
          <Link to={`/financas/mes?mes=${pMes}`}>Voltar ao mês</Link>
        </p>
      )}
      <div className="fi-lancar">
        <Card className="fi-stack fi-lancar__card">
          <Segmented
            block
            value={tipo}
            onChange={trocarTipo}
            options={[
              { value: "saida", label: "Saída" },
              { value: "entrada", label: "Entrada" },
              { value: "transferencia", label: "Transferência" },
            ]}
          />
          {ehCartao && tipo === "saida" && (
            <Segmented
              block
              value={parcelado ? "parcelado" : "avista"}
              onChange={(v) => setParcelado(v === "parcelado")}
              options={[
                { value: "avista", label: "À vista" },
                { value: "parcelado", label: "Parcelado" },
              ]}
            />
          )}
          <Field
            label={
              comParcelas
                ? modoValor === "total"
                  ? "Valor total da compra"
                  : "Valor de cada parcela"
                : "Valor"
            }
          >
            <ValorInput value={valor} onChange={setValor} />
          </Field>
          {comParcelas && (
            <div className="fi-twocol">
              <Field label="Parcelas" hint={`De 2 a ${MAX_PARCELAS}`}>
                <Input
                  inputMode="numeric"
                  value={nParcelas}
                  onChange={(e) => setNParcelas(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </Field>
              <div className="fi-field">
                <span className="fi-label">O valor informado é</span>
                <Segmented
                  block
                  value={modoValor}
                  onChange={setModoValor}
                  options={[
                    { value: "total", label: "Total" },
                    { value: "parcela", label: "Parcela" },
                  ]}
                />
              </div>
            </div>
          )}

          {tipo !== "transferencia" && (
            <Field label="Categoria">
              <Combobox
                value={catId ?? ""}
                onChange={(e) => setCatId(e.target.value || null)}
                opcoes={cats.map((c) => ({
                  value: c.id,
                  label: c.nome,
                  sub: c.grupo ?? undefined,
                }))}
                placeholder="Buscar categoria…"
                vazio="Nenhuma categoria com esse nome"
                onCriar={setCriandoCat}
                rotuloCriar="Criar categoria"
              />
            </Field>
          )}

          <div className="fi-twocol fi-twocol--keep">
            <Field label={tipo === "transferencia" ? "De" : "Conta"}>
              <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
                <OpcoesContas contas={contasUteis} />
              </Select>
            </Field>
            {tipo === "transferencia" ? (
              <Field label="Para">
                <Select value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                  <option value="">Escolher…</option>
                  <OpcoesContas contas={contasUteis.filter((c) => c.id !== contaId)} />
                </Select>
              </Field>
            ) : (
              <Field label="Data">
                <DateField value={data} onChange={(e) => setData(e.target.value)} />
              </Field>
            )}
          </div>
          {tipo === "transferencia" && (
            <Field label="Data">
              <DateField value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
          )}

          {ehCartao && contaSel && (
            <SeletorFatura
              cartao={contaSel}
              data={data}
              valor={faturaManual ?? pMes ?? null}
              onChange={setFaturaManual}
              compacto
            />
          )}

          {comParcelas && <PreviaParcelas parcelas={parcelas} cartao={contaSel!} />}

          {!comParcelas && (
            <div className="fi-field">
              <span className="fi-label fi-sr">Situação</span>
              <Segmented
                block
                value={status}
                onChange={(s) => {
                  setStatusManual(true);
                  setStatus(s);
                }}
                options={[
                  { value: "pago", label: "Pago" },
                  { value: "pendente", label: "Previsto" },
                ]}
              />
            </div>
          )}

          <Field label="Anotação">
            <Input
              list="notas-recentes"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="O que foi? (opcional)"
            />
          </Field>
          <datalist id="notas-recentes">
            {sugestoes.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          {erro && (
            <p className="fi-error-text" role="alert">
              {erro}
            </p>
          )}
          <Button size="lg" block loading={enviando} onClick={() => void lancar()}>
            {comParcelas ? "Lançar compra parcelada" : `Lançar ${ROTULO[tipo].toLowerCase()}`}
          </Button>
        </Card>

        <section className="fi-stack" aria-label="Últimos lançamentos">
          <div className="fi-row fi-row--between">
            <h2 className="t-h3">Últimos lançamentos</h2>
            <Link
              className="fi-btn fi-btn--ghost fi-btn--sm fi-so-celular"
              to="/financas/lancamentos?vista=massa"
            >
              Lançar em massa
            </Link>
          </div>
          {recentes.length === 0 ? (
            <p className="t-body t-muted">Nada lançado ainda.</p>
          ) : (
            <ul className="fi-list">
              {recentes.slice(0, 6).map((l) => (
                <LancamentoItem
                  key={l.id}
                  l={l}
                  mostrarData
                  onAbrir={() => setEditando(l)}
                  onPagar={() => void pagar(l)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
      <EditarLancamento
        l={editando}
        onClose={() => setEditando(null)}
        onMudou={() => void carregarRecentes()}
      />
      <CriarCategoriaSheet
        aberto={criandoCat !== null}
        nome={criandoCat ?? ""}
        tipo={tipo === "entrada" ? "entrada" : "saida"}
        onClose={() => setCriandoCat(null)}
        onCriada={(c) => setCatId(c.id)}
      />
    </Page>
  );
}

/** Mostra, ANTES de gravar, onde cada parcela cai: fatura, data de pagamento e valor. */
function PreviaParcelas({
  parcelas,
  cartao,
}: {
  parcelas: ReturnType<typeof gerarParcelas>;
  cartao: import("@/lib/financas/dados").Conta;
}) {
  if (parcelas.length === 0)
    return (
      <p className="t-body-sm t-muted" data-testid="previa-parcelas">
        Informe o valor e a quantidade de parcelas para ver como fica.
      </p>
    );
  const iguais = new Set(parcelas.map((p) => p.valor_cents)).size === 1;
  return (
    <div className="fi-stack" data-testid="previa-parcelas" style={{ gap: 8 }}>
      <p className="t-body" style={{ fontWeight: 700 }}>
        {parcelas.length}× de{" "}
        {iguais
          ? brl(parcelas[0]!.valor_cents)
          : `${brl(parcelas[parcelas.length - 1]!.valor_cents)} (a 1ª de ${brl(parcelas[0]!.valor_cents)})`}{" "}
        · total {brl(totalDasParcelas(parcelas))}
      </p>
      <ul className="fi-parcelas">
        {parcelas.map((p) => {
          const d = datasDaFatura(p.fatura, cartao.dia_fechamento, cartao.dia_vencimento);
          return (
            <li key={p.numero}>
              <span>
                {p.numero}/{p.total} · fatura {mesCurto(p.fatura)}
                {d.paga ? ` · paga ${dataBR(d.paga, true)}` : ""}
              </span>
              <span className="t-money">{brl(p.valor_cents)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
