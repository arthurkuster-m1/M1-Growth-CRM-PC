"use client";

import { useMemo, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { lerNumero } from "@/lib/marketing/calculadora";
import { Plus, Trash } from "@/lib/ui/icons";
import {
  FORMAS_DE_PAGAMENTO,
  gerarParcelas,
  type FormaDePagamento,
  type ParcelaDaVenda,
  type Venda,
} from "@/lib/vendas";

const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

export interface ClienteOpcao {
  contact_id: string;
  nome: string;
  telefone: string | null;
}

export interface DadosDaVenda {
  id?: string;
  contact_id: string;
  status: "interesse" | "comprometida" | "cancelada";
  itens: Array<{ product_name: string; quantity: number; amount_cents: number }>;
  pagamentos: Array<{
    number: number;
    due_on: string;
    paid_on: string | null;
    amount_cents: number;
    status: "prevista" | "recebida";
  }>;
  payment_method: string;
  is_recurring: boolean;
  recurrence_active: boolean;
  reference: string;
  notes: string;
}

function rotuloDaForma(t: (s: string) => string, f: FormaDePagamento): string {
  switch (f) {
    case "pix":
      return t("PIX");
    case "cartao_credito":
      return t("Cartão de crédito");
    case "cartao_debito":
      return t("Cartão de débito");
    case "boleto":
      return t("Boleto");
    case "transferencia":
      return t("Transferência");
    case "dinheiro":
      return t("Dinheiro");
    case "recorrencia":
      return t("Recorrência (assinatura)");
    case "outro":
      return t("Outra");
  }
}

const hoje = () => new Date().toISOString().slice(0, 10);
const centavos = (texto: string) => Math.round((lerNumero(texto) ?? 0) * 100);
const textoDe = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * A VENDA, do jeito que acontece: um ou mais produtos, a forma de pagamento e as parcelas — cada
 * uma com a data e o valor, marcada como recebida quando cai na conta. O dinheiro só conta no
 * mês em que entra, não o valor cheio. Serve para registrar uma venda nova, editar e, quando o
 * lead é movido para Ganho, para FINALIZAR a venda com os valores reais.
 */
export function DialogoDaVenda({
  venda,
  contatoInicial,
  clientes,
  titulo,
  aoFechar,
  aoSalvar,
  aoApagar,
}: {
  venda: Venda | null;
  contatoInicial?: { contact_id: string; nome: string } | null;
  clientes: ClienteOpcao[];
  titulo?: string;
  aoFechar: () => void;
  aoSalvar: (v: DadosDaVenda) => Promise<void>;
  aoApagar?: () => Promise<void>;
}) {
  const t = useT();
  const fechada = venda ? venda.status === "comprometida" || venda.status === "concluida" : true;
  const [busca, setBusca] = useState("");
  const [contato, setContato] = useState(venda?.contact_id ?? contatoInicial?.contact_id ?? "");
  const [situacao, setSituacao] = useState<"interesse" | "fechada" | "cancelada">(
    venda
      ? venda.status === "interesse"
        ? "interesse"
        : venda.status === "cancelada"
          ? "cancelada"
          : "fechada"
      : "fechada",
  );
  const [itens, setItens] = useState<Array<{ produto: string; valor: string }>>(() => {
    if (venda?.itens && venda.itens.length > 0) {
      return venda.itens.map((i) => ({ produto: i.product_name, valor: textoDe(i.amount_cents) }));
    }
    return [
      { produto: venda?.product_name ?? "", valor: venda ? textoDe(venda.amount_cents) : "" },
    ];
  });
  const [forma, setForma] = useState<string>(venda?.payment_method ?? "pix");
  const [recorrente, setRecorrente] = useState(venda?.is_recurring ?? false);
  const [recorrenciaAtiva, setRecorrenciaAtiva] = useState(venda?.recurrence_active ?? true);
  const [referencia, setReferencia] = useState(venda?.reference ?? "");
  const [notas, setNotas] = useState(venda?.notes ?? "");
  const [parcelas, setParcelas] = useState<
    Array<{
      number: number;
      due_on: string;
      valor: string;
      recebida: boolean;
      paid_on: string | null;
    }>
  >(() => {
    const existentes = (venda?.parcelas ?? [])
      .filter((p) => p.status !== "cancelada")
      .map((p) => ({
        number: p.number,
        due_on: p.due_on,
        valor: textoDe(p.amount_cents),
        recebida: p.status === "recebida",
        paid_on: p.paid_on,
      }));
    // Venda marcada como concluída sem parcelas: uma parcela única, já recebida hoje.
    if (existentes.length === 0 && venda?.status === "concluida") {
      return [
        {
          number: 1,
          due_on: hoje(),
          valor: textoDe(venda.amount_cents),
          recebida: true,
          paid_on: hoje(),
        },
      ];
    }
    return existentes;
  });
  const [qtd, setQtd] = useState(String(Math.max(1, venda?.installments ?? 1)));
  const [primeiro, setPrimeiro] = useState(venda?.expected_on ?? hoje());
  const [salvando, setSalvando] = useState(false);

  const total = itens.reduce((s, i) => s + centavos(i.valor), 0);
  const somaParcelas = parcelas.reduce((s, p) => s + centavos(p.valor), 0);
  const diferenca = parcelas.length > 0 ? total - somaParcelas : 0;
  const termo = busca.trim().toLowerCase();
  const sugestoes = useMemo(
    () =>
      termo
        ? clientes
            .filter((c) => `${c.nome} ${c.telefone ?? ""}`.toLowerCase().includes(termo))
            .slice(0, 8)
        : [],
    [clientes, termo],
  );
  const clienteEscolhido =
    clientes.find((c) => c.contact_id === contato) ??
    (contatoInicial && contatoInicial.contact_id === contato
      ? { ...contatoInicial, telefone: null }
      : null);

  function gerar() {
    const n = Math.max(1, Math.min(120, Math.round(lerNumero(qtd) ?? 1)));
    const lista = gerarParcelas(total, n, primeiro || hoje());
    setParcelas(
      lista.map((p: ParcelaDaVenda) => ({
        number: p.number,
        due_on: p.due_on,
        valor: textoDe(p.amount_cents),
        recebida: false,
        paid_on: null,
      })),
    );
  }

  const itensValidos = itens.filter((i) => i.produto.trim() !== "");
  const valido =
    contato !== "" &&
    (situacao === "cancelada" || itensValidos.length > 0) &&
    (situacao !== "fechada" || (total > 0 && parcelas.length > 0 && Math.abs(diferenca) <= 1));

  async function salvar() {
    setSalvando(true);
    const pagos = situacao === "fechada" ? parcelas : [];
    await aoSalvar({
      ...(venda ? { id: venda.id } : {}),
      contact_id: contato,
      status: situacao === "fechada" ? "comprometida" : situacao,
      itens: itensValidos.map((i) => ({
        product_name: i.produto.trim(),
        quantity: 1,
        amount_cents: centavos(i.valor),
      })),
      pagamentos: pagos.map((p, k) => ({
        number: k + 1,
        due_on: p.due_on,
        paid_on: p.recebida ? (p.paid_on ?? hoje()) : null,
        amount_cents: centavos(p.valor),
        status: p.recebida ? ("recebida" as const) : ("prevista" as const),
      })),
      payment_method: situacao === "fechada" ? forma : "",
      is_recurring: recorrente,
      recurrence_active: recorrente && recorrenciaAtiva,
      reference: referencia.trim(),
      notes: notas.trim(),
    });
    setSalvando(false);
    aoFechar();
  }

  return (
    <Dialog open onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-h-[92vh] max-w-2xl gap-3 overflow-y-auto p-5 sm:rounded-2xl">
        <DialogTitle className="text-base font-semibold">
          {titulo ?? (venda ? t("Editar venda") : t("Nova venda"))}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t(
            "Informe os produtos, o valor real e como o cliente vai pagar. Só entra no mês o que de fato cair na conta.",
          )}
        </DialogDescription>

        <div className="grid grid-cols-1 gap-1">
          <span className="text-xs text-muted-foreground">{t("Cliente")}</span>
          {venda || (contatoInicial && contato === contatoInicial.contact_id) ? (
            <p className="text-sm font-medium">
              {venda?.cliente?.nome ?? contatoInicial?.nome ?? "—"}
            </p>
          ) : clienteEscolhido ? (
            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-sm">
              <span>{clienteEscolhido.nome}</span>
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => setContato("")}
              >
                {t("Trocar")}
              </button>
            </div>
          ) : (
            <>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t("Buscar cliente por nome ou telefone")}
                aria-label={t("Buscar cliente")}
                className={CAMPO}
              />
              {sugestoes.length > 0 ? (
                <ul className="grid grid-cols-1 gap-1 rounded-xl border p-1">
                  {sugestoes.map((c) => (
                    <li key={c.contact_id}>
                      <button
                        type="button"
                        onClick={() => setContato(c.contact_id)}
                        className="flex w-full justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary"
                      >
                        <span className="truncate">{c.nome}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{c.telefone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-1">
          <span className="text-xs text-muted-foreground">{t("Situação")}</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {(
              [
                ["fechada", t("Venda fechada")],
                ["interesse", t("Interesse (ainda não fechou)")],
                ["cancelada", t("Cancelada")],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={situacao === valor}
                onClick={() => setSituacao(valor)}
                className={`h-9 rounded-lg border px-3 text-sm ${
                  situacao === valor
                    ? "border-primary bg-primary/10 font-medium"
                    : "hover:bg-secondary"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-xl border p-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Produtos e serviços")}
          </p>
          {itens.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
              <input
                value={it.produto}
                onChange={(e) =>
                  setItens((l) =>
                    l.map((x, k) => (k === i ? { ...x, produto: e.target.value } : x)),
                  )
                }
                placeholder={t("Produto ou serviço")}
                aria-label={`${t("Produto")} ${i + 1}`}
                className={CAMPO}
              />
              <input
                value={it.valor}
                inputMode="decimal"
                onChange={(e) =>
                  setItens((l) =>
                    l.map((x, k) =>
                      k === i ? { ...x, valor: e.target.value.replace(/[^\d.,]/g, "") } : x,
                    ),
                  )
                }
                placeholder="R$ 0,00"
                aria-label={`${t("Valor")} ${i + 1}`}
                className={CAMPO}
              />
              <button
                type="button"
                aria-label={t("Tirar item")}
                disabled={itens.length === 1}
                onClick={() => setItens((l) => l.filter((_, k) => k !== i))}
                className="grid h-9 w-9 grid-cols-1 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg disabled:opacity-30"
              >
                <Trash size={14} aria-hidden />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setItens((l) => [...l, { produto: "", valor: "" }])}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-secondary"
            >
              <Plus size={14} weight="bold" aria-hidden />
              {t("Vendeu mais alguma coisa?")}
            </button>
            <p className="text-sm">
              {t("Total")}: <strong className="tabular-nums">{reais(total)}</strong>
            </p>
          </div>
        </div>

        {situacao === "fechada" ? (
          <div className="grid grid-cols-1 gap-3 rounded-xl border p-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("Pagamento")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="grid grid-cols-1 gap-1">
                <span className="text-xs text-muted-foreground">{t("Forma de pagamento")}</span>
                <select
                  value={forma}
                  onChange={(e) => {
                    setForma(e.target.value);
                    if (e.target.value === "recorrencia") setRecorrente(true);
                  }}
                  className={CAMPO}
                >
                  {FORMAS_DE_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {rotuloDaForma(t, f)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid grid-cols-1 gap-1">
                <span className="text-xs text-muted-foreground">{t("Número de parcelas")}</span>
                <input
                  value={qtd}
                  inputMode="numeric"
                  onChange={(e) => setQtd(e.target.value.replace(/\D/g, ""))}
                  className={CAMPO}
                />
              </label>
              <label className="grid grid-cols-1 gap-1">
                <span className="text-xs text-muted-foreground">{t("Primeira parcela em")}</span>
                <input
                  type="date"
                  value={primeiro}
                  onChange={(e) => setPrimeiro(e.target.value)}
                  className={CAMPO}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={gerar}
                disabled={total <= 0}
                className="h-9 rounded-lg border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                {parcelas.length > 0 ? t("Refazer as parcelas") : t("Gerar as parcelas")}
              </button>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recorrente}
                  onChange={(e) => setRecorrente(e.target.checked)}
                />
                {t("Recorrente (mensalidade, assinatura)")}
              </label>
            </div>
            {recorrente ? (
              <label className="flex items-start gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={recorrenciaAtiva}
                  onChange={(e) => setRecorrenciaAtiva(e.target.checked)}
                />
                <span>
                  {t("Recorrência ativa")}
                  <span className="block text-xs text-muted-foreground">
                    {t(
                      "Todo mês o sistema cria a próxima parcela como prevista e avisa na véspera, no dia e no dia seguinte para você confirmar se o lead pagou e se o valor mudou. Nada é dado como pago sozinho.",
                    )}
                  </span>
                </span>
              </label>
            ) : null}

            {parcelas.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-max text-sm">
                  <thead className="bg-secondary/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">{t("Vence em")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("Valor")}</th>
                      <th className="px-3 py-2 text-center font-medium">{t("Já recebida")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelas.map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1 tabular-nums">{i + 1}</td>
                        <td className="px-2 py-1">
                          <input
                            type="date"
                            value={p.due_on}
                            aria-label={`${t("Vencimento da parcela")} ${i + 1}`}
                            onChange={(e) =>
                              setParcelas((l) =>
                                l.map((x, k) => (k === i ? { ...x, due_on: e.target.value } : x)),
                              )
                            }
                            className="h-9 rounded-lg border bg-background px-2 text-sm"
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <input
                            value={p.valor}
                            inputMode="decimal"
                            aria-label={`${t("Valor da parcela")} ${i + 1}`}
                            onChange={(e) =>
                              setParcelas((l) =>
                                l.map((x, k) =>
                                  k === i
                                    ? { ...x, valor: e.target.value.replace(/[^\d.,]/g, "") }
                                    : x,
                                ),
                              )
                            }
                            className="h-9 w-28 rounded-lg border bg-background px-2 text-right text-sm tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={p.recebida}
                            aria-label={`${t("Parcela recebida")} ${i + 1}`}
                            onChange={(e) =>
                              setParcelas((l) =>
                                l.map((x, k) =>
                                  k === i
                                    ? {
                                        ...x,
                                        recebida: e.target.checked,
                                        paid_on: e.target.checked ? hoje() : null,
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("Gere as parcelas para registrar quando cada uma cai na conta.")}
              </p>
            )}
            {parcelas.length > 0 && Math.abs(diferenca) > 1 ? (
              <p
                role="alert"
                className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-fg"
              >
                {t("A soma das parcelas difere do total em")} {reais(Math.abs(diferenca))}.{" "}
                {t("Ajuste os valores ou refaça as parcelas.")}
              </p>
            ) : null}
          </div>
        ) : null}

        <label className="grid grid-cols-1 gap-1">
          <span className="text-xs text-muted-foreground">
            {t("Referência (ex.: Mensalidade 03/2026)")}
          </span>
          <input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            className={CAMPO}
          />
        </label>
        <label className="grid grid-cols-1 gap-1">
          <span className="text-xs text-muted-foreground">{t("Observações")}</span>
          <textarea
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          />
        </label>

        <div className="flex flex-wrap justify-between gap-2 pt-1">
          {aoApagar && venda ? (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(t("Apagar esta venda? Os totais do cliente serão recalculados."))
                ) {
                  void aoApagar().then(aoFechar);
                }
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium text-error-fg hover:bg-error-bg"
            >
              <Trash size={14} aria-hidden />
              {t("Apagar")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={aoFechar}
              className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-secondary"
            >
              {fechada && venda?.needs_details ? t("Detalhar depois") : t("Cancelar")}
            </button>
            <button
              type="button"
              disabled={!valido || salvando}
              onClick={() => void salvar()}
              className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {salvando ? t("Salvando…") : t("Salvar venda")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
