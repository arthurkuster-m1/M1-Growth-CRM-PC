"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { CelulaDeCaixa } from "@/components/motor/CelulaDeCaixa";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";
import { TabelaDoMotor, type ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import {
  DialogoDaVenda,
  type ClienteOpcao,
  type DadosDaVenda,
} from "@/components/vendas/DialogoDaVenda";
import { useT } from "@/hooks/i18n/useT";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import { apiClient } from "@/lib/api/client";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import {
  aplicarConsulta,
  type CampoConsultavel,
  type ConsultaDaTabela,
} from "@/lib/motor/consulta";
import { moverColuna, resolverColunas } from "@/lib/motor/layout";
import { somarMeses } from "@/lib/marketing/campanhas-resumo";
import { precisaDeConfirmacao } from "@/lib/vendas-recorrentes";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { ArrowRight, Plus, TextAa } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import {
  STATUS_DA_VENDA,
  fluxoDoMes,
  totaisDeVendas,
  type StatusDaVenda,
  type Venda,
} from "@/lib/vendas";

const COR: Record<StatusDaVenda, CorDaOpcao> = {
  interesse: "purple",
  comprometida: "orange",
  concluida: "green",
  cancelada: "gray",
};

const reais = (centavos: number) => moedaDoNumero(centavos / 100);
const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

function rotuloDoStatusDaVenda(t: (s: string) => string, s: StatusDaVenda): string {
  switch (s) {
    case "interesse":
      return t("Interesse");
    case "comprometida":
      return t("Comprometida");
    case "concluida":
      return t("Concluída");
    case "cancelada":
      return t("Cancelada");
  }
}

/**
 * VENDAS: o banco de todas as transações dos clientes. Cada venda pertence a um cliente (lead),
 * e os totais (primeira compra, LTV atual e previsto) refletem no cadastro dele; a origem da
 * venda (campanha, LP, criativo) é a do último cadastro do cliente até a data dela.
 */
export function VendasCRM() {
  const t = useT();
  const queryClient = useQueryClient();
  const padrao = useVisualizacao("vendas");
  const preferencias = padrao.preferencias;
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusDaVenda | null>(null);
  const [editando, setEditando] = useState<Venda | "nova" | null>(null);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));

  const consulta = useQuery({
    queryKey: ["vendas"],
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>("/api/v1/vendas")).data.vendas,
    staleTime: 10_000,
  });
  const clientes = useQuery({
    queryKey: ["vendas-clientes"],
    enabled: editando === "nova",
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { clientes: ClienteOpcao[] } }>("/api/v1/clientes?funil=todos")
      ).data.clientes.map((c) => ({
        contact_id: c.contact_id,
        nome: c.nome,
        telefone: c.telefone,
      })),
  });

  const recarregar = () => queryClient.invalidateQueries({ queryKey: ["vendas"] });
  const salvar = useMutation({
    mutationFn: async (v: DadosDaVenda) => {
      const { id, contact_id, ...resto } = v;
      return id
        ? apiClient.patch(`/api/v1/vendas/${id}`, resto)
        : apiClient.post("/api/v1/vendas", { contact_id, currency: "BRL", ...resto });
    },
    onSuccess: recarregar,
    onError: showApiError,
  });
  const apagar = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/vendas/${id}`),
    onSuccess: recarregar,
    onError: showApiError,
  });
  const mudarStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusDaVenda }) =>
      apiClient.patch(`/api/v1/vendas/${id}`, { status }),
    onSuccess: recarregar,
    onError: showApiError,
  });
  const mudarRecorrente = useMutation({
    mutationFn: ({ id, is_recurring }: { id: string; is_recurring: boolean }) =>
      apiClient.patch(`/api/v1/vendas/${id}`, { is_recurring }),
    onSuccess: recarregar,
    onError: showApiError,
  });

  const vendas = useMemo(() => consulta.data ?? [], [consulta.data]);
  const confirmar = useMutation({
    mutationFn: ({ id, ...corpo }: { id: string } & Record<string, unknown>) =>
      apiClient.patch(`/api/v1/vendas/parcelas/${id}`, corpo),
    onSuccess: async () => {
      await recarregar();
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: showApiError,
  });
  const [hojeIso] = useState(() => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10));
  const cobrancas = vendas
    .filter((v) => v.status === "comprometida" || v.status === "concluida")
    .flatMap((v) =>
      (v.parcelas ?? [])
        .filter((p) => p.status === "prevista" && precisaDeConfirmacao(p.due_on, hojeIso))
        .map((p) => ({ venda: v, parcela: p })),
    )
    .sort((a, b) => a.parcela.due_on.localeCompare(b.parcela.due_on));
  const termo = busca.trim().toLowerCase();
  const filtradas = useMemo(
    () =>
      vendas.filter(
        (v) =>
          (filtroStatus === null || v.status === filtroStatus) &&
          (termo === "" ||
            `${v.cliente?.nome ?? ""} ${v.product_name} ${v.reference} ${v.campanha ?? ""}`
              .toLowerCase()
              .includes(termo)),
      ),
    [vendas, filtroStatus, termo],
  );
  const totais = totaisDeVendas(filtradas);

  const opcoesDeStatus = STATUS_DA_VENDA.map((s) => ({
    id: s,
    rotulo: rotuloDoStatusDaVenda(t, s),
    cor: COR[s],
  }));

  const colunas: ColunaDoMotor<Venda>[] = [
    {
      id: "cliente",
      titulo: t("Cliente"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 240,
      semOcultar: true,
      celula: (v) => (
        <button
          type="button"
          onClick={() => setEditando(v)}
          className="block w-full truncate px-2 text-left text-sm font-medium hover:underline"
        >
          {v.cliente?.nome ?? "—"}
        </button>
      ),
    },
    {
      id: "produto",
      titulo: t("Produto"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 220,
      celula: (v) => <span className="block truncate px-2 text-sm">{v.product_name || "—"}</span>,
    },
    {
      id: "valor",
      titulo: t("Valor"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      celula: (v) => (
        <span className="block px-2 text-sm font-medium tabular-nums">{reais(v.amount_cents)}</span>
      ),
    },
    {
      id: "status",
      titulo: t("Situação"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 160,
      celula: (v) => (
        <SeletorDeOpcao
          opcoes={opcoesDeStatus}
          valorId={v.status}
          podeEditar
          rotulo={t("Situação da venda")}
          aoEscolher={(id) => mudarStatus.mutate({ id: v.id, status: id as StatusDaVenda })}
        >
          <Etiqueta ponto cor={COR[v.status]}>
            {rotuloDoStatusDaVenda(t, v.status)}
            {v.needs_details ? ` · ${t("detalhar")}` : ""}
          </Etiqueta>
        </SeletorDeOpcao>
      ),
    },
    {
      id: "prevista",
      titulo: t("Previsão"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 130,
      celula: (v) => (
        <span className="block px-2 text-sm tabular-nums">{dataBr(v.expected_on)}</span>
      ),
    },
    {
      id: "recebida",
      titulo: t("Recebida em"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 130,
      celula: (v) => <span className="block px-2 text-sm tabular-nums">{dataBr(v.paid_on)}</span>,
    },
    {
      id: "recorrente",
      titulo: t("Recorrente"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 120,
      celula: (v) => (
        <CelulaDeCaixa
          marcada={v.is_recurring}
          podeEditar
          rotulo={t("Venda recorrente")}
          aoMudar={(m) => mudarRecorrente.mutate({ id: v.id, is_recurring: m })}
        />
      ),
    },
    {
      id: "referencia",
      titulo: t("Referência"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 180,
      padrao: false,
      celula: (v) => <span className="block truncate px-2 text-sm">{v.reference || "—"}</span>,
    },
    {
      id: "campanha",
      titulo: t("Campanha"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 220,
      celula: (v) => <span className="block truncate px-2 text-sm">{v.campanha ?? "—"}</span>,
    },
    {
      id: "funil",
      titulo: t("Funil"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 200,
      padrao: false,
      celula: (v) => <span className="block truncate px-2 text-sm">{v.funil ?? "—"}</span>,
    },
    {
      id: "criada",
      titulo: t("Registrada em"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      padrao: false,
      celula: (v) => (
        <span className="block px-2 text-sm tabular-nums">{dataBr(v.created_at.slice(0, 10))}</span>
      ),
    },
  ];
  const resolvidas = resolverColunas(colunas, preferencias);
  const mostradas = resolvidas.filter((c) => c.visivel);

  const campos: Array<
    CampoConsultavel<Venda> & {
      titulo: string;
      opcoes?: { id: string; rotulo: string; cor?: CorDaOpcao }[];
    }
  > = [
    { id: "cliente", titulo: t("Cliente"), tipo: "texto", valorDe: (v) => v.cliente?.nome ?? "" },
    { id: "produto", titulo: t("Produto"), tipo: "texto", valorDe: (v) => v.product_name },
    { id: "valor", titulo: t("Valor"), tipo: "numero", valorDe: (v) => v.amount_cents / 100 },
    {
      id: "status",
      titulo: t("Situação"),
      tipo: "opcao",
      valorDe: (v) => v.status,
      opcoes: opcoesDeStatus,
    },
    { id: "prevista", titulo: t("Previsão"), tipo: "data", valorDe: (v) => v.expected_on },
    { id: "recebida", titulo: t("Recebida em"), tipo: "data", valorDe: (v) => v.paid_on },
    { id: "recorrente", titulo: t("Recorrente"), tipo: "caixa", valorDe: (v) => v.is_recurring },
    { id: "campanha", titulo: t("Campanha"), tipo: "texto", valorDe: (v) => v.campanha ?? "" },
  ];
  const camposDaBarra: CampoDaBarra[] = campos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    ...(c.opcoes ? { opcoes: c.opcoes } : {}),
  }));
  const resultado = useMemo(
    () =>
      aplicarConsulta(filtradas, campos, preferencias, {
        hoje: new Date().toISOString().slice(0, 10),
      }),
    // `campos` é recriado a cada render; as entradas reais são estas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtradas, preferencias],
  );
  const grupos = resultado.grupos?.map((g) => {
    const campo = campos.find((c) => c.id === preferencias.agrupar);
    const rotulo =
      g.chave === ""
        ? t("Sem valor")
        : (campo?.opcoes?.find((o) => o.id === g.chave)?.rotulo ?? g.rotulo);
    return { chave: g.chave || "__vazio", titulo: <strong>{rotulo}</strong>, linhas: g.linhas };
  });
  function mudarConsulta(c: ConsultaDaTabela) {
    padrao.atualizar((p) => ({
      ...p,
      filtros: c.filtros?.length ? c.filtros : undefined,
      ordenacao: c.ordenacao?.length ? c.ordenacao : undefined,
      agrupar: c.agrupar,
      agruparPor: c.agrupar && c.agruparPor !== "dia" ? c.agruparPor : undefined,
    }));
  }

  const fluxo = fluxoDoMes(vendas, mes);
  const detalhar = vendas.filter((v) => v.needs_details).length;
  const numeros: Array<[string, string]> = [
    [t("Recebido no mês"), reais(fluxo.recebido)],
    [t("A receber no mês"), reais(fluxo.aReceber)],
    [t("Em interesse"), reais(totais.interesse)],
    [t("Vendas fechadas"), String(totais.vendasConcluidas)],
    [t("Ticket médio"), totais.ticketMedio === null ? "—" : reais(totais.ticketMedio)],
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Vendas")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Cada recebimento e compromisso dos clientes, ligado ao lead e à campanha de origem.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/clientes"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium hover:bg-secondary"
          >
            <ArrowRight size={14} className="rotate-180" aria-hidden />
            {t("Clientes")}
          </Link>
          <button
            type="button"
            onClick={() => setEditando("nova")}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Nova venda")}
          </button>
        </div>
      </header>

      {detalhar > 0 ? (
        <p
          role="status"
          className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-warning-fg"
        >
          {detalhar}{" "}
          {t(
            "venda(s) de lead ganho ainda precisam dos produtos, do valor real e das parcelas. Abra a venda e finalize.",
          )}
        </p>
      ) : null}

      {cobrancas.length > 0 ? (
        <section
          aria-label={t("Cobranças para confirmar")}
          className="grid gap-2 rounded-2xl border border-warning/40 bg-warning-bg/40 p-4"
        >
          <h2 className="text-sm font-semibold">
            {t("Cobranças para confirmar")} ({cobrancas.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            {t(
              "Venceu ou vence até amanhã. Confirme se o lead pagou e se o valor mudou — nada é dado como pago sozinho.",
            )}
          </p>
          <ul className="grid gap-2">
            {cobrancas.map(({ venda, parcela }) => (
              <CobrancaParaConfirmar
                key={parcela.id}
                cliente={venda.cliente?.nome ?? "—"}
                produto={venda.product_name}
                parcela={parcela}
                hoje={hojeIso}
                aoReceber={(valor) =>
                  confirmar.mutate({ id: parcela.id!, acao: "receber", amount_cents: valor })
                }
                aoAdiar={(due_on) => confirmar.mutate({ id: parcela.id!, acao: "adiar", due_on })}
                aoCancelar={() => confirmar.mutate({ id: parcela.id!, acao: "cancelar" })}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex items-center gap-1 self-start rounded-xl bg-secondary p-0.5">
        <button
          type="button"
          aria-label={t("Mês anterior")}
          onClick={() => setMes(somarMeses(mes, -1))}
          className="grid h-9 w-9 place-items-center rounded-[10px] hover:bg-card"
        >
          ‹
        </button>
        <span className="min-w-36 text-center text-sm font-medium capitalize">
          {new Intl.DateTimeFormat("pt-BR", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(`${mes}-01T12:00:00Z`))}
        </span>
        <button
          type="button"
          aria-label={t("Próximo mês")}
          onClick={() => setMes(somarMeses(mes, 1))}
          className="grid h-9 w-9 place-items-center rounded-[10px] hover:bg-card"
        >
          ›
        </button>
      </div>

      <section
        aria-label={t("Resumo")}
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3 xl:grid-cols-5"
      >
        {numeros.map(([rotulo, valor]) => (
          <div key={rotulo} className="bg-card px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {rotulo}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={t("Buscar por cliente, produto ou campanha")}
          aria-label={t("Buscar venda")}
          className="h-10 min-w-0 flex-1 basis-60 rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={filtroStatus === null}
            onClick={() => setFiltroStatus(null)}
            className={cn(
              "h-9 rounded-lg border px-3 text-xs font-medium whitespace-nowrap",
              filtroStatus === null ? "border-primary bg-primary/10" : "hover:bg-secondary",
            )}
          >
            {t("Todas")}
          </button>
          {STATUS_DA_VENDA.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={filtroStatus === s}
              onClick={() => setFiltroStatus(s)}
              className={cn(
                "h-9 rounded-lg border px-3 text-xs font-medium whitespace-nowrap",
                filtroStatus === s ? "border-primary bg-primary/10" : "hover:bg-secondary",
              )}
            >
              {rotuloDoStatusDaVenda(t, s)}
            </button>
          ))}
        </div>
        <BarraDeConsulta
          compacta
          campos={camposDaBarra}
          consulta={{
            filtros: preferencias.filtros,
            ordenacao: preferencias.ordenacao,
            agrupar: preferencias.agrupar,
            agruparPor: preferencias.agruparPor,
          }}
          aoMudar={mudarConsulta}
        />
      </div>

      {consulta.isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />
      ) : (
        <TabelaDoMotor
          linhas={resultado.linhas}
          idDe={(v) => v.id}
          colunas={mostradas}
          grupos={grupos}
          aoMoverColuna={(movido, alvo) =>
            padrao.atualizar((p) => ({
              ...p,
              ordem: moverColuna(
                resolvidas.filter((c) => !c.fixa).map((c) => c.id),
                movido,
                alvo,
              ),
            }))
          }
          aoRedimensionarColuna={(id, largura) =>
            padrao.atualizar((p) => ({ ...p, larguras: { ...p.larguras, [id]: largura } }))
          }
          aoReordenar={() => undefined}
          podeReordenar={false}
          rotuloDaTabela={t("Vendas")}
          vazio={
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("Nenhuma venda com esses filtros. Registre a primeira em “Nova venda”.")}
            </p>
          }
        />
      )}

      {editando ? (
        <DialogoDaVenda
          key={editando === "nova" ? "nova" : editando.id}
          venda={editando === "nova" ? null : editando}
          clientes={clientes.data ?? []}
          titulo={editando !== "nova" && editando.needs_details ? t("Finalizar venda") : undefined}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (v) => {
            await salvar.mutateAsync(v).catch(() => undefined);
          }}
          aoApagar={
            editando !== "nova"
              ? async () => {
                  await apagar.mutateAsync(editando.id).catch(() => undefined);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function CobrancaParaConfirmar({
  cliente,
  produto,
  parcela,
  hoje,
  aoReceber,
  aoAdiar,
  aoCancelar,
}: {
  cliente: string;
  produto: string;
  parcela: { due_on: string; amount_cents: number };
  hoje: string;
  aoReceber: (valorCents: number) => void;
  aoAdiar: (due_on: string) => void;
  aoCancelar: () => void;
}) {
  const t = useT();
  const [valor, setValor] = useState((parcela.amount_cents / 100).toFixed(2).replace(".", ","));
  const [novaData, setNovaData] = useState("");
  const atrasada = parcela.due_on < hoje;
  const quando = atrasada
    ? t("Venceu")
    : parcela.due_on === hoje
      ? t("Vence hoje")
      : t("Vence amanhã");
  const valorEmCentavos = Math.round(
    (Number(valor.replace(/\./g, "").replace(",", ".")) || 0) * 100,
  );
  return (
    <li className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{cliente}</p>
        <p className="truncate text-xs text-muted-foreground">
          {produto || t("Recorrência")} ·{" "}
          <span className={atrasada ? "font-semibold text-error-fg" : ""}>
            {quando} ({parcela.due_on.split("-").reverse().join("/")})
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          {t("Valor")}
          <input
            value={valor}
            inputMode="decimal"
            onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ""))}
            aria-label={t("Valor recebido")}
            className="h-9 w-28 rounded-lg border bg-background px-2 text-right text-sm tabular-nums"
          />
        </label>
        <button
          type="button"
          onClick={() => aoReceber(valorEmCentavos)}
          className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
        >
          {t("Pagou")}
        </button>
        <input
          type="date"
          value={novaData}
          min={hoje}
          onChange={(e) => setNovaData(e.target.value)}
          aria-label={t("Nova data de vencimento")}
          className="h-9 rounded-lg border bg-background px-2 text-sm"
        />
        <button
          type="button"
          disabled={!novaData}
          onClick={() => aoAdiar(novaData)}
          className="h-9 rounded-lg border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-40"
        >
          {t("Adiar")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t("Cancelar esta parcela? Ela deixa de contar como a receber.")))
              aoCancelar();
          }}
          className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-error-fg"
        >
          {t("Cancelar")}
        </button>
      </div>
    </li>
  );
}
