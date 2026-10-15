"use client";

import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BarraDeFunis, type FunilDaBarra } from "@/components/clientes/BarraDeFunis";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { AbasDeVisualizacao } from "@/components/motor/AbasDeVisualizacao";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { ConfigurarVisualizacao } from "@/components/motor/ConfigurarVisualizacao";
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
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useMarcarParcela } from "@/hooks/vendas/useMarcarParcela";
import { useVisoesSalvas } from "@/hooks/motor/useVisoesSalvas";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import { ROLE_RANK } from "@/lib/auth/types";
import { CardDaOportunidade } from "@/components/contacts/ficha/OportunidadesDoLead";
import { LoseLeadDialog } from "@/components/kanban/LoseLeadDialog";
import { CirculoDeRecebida } from "@/components/vendas/CirculoDeRecebida";
import { recebeuNoMes, recorteDoMes, resumoDaVenda } from "@/lib/vendas-tabela";
import { apiClient } from "@/lib/api/client";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import {
  aplicarConsulta,
  type CampoConsultavel,
  type ConsultaDaTabela,
} from "@/lib/motor/consulta";
import { proximaOrdenacao } from "@/lib/motor/ordenar-por-coluna";
import { moverColuna, resolverColunas, type PreferenciasDaTabela } from "@/lib/motor/layout";
import { somarMeses } from "@/lib/marketing/campanhas-resumo";
import { precisaDeConfirmacao } from "@/lib/vendas-recorrentes";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { ArrowRight, Plus, TextAa } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import {
  STATUS_DA_VENDA,
  fluxoDoMes,
  FORMAS_DE_PAGAMENTO,
  rotuloDaForma,
  totaisDeVendas,
  nomeDaVenda,
  valorPagoDaVenda,
  valorPrevistoDaVenda,
  type StatusDaVenda,
  type Venda,
} from "@/lib/vendas";

const COR: Record<StatusDaVenda, CorDaOpcao> = {
  interesse: "purple",
  comprometida: "orange",
  concluida: "green",
  recorrencia_ativa: "blue",
  recorrencia_encerrada: "brown",
  cancelada: "gray",
};

const reais = (centavos: number) => moedaDoNumero(centavos / 100);
const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

function rotuloDoStatusDaVenda(t: (s: string) => string, s: StatusDaVenda): string {
  switch (s) {
    case "interesse":
      return t("Possível venda");
    case "comprometida":
      return t("Comprometido");
    case "concluida":
      return t("Pago");
    case "recorrencia_ativa":
      return t("Recorrência ativa");
    case "recorrencia_encerrada":
      return t("Recorrência encerrada");
    case "cancelada":
      return t("Cancelado");
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
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const org = useActiveOrg();
  const podeEditarVisoes = ROLE_RANK[org?.role ?? "viewer"] >= ROLE_RANK.agent;
  const marcarParcela = useMarcarParcela();
  const [configurando, setConfigurando] = useState(false);

  // As abas salvas de Vendas (da organização, como as de Clientes e Tarefas). "Tabela" é a de fábrica.
  const padrao = useVisualizacao("vendas");
  const { visoes, salvarConfig, criarVisao, editarVisao, apagarVisao, arquivarVisao } = useVisoesSalvas(
    "vendas",
    podeEditarVisoes,
  );
  const ID_DA_PADRAO = "padrao";
  const posicaoDaPadrao = padrao.preferencias.posicao ?? -1_000_000;
  const ordemDasAbas = [
    { id: ID_DA_PADRAO, posicao: posicaoDaPadrao },
    ...visoes.map((v) => ({ id: v.id, posicao: v.position })),
  ].sort((a, b) => a.posicao - b.posicao);
  const abaPedida = parametros.get("v");
  const visaoAtiva =
    abaPedida === ID_DA_PADRAO
      ? undefined
      : (visoes.find((v) => v.id === abaPedida) ??
        (abaPedida ? undefined : visoes.find((v) => v.id === ordemDasAbas[0]?.id)));
  const ativaId = visaoAtiva?.id ?? ID_DA_PADRAO;
  const preferencias: PreferenciasDaTabela = visaoAtiva ? visaoAtiva.config : padrao.preferencias;
  const atualizar = (mudar: (atual: PreferenciasDaTabela) => PreferenciasDaTabela) => {
    if (visaoAtiva) salvarConfig(visaoAtiva.id, mudar(visaoAtiva.config));
    else padrao.atualizar(mudar);
  };
  const indiceDaAba = ordemDasAbas.findIndex((a) => a.id === ativaId);
  const moverAba = (direcao: -1 | 1) => {
    const ids = ordemDasAbas.map((a) => a.id);
    const i = ids.indexOf(ativaId);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    ids.forEach((id, k) => {
      const posicao = (k + 1) * 1000;
      if (id === ID_DA_PADRAO) padrao.atualizar((p) => ({ ...p, posicao }));
      else void editarVisao(id, { position: posicao });
    });
  };
  function irParaAba(id: string) {
    const p = new URLSearchParams(parametros.toString());
    p.set("v", id);
    router.replace(`${caminho}?${p.toString()}`, { scroll: false });
  }
  // ── Funis (como em Clientes): ver as vendas de cada funil/campanha ──
  const funilEscolhido = parametros.get("funil") ?? "todos";
  const barraDeFunis = useVisualizacao("vendas-funis");
  const dadosDeFunis = useQuery({
    queryKey: ["clientes", "todos"],
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: {
            funis: Array<{ id: string; name: string }>;
            campanhas: Array<{ pipeline_id: string | null; status: string; channel: string }>;
          };
        }>("/api/v1/clientes?funil=todos")
      ).data,
  });
  const arquivadosDeFunis = useMemo(
    () => new Set(barraDeFunis.preferencias.funis?.arquivados ?? []),
    [barraDeFunis.preferencias.funis?.arquivados],
  );
  const funisNaOrdem: FunilDaBarra[] = useMemo(() => {
    const ordem = barraDeFunis.preferencias.funis?.ordem ?? [];
    const rank = (id: string) => {
      const i = ordem.indexOf(id);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    const campanha = new Map(
      (dadosDeFunis.data?.campanhas ?? [])
        .filter((c) => c.pipeline_id)
        .map((c) => [c.pipeline_id as string, c]),
    );
    return [...(dadosDeFunis.data?.funis ?? [])]
      .sort((a, b) => rank(a.id) - rank(b.id))
      .map((f) => ({
        id: f.id,
        nome: f.name,
        statusDaCampanha: campanha.get(f.id)?.status ?? null,
        canal: campanha.get(f.id)?.channel ?? null,
      }));
  }, [dadosDeFunis.data, barraDeFunis.preferencias.funis?.ordem]);
  function escolherFunil(id: string) {
    const p = new URLSearchParams(parametros.toString());
    if (id === "todos") p.delete("funil");
    else p.set("funil", id);
    const qs = p.toString();
    router.replace(qs ? `${caminho}?${qs}` : caminho, { scroll: false });
  }
  const salvarFunis = (
    mudar: (
      atual: NonNullable<PreferenciasDaTabela["funis"]>,
    ) => NonNullable<PreferenciasDaTabela["funis"]>,
  ) => barraDeFunis.atualizar((p) => ({ ...p, funis: mudar(p.funis ?? {}) }));

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusDaVenda | null>(null);
  const [soComRecebimento, setSoComRecebimento] = useState(false);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<Venda | null>(null);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));

  const consulta = useQuery({
    queryKey: ["vendas"],
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>("/api/v1/vendas")).data.vendas,
    staleTime: 10_000,
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
  const excluirParcela = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/vendas/parcelas/${id}`),
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
  const canceladas = vendas.flatMap((v) =>
    (v.parcelas ?? []).filter((p) => p.status === "cancelada").map((p) => ({ venda: v, parcela: p })),
  );
  const termo = busca.trim().toLowerCase();
  const filtradas = useMemo(
    () =>
      vendas.filter(
        (v) =>
          (funilEscolhido === "todos" || v.pipeline_id === funilEscolhido) &&
          (filtroStatus === null || v.status === filtroStatus) &&
          (!soComRecebimento || recebeuNoMes(v, mes)) &&
          (termo === "" ||
            `${v.cliente?.nome ?? ""} ${nomeDaVenda(v)} ${v.product_name} ${v.reference} ${v.campanha ?? ""}`
              .toLowerCase()
              .includes(termo)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendas, filtroStatus, termo, soComRecebimento, mes, funilEscolhido],
  );
  const totais = totaisDeVendas(filtradas);
  // "Recebido no mês" ligado: a venda fica, mas só com as parcelas e os valores pagos nesse mês.
  const exibidas = useMemo(
    () => (soComRecebimento ? filtradas.map((v) => recorteDoMes(v, mes)) : filtradas),
    [filtradas, soComRecebimento, mes],
  );

  const opcoesDeStatus = STATUS_DA_VENDA.map((s) => ({
    id: s,
    rotulo: rotuloDoStatusDaVenda(t, s),
    cor: COR[s],
  }));

  const texto = (v: string) => <span className="block truncate px-2 text-sm">{v || "—"}</span>;
  const dataCelula = (iso: string | null) => (
    <span className="block px-2 text-sm tabular-nums">{iso ? dataBr(iso) : "—"}</span>
  );
  const dinheiro = (cents: number, classe = "") => (
    <span className={`block px-2 text-sm tabular-nums ${classe}`}>{reais(cents)}</span>
  );
  // Origem da oportunidade: só leitura aqui (muda na página da oportunidade).
  const colunas: ColunaDoMotor<Venda>[] = [
    {
      id: "oportunidade",
      titulo: t("Oportunidade"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 280,
      semOcultar: true,
      celula: (v) => (
        <button
          type="button"
          onClick={() => setAbertaId(v.id)}
          title={t("Abrir a oportunidade")}
          className="block w-full min-w-0 px-2 text-left hover:underline"
        >
          <span className="block truncate text-sm font-medium">
            {nomeDaVenda(v) || t("Sem produto")}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {v.cliente?.nome ?? "—"}
          </span>
        </button>
      ),
    },
    {
      id: "funil",
      titulo: t("Funil"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 200,
      celula: (v) => texto(v.funil ?? ""),
    },
    {
      id: "produtos",
      titulo: t("Produto(s)"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 240,
      celula: (v) => texto(resumoDaVenda(v).produtos),
    },
    {
      id: "status",
      titulo: t("Status"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      celula: (v) => (
        <SeletorDeOpcao
          opcoes={opcoesDeStatus}
          valorId={v.status}
          podeEditar
          rotulo={t("Status da venda")}
          aoEscolher={(id) => {
            if (id === v.status) return;
            // Cancelar a venda ou encerrar a recorrência pede o motivo (o que já foi pago, um sinal
            // por exemplo, continua no faturamento).
            if (id === "cancelada" || id === "recorrencia_encerrada") setCancelando(v);
            else mudarStatus.mutate({ id: v.id, status: id as StatusDaVenda });
          }}
        >
          <Etiqueta ponto cor={COR[v.status]}>
            {rotuloDoStatusDaVenda(t, v.status)}
          </Etiqueta>
        </SeletorDeOpcao>
      ),
    },
    {
      id: "pagamento",
      titulo: t("Tipo de pagamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 160,
      celula: (v) => texto(v.payment_method ? rotuloDaForma(t, v.payment_method) : ""),
    },
    {
      id: "parcelas",
      titulo: t("Parcelas"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 270,
      celula: (v) => {
        const parcelas = (v.parcelas ?? []).filter((p) => p.status !== "cancelada");
        if (parcelas.length === 0) {
          return (
            <div className="flex items-center gap-2 px-2 text-xs">
              <CirculoDeRecebida
                marcado={v.status === "concluida"}
                desabilitado={v.status === "cancelada"}
                rotulo={`${t("À vista")} ${t("recebido")}`}
                aoMudar={(ok) =>
                  mudarStatus.mutate({ id: v.id, status: ok ? "concluida" : "comprometida" })
                }
              />
              <span className="tabular-nums">
                {t("À vista")} · {reais(v.amount_cents)}
              </span>
            </div>
          );
        }
        return (
          <ul className="grid min-w-0 gap-1 overflow-hidden px-2 py-1">
            {parcelas.map((p) => (
              <li key={p.number} className="flex min-w-0 items-center gap-2 text-xs">
                <CirculoDeRecebida
                  marcado={p.status === "recebida"}
                  rotulo={`${t("Parcela")} ${p.number} ${t("recebida")}`}
                  aoMudar={(ok) => void marcarParcela(v, p.number, ok)}
                />
                <span className="min-w-0 truncate tabular-nums">
                  {p.number}/{parcelas.length} · {reais(p.amount_cents)} ·{" "}
                  {p.status === "recebida" && p.paid_on
                    ? `${t("pago em")} ${dataBr(p.paid_on.slice(0, 10))}`
                    : `${t("vence")} ${dataBr(p.due_on)}`}
                </span>
              </li>
            ))}
          </ul>
        );
      },
    },
    {
      id: "pago",
      titulo: t("Valor pago"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      celula: (v) =>
        dinheiro(resumoDaVenda(v).pagoCents, "text-green-700 dark:text-green-400"),
    },
    {
      id: "previsto",
      titulo: t("Valor previsto"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      celula: (v) => dinheiro(resumoDaVenda(v).previstoCents),
    },
    {
      id: "valor",
      titulo: t("Valor total"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      celula: (v) => dinheiro(v.amount_cents, "font-medium"),
    },
    {
      id: "primeiro_pagamento",
      titulo: t("Primeiro pagamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 160,
      celula: (v) => dataCelula(resumoDaVenda(v).primeiroPagamento),
    },
    {
      id: "ultimo_pagamento",
      titulo: t("Último pagamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 160,
      celula: (v) => dataCelula(resumoDaVenda(v).ultimoPagamento),
    },
    {
      id: "proximo_pagamento",
      titulo: t("Próximo pagamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      celula: (v) => dataCelula(resumoDaVenda(v).proximoPagamento),
    },
    {
      id: "origem",
      titulo: t("Origem"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      celula: (v) => texto(v.origem ?? ""),
    },
    {
      id: "campanha",
      titulo: t("Campanha"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 240,
      celula: (v) => texto(v.campanha ?? ""),
    },
    {
      id: "anuncio",
      titulo: t("Anúncio"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 200,
      celula: (v) => texto(v.anuncio ?? ""),
    },
    {
      id: "lp",
      titulo: t("Landing page"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 200,
      celula: (v) => texto(v.lp ?? ""),
    },
    {
      id: "posicionamento",
      titulo: t("Posicionamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      celula: (v) => texto(v.posicionamento ?? ""),
    },
  ];
  // A linha de totais do fim da tabela (somas e contagens do que está na tela).
  const somar = (linhas: readonly Venda[], f: (r: ReturnType<typeof resumoDaVenda>) => number) =>
    linhas.reduce((s2, v) => s2 + f(resumoDaVenda(v)), 0);
  const totalDe: Record<string, (linhas: readonly Venda[]) => React.ReactNode> = {
    oportunidade: (ls) => (
      <span className="block px-2 text-sm">
        {t("Total")} · {ls.length}
      </span>
    ),
    parcelas: (ls) => {
      const pagas = somar(ls, (r) => r.parcelasPagas);
      const todas = somar(ls, (r) => r.parcelas.length);
      return (
        <span className="block px-2 text-sm tabular-nums">
          {pagas}/{todas} {t("parcelas pagas")}
        </span>
      );
    },
    pago: (ls) => dinheiro(somar(ls, (r) => r.pagoCents), "text-green-700 dark:text-green-400"),
    previsto: (ls) => dinheiro(somar(ls, (r) => r.previstoCents)),
    valor: (ls) => dinheiro(ls.reduce((s2, v) => s2 + v.amount_cents, 0)),
  };
  const colunasComTotal = colunas.map((c) => ({ ...c, total: totalDe[c.id] }));
  const resolvidas = resolverColunas(colunasComTotal, preferencias);
  const mostradas = resolvidas.filter((c) => c.visivel);

  const campos: Array<
    CampoConsultavel<Venda> & {
      titulo: string;
      opcoes?: { id: string; rotulo: string; cor?: CorDaOpcao }[];
    }
  > = [
    { id: "oportunidade", titulo: t("Oportunidade"), tipo: "texto", valorDe: (v) => nomeDaVenda(v) },
    { id: "cliente", titulo: t("Cliente"), tipo: "texto", valorDe: (v) => v.cliente?.nome ?? "" },
    { id: "funil", titulo: t("Funil"), tipo: "texto", valorDe: (v) => v.funil ?? "" },
    {
      id: "produtos",
      titulo: t("Produto(s)"),
      tipo: "texto",
      valorDe: (v) => resumoDaVenda(v).produtos,
    },
    {
      id: "status",
      titulo: t("Status"),
      tipo: "opcao",
      valorDe: (v) => v.status,
      opcoes: opcoesDeStatus,
    },
    {
      id: "pagamento",
      titulo: t("Tipo de pagamento"),
      tipo: "texto",
      valorDe: (v) => v.payment_method,
    },
    {
      id: "parcelas",
      titulo: t("Parcelas pagas"),
      tipo: "numero",
      valorDe: (v) => resumoDaVenda(v).parcelasPagas,
    },
    {
      id: "pago",
      titulo: t("Valor pago"),
      tipo: "numero",
      valorDe: (v) => resumoDaVenda(v).pagoCents / 100,
    },
    {
      id: "previsto",
      titulo: t("Valor previsto"),
      tipo: "numero",
      valorDe: (v) => resumoDaVenda(v).previstoCents / 100,
    },
    { id: "valor", titulo: t("Valor total"), tipo: "numero", valorDe: (v) => v.amount_cents / 100 },
    {
      id: "primeiro_pagamento",
      titulo: t("Primeiro pagamento"),
      tipo: "data",
      valorDe: (v) => resumoDaVenda(v).primeiroPagamento,
    },
    {
      id: "ultimo_pagamento",
      titulo: t("Último pagamento"),
      tipo: "data",
      valorDe: (v) => resumoDaVenda(v).ultimoPagamento,
    },
    {
      id: "proximo_pagamento",
      titulo: t("Próximo pagamento"),
      tipo: "data",
      valorDe: (v) => resumoDaVenda(v).proximoPagamento,
    },
    { id: "origem", titulo: t("Origem"), tipo: "texto", valorDe: (v) => v.origem ?? "" },
    { id: "campanha", titulo: t("Campanha"), tipo: "texto", valorDe: (v) => v.campanha ?? "" },
    { id: "anuncio", titulo: t("Anúncio"), tipo: "texto", valorDe: (v) => v.anuncio ?? "" },
    { id: "lp", titulo: t("Landing page"), tipo: "texto", valorDe: (v) => v.lp ?? "" },
    {
      id: "posicionamento",
      titulo: t("Posicionamento"),
      tipo: "texto",
      valorDe: (v) => v.posicionamento ?? "",
    },
  ];
  const camposDaBarra: CampoDaBarra[] = campos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    ...(c.opcoes ? { opcoes: c.opcoes } : {}),
  }));
  const resultado = useMemo(
    () =>
      aplicarConsulta(exibidas, campos, preferencias, {
        hoje: new Date().toISOString().slice(0, 10),
      }),
    // `campos` é recriado a cada render; as entradas reais são estas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exibidas, preferencias],
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
    atualizar((p) => ({
      ...p,
      filtros: c.filtros?.length ? c.filtros : undefined,
      ordenacao: c.ordenacao?.length ? c.ordenacao : undefined,
      agrupar: c.agrupar,
      agruparPor: c.agrupar && c.agruparPor !== "dia" ? c.agruparPor : undefined,
    }));
  }

  const fluxo = fluxoDoMes(vendas, mes);
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
        </div>
      </header>

      {cobrancas.length > 0 ? (
        <section
          aria-label={t("Cobranças para confirmar")}
          className="grid grid-cols-1 gap-2 rounded-2xl border border-warning/40 bg-warning-bg/40 p-4"
        >
          <h2 className="text-sm font-semibold">
            {t("Cobranças para confirmar")} ({cobrancas.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            {t(
              "Venceu ou vence até amanhã. Confirme se o lead pagou e se o valor mudou — nada é dado como pago sozinho.",
            )}
          </p>
          <ul className="grid grid-cols-1 gap-2">
            {cobrancas.map(({ venda, parcela }) => (
              <CobrancaParaConfirmar
                key={parcela.id}
                cliente={venda.cliente?.nome ?? "—"}
                produto={nomeDaVenda(venda)}
                parcela={parcela}
                hoje={hojeIso}
                formaInicial={parcela.forma ?? venda.payment_method ?? ""}
                aoReceber={(valor, forma) =>
                  confirmar.mutate({
                    id: parcela.id!,
                    acao: "receber",
                    amount_cents: valor,
                    ...(forma ? { forma } : {}),
                  })
                }
                aoAdiar={(due_on) => confirmar.mutate({ id: parcela.id!, acao: "adiar", due_on })}
                aoCancelar={() => confirmar.mutate({ id: parcela.id!, acao: "cancelar" })}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {canceladas.length > 0 ? (
        <section
          aria-label={t("Parcelas canceladas")}
          className="grid grid-cols-1 gap-2 rounded-2xl border p-4"
        >
          <h2 className="text-sm font-semibold">
            {t("Parcelas canceladas")} ({canceladas.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("O valor delas voltou a contar como interesse. Exclua para tirar de vez.")}
          </p>
          <ul className="grid grid-cols-1 gap-1">
            {canceladas.map(({ venda, parcela }) => (
              <li
                key={parcela.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  {venda.cliente?.nome ?? "—"} · {nomeDaVenda(venda) || t("Recorrência")} ·{" "}
                  {parcela.due_on.split("-").reverse().join("/")} ·{" "}
                  {(parcela.amount_cents / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t("Excluir esta parcela cancelada?")))
                      excluirParcela.mutate(parcela.id!);
                  }}
                  className="h-8 rounded-lg px-3 text-xs text-muted-foreground hover:bg-secondary hover:text-error-fg"
                >
                  {t("Excluir")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex items-center gap-1 self-start rounded-xl bg-secondary p-0.5">
        <button
          type="button"
          aria-label={t("Mês anterior")}
          onClick={() => setMes(somarMeses(mes, -1))}
          className="grid h-9 w-9 grid-cols-1 place-items-center rounded-[10px] hover:bg-card"
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
          className="grid h-9 w-9 grid-cols-1 place-items-center rounded-[10px] hover:bg-card"
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


      <BarraDeFunis
        funis={funisNaOrdem}
        arquivados={arquivadosDeFunis}
        filtros={{
          status: barraDeFunis.preferencias.funis?.status ?? [],
          canais: barraDeFunis.preferencias.funis?.canais ?? [],
        }}
        aoFiltrar={(f) =>
          salvarFunis((atual) => ({ ...atual, status: f.status, canais: f.canais }))
        }
        escolhido={funilEscolhido}
        todosId="todos"
        podeOrganizar={podeEditarVisoes}
        aoEscolher={escolherFunil}
        aoReordenar={(ids) => salvarFunis((f) => ({ ...f, ordem: ids }))}
        aoArquivar={(ids, arquivar) =>
          salvarFunis((f) => {
            const atuais = new Set(f.arquivados ?? []);
            for (const id of ids) {
              if (arquivar) atuais.add(id);
              else atuais.delete(id);
            }
            return { ...f, arquivados: [...atuais] };
          })
        }
      />

      <AbasDeVisualizacao
        abas={[ID_DA_PADRAO, ...visoes.map((v) => v.id)]
          .map((id) => ordemDasAbas.find((a) => a.id === id))
          .flatMap((a) => (a ? [a] : []))
          .sort((x, y) => x.posicao - y.posicao)
          .map((a) =>
            a.id === ID_DA_PADRAO
              ? { id: a.id, nome: padrao.preferencias.nome ?? t("Tabela"), tipo: "tabela" as const }
              : {
                  id: a.id,
                  nome: visoes.find((v) => v.id === a.id)?.name ?? t("Tabela"),
                  tipo: "tabela" as const,
                },
          )}
        ativaId={ativaId}
        podeEditar={podeEditarVisoes}
        tipos={["tabela"]}
        aoEscolher={irParaAba}
        aoCriar={(nome) =>
          void criarVisao({ name: nome, type: "tabela", config: preferencias }).then(
            (v) => v && irParaAba(v.id),
          )
        }
        aoConfigurar={() => setConfigurando(true)}
      />

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
            aria-pressed={soComRecebimento}
            onClick={() => setSoComRecebimento((x) => !x)}
            title={t("Só as vendas com algum pagamento recebido no mês escolhido (mesmo comprometidas)")}
            className={cn(
              "h-9 rounded-lg border px-3 text-xs font-medium whitespace-nowrap",
              soComRecebimento ? "border-green-600 bg-green-600/10" : "hover:bg-secondary",
            )}
          >
            {t("Recebeu no mês")}
          </button>
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
          aoOrdenarPor={(coluna) =>
            mudarConsulta({
              filtros: preferencias.filtros,
              ordenacao: proximaOrdenacao(preferencias.ordenacao, coluna),
              agrupar: preferencias.agrupar,
              agruparPor: preferencias.agruparPor,
            })
          }
          ordenacao={preferencias.ordenacao}
          colunasOrdenaveis={new Set(camposDaBarra.map((c) => c.id))}
          linhas={resultado.linhas}
          idDe={(v) => v.id}
          colunas={mostradas}
          grupos={grupos}
          aoMoverColuna={(movido, alvo) =>
            atualizar((p) => ({
              ...p,
              ordem: moverColuna(
                resolvidas.filter((c) => !c.fixa).map((c) => c.id),
                movido,
                alvo,
              ),
            }))
          }
          aoRedimensionarColuna={(id, largura) =>
            atualizar((p) => ({ ...p, larguras: { ...p.larguras, [id]: largura } }))
          }
          aoReordenar={() => undefined}
          podeReordenar={false}
          rotuloDaTabela={t("Vendas")}
          vazio={
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("Nenhuma venda com esses filtros. Toda venda nasce de uma oportunidade.")}
            </p>
          }
        />
      )}

      <ConfigurarVisualizacao
        aberto={configurando}
        aoFechar={() => setConfigurando(false)}
        nome={visaoAtiva?.name ?? padrao.preferencias.nome ?? t("Tabela")}
        tipo="tabela"
        tipos={["tabela"]}
        podeEditar={podeEditarVisoes && (visaoAtiva?.editavel ?? true)}
        ehPadrao={!visaoAtiva}
        aoArquivar={
          visaoAtiva && visaoAtiva.editavel === false
            ? () => void arquivarVisao(visaoAtiva.id)
            : undefined
        }
        aoRenomear={(nome) =>
          visaoAtiva
            ? void editarVisao(visaoAtiva.id, { name: nome })
            : padrao.atualizar((p) => ({ ...p, nome }))
        }
        aoTrocarTipo={() => undefined}
        aoMoverAba={moverAba}
        podeMoverAba={{
          esquerda: indiceDaAba > 0,
          direita: indiceDaAba >= 0 && indiceDaAba < ordemDasAbas.length - 1,
        }}
        propriedades={resolvidas.map((c) => ({
          id: c.id,
          titulo: c.titulo,
          icone: c.icone,
          visivel: c.visivel,
          obrigatoria: c.fixa || c.semOcultar,
        }))}
        aoMover={(movido, alvo) =>
          atualizar((p) => ({
            ...p,
            ordem: moverColuna(
              resolvidas.filter((c) => !c.fixa).map((c) => c.id),
              movido,
              alvo,
            ),
          }))
        }
        aoAlternar={(id) => {
          const atual = resolvidas.find((c) => c.id === id);
          if (!atual || atual.fixa || atual.semOcultar) return;
          atualizar((p) => ({ ...p, visiveis: { ...p.visiveis, [id]: !atual.visivel } }));
        }}
        aoMostrarTodas={(mostrar) =>
          atualizar((p) => ({
            ...p,
            visiveis: Object.fromEntries(
              resolvidas.filter((c) => !c.fixa && !c.semOcultar).map((c) => [c.id, mostrar]),
            ),
          }))
        }
        aoApagar={
          visaoAtiva
            ? () => {
                void apagarVisao(visaoAtiva.id);
                setConfigurando(false);
                irParaAba(ID_DA_PADRAO);
              }
            : undefined
        }
      />

      {abertaId ? <CardDaOportunidade leadId={abertaId} aoFechar={() => setAbertaId(null)} /> : null}
      {cancelando && cancelando.pipeline_id ? (
        <LoseLeadDialog
          open
          leadId={cancelando.id}
          pipelineId={cancelando.pipeline_id}
          onOpenChange={(aberta) => {
            if (aberta) return;
            setCancelando(null);
            void recarregar();
          }}
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
  formaInicial,
  aoReceber,
  aoAdiar,
  aoCancelar,
}: {
  cliente: string;
  produto: string;
  parcela: { due_on: string; amount_cents: number };
  hoje: string;
  formaInicial: string;
  aoReceber: (valorCents: number, forma: string) => void;
  aoAdiar: (due_on: string) => void;
  aoCancelar: () => void;
}) {
  const t = useT();
  const [valor, setValor] = useState((parcela.amount_cents / 100).toFixed(2).replace(".", ","));
  const [novaData, setNovaData] = useState("");
  const [forma, setForma] = useState(formaInicial);
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
    <li className="grid grid-cols-1 gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_auto] sm:items-center">
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
        <select
          value={forma}
          onChange={(e) => setForma(e.target.value)}
          aria-label={t("Forma de pagamento")}
          className="h-9 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">{t("Forma…")}</option>
          {FORMAS_DE_PAGAMENTO.map((f) => (
            <option key={f} value={f}>
              {rotuloDaForma(t, f)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => aoReceber(valorEmCentavos, forma)}
          className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
        >
          {t("Pagou")}
        </button>
        <CampoDeData
          valor={novaData}
          min={hoje}
          aoMudar={setNovaData}
          rotulo={t("Nova data de vencimento")}
          placeholder={t("Nova data")}
          className="h-9"
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

/** Vendas e faturamento de cada produto do catálogo no mês. */
function PorProduto({ mes }: { mes: string }) {
  const t = useT();
  const consulta = useQuery({
    queryKey: ["vendas-por-produto", mes],
    staleTime: 30_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: {
            produtos: Array<{
              product_id: string;
              nome: string;
              vendas: number;
              interesse: number;
              recebido: number;
              a_receber: number;
            }>;
          };
        }>(`/api/v1/vendas/por-produto?mes=${mes}`)
      ).data.produtos,
  });
  const linhas = (consulta.data ?? []).sort((a, b) => b.recebido - a.recebido);
  if (consulta.isLoading || linhas.length === 0) return null;
  return (
    <details className="rounded-2xl border bg-card" open>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
        {t("Por produto")}
      </summary>
      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t("Produto")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("Vendas fechadas")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("Recebido")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("A receber")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("Em interesse")}</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((p) => (
              <tr key={p.product_id} className="border-t">
                <td className="max-w-72 truncate px-3 py-2 font-medium">{p.nome}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.vendas}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {moedaDoNumero(p.recebido)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{moedaDoNumero(p.a_receber)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{moedaDoNumero(p.interesse)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
