"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { BlocoDaFicha, CampoLido, SeloDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import {
  useDadosDosNegocios,
  useEquipeDaFicha,
  useQualificacaoDoContato,
} from "@/components/contacts/ficha/dados-da-ficha";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import {
  OrigemEmCascata,
  type ValorDaOrigem,
} from "@/components/contacts/ficha/OrigemEmCascata";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { corpoDaOrigem, valorDaOrigemDoCard } from "@/components/contacts/ficha/origem-do-card";
import { Button } from "@/components/ui/button";
import {
  aplicarConsulta,
  consultaAtiva,
  type CampoConsultavel,
  type ConsultaDaTabela,
} from "@/lib/motor/consulta";
import type { CampanhaOpcao } from "@/lib/marketing/origem-opcoes";
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
import { nomeDaVenda, type Venda } from "@/lib/vendas";

const reais = (c: number) => moedaDoNumero(c / 100);
const corDoStatusDaVenda = (s: string) =>
  s === "concluida" ? "green" : s === "comprometida" ? "yellow" : s === "cancelada" ? "gray" : "blue";
const SELECT = "h-9 w-full rounded-lg border bg-background px-2 text-sm disabled:opacity-60";

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
  podeEditar,
}: {
  contactId: string;
  nomeDoContato: string;
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
  const equipe = useEquipeDaFicha();
  const [busca, setBusca] = useState("");
  const [consulta, setConsulta] = useState<ConsultaDaTabela>({});

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
  // ── Busca, filtro, agrupamento e ordem (o mesmo motor das outras tabelas) ──
  interface LinhaDoFunil {
    n: DadosDoLead;
    vendas: Venda[];
  }
  const linhas: LinhaDoFunil[] = negocios.dados.map((n) => ({
    n,
    vendas: (vendasQ.data ?? []).filter(
      (v) => v.lead_id === n.lead_id || (!v.lead_id && v.pipeline_id === n.negocio.pipeline_id),
    ),
  }));
  const SITUACOES = ["open", "won", "lost"] as const;
  const rotuloSituacao = (s: string) =>
    s === "won" ? t("Ganho") : s === "lost" ? t("Perdido") : t("Em andamento");
  const STATUS = ["interesse", "comprometida", "concluida", "cancelada"];
  const campos: Array<
    CampoConsultavel<LinhaDoFunil> & { titulo: string; opcoes?: { id: string; rotulo: string }[] }
  > = [
    { id: "funil", titulo: t("Funil"), tipo: "texto", valorDe: (l) => l.n.negocio.funil_nome ?? "" },
    {
      id: "venda",
      titulo: t("Venda"),
      tipo: "texto",
      valorDe: (l) => (l.vendas[0] ? nomeDaVenda(l.vendas[0]) : ""),
    },
    {
      id: "situacao",
      titulo: t("Situação do funil"),
      tipo: "opcao",
      valorDe: (l) => l.n.negocio.status,
      opcoes: SITUACOES.map((s) => ({ id: s, rotulo: rotuloSituacao(s) })),
      rotuloDoValor: rotuloSituacao,
      ordemDoValor: (v) => SITUACOES.indexOf(v as (typeof SITUACOES)[number]),
    },
    { id: "etapa", titulo: t("Etapa"), tipo: "texto", valorDe: (l) => l.n.negocio.etapa_nome ?? "" },
    {
      id: "status_venda",
      titulo: t("Status da venda"),
      tipo: "opcao",
      valorDe: (l) => l.vendas[0]?.status ?? "",
      opcoes: STATUS.map((s) => ({ id: s, rotulo: t(ROTULO_VENDA[s] ?? s) })),
      rotuloDoValor: (v) => t(ROTULO_VENDA[v] ?? v),
      ordemDoValor: (v) => STATUS.indexOf(v),
    },
    {
      id: "valor",
      titulo: t("Valor da venda"),
      tipo: "numero",
      valorDe: (l) => l.vendas.reduce((s, v) => s + v.amount_cents, 0) / 100,
    },
    {
      id: "responsavel",
      titulo: t("Responsável"),
      tipo: "texto",
      valorDe: (l) => l.n.sistema.responsavel ?? "",
    },
    {
      id: "previsao",
      titulo: t("Previsão de fechamento"),
      tipo: "data",
      valorDe: (l) => l.n.negocio.expected_close_date,
    },
    {
      id: "entrou",
      titulo: t("Entrou no funil"),
      tipo: "data",
      valorDe: (l) => l.n.sistema.criado_em?.slice(0, 10) ?? null,
    },
    { id: "origem", titulo: t("Origem"), tipo: "texto", valorDe: (l) => l.n.source ?? "" },
  ];
  const camposDaBarra: CampoDaBarra[] = campos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    opcoes: c.opcoes,
  }));
  const normal = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  const termo = normal(busca);
  const buscadas = termo
    ? linhas.filter((l) =>
        normal(
          `${l.n.negocio.funil_nome ?? ""} ${l.n.negocio.etapa_nome ?? ""} ${l.vendas
            .map((v) => `${nomeDaVenda(v)} ${v.product_name}`)
            .join(" ")} ${l.n.source ?? ""}`,
        ).includes(termo),
      )
    : linhas;
  const resultado = aplicarConsulta(buscadas, campos, consulta, {
    hoje: new Date().toISOString().slice(0, 10),
  });
  const grupos = resultado.grupos?.map((g) => {
    const campo = campos.find((c) => c.id === consulta.agrupar);
    const rotulo =
      g.chave === ""
        ? t("Sem valor")
        : (campo?.opcoes?.find((o) => o.id === g.chave)?.rotulo ?? g.rotulo);
    return { chave: g.chave || "__vazio", rotulo, linhas: g.linhas };
  });
  const cartao = (l: LinhaDoFunil) => (
    <CartaoDoFunil
      key={l.n.lead_id}
      n={l.n}
      contactId={contactId}
      nomeDoContato={nomeDoContato}
      podeEditar={podeEditar}
      vendas={l.vendas}
      equipe={equipe.data ?? []}
    />
  );

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">{t("Buscar")}</span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t("Buscar funil ou venda")}
            className="h-9 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <BarraDeConsulta compacta campos={camposDaBarra} consulta={consulta} aoMudar={setConsulta} />
      </div>
      {resultado.linhas.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {t("Nada combina com a busca e os filtros.")}
          {consultaAtiva(consulta) || busca ? (
            <button
              type="button"
              className="ml-2 font-medium text-primary hover:underline"
              onClick={() => {
                setBusca("");
                setConsulta({});
              }}
            >
              {t("Limpar")}
            </button>
          ) : null}
        </p>
      ) : grupos ? (
        grupos.map((g) => (
          <div key={g.chave} className="grid gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {g.rotulo} · {g.linhas.length}
            </p>
            {g.linhas.map(cartao)}
          </div>
        ))
      ) : (
        resultado.linhas.map(cartao)
      )}
    </div>
  );
}

function CartaoDoFunil({
  n,
  contactId,
  nomeDoContato,
  podeEditar,
  vendas,
  equipe,
}: {
  n: DadosDoLead;
  contactId: string;
  nomeDoContato: string;
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

  async function salvarVenda(v: DadosDaVenda): Promise<boolean> {
    try {
      const { id, contact_id: _contato, ...resto } = v;
      if (id) await apiClient.patch(`/api/v1/vendas/${id}`, resto);
      await recarregar();
      return true;
    } catch (e) {
      showApiError(e);
      return false;
    }
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

  // ── Origem deste funil (a fonte + campanha → conjunto → anúncio → página + posicionamento) ──
  const opcoesDeOrigem = useQuery({
    queryKey: ["origem-opcoes"],
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: { campanhas: CampanhaOpcao[]; posicionamentos: string[]; fontes: string[] };
        }>("/api/v1/marketing/origem-opcoes")
      ).data,
  });
  const origemDoCard: ValorDaOrigem = valorDaOrigemDoCard(n);
  const [origemEdit, setOrigemEdit] = useState<ValorDaOrigem>(origemDoCard);
  const origemMudou = JSON.stringify(origemEdit) !== JSON.stringify(origemDoCard);
  async function salvarOrigemDoCard() {
    await mudarOrigem(corpoDaOrigem(origemEdit, opcoesDeOrigem.data?.campanhas ?? []));
  }

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
      recolhivel={{
        texto: vendas[0] ? nomeDaVenda(vendas[0]) || t("Sem produto") : t("Sem venda"),
        selos: (
          <>
            <SeloDaFicha cor={status === "won" ? "green" : status === "lost" ? "red" : "blue"}>
              {n.negocio.etapa_nome ?? (status === "won" ? t("Ganho") : status === "lost" ? t("Perdido") : t("Em andamento"))}
            </SeloDaFicha>
            {vendas[0] ? (
              <SeloDaFicha cor={corDoStatusDaVenda(vendas[0].status)}>
                {t(ROTULO_VENDA[vendas[0].status] ?? vendas[0].status)}
              </SeloDaFicha>
            ) : null}
          </>
        ),
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">{selo}</div>
      {/* ── Situação ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1">
          <Label className="text-xs">{t("Etapa (diz se a venda deu certo)")}</Label>
          <select
            className={SELECT}
            disabled={!podeEditar}
            value={n.negocio.etapa_id ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (!id || id === n.negocio.etapa_id) return;
              const alvo = etapas.find((x) => x.id === id);
              if (alvo?.perdido) setPerdendo(true);
              else if (alvo?.ganho)
                void executar(
                  () => apiClient.post(`/api/v1/leads/${n.lead_id}/win`, {}),
                  t("Marcado como ganho"),
                );
              else void mover(id);
            }}
          >
            <optgroup label={t("Em andamento")}>
              {etapasAbertas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </optgroup>
            {etapas.some((e) => e.ganho) ? (
              <optgroup label={t("Deu certo")}>
                {etapas
                  .filter((e) => e.ganho)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            {etapas.some((e) => e.perdido) ? (
              <optgroup label={t("Não deu certo")}>
                {etapas
                  .filter((e) => e.perdido)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
              </optgroup>
            ) : null}
          </select>
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
        <div className="min-w-0 rounded-xl border p-3">
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
            <ul className="grid min-w-0 gap-1.5">
              {vendas.map((v) => (
                <li key={v.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setEditandoVenda(v)}
                    className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm hover:bg-secondary"
                  >
                    <span className="min-w-0 truncate" title={nomeDaVenda(v)}>
                      {nomeDaVenda(v) || t("Sem produto")}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums">{reais(v.amount_cents)}</span>
                      <SeloDaFicha cor={corDoStatusDaVenda(v.status)}>
                        {t(ROTULO_VENDA[v.status] ?? v.status)}
                      </SeloDaFicha>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Origem deste funil: o mesmo modelo do cadastro (fonte + cascata) ── */}
        <div className="rounded-xl border p-3 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              {t("Origem neste funil")}
            </p>
            {podeEditar && origemMudou ? (
              <Button size="sm" onClick={() => void salvarOrigemDoCard()}>
                {t("Salvar origem")}
              </Button>
            ) : null}
          </div>
          <OrigemEmCascata
            valor={origemEdit}
            aoMudar={setOrigemEdit}
            campanhas={opcoesDeOrigem.data?.campanhas ?? []}
            posicionamentos={opcoesDeOrigem.data?.posicionamentos ?? []}
            fontes={opcoesDeOrigem.data?.fontes ?? []}
            carregando={opcoesDeOrigem.isLoading}
            desabilitado={!podeEditar}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t(
              "Pode ser uma campanha de anúncio ou só uma fonte (extração de leads, indicação, base de clientes…): nesse caso o funil fica sem conjunto, anúncio e página.",
            )}
          </p>
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
