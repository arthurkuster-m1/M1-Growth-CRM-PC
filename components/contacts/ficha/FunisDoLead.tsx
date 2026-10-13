"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { BlocoDaFicha, CampoLido, SeloDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { useDadosDosNegocios, useQualificacaoDoContato } from "@/components/contacts/ficha/dados-da-ficha";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { LoseLeadDialog } from "@/components/kanban/LoseLeadDialog";
import type { DadosDoLead } from "@/components/leads/FichaDoLead";
import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { Plus } from "@/lib/ui/icons";
import type { Venda } from "@/lib/vendas";

const reais = (c: number) => moedaDoNumero(c / 100);
const SELECT = "h-9 w-full rounded-lg border bg-background px-2 text-sm disabled:opacity-60";
const BASE = "__base__";
const NENHUMA = "__nenhuma__";

const ROTULO_VENDA: Record<string, string> = {
  interesse: "Interesse",
  comprometida: "Comprometida",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

/**
 * A ABA FUNIS: um cartão por funil em que o lead está, com tudo o que é DA PASSAGEM e editável —
 * etapa, situação, responsável, previsão de fechamento, descrição, as vendas atreladas e a origem.
 * O que é da pessoa (nome, telefone, campos, tags…) mora no Cadastro e não se repete aqui.
 */
export function FunisDoLead({
  contactId,
  nomeDoContato,
  conjuntoDoAnuncio,
  podeEditar,
}: {
  contactId: string;
  nomeDoContato: string;
  conjuntoDoAnuncio: string | null;
  podeEditar: boolean;
}) {
  const t = useT();
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
  const equipe = useQuery({
    queryKey: ["team", "assignable"],
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: Array<{ user_id: string; name: string | null; email: string | null }> }>(
          "/api/v1/team/assignable",
        )
      ).data,
  });

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
      {negocios.dados.map((n) => (
        <CartaoDoFunil
          key={n.lead_id}
          n={n}
          contactId={contactId}
          nomeDoContato={nomeDoContato}
          conjuntoDoAnuncio={conjuntoDoAnuncio}
          podeEditar={podeEditar}
          vendas={(vendasQ.data ?? []).filter(
            (v) => v.lead_id === n.lead_id || (!v.lead_id && v.pipeline_id === n.negocio.pipeline_id),
          )}
          equipe={equipe.data ?? []}
        />
      ))}
    </div>
  );
}

function CartaoDoFunil({
  n,
  contactId,
  nomeDoContato,
  conjuntoDoAnuncio,
  podeEditar,
  vendas,
  equipe,
}: {
  n: DadosDoLead;
  contactId: string;
  nomeDoContato: string;
  conjuntoDoAnuncio: string | null;
  podeEditar: boolean;
  vendas: Venda[];
  equipe: Array<{ user_id: string; name: string | null; email: string | null }>;
}) {
  const t = useT();
  const locale = useLocaleDeData();
  const queryClient = useQueryClient();
  const [descricao, setDescricao] = useState(n.negocio.description ?? "");
  const [perdendo, setPerdendo] = useState(false);
  const [editandoVenda, setEditandoVenda] = useState<Venda | null>(null);

  const status = n.negocio.status;
  const aberto = status === "open";
  const etapas = n.negocio.etapas ?? [];
  const etapasAbertas = etapas.filter((e) => !e.ganho && !e.perdido);
  const dia = (iso: string | null | undefined, hora = false) =>
    iso ? format(new Date(iso), hora ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale }) : "—";

  async function recarregar() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ficha-do-lead", n.lead_id] }),
      queryClient.invalidateQueries({ queryKey: ["qualificacao-do-lead", contactId] }),
      queryClient.invalidateQueries({ queryKey: ["vendas-do-cliente", contactId] }),
      queryClient.invalidateQueries({ queryKey: ["clientes"] }),
      queryClient.invalidateQueries({ queryKey: ["contact", contactId] }),
    ]);
  }
  async function executar(acao: () => Promise<unknown>, ok?: string) {
    try {
      await acao();
      await recarregar();
      if (ok) toast.success(ok);
    } catch (e) {
      showApiError(e);
    }
  }
  const alterar = (patch: Record<string, unknown>, ok?: string) =>
    executar(() => apiClient.patch(`/api/v1/leads/${n.lead_id}`, patch), ok);
  const mudarOrigem = (corpo: Record<string, unknown>) =>
    executar(() => apiClient.put(`/api/v1/leads/${n.lead_id}/origem`, corpo), t("Origem atualizada"));

  const mover = (etapaId: string) =>
    executar(
      () =>
        apiClient.post(`/api/v1/leads/${n.lead_id}/move`, {
          stage_id: etapaId,
          position_in_stage: Date.now(),
          expected_updated_at: n.sistema.atualizado_em,
        }),
      t("Etapa atualizada"),
    );

  async function salvarVenda(v: DadosDaVenda) {
    await executar(async () => {
      const { id, contact_id: _contato, ...resto } = v;
      if (id) await apiClient.patch(`/api/v1/vendas/${id}`, resto);
    });
  }

  /**
   * Uma venda a mais no MESMO funil é um card a mais, na sua própria etapa: cria o card e abre a
   * venda dele para preencher.
   */
  async function novaVendaNoFunil() {
    try {
      const r = await apiClient.post<{ data: { lead_id: string; sale_id: string | null } }>(
        `/api/v1/leads/${n.lead_id}/venda-adicional`,
        {},
      );
      await recarregar();
      const vendas = (
        await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`)
      ).data.vendas;
      const nova = vendas.find((x) => x.id === r.data.sale_id);
      toast.success(t("Novo card criado neste funil. Preencha a venda."));
      if (nova) setEditandoVenda(nova);
    } catch (e) {
      showApiError(e);
    }
  }

  // ── Origem deste funil ──
  const campanha = n.campanhas.find((c) => c.id === n.campaign_id) ?? null;
  const valorDaOrigem = n.campaign_id ? n.campaign_id : n.source === "base_de_clientes" ? BASE : NENHUMA;
  const deAnuncio = campanha !== null && (campanha.criativos.length > 0 || campanha.landing_pages.length > 0);

  const selo =
    status === "won" ? (
      <SeloDaFicha cor="green">{t("Ganho")}</SeloDaFicha>
    ) : status === "lost" ? (
      <SeloDaFicha cor="red">{t("Perdido")}</SeloDaFicha>
    ) : (
      <SeloDaFicha cor="blue">{t("Em andamento")}</SeloDaFicha>
    );
  const realizadas = vendas.filter((v) => v.status === "comprometida" || v.status === "concluida");
  const soma = realizadas.reduce((s, v) => s + v.amount_cents, 0);

  return (
    <BlocoDaFicha
      cor={status === "won" ? "green" : status === "lost" ? "red" : "blue"}
      titulo={n.negocio.funil_nome ?? t("Funil")}
      acao={<div className="flex flex-wrap items-center gap-2">{selo}</div>}
    >
      {/* ── Situação ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1">
          <Label className="text-xs">{t("Etapa")}</Label>
          <select
            className={SELECT}
            disabled={!podeEditar}
            value={n.negocio.etapa_id ?? ""}
            onChange={(e) => e.target.value && void mover(e.target.value)}
          >
            {(aberto ? etapasAbertas : etapas).map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
            {aberto || etapas.some((e) => e.id === n.negocio.etapa_id) ? null : (
              <option value={n.negocio.etapa_id ?? ""}>{n.negocio.etapa_nome ?? "—"}</option>
            )}
          </select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">{t("Situação")}</Label>
          <select
            className={SELECT}
            disabled={!podeEditar || !aberto}
            value={status}
            onChange={(e) => {
              if (e.target.value === "won")
                void executar(() => apiClient.post(`/api/v1/leads/${n.lead_id}/win`, {}), t("Marcado como ganho"));
              if (e.target.value === "lost") setPerdendo(true);
            }}
          >
            <option value="open">{t("Em andamento")}</option>
            <option value="won">{t("Ganho")}</option>
            <option value="lost">{t("Perdido")}</option>
          </select>
          {!aberto ? (
            <span className="text-[11px] text-muted-foreground">
              {t("Para reabrir, mova o lead para uma etapa.")}
            </span>
          ) : null}
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">{t("Responsável")}</Label>
          <select
            className={SELECT}
            disabled={!podeEditar}
            value={n.sistema.dono_id ?? ""}
            onChange={(e) => void alterar({ owner_user_id: e.target.value || null }, t("Responsável atualizado"))}
          >
            <option value="">{n.sistema.responsavel_tipo === "agent" ? t("Agente de IA") : t("Sem responsável")}</option>
            {equipe.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.name ?? p.email ?? p.user_id}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">{t("Previsão de fechamento")}</Label>
          <CampoDeData
            valor={n.negocio.expected_close_date ?? ""}
            aoMudar={(v) => void alterar({ expected_close_date: v === "" ? null : v })}
            rotulo={t("Previsão de fechamento")}
            desabilitado={!podeEditar}
            className="w-full"
          />
        </div>
      </div>

      <div className="mt-3 grid gap-1">
        <Label className="text-xs">{t("Descrição do negócio")}</Label>
        <Textarea
          rows={2}
          value={descricao}
          disabled={!podeEditar}
          maxLength={2000}
          placeholder={t("Contexto desta negociação…")}
          onChange={(e) => setDescricao(e.target.value)}
          onBlur={() => {
            if (descricao !== (n.negocio.description ?? "")) void alterar({ description: descricao || null });
          }}
        />
      </div>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CampoLido rotulo={t("Entrou no funil")} valor={dia(n.sistema.criado_em, true)} />
        <CampoLido rotulo={t("Na etapa desde")} valor={dia(n.sistema.entrou_na_etapa_em)} />
        <CampoLido rotulo={t("Fechado em")} valor={dia(n.sistema.fechado_em)} />
        <CampoLido rotulo={t("Motivo da perda")} valor={n.sistema.motivo_da_perda} />
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* ── Vendas atreladas ── */}
        <div className="rounded-xl border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              {t("Venda deste card")}
              {realizadas.length > 0 ? ` · ${realizadas.length} · ${reais(soma)}` : ""}
            </p>
            {podeEditar ? (
              <button
                type="button"
                onClick={() => void novaVendaNoFunil()}
                title={t("Cria um novo card neste funil, com a própria etapa")}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2 text-[11px] font-medium text-primary-foreground"
              >
                <Plus size={11} weight="bold" aria-hidden />
                {t("Nova venda neste funil")}
              </button>
            ) : null}
          </div>
          {vendas.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Nenhuma venda atrelada a este funil.")}</p>
          ) : (
            <ul className="grid gap-1.5">
              {vendas.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setEditandoVenda(v)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm hover:bg-secondary"
                  >
                    <span className="min-w-0 truncate">{v.product_name || t("Sem produto")}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums">{reais(v.amount_cents)}</span>
                      <SeloDaFicha
                        cor={
                          v.status === "concluida"
                            ? "green"
                            : v.status === "comprometida"
                              ? "yellow"
                              : v.status === "cancelada"
                                ? "gray"
                                : "blue"
                        }
                      >
                        {t(ROTULO_VENDA[v.status] ?? v.status)}
                      </SeloDaFicha>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Origem deste funil ── */}
        <div className="rounded-xl border p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
            {t("Origem neste funil")}
          </p>
          <div className="grid gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">{t("Campanha")}</Label>
              <select
                className={SELECT}
                disabled={!podeEditar}
                value={valorDaOrigem}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === BASE) void mudarOrigem({ campaign_id: null, source: "base_de_clientes" });
                  else if (v === NENHUMA) void mudarOrigem({ campaign_id: null });
                  else void mudarOrigem({ campaign_id: v });
                }}
              >
                <option value={NENHUMA}>{t("Sem campanha")}</option>
                <option value={BASE}>{t("Base de clientes (funil padrão)")}</option>
                {n.campanhas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            {valorDaOrigem === BASE ? (
              <p className="text-xs text-muted-foreground">
                {t("Cliente que já comprou: o funil nasce da base, sem página, criativo nem conjunto de anúncios.")}
              </p>
            ) : null}
            {campanha && deAnuncio ? (
              <>
                <div className="grid gap-1">
                  <Label className="text-xs">{t("Criativo")}</Label>
                  <select
                    className={SELECT}
                    disabled={!podeEditar}
                    value={n.creative_id ?? ""}
                    onChange={(e) => void mudarOrigem({ creative_id: e.target.value || null })}
                  >
                    <option value="">{t("Sem criativo")}</option>
                    {campanha.criativos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">{t("Landing page")}</Label>
                  <select
                    className={SELECT}
                    disabled={!podeEditar}
                    value={n.landing_page_id ?? ""}
                    onChange={(e) => void mudarOrigem({ landing_page_id: e.target.value || null })}
                  >
                    <option value="">{t("Sem landing page")}</option>
                    {campanha.landing_pages.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <dl>
                  <CampoLido rotulo={t("Conjunto (anúncio de entrada)")} valor={conjuntoDoAnuncio} />
                </dl>
              </>
            ) : campanha ? (
              <p className="text-xs text-muted-foreground">
                {t("Campanha sem criativo nem página: disparo ou prospecção, sem conjunto de anúncios.")}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {perdendo ? (
        <LoseLeadDialog
          open
          leadId={n.lead_id}
          pipelineId={n.negocio.pipeline_id}
          onOpenChange={(aberta) => {
            if (aberta) return;
            setPerdendo(false);
            void recarregar();
          }}
        />
      ) : null}

      {editandoVenda ? (
        <DialogoDaVenda
          key={editandoVenda.id}
          venda={editandoVenda}
          contatoInicial={{ contact_id: contactId, nome: nomeDoContato }}
          clientes={[]}
          aoFechar={() => setEditandoVenda(null)}
          aoSalvar={salvarVenda}
          aoApagar={async () => {
            await executar(() => apiClient.delete(`/api/v1/vendas/${editandoVenda.id}`));
          }}
        />
      ) : null}
    </BlocoDaFicha>
  );
}
