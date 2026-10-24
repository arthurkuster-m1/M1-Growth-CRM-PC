"use client";

import { NumeroQueCabe } from "@/components/ui/NumeroQueCabe";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { BlocoDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { useEquipeDaFicha } from "@/components/contacts/ficha/dados-da-ficha";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { VendaDoCard } from "@/components/kanban/VendaDoCard";
import { chaveDaFicha, type DadosDoLead } from "@/components/leads/FichaDoLead";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import type { Lead } from "@/lib/types/leads";
import { Plus } from "@/lib/ui/icons";
import { nomeDaVenda, type StatusDaParcela, type Venda } from "@/lib/vendas";

const reais = (c: number) => moedaDoNumero(c / 100);
const dia = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";

const ROTULO_DA_SITUACAO: Record<string, string> = {
  open: "Em andamento",
  won: "Comprou",
  lost: "Não comprou",
};
const COR_DA_SITUACAO: Record<string, CorDaOpcao> = { open: "blue", won: "green", lost: "gray" };

function dinheiroDa(v: Venda) {
  const vivas = (v.parcelas ?? []).filter((p) => p.status !== ("cancelada" as StatusDaParcela));
  const pago = vivas.filter((p) => p.status === "recebida").reduce((s, p) => s + p.amount_cents, 0);
  const aReceber = vivas
    .filter((p) => p.status === "prevista")
    .reduce((s, p) => s + p.amount_cents, 0);
  return { pago, aReceber };
}

/**
 * A aba OPORTUNIDADES da ficha: todas as oportunidades desta pessoa (de qualquer funil e campanha),
 * em lista, com o que importa de cada uma. Clicar abre o card dela (o mesmo popup do quadro), onde
 * se edita etapa, produtos, valor, parcelas, origem e responsável.
 */
export function OportunidadesDoLead({
  contactId,
  podeEditar,
}: {
  contactId: string;
  podeEditar: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const equipe = useEquipeDaFicha();
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState("");

  const consulta = useQuery({
    queryKey: ["vendas-do-cliente", contactId],
    retry: false,
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`))
        .data.vendas,
  });
  const lista = consulta.data ?? [];

  const nomeDoResponsavel = (id: string | null | undefined) =>
    (equipe.data ?? []).find((m) => m.user_id === id)?.name?.trim() || "—";

  const termo = busca
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  const visiveis = termo
    ? lista.filter((v) =>
        `${nomeDaVenda(v)} ${v.funil ?? ""} ${v.etapa ?? ""} ${v.campanha ?? ""} ${v.anuncio ?? ""} ${v.lp ?? ""}`
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .includes(termo),
      )
    : lista;

  async function nova() {
    const base = lista[0];
    if (!base) return;
    setCriando(true);
    try {
      const r = await apiClient.post<{ data: { lead_id: string } }>(
        `/api/v1/leads/${base.id}/venda-adicional`,
        {},
      );
      await queryClient.invalidateQueries({ queryKey: ["vendas-do-cliente", contactId] });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setAbertaId(r.data.lead_id);
    } catch (e) {
      showApiError(e);
    } finally {
      setCriando(false);
    }
  }

  if (consulta.isError) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {t("Você não tem permissão para ver as oportunidades deste cliente.")}
      </p>
    );
  }

  return (
    <BlocoDaFicha
      titulo={t("Oportunidades")}
      cor="purple"
      acao={
        podeEditar && lista.length > 0 ? (
          <button
            type="button"
            disabled={criando}
            onClick={() => void nova()}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            <Plus size={12} weight="bold" aria-hidden />
            {t("Nova oportunidade")}
          </button>
        ) : null
      }
    >
      {consulta.isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-secondary" />
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("Este lead ainda não tem nenhuma oportunidade.")}
        </p>
      ) : (
        <div className="grid gap-3">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t("Buscar oportunidade, funil, etapa ou campanha")}
            className="h-9 w-full rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
          {/* Celular: cada oportunidade é um cartão, com tudo à vista e sem rolar para o lado. */}
          <ul className="grid gap-3 md:hidden">
            {visiveis.map((v) => {
              const { pago, aReceber } = dinheiroDa(v);
              const situacao = v.lead_status ?? "open";
              const origem = [v.anuncio, v.lp].filter(Boolean).join(" · ");
              const linhas: Array<[string, string]> = [
                [t("Funil › Etapa"), `${v.funil ?? "—"}${v.etapa ? ` › ${v.etapa}` : ""}`],
                [t("Campanha"), v.campanha ?? "—"],
                [t("Origem"), origem || "—"],
                [t("Responsável"), nomeDoResponsavel(v.responsavel_id) || "—"],
                [t("Previsão"), dia(v.expected_close_date) || "—"],
                [t("Criada em"), dia(v.created_at) || "—"],
              ];
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setAbertaId(v.id)}
                    className="grid w-full min-w-0 gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p className="min-w-0 text-sm font-semibold break-words">
                        {nomeDaVenda(v) || t("Sem produto")}
                      </p>
                      <Etiqueta ponto cor={COR_DA_SITUACAO[situacao] ?? "gray"}>
                        {t(ROTULO_DA_SITUACAO[situacao] ?? situacao)}
                      </Etiqueta>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          [t("Valor"), reais(v.amount_cents), ""],
                          [t("Pago"), reais(pago), "text-green-700 dark:text-green-400"],
                          [t("A receber"), reais(aReceber), ""],
                        ] as const
                      ).map(([rotulo, valor, cor]) => (
                        <div key={rotulo} className="min-w-0 rounded-xl bg-secondary/60 px-2.5 py-2">
                          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            {rotulo}
                          </p>
                          <p className={`text-sm font-semibold tabular-nums ${cor}`}>
                            <NumeroQueCabe>{valor}</NumeroQueCabe>
                          </p>
                        </div>
                      ))}
                    </div>
                    <dl className="grid gap-1 text-xs">
                      {linhas.map(([rotulo, valor]) => (
                        <div key={rotulo} className="flex justify-between gap-3">
                          <dt className="shrink-0 text-muted-foreground">{rotulo}</dt>
                          <dd className="min-w-0 text-right break-words">{valor}</dd>
                        </div>
                      ))}
                    </dl>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="hidden max-w-full overflow-x-auto rounded-xl border md:block">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("Oportunidade")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Situação")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Funil › Etapa")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Campanha")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Origem")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Valor")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Pago")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("A receber")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Responsável")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Previsão")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Criada em")}</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((v) => {
                  const { pago, aReceber } = dinheiroDa(v);
                  const situacao = v.lead_status ?? "open";
                  const origem = [v.anuncio, v.lp].filter(Boolean).join(" · ");
                  return (
                    <tr
                      key={v.id}
                      className="cursor-pointer border-t align-top hover:bg-secondary/40"
                      onClick={() => setAbertaId(v.id)}
                    >
                      <td className="max-w-[16rem] px-3 py-2">
                        <button
                          type="button"
                          className="block max-w-full truncate text-left font-medium hover:underline"
                          title={nomeDaVenda(v)}
                        >
                          {nomeDaVenda(v) || t("Sem produto")}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <Etiqueta ponto cor={COR_DA_SITUACAO[situacao] ?? "gray"}>
                          {t(ROTULO_DA_SITUACAO[situacao] ?? situacao)}
                        </Etiqueta>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {v.funil ?? "—"}
                        {v.etapa ? ` › ${v.etapa}` : ""}
                      </td>
                      <td className="px-3 py-2">{v.campanha ?? "—"}</td>
                      <td className="px-3 py-2">{origem || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{reais(v.amount_cents)}</td>
                      <td className="px-3 py-2 text-right text-green-700 tabular-nums dark:text-green-400">
                        {reais(pago)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{reais(aReceber)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {nomeDoResponsavel(v.responsavel_id)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{dia(v.expected_close_date)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{dia(v.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abertaId ? (
        <CardDaOportunidade leadId={abertaId} aoFechar={() => setAbertaId(null)} />
      ) : null}
    </BlocoDaFicha>
  );
}

/** Abre o card da oportunidade (o popup do quadro), com as etapas do funil dela. */
export function CardDaOportunidade({ leadId, aoFechar }: { leadId: string; aoFechar: () => void }) {
  const dados = useQuery({
    queryKey: chaveDaFicha(leadId),
    staleTime: 5_000,
    queryFn: async () =>
      (await apiClient.get<{ data: DadosDoLead }>(`/api/v1/leads/${leadId}/origem`)).data,
  });
  const d = dados.data;
  if (!d || !d.contact_id) return null;
  const lead = {
    id: d.lead_id,
    organization_id: "",
    pipeline_id: d.negocio.pipeline_id,
    stage_id: d.negocio.etapa_id ?? "",
    contact_id: d.contact_id,
    title: d.negocio.title,
    description: d.negocio.description,
    status: d.negocio.status,
    value_cents: d.negocio.value_cents,
    currency: d.negocio.currency,
    updated_at: d.sistema.atualizado_em,
    created_at: d.sistema.criado_em,
  } as unknown as Lead;
  const etapas = (d.negocio.etapas ?? []).map((e) => ({
    id: e.id,
    name: e.nome,
    is_won: e.ganho,
    is_lost: e.perdido,
  }));
  return (
    <VendaDoCard lead={lead} etapas={etapas} aoFechar={aoFechar} semVenda={() => null} />
  );
}
