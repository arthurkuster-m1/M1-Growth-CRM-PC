"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "@/components/financas/rota";
import { CategoriasAba } from "./CategoriasConfig";
import { Bank, CreditCard, Plus } from "@/lib/ui/icons";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  MonthField,
  Page,
  Segmented,
  Select,
  Sheet,
  Switch,
  ValorInput,
  brl,
  useToast,
} from "@/components/financas/kit";
import {
  atualizarConta,
  criarConta,
  listarSaldos,
  obterAbertura,
  removerAbertura,
  salvarAbertura,
  useFinancas,
  type Conta,
  type DadosConta,
  type Saldo,
  type TipoConta,
} from "@/lib/financas/dados";
import { mesAtual, nomeDoMes, parsePercentual, percentualParaCampo } from "@/lib/financas/formato";

type Aba = "contas" | "cartoes" | "categorias";
const ABAS: { value: Aba; label: string }[] = [
  { value: "contas", label: "Contas" },
  { value: "cartoes", label: "Cartões" },
  { value: "categorias", label: "Categorias" },
];
const ROTULO_TIPO: Record<TipoConta, string> = {
  corrente: "Conta corrente",
  investida: "Investimento",
  emprestada: "Emprestada",
  bem: "Bem",
  cartao: "Cartão",
};

export function Configuracoes() {
  const [params, setParams] = useSearchParams();
  const aba = ABAS.find((a) => a.value === params.get("aba"))?.value ?? "contas";
  return (
    <Page wide>
      <h1 className="t-display">Configurações</h1>
      <Segmented
        block
        value={aba}
        onChange={(a) => setParams({ aba: a }, { replace: true })}
        options={ABAS}
      />
      {aba === "contas" && <ContasAba />}
      {aba === "cartoes" && <CartoesAba />}
      {aba === "categorias" && <CategoriasAba />}
    </Page>
  );
}

/* ───────── helpers visuais ───────── */
export function Linha({
  icone,
  titulo,
  sub,
  direita,
  onClick,
  apagada,
  acoes,
}: {
  icone: ReactNode;
  titulo: string;
  sub?: string;
  direita?: ReactNode;
  onClick?: () => void;
  apagada?: boolean;
  acoes?: ReactNode;
}) {
  return (
    <li className="fi-item" style={apagada ? { opacity: 0.55 } : undefined}>
      <button type="button" className="fi-item__open" onClick={onClick} disabled={!onClick}>
        <span className="fi-item__icon" aria-hidden>
          {icone}
        </span>
        <span className="fi-item__main">
          <span className="t-body" style={{ fontWeight: 700 }}>
            {titulo}
          </span>
          {sub && <span className="t-body-sm t-muted">{sub}</span>}
        </span>
        {direita && <span className="fi-item__lado">{direita}</span>}
      </button>
      {acoes}
    </li>
  );
}

function textoRendimento(c: Conta): string | null {
  if (!c.rendimento_base || c.rendimento_pct == null) return null;
  return c.rendimento_base === "cdi"
    ? `${percentualParaCampo(c.rendimento_pct)}% do CDI`
    : `${percentualParaCampo(c.rendimento_pct)}% ao ano`;
}

function useSaldos() {
  const [saldos, setSaldos] = useState<Map<string, Saldo>>(new Map());
  const carregar = useCallback(() => {
    listarSaldos().then(
      (l) => setSaldos(new Map(l.map((s) => [s.account_id, s]))),
      () => undefined,
    );
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);
  return { saldos, carregar };
}

/* ───────── CONTAS ───────── */
function ContasAba() {
  const { contas, recarregar } = useFinancas();
  const { saldos, carregar } = useSaldos();
  const [editando, setEditando] = useState<Conta | "nova" | null>(null);
  const lista = contas.filter((c) => c.tipo !== "cartao");
  return (
    <>
      <div className="fi-row fi-row--between">
        <p className="t-body t-muted">
          Contas correntes, investimentos e bens. O saldo é calculado a partir do saldo de abertura
          e dos lançamentos pagos.
        </p>
        <Button
          size="sm"
          icon={<Plus size={16} weight="bold" />}
          onClick={() => setEditando("nova")}
        >
          Nova conta
        </Button>
      </div>
      {lista.length === 0 ? (
        <Card>
          <EmptyState icon={<Bank size={30} />} title="Nenhuma conta ainda" />
        </Card>
      ) : (
        <ul className="fi-list">
          {lista.map((c) => (
            <Linha
              key={c.id}
              icone={<Bank size={20} />}
              titulo={c.nome}
              apagada={!c.ativa}
              sub={[ROTULO_TIPO[c.tipo], textoRendimento(c), c.ativa ? null : "arquivada"]
                .filter(Boolean)
                .join(" · ")}
              direita={
                <span className="fi-item__valor">
                  {saldos.has(c.id) ? brl(saldos.get(c.id)!.saldo_atual_cents) : "—"}
                </span>
              }
              onClick={() => setEditando(c)}
            />
          ))}
        </ul>
      )}
      <Sheet
        open={!!editando}
        onClose={() => setEditando(null)}
        title={editando === "nova" ? "Nova conta" : "Editar conta"}
      >
        {editando && (
          <FormConta
            key={editando === "nova" ? "nova" : editando.id}
            conta={editando === "nova" ? null : editando}
            onClose={() => setEditando(null)}
            onSalvo={() => {
              recarregar();
              carregar();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function FormConta({
  conta,
  onClose,
  onSalvo,
}: {
  conta: Conta | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(conta?.nome ?? "");
  const [tipo, setTipo] = useState<TipoConta>(conta?.tipo ?? "corrente");
  const [base, setBase] = useState<"" | "ano" | "cdi">(conta?.rendimento_base ?? "");
  const [pct, setPct] = useState(percentualParaCampo(conta?.rendimento_pct ?? null));
  const [ativa, setAtiva] = useState(conta?.ativa ?? true);
  const [mes, setMes] = useState(mesAtual());
  const [abertura, setAbertura] = useState(0);
  const [aberturaOriginal, setAberturaOriginal] = useState<number | null>(null);
  const [remover, setRemover] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Mostra o saldo de abertura que já existe para o mês escolhido (se existir).
  useEffect(() => {
    let vivo = true;
    setRemover(false);
    if (!conta) {
      setAbertura(0);
      setAberturaOriginal(null);
      return;
    }
    obterAbertura(conta.id, mes).then(
      (v) => {
        if (vivo) {
          setAberturaOriginal(v);
          setAbertura(v ?? 0);
        }
      },
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [conta, mes]);

  async function salvar() {
    if (!nome.trim()) return setErro("Dê um nome à conta.");
    if (base && parsePercentual(pct) === null)
      return setErro("Informe o rendimento como número maior que zero (ex.: 120 ou 10,5).");
    setOcupado(true);
    setErro(null);
    try {
      const dados: DadosConta = {
        nome: nome.trim(),
        tipo,
        ativa,
        rendimento_base: tipo === "investida" && base ? base : null,
        rendimento_pct: tipo === "investida" && base ? parsePercentual(pct) : null,
      };
      const salva = conta ? await atualizarConta(conta.id, dados) : await criarConta(dados);
      if (remover && aberturaOriginal !== null) await removerAbertura(salva.id, mes);
      else if (
        !remover &&
        abertura !== (aberturaOriginal ?? 0) &&
        (abertura > 0 || aberturaOriginal !== null)
      )
        await salvarAbertura(salva.id, mes, abertura);
      toast(conta ? "Conta atualizada" : "Conta criada");
      onSalvo();
      onClose();
    } catch (e) {
      const m = (e as Error).message;
      setErro(/duplicate|unique/i.test(m) ? "Já existe uma conta com esse nome." : m);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <Field label="Nome">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Nubank 120% | Art"
        />
      </Field>
      <Field label="Tipo">
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoConta)}>
          <option value="corrente">Conta corrente</option>
          <option value="investida">Investimento</option>
          <option value="bem">Bem (casa, carro…)</option>
        </Select>
      </Field>
      {tipo === "investida" && (
        <div className="fi-twocol">
          <Field label="Rendimento">
            <Select value={base} onChange={(e) => setBase(e.target.value as typeof base)}>
              <option value="">Sem rendimento</option>
              <option value="cdi">% do CDI</option>
              <option value="ano">% ao ano</option>
            </Select>
          </Field>
          <Field
            label={base === "cdi" ? "% do CDI" : "% ao ano"}
            hint={
              base === "cdi"
                ? "Acompanha o CDI do banco"
                : base === "ano"
                  ? "Taxa fixa que você informa"
                  : undefined
            }
          >
            <Input
              inputMode="decimal"
              disabled={!base}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder={base === "cdi" ? "120" : "10,5"}
            />
          </Field>
        </div>
      )}
      <div className="fi-stack" style={{ gap: 8 }}>
        <div className="fi-twocol">
          <Field label="Saldo de abertura de">
            <MonthField value={mes} onChange={(e) => setMes(e.target.value || mesAtual())} />
          </Field>
          <Field label="Valor">
            <ValorInput
              value={abertura}
              onChange={(v) => {
                setAbertura(v);
                setRemover(false);
              }}
            />
          </Field>
        </div>
        <p className="t-caption t-muted">
          Saldo no 1º dia de {nomeDoMes(mes)}.{" "}
          {aberturaOriginal === null
            ? "Sem registro: o mês herda o fechamento do mês anterior."
            : `Registro atual: ${brl(aberturaOriginal)}.`}
        </p>
        {aberturaOriginal !== null && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRemover(true);
              setAbertura(0);
            }}
          >
            {remover ? "Registro será removido ao salvar" : "Remover registro deste mês"}
          </Button>
        )}
      </div>
      {conta && (
        <div className="fi-row fi-row--between">
          <span className="t-body">Conta ativa</span>
          <Switch label="Conta ativa" checked={ativa} onChange={setAtiva} />
        </div>
      )}
      {erro && (
        <p className="fi-error-text" role="alert">
          {erro}
        </p>
      )}
      <Button size="lg" block loading={ocupado} onClick={() => void salvar()}>
        Salvar
      </Button>
    </>
  );
}

/* ───────── CARTÕES ───────── */
function CartoesAba() {
  const { contas, conta, recarregar } = useFinancas();
  const { saldos, carregar } = useSaldos();
  const [editando, setEditando] = useState<Conta | "nova" | null>(null);
  const cartoes = contas.filter((c) => c.tipo === "cartao");
  return (
    <>
      <div className="fi-row fi-row--between">
        <p className="t-body t-muted">
          Cada cartão tem a sua fatura. Ao lançar uma compra, escolha o cartão como conta e ela cai
          na fatura certa.
        </p>
        <Button
          size="sm"
          icon={<Plus size={16} weight="bold" />}
          onClick={() => setEditando("nova")}
        >
          Novo cartão
        </Button>
      </div>
      {cartoes.length === 0 ? (
        <Card>
          <EmptyState icon={<CreditCard size={30} />} title="Nenhum cartão ainda">
            Cadastre o Mercado Pago e os cartões de vocês.
          </EmptyState>
        </Card>
      ) : (
        <ul className="fi-list">
          {cartoes.map((c) => {
            const aberto = Math.max(0, -(saldos.get(c.id)?.saldo_atual_cents ?? 0));
            return (
              <Linha
                key={c.id}
                icone={<CreditCard size={20} />}
                titulo={c.nome}
                apagada={!c.ativa}
                sub={[
                  c.dia_fechamento ? `fecha dia ${c.dia_fechamento}` : "fechamento não informado",
                  c.dia_vencimento ? `vence dia ${c.dia_vencimento}` : null,
                  conta(c.conta_pagamento_id)
                    ? `paga com ${conta(c.conta_pagamento_id)!.nome}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                direita={
                  aberto > 0 ? (
                    <>
                      <span className="fi-item__valor">{brl(aberto)}</span>
                      <span className="t-caption t-muted">em aberto</span>
                    </>
                  ) : undefined
                }
                onClick={() => setEditando(c)}
              />
            );
          })}
        </ul>
      )}
      <Sheet
        open={!!editando}
        onClose={() => setEditando(null)}
        title={editando === "nova" ? "Novo cartão" : "Editar cartão"}
      >
        {editando && (
          <FormCartao
            key={editando === "nova" ? "nova" : editando.id}
            cartao={editando === "nova" ? null : editando}
            onClose={() => setEditando(null)}
            onSalvo={() => {
              recarregar();
              carregar();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function FormCartao({
  cartao,
  onClose,
  onSalvo,
}: {
  cartao: Conta | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const { contas } = useFinancas();
  const toast = useToast();
  const [nome, setNome] = useState(cartao?.nome ?? "");
  const [fecha, setFecha] = useState(cartao?.dia_fechamento ? String(cartao.dia_fechamento) : "");
  const [vence, setVence] = useState(cartao?.dia_vencimento ? String(cartao.dia_vencimento) : "");
  const [paga, setPaga] = useState(cartao?.conta_pagamento_id ?? "");
  const [ativa, setAtiva] = useState(cartao?.ativa ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const dia = (t: string) =>
    t.trim() === "" ? null : /^\d{1,2}$/.test(t.trim()) && +t >= 1 && +t <= 31 ? +t : NaN;

  async function salvar() {
    if (!nome.trim()) return setErro("Dê um nome ao cartão.");
    const f = dia(fecha),
      v = dia(vence);
    if (Number.isNaN(f) || Number.isNaN(v)) return setErro("Os dias precisam estar entre 1 e 31.");
    setOcupado(true);
    setErro(null);
    try {
      const dados: DadosConta = {
        nome: nome.trim(),
        tipo: "cartao",
        ativa,
        dia_fechamento: f,
        dia_vencimento: v,
        conta_pagamento_id: paga || null,
      };
      if (cartao) await atualizarConta(cartao.id, dados);
      else await criarConta(dados);
      toast(cartao ? "Cartão atualizado" : "Cartão criado");
      onSalvo();
      onClose();
    } catch (e) {
      const m = (e as Error).message;
      setErro(/duplicate|unique/i.test(m) ? "Já existe uma conta ou cartão com esse nome." : m);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <Field label="Nome do cartão">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Mercado Pago"
        />
      </Field>
      <div className="fi-twocol fi-twocol--keep">
        <Field label="Dia de fechamento">
          <Input
            inputMode="numeric"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            placeholder="28"
          />
        </Field>
        <Field label="Dia de vencimento">
          <Input
            inputMode="numeric"
            value={vence}
            onChange={(e) => setVence(e.target.value)}
            placeholder="5"
          />
        </Field>
      </div>
      <p className="t-caption t-muted" style={{ marginTop: -8 }}>
        A fatura é nomeada pelo mês em que é paga (quando o dinheiro sai do caixa). Ex.: fecha dia
        28 e vence dia 5, uma compra de 31/10 é paga em dezembro. Dá para mudar a fatura de cada
        compra.
      </p>
      <Field label="Conta que paga a fatura" hint="Usada ao registrar o pagamento">
        <Select value={paga} onChange={(e) => setPaga(e.target.value)}>
          <option value="">Nenhuma</option>
          {contas
            .filter((c) => c.tipo === "corrente" && c.ativa)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </Select>
      </Field>
      {cartao && (
        <div className="fi-row fi-row--between">
          <span className="t-body">Cartão ativo</span>
          <Switch label="Cartão ativo" checked={ativa} onChange={setAtiva} />
        </div>
      )}
      {erro && (
        <p className="fi-error-text" role="alert">
          {erro}
        </p>
      )}
      <Button size="lg" block loading={ocupado} onClick={() => void salvar()}>
        Salvar
      </Button>
    </>
  );
}
