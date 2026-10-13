"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { Plus } from "@/lib/ui/icons";
import { nomeDaVenda, type Venda } from "@/lib/vendas";

const reais = (c: number) => moedaDoNumero(c / 100);
const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

/**
 * AS VENDAS DO CLIENTE, na ficha e no dossiê do lead, em duas listas: o INTERESSE de compra
 * (potencial, ainda sem compromisso) e as VENDAS realizadas (comprometidas e recebidas), com o LTV
 * atual e o previsto. Só a equipe do CRM (agent+) vê dinheiro: para os demais, não aparece.
 */
export function VendasDoCliente({
  contactId,
  nome,
  semTitulo = false,
}: {
  contactId: string;
  nome?: string;
  semTitulo?: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Venda | "nova" | null>(null);
  const consulta = useQuery({
    queryKey: ["vendas-do-cliente", contactId],
    retry: false,
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`))
        .data.vendas,
  });
  if (consulta.isError) return null; // sem permissão para ver vendas
  const vendas = consulta.data ?? [];
  const interesse = vendas.filter((v) => v.status === "interesse");
  const realizadas = vendas.filter((v) => v.status === "comprometida" || v.status === "concluida");
  const ltv = realizadas.reduce((s, v) => {
    const p = v.parcelas ?? [];
    if (p.length === 0) return s + (v.status === "concluida" ? v.amount_cents : 0);
    return s + p.filter((x) => x.status === "recebida").reduce((a, x) => a + x.amount_cents, 0);
  }, 0);
  const previsto = realizadas.reduce((s, v) => {
    const p = v.parcelas ?? [];
    if (p.length === 0) return s + (v.status === "comprometida" ? v.amount_cents : 0);
    return s + p.filter((x) => x.status === "prevista").reduce((a, x) => a + x.amount_cents, 0);
  }, 0);

  async function atualizar() {
    await queryClient.invalidateQueries({ queryKey: ["vendas-do-cliente", contactId] });
    await queryClient.invalidateQueries({ queryKey: ["vendas"] });
    await queryClient.invalidateQueries({ queryKey: ["clientes"] });
  }

  async function salvar(v: DadosDaVenda): Promise<boolean> {
    try {
      const { id, contact_id, ...resto } = v;
      if (id) await apiClient.patch(`/api/v1/vendas/${id}`, resto);
      else await apiClient.post("/api/v1/vendas", { contact_id, currency: "BRL", ...resto });
      await atualizar();
      return true;
    } catch (e) {
      showApiError(e);
      return false;
    }
  }

  const linha = (v: Venda) => {
    const parcelas = (v.parcelas ?? []).filter((p) => p.status !== "cancelada");
    const pagas = parcelas.filter((p) => p.status === "recebida").length;
    return (
      <li key={v.id}>
        <button
          type="button"
          onClick={() => setEditando(v)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 text-left hover:bg-secondary/50"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {nomeDaVenda(v) || t("Venda")}
              {v.needs_details ? ` · ${t("detalhar")}` : ""}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {v.status === "interesse"
                ? t("Interesse de compra")
                : parcelas.length > 0
                  ? `${pagas}/${parcelas.length} ${t("parcelas recebidas")}${
                      v.expected_on ? ` · ${t("próxima")} ${dataBr(v.expected_on)}` : ""
                    }`
                  : v.status === "concluida"
                    ? `${t("Recebida")} ${dataBr(v.paid_on)}`
                    : t("Comprometida")}
              {v.campanha ? ` · ${v.campanha}` : ""}
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {reais(v.amount_cents)}
          </span>
        </button>
      </li>
    );
  };

  return (
    <section className={semTitulo ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-3 py-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {semTitulo ? (
          <span />
        ) : (
          <h3 className="text-xs font-medium tracking-wide text-text-muted uppercase">
            {t("Vendas")}
          </h3>
        )}
        <button
          type="button"
          onClick={() => setEditando("nova")}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-secondary"
        >
          <Plus size={12} weight="bold" aria-hidden />
          {t("Nova venda")}
        </button>
      </div>

      {realizadas.length > 0 || interesse.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary/50 p-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t("LTV atual")}</p>
            <p className="font-semibold tabular-nums">{reais(ltv)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("LTV previsto")}</p>
            <p className="font-semibold tabular-nums">{reais(ltv + previsto)}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-1.5">
        <p className="text-xs font-semibold text-muted-foreground">
          {t("Vendas realizadas")} ({realizadas.length})
        </p>
        {realizadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Nenhuma venda realizada ainda.")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5">{realizadas.map(linha)}</ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        <p className="text-xs font-semibold text-muted-foreground">
          {t("Interesse de compra")} ({interesse.length})
        </p>
        {interesse.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Nenhum interesse registrado.")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5">{interesse.map(linha)}</ul>
        )}
      </div>

      {editando ? (
        <DialogoDaVenda
          key={editando === "nova" ? "nova" : editando.id}
          venda={editando === "nova" ? null : editando}
          contatoInicial={{ contact_id: contactId, nome: nome ?? "" }}
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
    </section>
  );
}
