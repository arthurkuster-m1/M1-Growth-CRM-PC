"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { BarraDeFunis, type FunilDaBarra } from "@/components/clientes/BarraDeFunis";
import { ImportarLeadsDoCRM } from "@/components/clientes/ImportarLeadsDoCRM";
import { NovoLeadDoCRM } from "@/components/clientes/NovoLeadDoCRM";
import { JanelaDoAtivo } from "@/components/clientes/JanelaDoAtivo";
import { QuadroDeOportunidades, type GrupoDoQuadro } from "@/components/clientes/QuadroDeOportunidades";
import { RegistrarAcaoEmMassaDialog } from "@/components/clientes/RegistrarAcaoEmMassaDialog";
import { AbrirConversaDoLead } from "@/components/kanban/AbrirConversaDoLead";
import { coolingLabel } from "@/lib/kanban/card-state";
import { MODELOS_DAS_OPORTUNIDADES } from "@/lib/clientes/modelos-de-visao";
import type { RiskBucket } from "@/lib/leads/risk-radar";
import { useRadarDasOportunidades } from "@/hooks/leads/useRadarDasOportunidades";
import { ResultadoRapidoDaLigacao } from "@/components/clientes/ResultadoRapidoDaLigacao";
import { prioridadeDaFila } from "@/lib/leads/resultados-rapidos";
import { BotaoWhatsApp } from "@/components/clientes/BotaoWhatsApp";
import { ConfirmarDataDaProximaAcao } from "@/components/clientes/ConfirmarDataDaProximaAcao";
import { ConfigDaProspeccaoDialog } from "@/components/clientes/ConfigDaProspeccaoDialog";
import { ModoProspeccao, type LeadDaProspeccao } from "@/components/clientes/ModoProspeccao";
import {
  carregarConfigDaProspeccao,
  CONFIG_PADRAO_DA_PROSPECCAO,
  salvarConfigDaProspeccao,
  type ConfigDaProspeccao,
} from "@/lib/leads/config-de-prospeccao";
import { QuadroDoCiclo } from "@/components/clientes/QuadroDoCiclo";
import {
  QuadroDeEtapas,
  type EtapaDoQuadro,
  type GrupoDeEtapas,
} from "@/components/clientes/QuadroDeEtapas";
import { CelulaDeEtiquetas } from "@/components/clientes/CelulaDeEtiquetas";
import { LoseLeadDialog } from "@/components/kanban/LoseLeadDialog";
import { telefoneE164 } from "@/components/leads/FichaDoLead";
import { AbasDeVisualizacao } from "@/components/motor/AbasDeVisualizacao";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { CelulaDeCaixa } from "@/components/motor/CelulaDeCaixa";
import { CelulaDePessoa } from "@/components/motor/CelulaDePessoa";
import { CelulaDeTexto } from "@/components/motor/CelulaDeTexto";
import { CelulaDeDia } from "@/components/motor/CelulaDeDia";
import { ConfigurarVisualizacao } from "@/components/motor/ConfigurarVisualizacao";
import { Etiqueta } from "@/components/motor/Etiqueta";
import {
  COR_DO_CICLO,
  CICLOS_DE_VIDA,
  ehCicloDeVida,
  ROTULO_DO_CICLO,
  ROTULO_PLURAL_DO_CICLO,
} from "@/lib/ciclo-de-vida";
import { BASE_DA_COR } from "@/lib/motor/cores";
import { proximaOrdenacao } from "@/lib/motor/ordenar-por-coluna";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";
import { AcoesEmMassaDeClientes } from "@/components/clientes/AcoesEmMassaDeClientes";
import { TabelaDoMotor, type ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useRotuloDaForma } from "@/hooks/financeiro/useTaxasDePagamento";
import { ComentariosEmMassaDialog } from "@/components/clientes/ComentariosEmMassaDialog";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useVisoesSalvas } from "@/hooks/motor/useVisoesSalvas";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import { apiClient } from "@/lib/api/client";
import { ROLE_RANK } from "@/lib/auth/types";
import { lerNumero } from "@/lib/marketing/calculadora";
import {
  aplicarConsulta,
  type CampoConsultavel,
  type ConsultaDaTabela,
} from "@/lib/motor/consulta";
import { moverColuna, resolverColunas, type PreferenciasDaTabela } from "@/lib/motor/layout";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import {
  ArrowRight,
  ChatCircle,
  InstagramLogo,
  MagnifyingGlass,
  Gear,
  Phone,
  Rows,
  Kanban,
  TextAa,
  Users,
  UploadSimple,
  Plus,
  WhatsappLogo,
} from "@/lib/ui/icons";
import type {
  ClienteDaLista,
  ParticipacaoDoCliente,
  VendaAtivaDoCliente,
} from "@/app/api/v1/clientes/route";
import { STATUS_DA_VENDA, type Venda } from "@/lib/vendas";
interface Funil {
  id: string;
  name: string;
  is_default: boolean;
}
interface Etapa {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
  qualification?: "mql" | "disqualified" | null;
  win_probability?: number | null;
}
interface Dados {
  funis: Funil[];
  etapas: Etapa[];
  campanhas?: Array<{
    id: string;
    name: string;
    status?: string;
    channel?: string;
    pipeline_id?: string | null;
  }>;
  clientes: ClienteDaLista[];
  anuncios_por_id?: Record<string, string>;
  lps_por_id?: Record<string, string>;
  pode_editar: boolean;
  pode_gerir: boolean;
}

/** Uma linha da tabela: o lead (contato) e, num funil escolhido, a participação dele nele. */
interface Linha extends ClienteDaLista {
  participacao: ParticipacaoDoCliente | null;
  /** Identifica a linha: o contato (Clientes) ou a oportunidade (Oportunidades). */
  chave: string;
}

const PALETA: CorDaOpcao[] = ["blue", "purple", "orange", "yellow", "pink", "brown", "gray"];
const TODOS = "todos";
const ROTULO_DA_VENDA: Record<string, string> = {
  interesse: "Possível venda",
  comprometida: "Comprometido",
  concluida: "Pago",
  recorrencia_ativa: "Recorrência ativa",
  recorrencia_encerrada: "Recorrência encerrada",
  cancelada: "Cancelado",
};
const COR_DA_VENDA: Record<string, string> = {
  interesse: "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  comprometida: "border-yellow-500/70 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300",
  concluida: "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-300",
  recorrencia_ativa: "border-indigo-500/60 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  recorrencia_encerrada: "border-stone-500/60 bg-stone-500/10 text-stone-700 dark:text-stone-300",
  cancelada: "border-gray-400/70 bg-gray-500/10 text-muted-foreground",
};
const ID_DA_PADRAO = "padrao";

/** O Radar de risco na tabela: do mais urgente ao menos. */
const BALDES_DO_RADAR: readonly RiskBucket[] = ["critico", "em_risco", "em_voo", "em_dia"];
const ROTULO_DO_RADAR: Record<RiskBucket, string> = {
  critico: "Crítico",
  em_risco: "Em risco",
  em_voo: "Em voo",
  em_dia: "Em dia",
};
const COR_DO_RADAR: Record<RiskBucket, CorDaOpcao> = {
  critico: "red",
  em_risco: "orange",
  em_voo: "blue",
  em_dia: "green",
};

/** Propriedades que são da OPORTUNIDADE: não aparecem na aba Clientes. */
const SO_DE_OPORTUNIDADES: ReadonlySet<string> = new Set([
  "funis",
  "etapa",
  "campanha",
  "status",
  "responsavel",
  "proxima-acao",
  "proxima-acao-em",
  "vendas-ativas",
  "valor",
  "previsao",
  "sem-resposta",
  "radar",
  "ligar",
  "whatsapp",
  "instagram",
  "inbox",
  "acao",
  "comentarios",
  "cliente",
  "entrou-no-funil",
  "produtos",
  "status-venda",
  "forma-de-pagamento",
  "parcelas",
  "pago",
  "previsto",
  "primeiro-pagamento",
  "ultimo-pagamento",
  "proximo-pagamento",
  "posicionamento",
  "resultado-rapido",
  "tentativas",
]);
/** Propriedades que são só da PESSOA: não aparecem na aba Oportunidades. */
const SO_DE_CLIENTES: ReadonlySet<string> = new Set([
  "dono",
  "ativo-ate",
  "oportunidades-abertas",
  "origem-campanha",
  "origem-posicionamento",
  "funis-ate-comprar",
  "dias-ate-comprar",
  "ciclo",
  "mql",
  "entrou",
  "primeira-compra",
  "abordagem",
  "ltv",
  "ltv-previsto",
  "interesse",
  "vendas",
  "vendas-ativas",
  "tags",
  "atividade",
]);
const TIPOS_DO_CRM = ["tabela", "kanban"] as const;

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * O CRM FINAL: a página Clientes. Uma lista de leads (um por telefone), a seleção do funil
 * ("Todos" é a lista completa) e o motor das Tarefas — abas de visualização salvas (Tabela ou
 * Quadro), filtros, ordem, agrupamento e colunas que se escondem e reordenam. As células da
 * tabela se editam no lugar, como no Notion.
 */
export function ClientesCRM({
  modo = "clientes",
}: {
  /** `oportunidades`: os negócios por funil (quadro por padrão), com as próprias visualizações. */
  modo?: "clientes" | "oportunidades";
} = {}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const queryClient = useQueryClient();
  const org = useActiveOrg();
  const role = org?.role ?? "viewer";

  const rotuloDaFormaDe = useRotuloDaForma();
  const ehOportunidades = modo === "oportunidades";
  const tela = ehOportunidades ? "oportunidades" : "clientes";
  const funilEscolhido = parametros.get("funil") ?? TODOS;
  const [busca, setBusca] = useState("");
  // "Agora" fixado na montagem: a tela não recalcula o relógio a cada render.
  const [agora] = useState(() => Date.now());
  const hojeIso = new Date(agora).toISOString().slice(0, 10);
  // O radar de cada oportunidade aberta (mesma classificação da IA); negócio fora da lista está em dia.
  const radarPorLead = useRadarDasOportunidades().data;
  const baldeDoRadar = (l: Linha): RiskBucket | null => {
    const p = l.participacao;
    if (!p || p.status !== "open" || !radarPorLead) return null;
    return radarPorLead.get(p.lead_id) ?? "em_dia";
  };
  const [configurando, setConfigurando] = useState(false);
  const [selecionadas, setSelecionadas] = useState<ReadonlySet<string>>(new Set());
  const [perdendo, setPerdendo] = useState<{ leadId: string; funilId: string; etapaId?: string } | null>(null);
  const [novoLeadAberto, setNovoLeadAberto] = useState(false);
  const [novaOportunidade, setNovaOportunidade] = useState(false);
  const [prospectando, setProspectando] = useState(false);
  const [configProspeccao, setConfigProspeccao] = useState(false);
  const [configDaProspeccao, setConfigDaProspeccao] = useState<ConfigDaProspeccao>(
    CONFIG_PADRAO_DA_PROSPECCAO,
  );
  // A configuração fica neste navegador: lê depois da hidratação, não no useState.
  useEffect(() => setConfigDaProspeccao(carregarConfigDaProspeccao()), []);
  /** A próxima ação foi escrita: pede a confirmação da data (a atual já vem escolhida). */
  const [confirmandoAcao, setConfirmandoAcao] = useState<{
    leadId: string;
    contactId: string;
    texto: string;
    dataAtual: string | null;
  } | null>(null);
  /** Editar os comentários das oportunidades selecionadas (texto inicial = o que foi colado). */
  const [comentariosEmMassa, setComentariosEmMassa] = useState<string | null>(null);
  /** O lead em que se registra uma ação rápida (ligação, mensagem…) direto da tabela. */
  const [acaoDoContato, setAcaoDoContato] = useState<string | null>(null);
  /** Etapas (ids) que filtram a lista de oportunidades; null = todas. */
  const [etapasFiltro, setEtapasFiltro] = useState<string[] | null>(null);
  /** Status de venda que a tabela mostra (vazio = todos): "só abertas", "só concluídas"… */
  // (guardado na visualização: ver `statusDasVendas` logo depois de `preferencias`)
  /** A venda aberta no popup (carregada inteira ao clicar). */
  const [vendaAberta, setVendaAberta] = useState<{ venda: Venda; nome: string } | null>(null);
  /** O número do topo que está "aberto": a lista mostra só quem compõe aquele número. */
  const [destaque, setDestaque] = useState<
    null | "ligarhoje" | "faturamento" | "abertos" | "abertas" | "compraram" | "vendas" | "mql" | "semcontato" | "sempasso"
  >(null);
  const [importarAberto, setImportarAberto] = useState(false);
  /** O status do ciclo de vida que filtra a lista (clique de novo para soltar). */
  const [cicloFiltro, setCicloFiltro] = useState<(typeof CICLOS_DE_VIDA)[number] | null>(null);

  const chaveDaConsulta = ["clientes", funilEscolhido] as const;
  const consulta = useQuery({
    queryKey: chaveDaConsulta,
    queryFn: async () =>
      (await apiClient.get<{ data: Dados }>(`/api/v1/clientes?funil=${funilEscolhido}`)).data,
    staleTime: 10_000,
  });
  const dados = consulta.data;
  const funilAtual = dados?.funis.find((f) => f.id === funilEscolhido) ?? null;
  const primeiroFunilId = dados?.funis[0]?.id ?? null;
  const funilValido = funilEscolhido === TODOS || funilAtual !== null;

  const membrosDaEquipe = useAssignableMembers(true);
  const membros = (membrosDaEquipe.data ?? []).map((m) => ({
    id: m.user_id,
    nome: m.full_name?.trim() || t("Sem nome"),
  }));
  const nomeDoMembro = (id: string | null) => membros.find((m) => m.id === id)?.nome ?? null;

  const podeEditar = (dados?.pode_editar ?? false) && ROLE_RANK[role] >= ROLE_RANK.agent;

  // As abas salvas do CRM (da organização, como as de Tarefas): cada uma é Tabela ou Quadro,
  // com os próprios filtros, ordem e colunas. "Tabela" é a aba de fábrica.
  const padrao = useVisualizacao(tela);
  const { visoes, salvarConfig, criarVisao, editarVisao, apagarVisao, arquivarVisao } = useVisoesSalvas(
    tela,
    podeEditar,
  );
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
  // Em Oportunidades o quadro do funil é a visão de abertura; "Tabela" continua a um clique.
  const vista = visaoAtiva
    ? visaoAtiva.type === "kanban"
      ? "quadro"
      : "tabela"
    : ehOportunidades && abaPedida !== ID_DA_PADRAO
      ? "quadro"
      : "tabela";
  const preferencias: PreferenciasDaTabela = visaoAtiva ? visaoAtiva.config : padrao.preferencias;
  const atualizar = (mudar: (atual: PreferenciasDaTabela) => PreferenciasDaTabela) => {
    if (visaoAtiva) salvarConfig(visaoAtiva.id, mudar(visaoAtiva.config));
    else padrao.atualizar(mudar);
  };
  /** Os status de venda que a tabela mostra (vazio = todos): ficam salvos na visualização. */
  const statusDasVendas = useMemo<ReadonlySet<string>>(
    // Clientes não filtra por venda (isso é da aba Oportunidades).
    () => new Set<string>(),
    [preferencias.statusDasVendas, ehOportunidades],
  );
  const setStatusDasVendas = (
    novo: ReadonlySet<string> | ((atual: ReadonlySet<string>) => ReadonlySet<string>),
  ) => {
    const valor = typeof novo === "function" ? novo(statusDasVendas) : novo;
    const lista = [...valor].filter(
      (v): v is (typeof STATUS_DA_VENDA)[number] =>
        (STATUS_DA_VENDA as readonly string[]).includes(v),
    );
    atualizar((p) => ({ ...p, statusDasVendas: lista.length > 0 ? lista : undefined }));
  };
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
  const indiceDaAba = ordemDasAbas.findIndex((a) => a.id === ativaId);

  function ir(novo: { funil?: string; aba?: string }) {
    const p = new URLSearchParams(parametros.toString());
    if (novo.funil !== undefined) {
      if (novo.funil === TODOS) p.delete("funil");
      else p.set("funil", novo.funil);
    }
    if (novo.aba !== undefined) p.set("v", novo.aba);
    const qs = p.toString();
    router.replace(qs ? `${caminho}?${qs}` : caminho, { scroll: false });
  }

  // A barra de funis (ordem e arquivados) é de quem está olhando, guardada na conta.
  const barra = useVisualizacao("clientes-funis");
  const arquivados = useMemo(
    () => new Set(barra.preferencias.funis?.arquivados ?? []),
    [barra.preferencias.funis?.arquivados],
  );
  const campanhaDoFunil = useMemo(
    () =>
      new Map(
        (dados?.campanhas ?? [])
          .filter((c) => c.pipeline_id)
          .map((c) => [
            c.pipeline_id as string,
            { status: c.status ?? null, canal: c.channel ?? null },
          ]),
      ),
    [dados],
  );
  const funisNaOrdem: FunilDaBarra[] = useMemo(() => {
    const ordem = barra.preferencias.funis?.ordem ?? [];
    const base = dados?.funis ?? [];
    const rank = (id: string) => {
      const i = ordem.indexOf(id);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...base]
      .sort((a, b) => rank(a.id) - rank(b.id))
      .map((f) => ({
        id: f.id,
        nome: f.name,
        statusDaCampanha: campanhaDoFunil.get(f.id)?.status ?? null,
        canal: campanhaDoFunil.get(f.id)?.canal ?? null,
      }));
  }, [dados, barra.preferencias.funis?.ordem, campanhaDoFunil]);

  const etapasPorId = useMemo(() => new Map((dados?.etapas ?? []).map((e) => [e.id, e])), [dados]);
  const campanhasPorId = useMemo(
    () => new Map((dados?.campanhas ?? []).map((c) => [c.id, c.name])),
    [dados],
  );
  const funisPorId = useMemo(() => new Map((dados?.funis ?? []).map((f) => [f.id, f])), [dados]);
  const todasAsTags = useMemo(
    () => [...new Set((dados?.clientes ?? []).flatMap((c) => c.tags))].sort(),
    [dados],
  );

  const linhas: Linha[] = useMemo(() => {
    const base = dados?.clientes ?? [];
    // Oportunidades: UMA LINHA POR OPORTUNIDADE (todas as de todos os leads; o funil e a campanha
    // filtram), cada uma com a venda dela.
    if (ehOportunidades) {
      return base.flatMap((c) =>
        c.participacoes
          .filter((p) => !funilAtual || p.funil_id === funilAtual.id)
          .map((p) => ({
            ...c,
            participacao: p,
            participacoes: [p],
            vendas_ativas: c.vendas_ativas.filter((v) => v.lead_id === p.lead_id),
            chave: p.lead_id,
          })),
      );
    }
    return base.map((c) => {
      const doFunil =
        funilAtual === null
          ? null
          : (c.participacoes.find((p) => p.funil_id === funilAtual.id && p.status === "open") ??
            c.participacoes.find((p) => p.funil_id === funilAtual.id) ??
            null);
      return { ...c, participacao: doFunil, chave: c.contact_id };
    });
  }, [dados, funilAtual, ehOportunidades]);

  /** Uma participação por funil, na mesma ordem nas colunas Funis e Etapa (uma linha por funil). */
  const porFunil = (l: Linha): ParticipacaoDoCliente[] => {
    const escolhida = new Map<string, ParticipacaoDoCliente>();
    for (const p of l.participacoes) {
      const atual = escolhida.get(p.funil_id);
      if (!atual || (atual.status !== "open" && p.status === "open")) escolhida.set(p.funil_id, p);
    }
    return [...escolhida.values()].sort((x, y) => x.criado_em.localeCompare(y.criado_em));
  };

  const corDaEtapa = (e: Etapa | undefined): CorDaOpcao =>
    !e ? "gray" : e.is_won ? "green" : e.is_lost ? "red" : PALETA[e.position % PALETA.length]!;
  const dia = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(tag, { day: "2-digit", month: "2-digit", year: "numeric" })
      : "";
  const moeda = (centavos: number) =>
    (centavos / 100).toLocaleString(tag, {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  /**
   * Os valores do lead, SOMADOS DAS VENDAS e definidos pelo status delas (no funil escolhido, se
   * houver): pago = o que já entrou; comprometido = valor das vendas comprometidas e concluídas
   * (pago + a receber); interesse = valor das vendas em interesse.
   */
  const valoresDoLead = (l: Linha) => {
    let pago = 0;
    let comprometido = 0;
    let interesse = 0;
    for (const v of l.vendas_ativas ?? []) {
      if (funilAtual && v.funil_id !== funilAtual.id) continue;
      if (v.status === "interesse") interesse += v.valor_cents;
      else {
        // Venda recorrente: as parcelas pagas podem passar do valor da venda (uma por mês).
        pago += v.pago_cents;
        // Assinatura: o comprometido é o já pago mais as parcelas previstas dos meses à frente.
        comprometido += v.recorrente
          ? v.pago_cents + v.previsto_cents
          : Math.max(v.valor_cents, v.pago_cents);
      }
    }
    return { pago, comprometido, aReceber: Math.max(0, comprometido - pago), interesse };
  };
  /** Abre o popup da venda (carrega a venda inteira: itens, parcelas, origem…). */
  async function abrirVenda(l: Linha, vendaId: string) {
    try {
      const r = await apiClient.get<{ data: { vendas: Venda[] } }>(
        `/api/v1/vendas?contato=${l.contact_id}`,
      );
      const venda = r.data.vendas.find((v) => v.id === vendaId);
      if (venda) setVendaAberta({ venda, nome: l.nome });
    } catch (e) {
      showApiError(e);
    }
  }
  async function salvarVendaAberta(v: DadosDaVenda): Promise<boolean> {
    try {
      const { id, contact_id: _contato, ...resto } = v;
      if (id) await apiClient.patch(`/api/v1/vendas/${id}`, resto);
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      await queryClient.invalidateQueries({ queryKey: ["vendas"] });
      return true;
    } catch (e) {
      showApiError(e);
      return false;
    }
  }
  async function alterarMql(contactId: string, is_mql: boolean) {
    try {
      await apiClient.put(`/api/v1/contacts/${contactId}/qualificacao`, { is_mql });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      showApiError(e);
    }
  }
  async function moverEtapa(p: ParticipacaoDoCliente, etapaId: string) {
    try {
      await apiClient.post(`/api/v1/leads/${p.lead_id}/move`, {
        stage_id: etapaId,
        position_in_stage: new Date().getTime(),
        expected_updated_at: p.atualizado_em,
      });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      showApiError(e);
    }
  }

  /** Os negócios que a linha mostra: o do funil escolhido, ou um por funil em "Todos". */
  /** As vendas do lead que a tabela mostra: do funil escolhido e dos status marcados. */
  const vendasVisiveis = (l: Linha) =>
    (l.vendas_ativas ?? []).filter(
      (v) =>
        (!funilAtual || v.funil_id === funilAtual.id) &&
        (statusDasVendas.size === 0 || statusDasVendas.has(v.status)),
    );
  /**
   * UMA LINHA POR VENDA: cada venda do lead é uma linha, com o card (funil e etapa) em que ela
   * está; campanha, anúncio e landing page são os da própria venda. Sem venda, cai nos cards.
   */
  const itensDaLinha = (l: Linha): Array<{ venda: VendaAtivaDoCliente | null; p: ParticipacaoDoCliente }> => {
    const base = l.participacao ? l.participacoes : l.participacoes;
    const porVenda = vendasVisiveis(l)
      .map((v) => ({ venda: v, p: base.find((x) => x.lead_id === v.lead_id) ?? null }))
      .sort((x, y) => (x.p?.criado_em ?? "").localeCompare(y.p?.criado_em ?? ""));
    if (porVenda.length > 0 && porVenda.every((i) => i.p)) {
      return porVenda as Array<{ venda: VendaAtivaDoCliente; p: ParticipacaoDoCliente }>;
    }
    return (l.participacao ? [l.participacao] : porFunil(l)).map((p) => ({ venda: null, p }));
  };
  const partes = (l: Linha): ParticipacaoDoCliente[] => itensDaLinha(l).map((i) => i.p);
  /** O negócio que uma edição de linha única atinge (valor, campanha, origem, responsável). */
  const alvoDaLinha = (l: Linha): ParticipacaoDoCliente | null => {
    const lista = partes(l);
    if (lista.length === 1) return lista[0]!;
    const abertas = lista.filter((p) => p.status === "open");
    return abertas.length === 1 ? abertas[0]! : null;
  };

  // Edição no lugar: a tela muda NA HORA (cache) e o servidor confirma; se falhar, relê tudo.
  function otimista(mudar: (c: ClienteDaLista) => ClienteDaLista, contactId: string) {
    queryClient.setQueryData<{ data?: never } | Dados>(chaveDaConsulta, (atual) => {
      const d = atual as Dados | undefined;
      if (!d?.clientes) return atual;
      return {
        ...d,
        clientes: d.clientes.map((c) => (c.contact_id === contactId ? mudar(c) : c)),
      };
    });
  }
  function otimistaNegocio(
    contactId: string,
    leadId: string,
    mudar: (p: ParticipacaoDoCliente) => ParticipacaoDoCliente,
  ) {
    otimista(
      (c) => ({
        ...c,
        participacoes: c.participacoes.map((p) => (p.lead_id === leadId ? mudar(p) : p)),
      }),
      contactId,
    );
  }
  async function executar(acao: () => Promise<unknown>) {
    try {
      await acao();
    } catch (e) {
      showApiError(e);
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    }
  }
  const salvarContato = (
    l: Linha,
    patch: Record<string, unknown>,
    local: Partial<ClienteDaLista>,
  ) => {
    otimista((c) => ({ ...c, ...local }), l.contact_id);
    return executar(() => apiClient.patch(`/api/v1/contacts/${l.contact_id}`, patch));
  };
  const salvarNegocio = (
    l: Linha,
    p: ParticipacaoDoCliente,
    patch: Record<string, unknown>,
    local: Partial<ParticipacaoDoCliente>,
  ) => {
    otimistaNegocio(l.contact_id, p.lead_id, (x) => ({ ...x, ...local }));
    return executar(() => apiClient.patch(`/api/v1/leads/${p.lead_id}`, patch));
  };
  const salvarOrigem = (
    l: Linha,
    p: ParticipacaoDoCliente,
    corpo: { campaign_id?: string | null; source?: string },
  ) => {
    otimistaNegocio(l.contact_id, p.lead_id, (x) => ({
      ...x,
      ...(corpo.campaign_id !== undefined ? { campanha_id: corpo.campaign_id } : {}),
      ...(corpo.source !== undefined ? { origem: corpo.source } : {}),
    }));
    return executar(() => apiClient.put(`/api/v1/leads/${p.lead_id}/origem`, corpo));
  };
  // Comprou só vale com pagamento: sem ele, abre a venda para registrar ao menos o sinal.
  const ganhar = async (l: Linha, p: ParticipacaoDoCliente) => {
    try {
      await apiClient.post(`/api/v1/leads/${p.lead_id}/win`, {});
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      if ((e as { code?: string }).code === "comprou_exige_pagamento") {
        await abrirVenda(l, p.lead_id);
        return;
      }
      showApiError(e);
    }
  };
  /** Muda a etapa de uma oportunidade (tabela ou quadro) respeitando perda, desqualificação e ganho. */
  const escolherEtapa = (l: Linha, p: ParticipacaoDoCliente, id: string) => {
    // Etapa de perda pede o motivo (o mesmo diálogo de antes).
    if (etapasPorId.get(id)?.is_lost) {
      setPerdendo({ leadId: p.lead_id, funilId: p.funil_id });
      return;
    }
    // Desqualificado também encerra, e também pede o motivo.
    if (etapasPorId.get(id)?.qualification === "disqualified") {
      setPerdendo({ leadId: p.lead_id, funilId: p.funil_id, etapaId: id });
      return;
    }
    // Etapa de ganho: fecha como venda (o banco efetiva a venda e abre o pop-up).
    if (etapasPorId.get(id)?.is_won) {
      void ganhar(l, p);
      return;
    }
    void moverEtapa(p, id);
  };
  const levarParaFunil = (p: ParticipacaoDoCliente, destinoId: string) => {
    const destino = funisPorId.get(destinoId)?.name ?? "";
    if (
      !window.confirm(
        t(
          "Levar este lead para o funil “{funil}”? Ele entra lá na primeira etapa e a passagem pelo funil atual é encerrada como perdida (“Levado para outro funil”).",
        ).replace("{funil}", destino),
      )
    ) {
      return;
    }
    return executar(() =>
      apiClient.post(`/api/v1/leads/${p.lead_id}/clone`, { pipeline_id: destinoId }),
    );
  };
  /** TODAS as etapas do funil: a etapa diz também se a venda deu certo (ganho) ou não (perdido). */
  const etapasDoFunil = (funilId: string) =>
    (dados?.etapas ?? [])
      .filter((e) => e.pipeline_id === funilId)
      .map((e) => ({
        id: e.id,
        rotulo: e.is_won ? `${e.name} ✓` : e.is_lost ? `${e.name} ✕` : e.name,
        cor: corDaEtapa(e),
      }));
  const opcoesDeFunil = (dados?.funis ?? []).map((f) => ({
    id: f.id,
    rotulo: f.name,
    cor: "gray" as CorDaOpcao,
  }));
  const empilhado = (itens: React.ReactNode[]) => (
    <div className="flex min-w-0 flex-col items-stretch gap-0.5 py-0.5">{itens}</div>
  );
  const semValor = <span className="block px-2 text-sm text-muted-foreground">—</span>;

  const opcoesDeEtapa = (dados?.etapas ?? [])
    .filter((e) => !funilAtual || e.pipeline_id === funilAtual.id)
    .map((e) => ({ id: e.id, rotulo: e.name, cor: corDaEtapa(e), pipeline_id: e.pipeline_id }));

  const colunas: ColunaDoMotor<Linha>[] = [
    {
      id: "nome",
      titulo: ehOportunidades ? t("Oportunidade") : t("Nome"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 300,
      semOcultar: true,
      celula: (l) =>
        ehOportunidades && l.participacao ? (
          <div className="flex min-w-0 items-center gap-1">
            <div className="min-w-0 flex-1">
              <CelulaDeTexto
                valor={l.participacao.titulo || l.nome}
                rotulo={t("Título da oportunidade")}
                podeEditar={podeEditar}
                aoSalvar={(nome) => {
                  const p = l.participacao!;
                  const novo = nome.trim();
                  if (!novo || novo === p.titulo) return;
                  otimistaNegocio(l.contact_id, p.lead_id, (x) => ({ ...x, titulo: novo }));
                  void executar(() => apiClient.patch(`/api/v1/vendas/${p.lead_id}`, { name: novo }));
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => void abrirVenda(l, l.participacao!.lead_id)}
              className="inline-flex h-7 shrink-0 items-center rounded-md border bg-card px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase hover:bg-secondary hover:text-foreground"
            >
              {t("Abrir")}
            </button>
          </div>
        ) : (
        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1">
            <CelulaDeTexto
              valor={l.nome}
              rotulo={t("Nome do lead")}
              podeEditar={podeEditar}
              aoSalvar={(nome) => void salvarContato(l, { name: nome }, { nome })}
            />
          </div>
          <Link
            href={`/app/contacts/${l.contact_id}`}
            className="inline-flex h-7 shrink-0 items-center rounded-md border bg-card px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase hover:bg-secondary hover:text-foreground"
          >
            {t("Abrir")}
          </Link>
        </div>
        ),
    },
    {
      id: "cliente",
      titulo: t("Cliente"),
      icone: <Users size={14} aria-hidden />,
      largura: 200,
      padrao: ehOportunidades,
      celula: (l) => (
        <Link
          href={`/app/contacts/${l.contact_id}`}
          className="block min-w-0 truncate px-2 text-sm hover:underline"
        >
          {l.nome}
        </Link>
      ),
    },
    {
      id: "funis",
      titulo: t("Funis"),
      icone: <Rows size={14} aria-hidden />,
      largura: 230,
      celula: (l) => {
        const lista = partes(l);
        if (lista.length === 0) return semValor;
        return empilhado(
          lista.map((p) => (
            <SeletorDeOpcao
              key={p.lead_id}
              opcoes={opcoesDeFunil}
              valorId={p.funil_id}
              podeEditar={podeEditar && p.status === "open" && opcoesDeFunil.length > 1}
              rotulo={t("Funil")}
              aoEscolher={(id) => {
                if (id !== p.funil_id) void levarParaFunil(p, id);
              }}
            >
              <Etiqueta cor="gray">{funisPorId.get(p.funil_id)?.name ?? "—"}</Etiqueta>
            </SeletorDeOpcao>
          )),
        );
      },
    },
    {
      id: "etapa",
      titulo: t("Etapa"),
      icone: <Kanban size={14} aria-hidden />,
      largura: 250,
      celula: (l) => {
        const lista = partes(l);
        if (lista.length === 0) return semValor;
        return empilhado(
          lista.map((p) => {
            const atual = etapasPorId.get(p.etapa_id);
            const prefixo = lista.length > 1 ? `${funisPorId.get(p.funil_id)?.name ?? "—"} - ` : "";
            return (
              <SeletorDeOpcao
                key={p.lead_id}
                opcoes={etapasDoFunil(p.funil_id)}
                valorId={atual?.id}
                podeEditar={podeEditar}
                rotulo={t("Etapa no funil")}
                aoEscolher={(id) => {
                  if (id === atual?.id) return;
                  escolherEtapa(l, p, id);
                }}
              >
                <Etiqueta ponto cor={corDaEtapa(atual)}>
                  {`${prefixo}${atual?.name ?? "—"}`}
                </Etiqueta>
              </SeletorDeOpcao>
            );
          }),
        );
      },
    },
    {
      id: "campanha",
      titulo: t("Campanha"),
      icone: <Rows size={14} aria-hidden />,
      largura: 230,
      celula: (l) => {
        const lista = itensDaLinha(l);
        if (lista.length === 0) return semValor;
        return empilhado(
          lista.map(({ venda, p }, i) => {
            const id = venda ? venda.campanha_id : p.campanha_id;
            const nome = id ? campanhasPorId.get(id) : null;
            return (
              <SeletorDeOpcao
                key={venda?.id ?? `${p.lead_id}-${i}`}
                opcoes={(dados?.campanhas ?? []).map((c) => ({
                  id: c.id,
                  rotulo: c.name,
                  cor: "gray" as CorDaOpcao,
                }))}
                valorId={id ?? undefined}
                podeEditar={podeEditar}
                rotulo={t("Campanha de origem")}
                aoEscolher={(novo) => void salvarOrigem(l, p, { campaign_id: novo })}
                aoLimpar={() => void salvarOrigem(l, p, { campaign_id: null })}
              >
                <span className="block min-w-0 truncate px-2 text-sm" title={nome ?? ""}>
                  {nome ?? "—"}
                </span>
              </SeletorDeOpcao>
            );
          }),
        );
      },
    },
    {
      id: "ciclo",
      titulo: t("Ciclo de vida"),
      icone: <Users size={14} aria-hidden />,
      largura: 190,
      celula: (l) =>
        ehCicloDeVida(l.ciclo_de_vida) ? (
          <span className="block px-2" title={l.ciclo_motivo ?? undefined}>
            <Etiqueta ponto cor={COR_DO_CICLO[l.ciclo_de_vida]}>
              {t(ROTULO_DO_CICLO[l.ciclo_de_vida])}
            </Etiqueta>
            {l.oportunidades_abertas > 0 && l.ciclo_de_vida !== "em_negociacao" ? (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {l.oportunidades_abertas === 1
                  ? t("1 oportunidade aberta")
                  : `${l.oportunidades_abertas} ${t("oportunidades abertas")}`}
              </span>
            ) : null}
          </span>
        ) : (
          semValor
        ),
    },
    {
      id: "mql",
      titulo: "MQL",
      icone: <Users size={14} aria-hidden />,
      largura: 100,
      celula: (l) => (
        <CelulaDeCaixa
          marcada={l.is_mql}
          podeEditar={podeEditar}
          rotulo={t("Lead qualificado (MQL)")}
          aoMudar={(v) => void alterarMql(l.contact_id, v)}
        />
      ),
    },
    {
      id: "responsavel",
      titulo: t("Responsável"),
      icone: <Users size={14} aria-hidden />,
      largura: 190,
      celula: (l) => {
        const alvo = alvoDaLinha(l);
        if (!alvo) {
          return (
            <span className="block truncate px-2 text-sm text-muted-foreground">
              {nomeDoMembro(
                l.participacoes.find((p) => p.responsavel_id)?.responsavel_id ?? null,
              ) ?? "—"}
            </span>
          );
        }
        return (
          <CelulaDePessoa
            membros={membros}
            valorId={alvo.responsavel_id}
            podeEditar={podeEditar}
            rotulo={t("Responsável no funil")}
            aoEscolher={(id) =>
              void salvarNegocio(l, alvo, { owner_user_id: id }, { responsavel_id: id })
            }
          />
        );
      },
    },
    {
      id: "previsao",
      titulo: t("Previsão de fechamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 190,
      padrao: ehOportunidades,
      celula: (l) => {
        const alvo = alvoDaLinha(l);
        if (!alvo) {
          const datas = partes(l)
            .map((p) => p.previsao_de_fechamento)
            .filter((d): d is string => Boolean(d))
            .sort();
          return <span className="block truncate px-2 text-sm text-muted-foreground">{datas[0] ? dia(datas[0]) : "—"}</span>;
        }
        return (
          <CelulaDeDia
            valor={alvo.previsao_de_fechamento ? alvo.previsao_de_fechamento.slice(0, 10) : null}
            tag={tag}
            podeEditar={podeEditar}
            rotulo={t("Previsão de fechamento")}
            aoSalvar={(d) =>
              void salvarNegocio(l, alvo, { expected_close_date: d }, { previsao_de_fechamento: d })
            }
          />
        );
      },
    },
    {
      id: "dono",
      titulo: t("Gestor de Relacionamento"),
      icone: <Users size={14} aria-hidden />,
      largura: 210,
      padrao: !ehOportunidades,
      celula: (l) => (
        <CelulaDePessoa
          membros={membros}
          valorId={l.dono_user_id}
          podeEditar={podeEditar}
          rotulo={t("Gestor de Relacionamento")}
          aoEscolher={(id) => {
            otimista((c) => ({ ...c, dono_user_id: id }), l.contact_id);
            void executar(() =>
              apiClient.post("/api/v1/clientes/lote", {
                action: "dono",
                contact_ids: [l.contact_id],
                user_id: id,
              }),
            );
          }}
        />
      ),
    },
    {
      id: "ativo-ate",
      titulo: t("Ativo até (próxima recompra)"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 190,
      padrao: false,
      celula: (l) => (
        <span className="block truncate px-2 text-sm">{l.ativo_ate ? dia(l.ativo_ate) : "—"}</span>
      ),
    },
    {
      id: "radar",
      titulo: t("Radar"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 230,
      padrao: ehOportunidades,
      celula: (l) => {
        const p = l.participacao;
        if (!p || p.status !== "open") return semValor;
        const balde = baldeDoRadar(l);
        if (!balde) return semValor;
        const horas = (agora - new Date(p.ultima_atividade ?? p.criado_em).getTime()) / 3_600_000;
        return (
          <span className="flex min-w-0 items-center gap-2 px-2">
            <Etiqueta ponto cor={COR_DO_RADAR[balde]}>
              {t(ROTULO_DO_RADAR[balde])}
            </Etiqueta>
            {balde !== "em_dia" ? (
              <span className="truncate text-xs text-muted-foreground">
                {coolingLabel(horas, t)}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "resultado-rapido",
      titulo: t("Resultado da ligação"),
      icone: <Phone size={14} aria-hidden />,
      largura: 440,
      padrao: ehOportunidades,
      celula: (l) => {
        const p = l.participacao;
        if (!p) return semValor;
        return (
          <ResultadoRapidoDaLigacao
            leadId={p.lead_id}
            contactId={l.contact_id}
            aberta={p.status === "open"}
            podeEditar={podeEditar}
            aoPerder={() => setPerdendo({ leadId: p.lead_id, funilId: p.funil_id })}
          />
        );
      },
    },
    {
      id: "tentativas",
      titulo: t("Tentativas"),
      icone: <Phone size={14} aria-hidden />,
      largura: 200,
      padrao: ehOportunidades,
      celula: (l) => {
        const p = l.participacao;
        if (!p || p.tentativas === 0) return semValor;
        const dias = p.ultima_tentativa
          ? Math.floor((agora - new Date(p.ultima_tentativa).getTime()) / 86_400_000)
          : null;
        const quando = dias === null ? "" : dias <= 0 ? t("hoje") : `${t("há")} ${dias} ${dias === 1 ? t("dia") : t("dias")}`;
        return (
          <span className="block truncate px-2 text-sm">
            {p.tentativas} {p.tentativas === 1 ? t("tentativa") : t("tentativas")}
            {quando ? ` · ${t("última")} ${quando}` : ""}
          </span>
        );
      },
    },
    {
      id: "ligar",
      titulo: t("Ligar"),
      icone: <Phone size={14} aria-hidden />,
      largura: 90,
      padrao: ehOportunidades,
      celula: (l) =>
        l.telefone ? (
          <a
            href={`tel:${l.telefone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-2 inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-secondary"
          >
            <Phone size={14} aria-hidden />
            {t("Ligar")}
          </a>
        ) : (
          semValor
        ),
    },
    {
      id: "whatsapp",
      titulo: "WhatsApp",
      icone: <WhatsappLogo size={14} aria-hidden />,
      largura: 120,
      padrao: ehOportunidades,
      celula: (l) => (
        <BotaoWhatsApp
          telefone={l.telefone}
          dados={{
            nome: l.nome,
            produto: l.participacao?.produtos ?? "",
            campanha: l.participacao?.campanha_id
              ? (campanhasPorId.get(l.participacao.campanha_id) ?? "")
              : "",
            responsavel: nomeDoMembro(l.participacao?.responsavel_id ?? null) ?? "",
          }}
        />
      ),
    },
    {
      id: "instagram",
      titulo: "Instagram",
      icone: <InstagramLogo size={14} aria-hidden />,
      largura: 120,
      padrao: false,
      celula: (l) => {
        const link = typeof l.campos.link_instagram === "string" ? l.campos.link_instagram : "";
        return /^https?:\/\//i.test(link) ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-2 inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-secondary"
          >
            <InstagramLogo size={14} aria-hidden />
            Instagram
          </a>
        ) : (
          semValor
        );
      },
    },
    {
      id: "inbox",
      titulo: t("Inbox"),
      icone: <ChatCircle size={14} aria-hidden />,
      largura: 130,
      padrao: ehOportunidades,
      celula: (l) =>
        l.conversa_id ? (
          <Link
            href={`/app/inbox?id=${l.conversa_id}`}
            className="mx-2 inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-secondary"
          >
            <ChatCircle size={14} aria-hidden />
            {t("Abrir no Inbox")}
          </Link>
        ) : l.telefone ? (
          <span className="mx-2 inline-flex">
            <AbrirConversaDoLead contactId={l.contact_id} phone={l.telefone} />
          </span>
        ) : (
          semValor
        ),
    },
    {
      id: "acao",
      titulo: t("Adicionar ação"),
      icone: <Plus size={14} aria-hidden />,
      largura: 150,
      padrao: ehOportunidades,
      celula: (l) => (
        <button
          type="button"
          disabled={!podeEditar}
          onClick={() => setAcaoDoContato(l.contact_id)}
          className="mx-2 inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
        >
          <Plus size={14} aria-hidden />
          {t("Adicionar ação")}
        </button>
      ),
    },
    {
      id: "comentarios",
      titulo: t("Comentários"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 280,
      padrao: ehOportunidades,
      celula: (l) => {
        const p = l.participacao;
        if (!p) return semValor;
        return (
          <CelulaDeTexto
            valor={p.comentarios}
            rotulo={t("Comentários")}
            vazioRotulo={t("Escrever um comentário…")}
            podeEditar={podeEditar}
            aoSalvar={(texto) => {
              const novo = texto.trim();
              if (novo === p.comentarios) return;
              otimistaNegocio(l.contact_id, p.lead_id, (x) => ({ ...x, comentarios: novo }));
              void executar(() => apiClient.patch(`/api/v1/vendas/${p.lead_id}`, { notes: novo }));
            }}
          />
        );
      },
    },
    {
      id: "proxima-acao",
      titulo: t("Próxima ação"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 260,
      padrao: ehOportunidades,
      celula: (l) => {
        const p = l.participacao;
        if (!p) return semValor;
        return (
          <CelulaDeTexto
            valor={p.proxima_acao}
            rotulo={t("Próxima ação")}
            vazioRotulo={p.status === "open" ? t("Sem próxima ação") : "—"}
            podeEditar={podeEditar && p.status === "open"}
            aoSalvar={(texto) => {
              const nova = texto.trim();
              if (nova === p.proxima_acao) return;
              // Toda vez que a ação é escrita, a data é confirmada (a atual já vem escolhida).
              setConfirmandoAcao({
                leadId: p.lead_id,
                contactId: l.contact_id,
                texto: nova,
                dataAtual: p.proxima_acao_em,
              });
            }}
          />
        );
      },
    },
    {
      id: "proxima-acao-em",
      titulo: t("Próxima ação em"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      padrao: ehOportunidades,
      celula: (l) => {
        const p = l.participacao;
        if (!p) return semValor;
        const atrasada = p.status === "open" && p.proxima_acao_em && p.proxima_acao_em < hojeIso;
        return (
          <div className={atrasada ? "text-error-fg" : undefined}>
            <CelulaDeDia
              valor={p.proxima_acao_em}
              tag={tag}
              podeEditar={podeEditar && p.status === "open"}
              rotulo={t("Próxima ação em")}
              aoSalvar={(v) => {
                otimistaNegocio(l.contact_id, p.lead_id, (x) => ({ ...x, proxima_acao_em: v }));
                void executar(() =>
                  apiClient.put(`/api/v1/leads/${p.lead_id}/proxima-acao`, { proxima_acao_em: v }),
                );
              }}
            />
          </div>
        );
      },
    },
    {
      id: "entrou-no-funil",
      titulo: t("Entrou no Funil em"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 160,
      padrao: ehOportunidades,
      celula: (l) => (
        <span className="block truncate px-2 text-sm">
          {l.participacao ? dia(l.participacao.criado_em) : "—"}
        </span>
      ),
    },
    {
      id: "produtos",
      titulo: t("Produto(s)"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 240,
      padrao: ehOportunidades,
      celula: (l) => (
        <span className="block truncate px-2 text-sm" title={l.participacao?.produtos}>
          {l.participacao?.produtos || "—"}
        </span>
      ),
    },
    {
      id: "status-venda",
      titulo: t("Status"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 180,
      padrao: ehOportunidades,
      celula: (l) => {
        const st = l.participacao?.status_da_venda;
        return st ? (
          <span className="block px-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${COR_DA_VENDA[st] ?? ""}`}
            >
              {t(ROTULO_DA_VENDA[st] ?? st)}
            </span>
          </span>
        ) : (
          semValor
        );
      },
    },
    {
      id: "forma-de-pagamento",
      titulo: t("Forma de pagamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      padrao: ehOportunidades,
      celula: (l) => (
        <span className="block truncate px-2 text-sm">
          {l.participacao?.forma_de_pagamento
            ? rotuloDaFormaDe(l.participacao.forma_de_pagamento)
            : "—"}
        </span>
      ),
    },
    {
      id: "parcelas",
      titulo: t("Parcelas"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 120,
      padrao: ehOportunidades,
      celula: (l) => {
        const p = l.participacao;
        return (
          <span className="block px-2 text-sm tabular-nums">
            {p && p.parcelas_total > 0 ? `${p.parcelas_pagas}/${p.parcelas_total}` : "—"}
          </span>
        );
      },
    },
    {
      id: "pago",
      titulo: t("Valor pago"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      padrao: ehOportunidades,
      celula: (l) => (
        <span className="block px-2 text-sm text-green-700 tabular-nums dark:text-green-400">
          {l.participacao && l.participacao.pago_cents > 0 ? moeda(l.participacao.pago_cents) : "—"}
        </span>
      ),
    },
    {
      id: "previsto",
      titulo: t("Valor previsto"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      padrao: ehOportunidades,
      celula: (l) => (
        <span className="block px-2 text-sm tabular-nums">
          {l.participacao && l.participacao.previsto_cents > 0
            ? moeda(l.participacao.previsto_cents)
            : "—"}
        </span>
      ),
    },
    {
      id: "primeiro-pagamento",
      titulo: t("Primeiro pagamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 160,
      padrao: false,
      celula: (l) => (
        <span className="block px-2 text-sm">{dia(l.participacao?.primeiro_pagamento ?? null) || "—"}</span>
      ),
    },
    {
      id: "ultimo-pagamento",
      titulo: t("Último pagamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 160,
      padrao: false,
      celula: (l) => (
        <span className="block px-2 text-sm">{dia(l.participacao?.ultimo_pagamento ?? null) || "—"}</span>
      ),
    },
    {
      id: "proximo-pagamento",
      titulo: t("Próximo pagamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 160,
      padrao: false,
      celula: (l) => (
        <span className="block px-2 text-sm">{dia(l.participacao?.proximo_pagamento ?? null) || "—"}</span>
      ),
    },
    {
      id: "posicionamento",
      titulo: t("Posicionamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      padrao: false,
      celula: (l) => (
        <span className="block truncate px-2 text-sm">{l.participacao?.posicionamento ?? "—"}</span>
      ),
    },
    {
      id: "telefone",
      titulo: t("Telefone"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 180,
      celula: (l) => (
        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1">
            <CelulaDeTexto
              valor={l.telefone ?? ""}
              rotulo={t("Telefone")}
              vazioRotulo="—"
              inputMode="numeric"
              podeEditar={podeEditar}
              aoSalvar={(texto) => {
                const fone = telefoneE164(texto);
                if (!fone || fone === l.telefone) return;
                void salvarContato(l, { phone_number: fone }, { telefone: fone });
              }}
            />
          </div>
          {l.telefone ? (
            <a
              href={`tel:${l.telefone}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t("Ligar para o lead")}
              aria-label={t("Ligar para o lead")}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Phone size={14} aria-hidden />
            </a>
          ) : null}
        </div>
      ),
    },
    {
      id: "email",
      titulo: t("E-mail"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 230,
      padrao: false,
      celula: (l) => (
        <CelulaDeTexto
          valor={l.email ?? ""}
          rotulo={t("E-mail")}
          vazioRotulo="—"
          podeEditar={podeEditar}
          aoSalvar={(email) => {
            if (!email.includes("@") || email === l.email) return;
            void salvarContato(l, { email }, { email });
          }}
        />
      ),
    },
    {
      id: "origem",
      titulo: t("Origem"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      celula: (l) => {
        // Na aba Clientes a origem é a do CADASTRO do lead (não a de uma oportunidade dele).
        if (!ehOportunidades) {
          return (
            <span className="block truncate px-2 text-sm">
              {l.origem_do_cliente.fonte ?? l.origem ?? "—"}
            </span>
          );
        }
        const alvo = alvoDaLinha(l);
        const atual = alvo?.origem ?? l.origem ?? "";
        if (!alvo) return <span className="block truncate px-2 text-sm">{atual || "—"}</span>;
        return (
          <CelulaDeTexto
            valor={atual}
            rotulo={t("Origem")}
            vazioRotulo="—"
            podeEditar={podeEditar}
            aoSalvar={(source) => {
              if (source === atual) return;
              void salvarOrigem(l, alvo, { source });
            }}
          />
        );
      },
    },
    {
      id: "tags",
      titulo: t("Tags"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 260,
      padrao: false,
      celula: (l) => (
        <CelulaDeEtiquetas
          tags={l.tags}
          sugestoes={todasAsTags}
          podeEditar={podeEditar}
          rotulo={t("Tags do lead")}
          aoMudar={(tags) => void salvarContato(l, { tags }, { tags })}
        />
      ),
    },
    {
      id: "entrou",
      titulo: t("Entrou em"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      celula: (l) => <span className="block truncate px-2 text-sm">{dia(l.entrou_em)}</span>,
    },
    {
      id: "abordagem",
      titulo: t("Primeira abordagem"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      padrao: false,
      celula: (l) => (
        <span className="block truncate px-2 text-sm">{dia(l.primeira_abordagem) || "—"}</span>
      ),
    },
    {
      id: "primeira-compra",
      titulo: t("Primeira compra"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 160,
      celula: (l) => (
        <span className="block truncate px-2 text-sm">
          {l.primeira_compra
            ? new Date(`${l.primeira_compra}T12:00:00`).toLocaleDateString(tag)
            : "—"}
        </span>
      ),
    },
    {
      id: "ltv",
      titulo: t("LTV atual (valor pago)"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      celula: (l) => {
        const v = valoresDoLead(l).pago;
        return (
          <span className="block truncate px-2 text-sm font-medium tabular-nums">
            {v > 0 ? moeda(v) : "—"}
          </span>
        );
      },
    },
    {
      id: "ltv-previsto",
      titulo: t("A receber"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 150,
      celula: (l) => {
        const v = valoresDoLead(l).aReceber;
        return (
          <span className="block truncate px-2 text-sm tabular-nums">{v > 0 ? moeda(v) : "—"}</span>
        );
      },
    },
    {
      id: "interesse",
      titulo: t("Em interesse"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 150,
      celula: (l) => {
        const v = valoresDoLead(l).interesse;
        return (
          <span className="block truncate px-2 text-sm tabular-nums">{v > 0 ? moeda(v) : "—"}</span>
        );
      },
    },
    {
      id: "vendas",
      titulo: t("Compras pagas (qtd)"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 130,
      padrao: false,
      celula: (l) => <span className="block px-2 text-sm tabular-nums">{l.vendas || "—"}</span>,
    },
    {
      id: "vendas-ativas",
      titulo: t("Vendas"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 320,
      celula: (l) => {
        const lista = itensDaLinha(l).filter((i) => i.venda);
        if (lista.length === 0) return semValor;
        return empilhado(
          lista.map(({ venda }) => (
            <button
              key={venda!.id}
              type="button"
              onClick={() => void abrirVenda(l, venda!.id)}
              title={t("Abrir a venda")}
              className="flex min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-sm hover:bg-secondary"
            >
              <span className="min-w-0 truncate" title={venda!.nome}>
                {venda!.nome || t("Sem produto")}
              </span>
              <span
                className={`shrink-0 rounded-full border px-1.5 text-[11px] font-medium ${
                  COR_DA_VENDA[venda!.status] ?? ""
                }`}
              >
                {t(ROTULO_DA_VENDA[venda!.status] ?? venda!.status)}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {moeda(venda!.valor_cents)}
              </span>
            </button>
          )),
        );
      },
    },
    {
      id: "oportunidades-abertas",
      titulo: t("Oportunidades abertas"),
      icone: <Kanban size={14} aria-hidden />,
      largura: 190,
      celula: (l) =>
        l.oportunidades_abertas > 0 ? (
          <Link
            href={`/app/contacts/${l.contact_id}?aba=oportunidades`}
            title={t("Ver as oportunidades deste cliente")}
            onClick={(e) => e.stopPropagation()}
            className="mx-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 text-sm font-semibold text-primary tabular-nums hover:bg-primary/20"
          >
            {l.oportunidades_abertas}
          </Link>
        ) : (
          <span className="block px-2 text-sm text-muted-foreground">0</span>
        ),
    },
    {
      id: "funis-ate-comprar",
      titulo: t("Funis até a 1ª compra"),
      icone: <Kanban size={14} aria-hidden />,
      largura: 170,
      padrao: false,
      celula: (l) => {
        const compra = l.primeira_compra;
        const funis = new Set(
          l.participacoes
            .filter((p) => !compra || p.criado_em.slice(0, 10) <= compra.slice(0, 10))
            .map((p) => p.funil_id),
        );
        return (
          <span
            className="block px-2 text-sm tabular-nums"
            title={t("Quantos funis diferentes o lead percorreu até comprar")}
          >
            {compra ? funis.size : "—"}
          </span>
        );
      },
    },
    {
      id: "dias-ate-comprar",
      titulo: t("Dias até a 1ª compra"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      padrao: false,
      celula: (l) => {
        if (!l.primeira_compra) return <span className="block px-2 text-sm">—</span>;
        const dias = Math.max(
          0,
          Math.round(
            (new Date(l.primeira_compra.slice(0, 10)).getTime() -
              new Date(l.entrou_em.slice(0, 10)).getTime()) /
              86_400_000,
          ),
        );
        return <span className="block px-2 text-sm tabular-nums">{dias}</span>;
      },
    },
    {
      id: "origem-campanha",
      titulo: t("Campanha"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 240,
      padrao: false,
      celula: (l) => (
        <span className="block truncate px-2 text-sm">{l.origem_do_cliente.campanha ?? "—"}</span>
      ),
    },
    {
      id: "origem-posicionamento",
      titulo: t("Posicionamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 180,
      padrao: false,
      celula: (l) => (
        <span className="block truncate px-2 text-sm">
          {l.origem_do_cliente.posicionamento ?? "—"}
        </span>
      ),
    },
    {
      id: "anuncio",
      titulo: t("Anúncio"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 220,
      celula: (l) => {
        if (!ehOportunidades) {
          return (
            <span className="block truncate px-2 text-sm">{l.origem_do_cliente.anuncio ?? "—"}</span>
          );
        }
        const lista = itensDaLinha(l);
        if (lista.length === 0) return semValor;
        return empilhado(
          lista.map(({ venda, p }, i) => {
            const idDoAnuncio = p.anuncio_id ?? venda?.anuncio_id ?? null;
            const nome = idDoAnuncio ? dados?.anuncios_por_id?.[idDoAnuncio] : null;
            return (
              <span
                key={venda?.id ?? `${p.lead_id}-${i}`}
                className="block min-w-0 truncate px-2 text-sm"
                title={nome ?? ""}
              >
                {nome ?? "—"}
              </span>
            );
          }),
        );
      },
    },
    {
      id: "lp",
      titulo: t("Landing page"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 220,
      celula: (l) => {
        if (!ehOportunidades) {
          return (
            <span className="block truncate px-2 text-sm">{l.origem_do_cliente.pagina ?? "—"}</span>
          );
        }
        const lista = itensDaLinha(l);
        if (lista.length === 0) return semValor;
        return empilhado(
          lista.map(({ venda, p }, i) => {
            const idDaLp = p.lp_id ?? venda?.lp_id ?? null;
            const nome = idDaLp ? dados?.lps_por_id?.[idDaLp] : null;
            return (
              <span
                key={venda?.id ?? `${p.lead_id}-${i}`}
                className="block min-w-0 truncate px-2 text-sm"
                title={nome ?? ""}
              >
                {nome ?? "—"}
              </span>
            );
          }),
        );
      },
    },
    {
      id: "atividade",
      titulo: t("Última atividade"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 160,
      padrao: false,
      celula: (l) => (
        <span className="block truncate px-2 text-sm">{dia(l.ultima_atividade) || "—"}</span>
      ),
    },
  ];
  const todosOsCampos: Array<
    CampoConsultavel<Linha> & {
      titulo: string;
      opcoes?: { id: string; rotulo: string; cor?: CorDaOpcao }[];
    }
  > = [
    { id: "nome", titulo: t("Nome"), tipo: "texto", valorDe: (l) => l.nome },
    { id: "telefone", titulo: t("Telefone"), tipo: "texto", valorDe: (l) => l.telefone },
    {
      id: "radar",
      titulo: t("Radar"),
      tipo: "opcao",
      valorDe: (l) => (l.participacao?.status === "open" ? baldeDoRadar(l) : undefined),
      opcoes: BALDES_DO_RADAR.map((id) => ({
        id,
        rotulo: t(ROTULO_DO_RADAR[id]),
        cor: COR_DO_RADAR[id],
      })),
      // Crítico primeiro: ordenar por Radar é ordenar por urgência.
      ordemDoValor: (v) => BALDES_DO_RADAR.indexOf(v as RiskBucket),
    },
    {
      id: "sem-resposta",
      titulo: t("Sem resposta há (horas)"),
      tipo: "numero",
      valorDe: (l) => {
        const p = l.participacao;
        if (!p || p.status !== "open") return null;
        return Math.max(
          0,
          Math.floor((agora - new Date(p.ultima_atividade ?? p.criado_em).getTime()) / 3_600_000),
        );
      },
    },
    {
      id: "comentarios",
      titulo: t("Comentários"),
      tipo: "texto",
      valorDe: (l) => l.participacao?.comentarios ?? "",
    },
    {
      id: "tentativas",
      titulo: t("Tentativas"),
      tipo: "numero",
      valorDe: (l) => l.participacao?.tentativas ?? 0,
    },
    {
      id: "entrou-no-funil",
      titulo: t("Entrou no Funil em"),
      tipo: "data",
      valorDe: (l) => l.participacao?.criado_em.slice(0, 10) ?? null,
    },
    {
      id: "produtos",
      titulo: t("Produto(s)"),
      tipo: "texto",
      valorDe: (l) => l.participacao?.produtos ?? "",
    },
    {
      id: "status-venda",
      titulo: t("Status"),
      tipo: "opcao",
      valorDe: (l) => l.participacao?.status_da_venda ?? undefined,
      opcoes: Object.entries(ROTULO_DA_VENDA).map(([id, rotulo]) => ({ id, rotulo: t(rotulo) })),
    },
    {
      id: "forma-de-pagamento",
      titulo: t("Forma de pagamento"),
      tipo: "texto",
      valorDe: (l) => l.participacao?.forma_de_pagamento ?? "",
    },
    {
      id: "pago",
      titulo: t("Valor pago"),
      tipo: "numero",
      valorDe: (l) => (l.participacao?.pago_cents ?? 0) / 100,
    },
    {
      id: "previsto",
      titulo: t("Valor previsto"),
      tipo: "numero",
      valorDe: (l) => (l.participacao?.previsto_cents ?? 0) / 100,
    },
    {
      id: "posicionamento",
      titulo: t("Posicionamento"),
      tipo: "texto",
      valorDe: (l) => l.participacao?.posicionamento ?? "",
    },
    {
      id: "funis",
      titulo: t("Funis"),
      tipo: "multi",
      valorDe: (l) => [...new Set(l.participacoes.map((p) => p.funil_id))],
      opcoes: (dados?.funis ?? []).map((f) => ({ id: f.id, rotulo: f.name })),
      rotuloDoValor: (v) => funisPorId.get(v)?.name ?? v,
    },
    {
      id: "campanha",
      titulo: t("Campanha"),
      tipo: "multi",
      valorDe: (l) => [
        ...new Set(
          (l.participacao ? [l.participacao] : l.participacoes)
            .map((p) => p.campanha_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ],
      opcoes: (dados?.campanhas ?? []).map((c) => ({ id: c.id, rotulo: c.name })),
      rotuloDoValor: (v) => campanhasPorId.get(v) ?? v,
    },
    {
      id: "etapa",
      titulo: t("Etapa"),
      tipo: "opcao",
      valorDe: (l) => l.participacao?.etapa_id,
      opcoes: opcoesDeEtapa,
      rotuloDoValor: (v) => etapasPorId.get(v)?.name ?? v,
      ordemDoValor: (v) => etapasPorId.get(v)?.position ?? 0,
    },
    {
      id: "ciclo",
      titulo: t("Ciclo de vida"),
      tipo: "opcao",
      valorDe: (l) => l.ciclo_de_vida,
      opcoes: CICLOS_DE_VIDA.map((c) => ({
        id: c,
        rotulo: t(ROTULO_DO_CICLO[c]),
        cor: COR_DO_CICLO[c],
      })),
      rotuloDoValor: (v) => (ehCicloDeVida(v) ? t(ROTULO_DO_CICLO[v]) : v),
    },
    {
      id: "mql",
      titulo: "MQL",
      tipo: "caixa",
      valorDe: (l) => l.is_mql,
      rotuloDoValor: (v) => (v === "1" ? t("Sim") : t("Não")),
    },
    {
      id: "dono",
      titulo: t("Gestor de Relacionamento"),
      tipo: "opcao",
      valorDe: (l) => l.dono_user_id,
      opcoes: membros.map((m) => ({ id: m.id, rotulo: m.nome, cor: "gray" as CorDaOpcao })),
      rotuloDoValor: (v) => nomeDoMembro(v) ?? v,
    },
    { id: "ativo-ate", titulo: t("Ativo até"), tipo: "data", valorDe: (l) => l.ativo_ate },
    {
      id: "proxima-acao-em",
      titulo: t("Próxima ação em"),
      tipo: "data",
      valorDe: (l) => l.participacao?.proxima_acao_em ?? null,
    },
    {
      id: "origem",
      titulo: t("Origem"),
      tipo: "texto",
      valorDe: (l) => (ehOportunidades ? l.origem : (l.origem_do_cliente.fonte ?? l.origem)),
    },
    {
      id: "oportunidades-abertas",
      titulo: t("Oportunidades abertas"),
      tipo: "numero",
      valorDe: (l) => l.oportunidades_abertas,
    },
    {
      id: "funis-ate-comprar",
      titulo: t("Funis até a 1ª compra"),
      tipo: "numero",
      valorDe: (l) => {
        if (!l.primeira_compra) return null;
        return new Set(
          l.participacoes
            .filter((p) => p.criado_em.slice(0, 10) <= l.primeira_compra!.slice(0, 10))
            .map((p) => p.funil_id),
        ).size;
      },
    },
    {
      id: "dias-ate-comprar",
      titulo: t("Dias até a 1ª compra"),
      tipo: "numero",
      valorDe: (l) =>
        l.primeira_compra
          ? Math.max(
              0,
              Math.round(
                (new Date(l.primeira_compra.slice(0, 10)).getTime() -
                  new Date(l.entrou_em.slice(0, 10)).getTime()) /
                  86_400_000,
              ),
            )
          : null,
    },
    {
      id: "origem-campanha",
      titulo: t("Campanha (origem)"),
      tipo: "texto",
      valorDe: (l) => l.origem_do_cliente.campanha ?? "",
    },
    {
      id: "origem-posicionamento",
      titulo: t("Posicionamento"),
      tipo: "texto",
      valorDe: (l) => l.origem_do_cliente.posicionamento ?? "",
    },
    { id: "tags", titulo: t("Tags"), tipo: "multi", valorDe: (l) => l.tags },
    {
      id: "entrou",
      titulo: t("Entrou em"),
      tipo: "data",
      valorDe: (l) => l.entrou_em.slice(0, 10),
    },
    {
      id: "primeira-compra",
      titulo: t("Primeira compra"),
      tipo: "data",
      valorDe: (l) => l.primeira_compra,
    },
    {
      id: "abordagem",
      titulo: t("Primeira abordagem"),
      tipo: "data",
      valorDe: (l) => l.primeira_abordagem?.slice(0, 10) ?? null,
    },
    {
      id: "ltv",
      titulo: t("LTV atual (valor pago)"),
      tipo: "numero",
      valorDe: (l) => valoresDoLead(l).pago / 100,
    },
    {
      id: "ltv-previsto",
      titulo: t("A receber"),
      tipo: "numero",
      valorDe: (l) => valoresDoLead(l).aReceber / 100,
    },
    {
      id: "interesse",
      titulo: t("Em interesse"),
      tipo: "numero",
      valorDe: (l) => valoresDoLead(l).interesse / 100,
    },
    { id: "vendas", titulo: t("Vendas pagas (qtd)"), tipo: "numero", valorDe: (l) => l.vendas },
    {
      id: "vendas-ativas",
      titulo: t("Status da venda"),
      tipo: "multi",
      valorDe: (l) => [...new Set((l.vendas_ativas ?? []).map((v) => v.status))],
      opcoes: Object.entries(ROTULO_DA_VENDA).map(([id, rotulo]) => ({ id, rotulo: t(rotulo) })),
      rotuloDoValor: (v) => t(ROTULO_DA_VENDA[v] ?? v),
    },
    {
      id: "anuncio",
      titulo: t("Anúncio"),
      tipo: "multi",
      valorDe: (l) => l.anuncios ?? [],
      opcoes: [...new Set((dados?.clientes ?? []).flatMap((c) => c.anuncios ?? []))]
        .sort()
        .map((n) => ({ id: n, rotulo: n })),
    },
    {
      id: "lp",
      titulo: t("Landing page"),
      tipo: "multi",
      valorDe: (l) => l.lps ?? [],
      opcoes: [...new Set((dados?.clientes ?? []).flatMap((c) => c.lps ?? []))]
        .sort()
        .map((n) => ({ id: n, rotulo: n })),
    },
  ];
  // Etapa e situação são de UM funil: na lista "Todos" não há uma só etapa por lead.
  const campos = todosOsCampos
    .filter((c) => funilAtual !== null || (c.id !== "etapa" && c.id !== "status"))
    .filter((c) => (ehOportunidades ? !SO_DE_CLIENTES.has(c.id) : !SO_DE_OPORTUNIDADES.has(c.id)));

  const camposDaBarra: CampoDaBarra[] = campos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    opcoes: c.opcoes,
  }));

  // Cada aba mostra só o que é dela: Clientes, o que é da pessoa; Oportunidades, o do negócio.
  const colunasDaVisao = colunas.filter((c) =>
    ehOportunidades ? !SO_DE_CLIENTES.has(c.id) : !SO_DE_OPORTUNIDADES.has(c.id),
  );
  // A linha de totais do fim da tabela: somas e contagens do que está na tela.
  const somaDe = (linhas: readonly Linha[], f: (l: Linha) => number) =>
    linhas.reduce((s2, l) => s2 + f(l), 0);
  const totalDe: Record<string, (linhas: readonly Linha[]) => React.ReactNode> = {
    nome: (ls) => (
      <span className="block px-2 text-sm">
        {t("Total")} · {ls.length}
      </span>
    ),
    mql: (ls) => (
      <span className="block px-2 text-sm tabular-nums">{ls.filter((l) => l.is_mql).length}</span>
    ),
    ltv: (ls) => (
      <span className="block px-2 text-sm tabular-nums">
        {moeda(somaDe(ls, (l) => valoresDoLead(l).pago))}
      </span>
    ),
    "ltv-previsto": (ls) => (
      <span className="block px-2 text-sm tabular-nums">
        {moeda(somaDe(ls, (l) => valoresDoLead(l).aReceber))}
      </span>
    ),
    interesse: (ls) => (
      <span className="block px-2 text-sm tabular-nums">
        {moeda(somaDe(ls, (l) => valoresDoLead(l).interesse))}
      </span>
    ),
    vendas: (ls) => (
      <span className="block px-2 text-sm tabular-nums">{somaDe(ls, (l) => l.vendas)}</span>
    ),
    "oportunidades-abertas": (ls) => (
      <span className="block px-2 text-sm tabular-nums">
        {somaDe(ls, (l) => l.oportunidades_abertas)}
      </span>
    ),
  };
  const colunasComTotal = colunasDaVisao.map((c) => ({ ...c, total: totalDe[c.id] }));
  const resolvidas = resolverColunas(colunasComTotal, preferencias);
  const mostradas = resolvidas.filter((c) => c.visivel);

  const termo = semAcento(busca);
  const buscadas = termo
    ? linhas.filter((l) =>
        semAcento(`${l.nome} ${l.telefone ?? ""} ${l.email ?? ""} ${l.tags.join(" ")}`).includes(
          termo,
        ),
      )
    : linhas;
  // Os números do topo (como na referência), sobre o que a lista mostra.
  const alvos = buscadas;
  const abertas = alvos.flatMap((l) =>
    (l.participacao ? [l.participacao] : l.participacoes).filter((p) => p.status === "open"),
  );
  // VENDAS = as vendas realizadas (com pagamento recebido), no funil escolhido ou em todos.
  const vendasDoLead = (l: Linha) =>
    funilAtual ? (l.vendas_por_funil?.[funilAtual.id] ?? 0) : l.vendas;
  const totalDeVendas = alvos.reduce((s, l) => s + vendasDoLead(l), 0);
  // TAXA DE CONVERSÃO = leads com ao menos uma venda paga ÷ total de leads (não é a contagem de
  // vendas: um lead com três vendas conta uma vez).
  const leadsComVenda = alvos.filter((l) => vendasDoLead(l) > 0).length;
  const taxa = alvos.length > 0 ? Math.round((leadsComVenda / alvos.length) * 100) : 0;
  const seteDias = agora - (ehOportunidades ? 3 : 7) * 86_400_000;
  /** Lead com negócio aberto e sem atividade há mais de 7 dias. */
  const estaSemContato = (l: Linha) =>
    (l.participacao ? [l.participacao] : l.participacoes).some(
      (p) =>
        p.status === "open" &&
        new Date(p.ultima_atividade ?? p.criado_em).getTime() < seteDias,
    );
  const semContato = alvos.filter(estaSemContato).length;
  /** Quem aparece na lista quando se clica num número do topo. */
  const passaNoDestaque = (l: Linha): boolean => {
    const emAberto = (l.participacao ? [l.participacao] : l.participacoes).filter(
      (p) => p.status === "open",
    );
    switch (destaque) {
      case "faturamento":
        return valoresDoLead(l).pago > 0;
      case "abertos":
        return valoresDoLead(l).aReceber + valoresDoLead(l).interesse > 0;
      case "compraram":
      case "vendas":
        return vendasDoLead(l) > 0;
      case "mql":
        return l.is_mql;
      case "ligarhoje":
        return l.participacao
          ? prioridadeDaFila(l.participacao, hojeIso, agora, configDaProspeccao.fila) !== null
          : false;
      case "abertas":
        return emAbertoDeVerdade(l);
      case "semcontato":
        return estaSemContato(l);
      case "sempasso":
        return emAberto.some((p) => !p.proxima_acao.trim() && !p.proxima_acao_em);
      default:
        return true;
    }
  };
  const comVendaNoFiltro = (l: Linha) => statusDasVendas.size === 0 || vendasVisiveis(l).length > 0;
  const visiveis = buscadas.filter(
    (l) =>
      comVendaNoFiltro(l) &&
      (!destaque || passaNoDestaque(l)) &&
      (!cicloFiltro || l.ciclo_de_vida === cicloFiltro) &&
      (!etapasFiltro || etapasFiltro.includes(l.participacao?.etapa_id ?? "")),
  );
  // Fila do dia: do mais atrasado ao menos (sem a pessoa ter escolhido outra ordem).
  if (destaque === "ligarhoje" && !preferencias.ordenacao?.length) {
    const peso = (l: Linha) =>
      l.participacao ? (prioridadeDaFila(l.participacao, hojeIso, agora, configDaProspeccao.fila) ?? Infinity) : Infinity;
    visiveis.sort((x, y) => peso(x) - peso(y));
  }
  const filaDoDia = alvos.filter(
    (l) => l.participacao && prioridadeDaFila(l.participacao, hojeIso, agora, configDaProspeccao.fila) !== null,
  ).length;

  const resultado = aplicarConsulta(visiveis, campos, preferencias, {
    hoje: new Date(agora).toISOString().slice(0, 10),
  });
  const grupos = resultado.grupos?.map((g) => {
    const campo = campos.find((c) => c.id === preferencias.agrupar);
    const rotulo =
      g.chave === ""
        ? t("Sem valor")
        : (campo?.opcoes?.find((o) => o.id === g.chave)?.rotulo ??
          campo?.rotuloDoValor?.(g.chave) ??
          g.rotulo);
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

  const totalPago = alvos.reduce((s2, l) => s2 + valoresDoLead(l).pago, 0);
  const totalAReceber = alvos.reduce((s2, l) => s2 + valoresDoLead(l).aReceber, 0);
  const totalInteresse = alvos.reduce((s2, l) => s2 + valoresDoLead(l).interesse, 0);
  const totalEmAberto = totalAReceber + totalInteresse;
  const previsaoPonderada = alvos.reduce((soma, l) => {
    const abertas = (l.participacao ? [l.participacao] : l.participacoes).filter(
      (p) => p.status === "open",
    );
    return (
      soma +
      abertas.reduce((s2, p) => {
        const prob = etapasPorId.get(p.etapa_id)?.win_probability ?? 0;
        return s2 + ((p.valor_cents ?? 0) * prob) / 100;
      }, 0)
    );
  }, 0);
  const numeros: Array<{
    id: "todos" | "ponderada" | NonNullable<typeof destaque>;
    rotulo: string;
    valor: string;
    detalhe?: string;
  }> = [
    { id: "todos", rotulo: t("Total de leads"), valor: String(alvos.length) },
    {
      id: "faturamento",
      rotulo: t("Faturamento recebido"),
      valor: moeda(totalPago),
      detalhe: t("Soma do LTV atual (valor pago)"),
    },
    {
      id: "abertos",
      rotulo: t("Valor em aberto"),
      valor: moeda(totalEmAberto),
      detalhe: `${moeda(totalAReceber)} ${t("previsto")} · ${moeda(totalInteresse)} ${t("em interesse")}`,
    },
    {
      id: "compraram",
      rotulo: t("Taxa de conversão"),
      valor: `${taxa}%`,
      detalhe:
        leadsComVenda === 1 ? t("1 cliente comprou") : `${leadsComVenda} ${t("clientes compraram")}`,
    },
    { id: "vendas", rotulo: t("Vendas"), valor: String(totalDeVendas) },
    { id: "mql", rotulo: t("MQL"), valor: String(alvos.filter((l) => l.is_mql).length) },
    { id: "semcontato", rotulo: t("Sem contato (+7d)"), valor: String(semContato) },
    {
      id: "sempasso",
      rotulo: t("Sem próxima ação"),
      valor: String(
        alvos.filter((l) =>
          (l.participacao ? [l.participacao] : l.participacoes).some(
            (p) => p.status === "open" && !p.proxima_acao.trim() && !p.proxima_acao_em,
          ),
        ).length,
      ),
      detalhe: t("Oportunidade aberta sem próximo passo"),
    },
    {
      id: "ponderada",
      rotulo: t("Previsão ponderada"),
      valor: moeda(previsaoPonderada),
      detalhe: t("Valor aberto × probabilidade da etapa"),
    },
  ];

  // Aba Clientes: os números são da BASE de clientes (o resto é da aba Oportunidades).
  const numerosDaBase = numeros.filter((n) =>
    ["todos", "mql", "faturamento", "abertos", "compraram"].includes(n.id),
  );
  const emAbertoDeVerdade = (l: Linha) =>
    (l.participacao ? [l.participacao] : l.participacoes).some((p) => {
      const e = etapasPorId.get(p.etapa_id);
      return p.status === "open" && !e?.is_won && !e?.is_lost;
    });
  // Aba Oportunidades: os quatro números do topo.
  const numerosDeOportunidades: typeof numeros = [
    { id: "todos", rotulo: t("Total de oportunidades"), valor: String(alvos.length) },
    {
      id: "abertas",
      rotulo: t("Oportunidades abertas"),
      valor: String(alvos.filter(emAbertoDeVerdade).length),
      detalhe: t("Fora de Comprou, Não comprou e Desqualificado"),
    },
    {
      id: "abertos",
      rotulo: t("Valor em aberto"),
      valor: moeda(totalEmAberto),
      detalhe: `${moeda(totalAReceber)} ${t("comprometido")} · ${moeda(totalInteresse)} ${t("em interesse")}`,
    },
    {
      id: "semcontato",
      rotulo: t("Leads sem contato (+3 dias)"),
      valor: String(semContato),
    },
  ];

  // As etapas do funil como filtro: funis com as mesmas etapas dividem um desenho.
  const funisDasEtapas = funilAtual
    ? [{ id: funilAtual.id, nome: funilAtual.name }]
    : funisNaOrdem.filter((f) => !arquivados.has(f.id)).map((f) => ({ id: f.id, nome: f.nome }));
  const gruposDeEtapas: GrupoDeEtapas[] = (() => {
    const mapa = new Map<string, { funis: string[]; etapas: EtapaDoQuadro[] }>();
    for (const f of funisDasEtapas) {
      const es = (dados?.etapas ?? [])
        .filter((e) => e.pipeline_id === f.id)
        .sort((a, b) => a.position - b.position);
      if (es.length === 0) continue;
      const assinatura = es.map((e) => e.name.trim().toLowerCase()).join("|");
      let g = mapa.get(assinatura);
      if (!g) {
        g = {
          funis: [],
          etapas: es.map((e, i) => ({
            chave: String(i),
            nome: e.name,
            cor: corDaEtapa(e),
            n: 0,
            ids: [],
            porFunil: {},
          })),
        };
        mapa.set(assinatura, g);
      }
      g.funis.push(f.nome);
      es.forEach((e, i) => {
        g!.etapas[i]!.ids.push(e.id);
        g!.etapas[i]!.porFunil![f.id] = e.id;
      });
    }
    return [...mapa.entries()].map(([chave, g]) => ({
      chave,
      funis: g.funis,
      etapas: g.etapas.map((e) => ({
        ...e,
        n: alvos.filter((l) => e.ids.includes(l.participacao?.etapa_id ?? "")).length,
      })),
    }));
  })();
  const gruposDoQuadro: GrupoDoQuadro[] = gruposDeEtapas.map((g) => ({
    chave: g.chave,
    titulo: funilAtual ? null : g.funis.join(" · "),
    colunas: g.etapas.map((e) => ({
      chave: e.chave,
      nome: e.nome,
      cor: e.cor,
      porFunil: e.porFunil ?? {},
    })),
  }));
  const ehQuadroDeOportunidades = ehOportunidades && vista === "quadro";
  const ordemDaBase = ["todos", "mql", "faturamento", "abertos", "compraram"];
  numerosDaBase.sort((x, y) => ordemDaBase.indexOf(x.id) - ordemDaBase.indexOf(y.id));
  const contagemDoCiclo = CICLOS_DE_VIDA.map((c) => ({
    ciclo: c,
    n: linhas.filter((l) => l.ciclo_de_vida === c).length,
  }));

  const abasPorId = new Map([
    [
      ID_DA_PADRAO,
      { id: ID_DA_PADRAO, nome: padrao.preferencias.nome ?? t("Tabela"), tipo: "tabela" as const },
    ],
    ...visoes.map((v) => [v.id, { id: v.id, nome: v.name, tipo: v.type }] as const),
  ]);
  const abas = ordemDasAbas.flatMap((a) => {
    const aba = abasPorId.get(a.id);
    return aba ? [aba] : [];
  });

  /** As oportunidades abertas da lista atual (filtros e ordem), para o modo prospecção. */
  const itensDaProspeccao: LeadDaProspeccao[] = resultado.linhas.flatMap((l) => {
    const p = l.participacao;
    if (!p || p.status !== "open") return [];
    const insta = typeof l.campos.link_instagram === "string" ? l.campos.link_instagram : null;
    return [
      {
        chave: l.chave,
        leadId: p.lead_id,
        contactId: l.contact_id,
        funilId: p.funil_id,
        funilNome: funisPorId.get(p.funil_id)?.name ?? "",
        etapaId: p.etapa_id,
        campanhaId: p.campanha_id,
        conversaId: l.conversa_id,
        nome: l.nome,
        titulo: p.titulo || l.nome,
        telefone: l.telefone,
        instagram: insta,
        produto: p.produtos,
        campanha: p.campanha_id ? (campanhasPorId.get(p.campanha_id) ?? "") : "",
        responsavel: nomeDoMembro(p.responsavel_id) ?? "",
        comentarios: p.comentarios,
        proximaAcao: p.proxima_acao,
        proximaAcaoEm: p.proxima_acao_em,
        tentativas: p.tentativas,
        ultimaTentativa: p.ultima_tentativa,
      },
    ];
  });

  // A sessão pode ter um número fixo de leads (configuração); 0 = a lista toda.
  const itensDaSessao =
    configDaProspeccao.quantidade > 0
      ? itensDaProspeccao.slice(0, configDaProspeccao.quantidade)
      : itensDaProspeccao;

  /** As oportunidades selecionadas, na ordem em que aparecem na lista. */
  const selecionadasNaOrdem = resultado.linhas.filter(
    (l) => selecionadas.has(l.chave) && l.participacao,
  );
  async function aplicarComentarios(texto: string, modo: "mesmo" | "linhas" | "acrescentar") {
    const linhasDoTexto = texto.split(/\r?\n/).filter((x) => x.trim() !== "");
    const itens = selecionadasNaOrdem.map((l, i) => {
      const atual = l.participacao!.comentarios;
      const novo =
        modo === "linhas"
          ? (linhasDoTexto[i] ?? "")
          : modo === "acrescentar"
            ? [atual, texto.trim()].filter(Boolean).join("\n")
            : texto.trim();
      return { lead_id: l.participacao!.lead_id, comentarios: novo };
    });
    try {
      await apiClient.post("/api/v1/leads/comentarios-em-lote", { itens });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      showApiError(e);
    }
  }
  // Ctrl+V com oportunidades selecionadas (e sem estar digitando): cola nos comentários, como na
  // planilha. Várias linhas na quantidade certa vão uma para cada oportunidade.
  useEffect(() => {
    if (!ehOportunidades || !podeEditar) return;
    const aoColar = (e: ClipboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (
        alvo &&
        (alvo.closest("input, textarea, select, [contenteditable='true'], [role='dialog']") ||
          alvo.isContentEditable)
      ) {
        return;
      }
      const texto = e.clipboardData?.getData("text/plain") ?? "";
      if (texto.trim() === "" || selecionadas.size === 0) return;
      e.preventDefault();
      setComentariosEmMassa(texto);
    };
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
  }, [ehOportunidades, podeEditar, selecionadas]);

  /** Excluir só a oportunidade (o cliente fica). Com pagamento recebido o servidor recusa. */
  async function excluirOportunidades() {
    const alvos = selecionadasNaOrdem;
    if (alvos.length === 0) return;
    const aviso =
      alvos.length === 1
        ? t("Excluir esta oportunidade? O cliente continua cadastrado.")
        : t("Excluir as {n} oportunidades selecionadas? Os clientes continuam cadastrados.").replace(
            "{n}",
            String(alvos.length),
          );
    if (!window.confirm(aviso)) return;
    let recusadas = 0;
    for (const l of alvos) {
      try {
        await apiClient.delete(`/api/v1/vendas/${l.participacao!.lead_id}`);
      } catch {
        recusadas += 1;
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    await queryClient.invalidateQueries({ queryKey: ["vendas"] });
    setSelecionadas(new Set());
    if (recusadas > 0) {
      window.alert(
        `${recusadas} ${t("oportunidade(s) não foram excluídas: já receberam pagamento. Cancele-as em vez de apagar.")}`,
      );
    }
  }

  function salvarFunis(
    mudar: (
      atual: NonNullable<PreferenciasDaTabela["funis"]>,
    ) => NonNullable<PreferenciasDaTabela["funis"]>,
  ) {
    barra.atualizar((p) => ({ ...p, funis: mudar(p.funis ?? {}) }));
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {ehOportunidades ? t("Oportunidades") : t("Clientes")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ehOportunidades
              ? t("Os negócios de cada funil, em quadro ou lista.")
              : t("Todos os seus leads, em cada funil, num só lugar.")}
          </p>
        </div>
        {dados?.pode_editar ? (
          <div className="flex flex-wrap items-center gap-2">
            {ehOportunidades ? (
              <button
                type="button"
                onClick={() => setNovaOportunidade(true)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-secondary"
              >
                <Plus size={14} weight="bold" aria-hidden />
                {t("Nova oportunidade")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setNovoLeadAberto(true)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-secondary"
                >
                  <Plus size={14} weight="bold" aria-hidden />
                  {t("Novo lead")}
                </button>
                <button
                  type="button"
                  onClick={() => setImportarAberto(true)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-secondary"
                >
                  <UploadSimple size={14} weight="bold" aria-hidden />
                  {t("Importar leads")}
                </button>
              </>
            )}
          </div>
        ) : null}
      </header>

      {novoLeadAberto ? (
        <NovoLeadDoCRM
          aberto
          aoFechar={() => setNovoLeadAberto(false)}
          funis={dados?.funis ?? []}
          etapas={dados?.etapas ?? []}
          funilInicial={funilValido && funilEscolhido !== TODOS ? funilEscolhido : null}
        />
      ) : null}
      {importarAberto ? (
        <ImportarLeadsDoCRM
          aberto
          aoFechar={() => setImportarAberto(false)}
          funis={dados?.funis ?? []}
          etapas={dados?.etapas ?? []}
          funilInicial={funilValido && funilEscolhido !== TODOS ? funilEscolhido : null}
        />
      ) : null}

      <section
        aria-label={t("Resumo")}
        className={`grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3 ${
          ehOportunidades ? "xl:grid-cols-4" : "xl:grid-cols-5"
        }`}
      >
        {(ehOportunidades ? numerosDeOportunidades : numerosDaBase).map((n) => {
          const clicavel = n.id !== "todos" && n.id !== "ponderada";
          const ativo = clicavel && destaque === n.id;
          return (
            <button
              key={n.id}
              type="button"
              disabled={!clicavel && destaque === null}
              aria-pressed={ativo}
              title={
                clicavel ? t("Clique para ver quem compõe este número") : t("Mostrar todos os leads")
              }
              onClick={() =>
                setDestaque(
                  n.id === "todos" || n.id === "ponderada" || destaque === n.id ? null : n.id,
                )
              }
              className={`bg-card px-4 py-3 text-left transition-colors hover:bg-secondary/60 ${
                ativo ? "ring-2 ring-inset ring-primary" : ""
              }`}
            >
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {n.rotulo}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{n.valor}</p>
              {n.detalhe ? <p className="text-[11px] text-muted-foreground">{n.detalhe}</p> : null}
            </button>
          );
        })}
      </section>

      {ehOportunidades ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={destaque === "ligarhoje"}
            title={t("Próxima ação vencida ou de hoje, e sem resposta há mais de 24h")}
            onClick={() => setDestaque(destaque === "ligarhoje" ? null : "ligarhoje")}
            className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors hover:bg-secondary ${
              destaque === "ligarhoje" ? "border-primary bg-primary/10" : "bg-card"
            }`}
          >
            <Phone size={14} aria-hidden />
            {t("Ligar hoje")}
            <span className="rounded-full bg-secondary px-1.5 text-xs tabular-nums">{filaDoDia}</span>
          </button>
          <button
            type="button"
            onClick={() => setProspectando(true)}
            title={t("Trabalha a lista que está filtrada, um lead de cada vez")}
            className="inline-flex h-9 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <Phone size={14} aria-hidden />
            {t("Modo prospecção")}
          </button>
          <button
            type="button"
            onClick={() => setConfigProspeccao(true)}
            aria-label={t("Configurar a prospecção")}
            title={t("Configurar a prospecção")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-card transition-colors hover:bg-secondary"
          >
            <Gear size={16} aria-hidden />
          </button>
        </div>
      ) : null}

      {ehOportunidades ? null : (
        <section
          aria-label={t("Ciclo de vida")}
          className="rounded-2xl border bg-card px-4 py-3"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {t("Ciclo de vida")}
            </p>
            {cicloFiltro ? (
              <button
                type="button"
                onClick={() => setCicloFiltro(null)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("Mostrar todos")}
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {t("Clique numa etapa para filtrar a lista")}
              </span>
            )}
          </div>
          <ol className="flex w-full items-stretch overflow-x-auto pb-1">
            {contagemDoCiclo.map(({ ciclo, n }, i) => {
              const cor = BASE_DA_COR[COR_DO_CICLO[ciclo]];
              const ativo = cicloFiltro === ciclo;
              const apagado = cicloFiltro !== null && !ativo;
              return (
                <li key={ciclo} className="min-w-[8.5rem] flex-1" style={{ marginLeft: i === 0 ? 0 : -10 }}>
                  <button
                    type="button"
                    aria-pressed={ativo}
                    title={t("Filtrar a lista por esta etapa")}
                    onClick={() => setCicloFiltro(ativo ? null : ciclo)}
                    className="relative flex h-16 w-full flex-col justify-center text-left transition-opacity hover:opacity-90"
                    style={{
                      // A seta que encaixa na próxima etapa: ponta à direita, recorte à esquerda.
                      clipPath:
                        i === 0
                          ? "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)"
                          : "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)",
                      backgroundColor: `color-mix(in srgb, ${cor} ${ativo ? 38 : 20}%, transparent)`,
                      opacity: apagado ? 0.5 : 1,
                      paddingLeft: i === 0 ? 14 : 24,
                      paddingRight: 18,
                    }}
                  >
                    <span className="truncate text-[11px] font-semibold tracking-wide uppercase">
                      {t(ROTULO_PLURAL_DO_CICLO[ciclo])}
                    </span>
                    <span className="text-xl leading-tight font-semibold tabular-nums">{n}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {confirmandoAcao ? (
        <ConfirmarDataDaProximaAcao
          texto={confirmandoAcao.texto}
          dataAtual={confirmandoAcao.dataAtual}
          aoCancelar={() => setConfirmandoAcao(null)}
          aoConfirmar={(data) => {
            const c = confirmandoAcao;
            setConfirmandoAcao(null);
            otimistaNegocio(c.contactId, c.leadId, (x) => ({
              ...x,
              proxima_acao: c.texto,
              proxima_acao_em: data,
            }));
            void executar(() =>
              apiClient.put(`/api/v1/leads/${c.leadId}/proxima-acao`, {
                proxima_acao: c.texto,
                proxima_acao_em: data,
              }),
            );
          }}
        />
      ) : null}

      {configProspeccao ? (
        <ConfigDaProspeccaoDialog
          config={configDaProspeccao}
          campanhaIds={[
            ...new Set(
              alvos.map((l) => l.participacao?.campanha_id).filter((x): x is string => Boolean(x)),
            ),
          ]}
          nomeDaCampanha={(id) => campanhasPorId.get(id) ?? ""}
          aoSalvar={(c) => {
            setConfigDaProspeccao(c);
            salvarConfigDaProspeccao(c);
          }}
          aoFechar={() => setConfigProspeccao(false)}
        />
      ) : null}

      {prospectando ? (
        <ModoProspeccao
          itens={itensDaSessao}
          config={configDaProspeccao}
          etapasDe={(funilId) => etapasDoFunil(funilId)}
          aoMoverEtapa={(item, etapaId) => {
            const linha = resultado.linhas.find((x) => x.participacao?.lead_id === item.leadId);
            if (linha?.participacao) escolherEtapa(linha, linha.participacao, etapaId);
          }}
          aoFechar={() => setProspectando(false)}
          aoPerder={(i) => {
            setProspectando(false);
            setPerdendo({ leadId: i.leadId, funilId: i.funilId });
          }}
          aoAbrirOportunidade={(i) => {
            const linha = resultado.linhas.find((x) => x.participacao?.lead_id === i.leadId);
            setProspectando(false);
            if (linha) void abrirVenda(linha, i.leadId);
          }}
        />
      ) : null}

      {comentariosEmMassa !== null && selecionadasNaOrdem.length > 0 ? (
        <ComentariosEmMassaDialog
          quantidade={selecionadasNaOrdem.length}
          textoInicial={comentariosEmMassa}
          aoFechar={() => setComentariosEmMassa(null)}
          aoAplicar={aplicarComentarios}
        />
      ) : null}

      {acaoDoContato ? (
        <RegistrarAcaoEmMassaDialog
          aberto
          contatoIds={[acaoDoContato]}
          aoFechar={() => setAcaoDoContato(null)}
          aoConcluir={() => void queryClient.invalidateQueries({ queryKey: ["clientes"] })}
        />
      ) : null}

      {vendaAberta ? (
        <DialogoDaVenda
          key={vendaAberta.venda.id}
          venda={vendaAberta.venda}
          contatoInicial={{ contact_id: vendaAberta.venda.contact_id, nome: vendaAberta.nome }}
          clientes={[]}
          aoFechar={() => setVendaAberta(null)}
          aoSalvar={salvarVendaAberta}
          aoApagar={async () => {
            try {
              await apiClient.delete(`/api/v1/vendas/${vendaAberta.venda.id}`);
              await queryClient.invalidateQueries({ queryKey: ["clientes"] });
              await queryClient.invalidateQueries({ queryKey: ["vendas"] });
            } catch (e) {
              showApiError(e);
            }
          }}
        />
      ) : null}

      {destaque ? (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>
            {t("Mostrando só quem compõe")}{" "}
            <strong>
              {destaque === "ligarhoje"
                ? t("Ligar hoje")
                : [...numeros, ...numerosDeOportunidades].find((n) => n.id === destaque)?.rotulo}
            </strong> · {visiveis.length}{" "}
            {visiveis.length === 1 ? t("lead") : t("leads")}
          </span>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setDestaque(null)}
          >
            {t("Limpar")}
          </button>
        </p>
      ) : null}

      {ehOportunidades ? (
      <BarraDeFunis
        funis={funisNaOrdem}
        arquivados={arquivados}
        filtros={{
          status: barra.preferencias.funis?.status ?? [],
          canais: barra.preferencias.funis?.canais ?? [],
        }}
        aoFiltrar={(f) =>
          salvarFunis((atual) => ({ ...atual, status: f.status, canais: f.canais }))
        }
        escolhido={funilEscolhido}
        todosId={TODOS}
        rotuloTodos={ehOportunidades ? t("Todas") : undefined}
        podeOrganizar
        aoEscolher={(id) => {
          setEtapasFiltro(null);
          ir({ funil: id });
        }}
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
      ) : null}

      {ehOportunidades ? (
        <QuadroDeEtapas
          grupos={gruposDeEtapas}
          escolhidas={etapasFiltro ? new Set(etapasFiltro) : null}
          aoEscolher={setEtapasFiltro}
          emToggle={!funilAtual && gruposDeEtapas.length > 1}
        />
      ) : null}

      {novaOportunidade ? (
        <DialogoDaVenda
          venda={null}
          titulo={t("Nova oportunidade")}
          clientes={(dados?.clientes ?? []).map((c) => ({
            contact_id: c.contact_id,
            nome: c.nome,
            telefone: c.telefone,
          }))}
          funis={(dados?.funis ?? []).map((f) => ({ id: f.id, nome: f.name }))}
          funilInicial={funilAtual?.id ?? null}
          aoFechar={() => setNovaOportunidade(false)}
          aoSalvar={async (v: DadosDaVenda) => {
            try {
              const { id: _id, ...corpo } = v;
              await apiClient.post("/api/v1/vendas", corpo);
              await queryClient.invalidateQueries({ queryKey: ["clientes"] });
              await queryClient.invalidateQueries({ queryKey: ["vendas"] });
              return true;
            } catch (e) {
              showApiError(e);
              return false;
            }
          }}
        />
      ) : null}

      {!funilValido && !consulta.isLoading ? (
        <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          {t("Este funil não existe mais.")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <AbasDeVisualizacao
            abas={abas}
            ativaId={ativaId}
            podeEditar={podeEditar}
            tipos={TIPOS_DO_CRM}
            aoEscolher={(id) => ir({ aba: id })}
            aoCriar={(nome, tipo) =>
              void criarVisao({ name: nome, type: tipo, config: preferencias }).then(
                (v) => v && ir({ aba: v.id }),
              )
            }
            modelos={ehOportunidades ? MODELOS_DAS_OPORTUNIDADES : []}
            aoCriarModelo={(id) => {
              const modelo = MODELOS_DAS_OPORTUNIDADES.find((m) => m.id === id);
              if (!modelo) return;
              // Já existe uma aba com o nome do modelo? Abre essa em vez de duplicar.
              const existente = visoes.find((v) => v.name === modelo.nome);
              if (existente) return ir({ aba: existente.id });
              void criarVisao({
                name: modelo.nome,
                type: modelo.tipo,
                config: modelo.config,
              }).then((v) => v && ir({ aba: v.id }));
            }}
            aoConfigurar={() => setConfigurando(true)}
          />
          {ehOportunidades ? null : (
            <JanelaDoAtivo podeEditar={dados?.pode_gerir === true} />
          )}
          </div>

          {vista === "quadro" && !ehOportunidades ? (
            <QuadroDoCiclo clientes={resultado.linhas} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-0 flex-1 basis-56">
                  <span className="sr-only">{t("Buscar")}</span>
                  <MagnifyingGlass
                    size={16}
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder={t("Buscar por nome, telefone, e-mail ou tag")}
                    className="h-9 w-full rounded-xl border bg-background pr-3 pl-9 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  />
                </label>
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
              {!consulta.isLoading && resultado.linhas.length === 0 ? (
                <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-14 text-center">
                  <p className="text-sm font-medium">
                    {consulta.isError
                      ? t("Não foi possível carregar os leads.")
                      : busca.trim() !== "" || preferencias.filtros?.length
                        ? t("Nenhum lead combina com a busca e os filtros.")
                        : funilAtual
                          ? t("Nenhum lead neste funil ainda.")
                          : t("Nenhum lead por aqui ainda.")}
                  </p>
                  {!consulta.isError &&
                  funilAtual &&
                  !busca.trim() &&
                  !preferencias.filtros?.length ? (
                    <p className="text-xs text-muted-foreground">
                      {t("Os leads aparecem aqui assim que entrarem no funil.")}
                    </p>
                  ) : null}
                </div>
              ) : ehQuadroDeOportunidades ? (
                <QuadroDeOportunidades
                  grupos={gruposDoQuadro}
                  linhas={resultado.linhas}
                  idDe={(l) => l.chave}
                  etapaDe={(l) => l.participacao?.etapa_id}
                  funilDe={(l) => l.participacao?.funil_id}
                  tituloDe={(l) => l.nome}
                  colunas={mostradas.filter((c) => c.id !== "nome" && c.id !== "etapa")}
                  podeEditar={podeEditar}
                  aoMover={(l, etapaId) => {
                    if (l.participacao) escolherEtapa(l, l.participacao, etapaId);
                  }}
                  aoAbrir={(l) => {
                    if (l.participacao) void abrirVenda(l, l.participacao.lead_id);
                  }}
                  totalDe={(itens) => {
                    const soma = itens.reduce((s2, l) => s2 + (l.participacao?.valor_cents ?? 0), 0);
                    return soma > 0 ? moeda(soma) : null;
                  }}
                />
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
                  idDe={(l) => l.chave}
                  colunas={mostradas}
                  grupos={grupos}
                  carregando={consulta.isLoading}
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
                  rotuloDaTabela={t("Leads")}
                  selecionadas={selecionadas}
                  aoSelecionar={(id, { faixa }) =>
                    setSelecionadas((atual) => {
                      const proximo = new Set(atual);
                      const ids = resultado.linhas.map((l) => l.chave);
                      if (faixa && atual.size > 0) {
                        const ultimo = ids.findLastIndex((x) => atual.has(x));
                        const alvo = ids.indexOf(id);
                        if (ultimo >= 0 && alvo >= 0) {
                          const [de, ate] = ultimo < alvo ? [ultimo, alvo] : [alvo, ultimo];
                          for (const x of ids.slice(de, ate + 1)) proximo.add(x);
                          return proximo;
                        }
                      }
                      if (proximo.has(id)) proximo.delete(id);
                      else proximo.add(id);
                      return proximo;
                    })
                  }
                  aoSelecionarTodas={(marcar) =>
                    setSelecionadas(
                      marcar ? new Set(resultado.linhas.map((l) => l.chave)) : new Set(),
                    )
                  }
                />
              )}
              {podeEditar && ehOportunidades && selecionadas.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setComentariosEmMassa("")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-medium hover:bg-secondary"
                >
                  {t("Editar comentários")}
                </button>
              ) : null}
              {podeEditar ? (
                <AcoesEmMassaDeClientes
                  contatoIds={[
                    ...new Set(
                      resultado.linhas.filter((l) => selecionadas.has(l.chave)).map((l) => l.contact_id),
                    ),
                  ]}
                  podeGerir={ROLE_RANK[role] >= ROLE_RANK.manager}
                  tagsExistentes={todasAsTags}
                  aoExcluir={ehOportunidades ? () => void excluirOportunidades() : undefined}
                  rotuloExcluir={ehOportunidades ? t("Excluir oportunidade") : undefined}
                  aoLimpar={() => setSelecionadas(new Set())}
                />
              ) : null}
            </>
          )}

          <ConfigurarVisualizacao
            aberto={configurando}
            aoFechar={() => setConfigurando(false)}
            nome={visaoAtiva?.name ?? padrao.preferencias.nome ?? t("Tabela")}
            tipo={visaoAtiva?.type ?? "tabela"}
            tipos={TIPOS_DO_CRM}
            podeEditar={podeEditar && (visaoAtiva?.editavel ?? true)}
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
            aoTrocarTipo={(tipo) => visaoAtiva && void editarVisao(visaoAtiva.id, { type: tipo })}
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
                    ir({ aba: ID_DA_PADRAO });
                  }
                : undefined
            }
          />
        </>
      )}

      {perdendo ? (
        <LoseLeadDialog
          open
          leadId={perdendo.leadId}
          pipelineId={perdendo.funilId}
          stageId={perdendo.etapaId}
          onOpenChange={(aberto) => {
            if (aberto) return;
            setPerdendo(null);
            void queryClient.invalidateQueries({ queryKey: ["clientes"] });
          }}
        />
      ) : null}
    </div>
  );
}
