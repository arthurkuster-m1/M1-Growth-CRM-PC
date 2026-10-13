"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";

import { BlocoDaFicha, CampoLido, SeloDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { useDadosDosNegocios, useQualificacaoDoContato } from "@/components/contacts/ficha/dados-da-ficha";
import { OrigemEditavel } from "@/components/leads/FichaDoLead";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import type { Venda } from "@/lib/vendas";

const reais = (c: number) => moedaDoNumero(c / 100);

/**
 * A ABA FUNIS: um cartão por funil em que o lead está. Só o que é DA PASSAGEM por aquele funil —
 * situação, datas, vendas atreladas e a origem (campanha, criativo, conjunto, página). O que é da
 * pessoa (nome, telefone, campos, tags…) está no Cadastro e não se repete aqui.
 */
export function FunisDoLead({
  contactId,
  conjuntoDoAnuncio,
  podeEditar,
}: {
  contactId: string;
  conjuntoDoAnuncio: string | null;
  podeEditar: boolean;
}) {
  const t = useT();
  const locale = useLocaleDeData();
  const qual = useQualificacaoDoContato(contactId);
  const negocios = useDadosDosNegocios((qual.data?.funis ?? []).map((f) => f.lead_id));
  const vendasQ = useQuery({
    queryKey: ["vendas-do-cliente", contactId],
    retry: false,
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`)).data
        .vendas,
  });
  const vendas = vendasQ.data ?? [];
  const dia = (iso: string | null | undefined, hora = false) =>
    iso ? format(new Date(iso), hora ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale }) : "—";

  if (qual.isLoading || negocios.carregando) {
    return <div className="h-24 animate-pulse rounded-2xl bg-secondary" />;
  }
  if (negocios.dados.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
        {t("Este lead ainda não está em nenhum funil.")}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {negocios.dados.map((n) => {
        const status = n.negocio.status;
        const selo =
          status === "won" ? (
            <SeloDaFicha cor="green">{t("Ganho")}</SeloDaFicha>
          ) : status === "lost" ? (
            <SeloDaFicha cor="red">{t("Perdido")}</SeloDaFicha>
          ) : (
            <SeloDaFicha cor="blue">{t("Em andamento")}</SeloDaFicha>
          );
        const dele = vendas.filter(
          (v) => v.lead_id === n.lead_id || (!v.lead_id && v.pipeline_id === n.negocio.pipeline_id),
        );
        const realizadas = dele.filter((v) => v.status === "comprometida" || v.status === "concluida");
        const soma = realizadas.reduce((s, v) => s + v.amount_cents, 0);
        return (
          <BlocoDaFicha
            key={n.lead_id}
            cor={status === "won" ? "green" : status === "lost" ? "red" : "blue"}
            titulo={n.negocio.funil_nome ?? t("Funil")}
            acao={
              <div className="flex flex-wrap items-center gap-2">
                {n.negocio.etapa_nome ? (
                  <SeloDaFicha cor="purple">{n.negocio.etapa_nome}</SeloDaFicha>
                ) : null}
                {selo}
                <Link
                  href={`/app/pipelines/${n.negocio.pipeline_id}?lead=${n.lead_id}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("Abrir no funil")}
                </Link>
              </div>
            }
          >
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CampoLido rotulo={t("Entrou no funil")} valor={dia(n.sistema.criado_em, true)} />
              <CampoLido rotulo={t("Na etapa desde")} valor={dia(n.sistema.entrou_na_etapa_em)} />
              <CampoLido rotulo={t("Fechado em")} valor={dia(n.sistema.fechado_em)} />
              <CampoLido rotulo={t("Motivo da perda")} valor={n.sistema.motivo_da_perda} />
            </dl>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                  {t("Vendas deste funil")}
                </p>
                {dele.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("Nenhuma venda atrelada.")}</p>
                ) : (
                  <>
                    <p className="text-sm">
                      <span className="font-semibold tabular-nums">{realizadas.length}</span>{" "}
                      {t("vendas")} · <span className="font-semibold tabular-nums">{reais(soma)}</span>
                    </p>
                    <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
                      {dele.map((v) => (
                        <li key={v.id}>
                          {v.product_name || t("Sem produto")} · {reais(v.amount_cents)} ·{" "}
                          {t(
                            v.status === "interesse"
                              ? "Interesse"
                              : v.status === "comprometida"
                                ? "Comprometida"
                                : v.status === "concluida"
                                  ? "Concluída"
                                  : "Cancelada",
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <div className="rounded-xl border p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                  {t("Origem neste funil")}
                </p>
                {podeEditar ? (
                  <OrigemEditavel leadId={n.lead_id} dados={n} />
                ) : (
                  <dl className="grid gap-2">
                    <CampoLido
                      rotulo={t("Campanha")}
                      valor={n.campanhas.find((c) => c.id === n.campaign_id)?.nome ?? null}
                    />
                  </dl>
                )}
                <dl className="mt-3">
                  <CampoLido rotulo={t("Conjunto (anúncio de entrada)")} valor={conjuntoDoAnuncio} />
                </dl>
              </div>
            </div>
          </BlocoDaFicha>
        );
      })}
    </div>
  );
}
