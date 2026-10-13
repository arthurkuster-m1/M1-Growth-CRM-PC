"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { BlocoDaFicha, SeloDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
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
  const recebido = (v: Venda) => {
    const p = v.parcelas ?? [];
    if (p.length === 0) return v.status === "concluida" ? v.amount_cents : 0;
    return p.filter((x) => x.status === "recebida").reduce((a, x) => a + x.amount_cents, 0);
  };
  const aReceber = (v: Venda) => {
    const p = v.parcelas ?? [];
    if (p.length === 0) return v.status === "comprometida" ? v.amount_cents : 0;
    return p.filter((x) => x.status === "prevista").reduce((a, x) => a + x.amount_cents, 0);
  };
  const ltv = realizadas.reduce((s, v) => s + recebido(v), 0);
  const previsto = realizadas.reduce((s, v) => s + aReceber(v), 0);
  const totalVendido = realizadas.reduce((s, v) => s + v.amount_cents, 0);
  const ticket = realizadas.length > 0 ? Math.round(totalVendido / realizadas.length) : 0;

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
        {consulta.isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-secondary" />
        ) : vendas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Nenhuma venda ou interesse cadastrado.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("Produto")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Funil")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Valor")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Status")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Compromisso")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Pago em")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Pagamento")}</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id} className="border-t hover:bg-secondary/40">
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
                    <td className="px-3 py-2 tabular-nums">{dataBr(v.expected_on)}</td>
                    <td className="px-3 py-2 tabular-nums">{dataBr(v.paid_on)}</td>
                    <td className="px-3 py-2">
                      {v.payment_method ? v.payment_method : "—"}
                      {v.installments > 1 ? ` · ${v.installments}x` : ""}
                    </td>
                  </tr>
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
