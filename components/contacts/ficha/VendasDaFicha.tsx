"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";

import { BlocoDaFicha, SeloDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import {
  aplicarConsulta,
  consultaAtiva,
  type CampoConsultavel,
  type ConsultaDaTabela,
} from "@/lib/motor/consulta";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { Plus } from "@/lib/ui/icons";
import { STATUS_DA_VENDA, type StatusDaVenda, type Venda } from "@/lib/vendas";

const reais = (c: number) => moedaDoNumero(c / 100);
const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

const ROTULO: Record<StatusDaVenda, string> = {
  interesse: "Interesse",
  comprometida: "Comprometida",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const COR: Record<StatusDaVenda, "blue" | "yellow" | "green" | "gray"> = {
  interesse: "blue",
  comprometida: "yellow",
  concluida: "green",
  cancelada: "gray",
};

/**
 * A ABA VENDAS: o resumo do dinheiro do cliente (LTV atual, LTV previsto, vendas, ticket médio) e a
 * tabela de todas as vendas, com status editável na própria linha e cadastro de venda nova.
 */
export function VendasDaFicha({ contactId, nome }: { contactId: string; nome: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Venda | "nova" | null>(null);
  const [busca, setBusca] = useState("");
  const [consultaDaTabela, setConsultaDaTabela] = useState<ConsultaDaTabela>({});

  const consulta = useQuery({
    queryKey: ["vendas-do-cliente", contactId],
    retry: false,
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`)).data
        .vendas,
  });
  if (consulta.isError) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {t("Você não tem permissão para ver as vendas deste cliente.")}
      </p>
    );
  }
  const vendas = consulta.data ?? [];
  const realizadas = vendas.filter((v) => v.status === "comprometida" || v.status === "concluida");
  /** O que já entrou: as parcelas recebidas (ou o total, na venda concluída sem parcelas). */
  const recebido = (v: Venda) => {
    const p = v.parcelas ?? [];
    if (p.length === 0) return v.status === "concluida" ? v.amount_cents : 0;
    return p.filter((x) => x.status === "recebida").reduce((a, x) => a + x.amount_cents, 0);
  };
  /** O que falta entrar: o total menos o que já entrou (venda cancelada não deve nada). */
  const faltando = (v: Venda) =>
    v.status === "cancelada" ? 0 : Math.max(0, v.amount_cents - recebido(v));
  const aReceber = (v: Venda) => {
    const p = v.parcelas ?? [];
    if (p.length === 0) return v.status === "comprometida" ? v.amount_cents : 0;
    return p.filter((x) => x.status === "prevista").reduce((a, x) => a + x.amount_cents, 0);
  };
  const ltv = realizadas.reduce((s, v) => s + recebido(v), 0);
  const previsto = realizadas.reduce((s, v) => s + aReceber(v), 0);
  const totalVendido = realizadas.reduce((s, v) => s + v.amount_cents, 0);
  const ticket = realizadas.length > 0 ? Math.round(totalVendido / realizadas.length) : 0;

  // ── Busca, filtro, agrupamento e ordem (o mesmo motor das outras tabelas) ──
  const campos: Array<
    CampoConsultavel<Venda> & {
      titulo: string;
      opcoes?: { id: string; rotulo: string }[];
    }
  > = [
    { id: "produto", titulo: t("Produto"), tipo: "texto", valorDe: (v) => v.product_name },
    { id: "funil", titulo: t("Funil"), tipo: "texto", valorDe: (v) => v.funil ?? "" },
    {
      id: "status",
      titulo: t("Status"),
      tipo: "opcao",
      valorDe: (v) => v.status,
      opcoes: STATUS_DA_VENDA.map((s) => ({ id: s, rotulo: t(ROTULO[s]) })),
      rotuloDoValor: (v) => t(ROTULO[v as StatusDaVenda] ?? v),
      ordemDoValor: (v) => STATUS_DA_VENDA.indexOf(v as StatusDaVenda),
    },
    { id: "total", titulo: t("Valor total"), tipo: "numero", valorDe: (v) => v.amount_cents / 100 },
    { id: "pago", titulo: t("Valor pago"), tipo: "numero", valorDe: (v) => recebido(v) / 100 },
    { id: "falta", titulo: t("A comprometido"), tipo: "numero", valorDe: (v) => faltando(v) / 100 },
    { id: "etapa", titulo: t("Etapa"), tipo: "texto", valorDe: (v) => v.etapa ?? "" },
    {
      id: "previsao",
      titulo: t("Previsão de fechamento"),
      tipo: "data",
      valorDe: (v) => v.expected_close_date,
    },
    { id: "compromisso", titulo: t("Compromisso"), tipo: "data", valorDe: (v) => v.expected_on },
    { id: "pago_em", titulo: t("Pago em"), tipo: "data", valorDe: (v) => v.paid_on },
    { id: "pagamento", titulo: t("Pagamento"), tipo: "texto", valorDe: (v) => v.payment_method },
  ];
  const camposDaBarra: CampoDaBarra[] = campos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    opcoes: c.opcoes,
  }));
  const termo = busca
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  const buscadas = termo
    ? vendas.filter((v) =>
        `${v.product_name} ${v.funil ?? ""} ${v.payment_method} ${v.notes} ${v.reference}`
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .includes(termo),
      )
    : vendas;
  const resultado = aplicarConsulta(buscadas, campos, consultaDaTabela, {
    hoje: new Date().toISOString().slice(0, 10),
  });
  const grupos = resultado.grupos?.map((g) => {
    const campo = campos.find((c) => c.id === consultaDaTabela.agrupar);
    const rotulo =
      g.chave === ""
        ? t("Sem valor")
        : (campo?.opcoes?.find((o) => o.id === g.chave)?.rotulo ?? g.rotulo);
    return { chave: g.chave || "__vazio", rotulo, linhas: g.linhas };
  });

  async function atualizar() {
    await queryClient.invalidateQueries({ queryKey: ["vendas-do-cliente", contactId] });
    await queryClient.invalidateQueries({ queryKey: ["vendas"] });
    await queryClient.invalidateQueries({ queryKey: ["clientes"] });
  }
  async function salvar(v: DadosDaVenda) {
    try {
      const { id, contact_id, ...resto } = v;
      if (id) await apiClient.patch(`/api/v1/vendas/${id}`, resto);
      else await apiClient.post("/api/v1/vendas", { contact_id, currency: "BRL", ...resto });
      await atualizar();
    } catch (e) {
      showApiError(e);
    }
  }
  /** Marca (ou desmarca) uma parcela como recebida; o servidor recalcula o resto da venda. */
  async function marcarParcela(v: Venda, numero: number, recebida: boolean) {
    const hoje = new Date().toISOString().slice(0, 10);
    const pagamentos = (v.parcelas ?? []).map((p) => ({
      number: p.number,
      due_on: p.due_on,
      amount_cents: p.amount_cents,
      status: (p.number === numero ? (recebida ? "recebida" : "prevista") : p.status) as
        | "prevista"
        | "recebida"
        | "cancelada",
      paid_on:
        p.number === numero ? (recebida ? hoje : null) : (p.paid_on ?? null),
    }));
    // Todas recebidas = venda concluída; desmarcar uma de venda concluída volta a "comprometida".
    const ativas = pagamentos.filter((p) => p.status !== "cancelada");
    const todasRecebidas = ativas.length > 0 && ativas.every((p) => p.status === "recebida");
    const status: StatusDaVenda | undefined = todasRecebidas
      ? "concluida"
      : v.status === "concluida"
        ? "comprometida"
        : undefined;
    try {
      await apiClient.patch(`/api/v1/vendas/${v.id}`, {
        pagamentos,
        ...(status && status !== v.status
          ? { status, paid_on: status === "concluida" ? hoje : null }
          : {}),
      });
      await atualizar();
    } catch (e) {
      showApiError(e);
    }
  }
  async function mudarStatus(v: Venda, status: StatusDaVenda) {
    try {
      await apiClient.patch(`/api/v1/vendas/${v.id}`, { status });
      await atualizar();
    } catch (e) {
      showApiError(e);
    }
  }

  const cartoes: Array<[string, string, "green" | "blue" | "purple" | "orange"]> = [
    [t("LTV atual"), reais(ltv), "green"],
    [t("LTV previsto"), reais(ltv + previsto), "blue"],
    [t("Vendas"), String(realizadas.length), "purple"],
    [t("Ticket médio"), reais(ticket), "orange"],
  ];
  const BARRA = {
    green: "border-l-green-500",
    blue: "border-l-blue-500",
    purple: "border-l-purple-500",
    orange: "border-l-orange-500",
  } as const;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cartoes.map(([rotulo, valor, cor]) => (
          <div key={rotulo} className={`rounded-2xl border border-l-4 bg-card p-4 shadow-sm ${BARRA[cor]}`}>
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{rotulo}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
          </div>
        ))}
      </div>

      <BlocoDaFicha
        titulo={t("Vendas e interesses")}
        cor="green"
        acao={
          <button
            type="button"
            onClick={() => setEditando("nova")}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground"
          >
            <Plus size={12} weight="bold" aria-hidden />
            {t("Nova venda")}
          </button>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-56">
            <span className="sr-only">{t("Buscar")}</span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={t("Buscar venda")}
              className="h-9 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <BarraDeConsulta
            compacta
            campos={camposDaBarra}
            consulta={consultaDaTabela}
            aoMudar={setConsultaDaTabela}
          />
        </div>

        {consulta.isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-secondary" />
        ) : vendas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Nenhuma venda ou interesse cadastrado.")}</p>
        ) : resultado.linhas.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            {t("Nada combina com a busca e os filtros.")}
            {consultaAtiva(consultaDaTabela) || busca ? (
              <button
                type="button"
                className="ml-2 font-medium text-primary hover:underline"
                onClick={() => {
                  setBusca("");
                  setConsultaDaTabela({});
                }}
              >
                {t("Limpar")}
              </button>
            ) : null}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("Produto")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Funil")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Valor total")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Valor pago")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("A comprometido")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Status")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Parcelas")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Etapa")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Previsão")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Compromisso")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Pagamento")}</th>
                </tr>
              </thead>
              <tbody>
                {(grupos ?? [{ chave: "__todas", rotulo: "", linhas: resultado.linhas }]).map((g) => (
                  <Fragment key={g.chave}>
                    {grupos ? (
                      <tr className="bg-secondary/40">
                        <td colSpan={11} className="px-3 py-1.5 text-xs font-semibold">
                          {g.rotulo} <span className="font-normal text-muted-foreground">({g.linhas.length})</span>
                        </td>
                      </tr>
                    ) : null}
                    {g.linhas.map((v) => {
                      const parcelas = (v.parcelas ?? []).filter((p) => p.status !== "cancelada");
                      return (
                        <tr key={v.id} className="border-t align-top hover:bg-secondary/40">
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="text-left font-medium hover:underline"
                              onClick={() => setEditando(v)}
                            >
                              {v.product_name || t("Sem produto")}
                            </button>
                          </td>
                          <td className="px-3 py-2">{v.funil ?? "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{reais(v.amount_cents)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
                            {reais(recebido(v))}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{reais(faltando(v))}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <SeloDaFicha cor={COR[v.status]}>{t(ROTULO[v.status])}</SeloDaFicha>
                              <select
                                aria-label={t("Mudar status")}
                                value={v.status}
                                onChange={(e) => void mudarStatus(v, e.target.value as StatusDaVenda)}
                                className="h-7 rounded-lg border bg-background px-1 text-xs"
                              >
                                {STATUS_DA_VENDA.map((s) => (
                                  <option key={s} value={s}>
                                    {t(ROTULO[s])}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {parcelas.length === 0 ? (
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={v.status === "concluida"}
                                  disabled={v.status === "cancelada"}
                                  onChange={(e) =>
                                    void mudarStatus(v, e.target.checked ? "concluida" : "comprometida")
                                  }
                                />
                                {t("À vista")} · {reais(v.amount_cents)} · {t("recebido")}
                              </label>
                            ) : (
                              <ul className="grid gap-1">
                                {parcelas.map((p) => (
                                  <li key={p.number}>
                                    <label className="flex items-center gap-2 text-xs whitespace-nowrap">
                                      <input
                                        type="checkbox"
                                        checked={p.status === "recebida"}
                                        onChange={(e) => void marcarParcela(v, p.number, e.target.checked)}
                                        aria-label={`${t("Parcela")} ${p.number} ${t("recebida")}`}
                                      />
                                      <span className="tabular-nums">
                                        {p.number}/{parcelas.length} · {reais(p.amount_cents)} · {dataBr(p.due_on)}
                                      </span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-3 py-2">{v.etapa ?? "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{dataBr(v.expected_close_date)}</td>
                          <td className="px-3 py-2 tabular-nums">{dataBr(v.expected_on)}</td>
                          <td className="px-3 py-2">{v.payment_method ? v.payment_method : "—"}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BlocoDaFicha>

      {editando ? (
        <DialogoDaVenda
          key={editando === "nova" ? "nova" : editando.id}
          venda={editando === "nova" ? null : editando}
          contatoInicial={{ contact_id: contactId, nome }}
          clientes={[]}
          aoFechar={() => setEditando(null)}
          aoSalvar={salvar}
          aoApagar={
            editando !== "nova"
              ? async () => {
                  try {
                    await apiClient.delete(`/api/v1/vendas/${editando.id}`);
                    await atualizar();
                  } catch (e) {
                    showApiError(e);
                  }
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
