"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { BarraDeFunis, type FunilDaBarra } from "@/components/clientes/BarraDeFunis";
import { ImportarLeadsDoCRM } from "@/components/clientes/ImportarLeadsDoCRM";
import { NovoLeadDoCRM } from "@/components/clientes/NovoLeadDoCRM";
import { CelulaDeEtiquetas } from "@/components/clientes/CelulaDeEtiquetas";
import { LoseLeadDialog } from "@/components/kanban/LoseLeadDialog";
import { telefoneE164 } from "@/components/leads/FichaDoLead";
import { AbasDeVisualizacao } from "@/components/motor/AbasDeVisualizacao";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { CelulaDeCaixa } from "@/components/motor/CelulaDeCaixa";
import { CelulaDePessoa } from "@/components/motor/CelulaDePessoa";
import { CelulaDeTexto } from "@/components/motor/CelulaDeTexto";
import { ConfigurarVisualizacao } from "@/components/motor/ConfigurarVisualizacao";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";
import { AcoesEmMassaDeClientes } from "@/components/clientes/AcoesEmMassaDeClientes";
import { TabelaDoMotor, type ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { PipelinePageClient } from "@/app/app/pipelines/[id]/_client";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
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
import { CHAVE_DE_VENDAS_PENDENTES } from "@/components/vendas/PopupDeVendaPendente";
import { ArrowRight, MagnifyingGlass, Rows, Kanban, TextAa, Users, UploadSimple, Plus } from "@/lib/ui/icons";
import type { ClienteDaLista, ParticipacaoDoCliente } from "@/app/api/v1/clientes/route";
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
  pode_editar: boolean;
  pode_gerir: boolean;
}

/** Uma linha da tabela: o lead (contato) e, num funil escolhido, a participação dele nele. */
interface Linha extends ClienteDaLista {
  participacao: ParticipacaoDoCliente | null;
}

const PALETA: CorDaOpcao[] = ["blue", "purple", "orange", "yellow", "pink", "brown", "gray"];
const TODOS = "todos";
const ROTULO_DA_VENDA: Record<string, string> = {
  interesse: "Interesse",
  comprometida: "Comprometida",
  concluida: "Concluída",
};
const COR_DA_VENDA: Record<string, string> = {
  interesse: "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  comprometida: "border-yellow-500/70 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300",
  concluida: "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-300",
};
const ID_DA_PADRAO = "padrao";
const TIPOS_DO_CRM = ["tabela", "kanban"] as const;

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * O CRM FINAL: a página Clientes. Uma lista de leads (um por telefone), a seleção do funil
 * ("Todos" é a lista completa) e o motor das Tarefas — abas de visualização salvas (Tabela ou
 * Quadro), filtros, ordem, agrupamento e colunas que se escondem e reordenam. As células da
 * tabela se editam no lugar, como no Notion.
 */
export function ClientesCRM() {
  const t = useT();
  const tag = useTagDeIdioma();
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const queryClient = useQueryClient();
  const org = useActiveOrg();
  const role = org?.role ?? "viewer";

  const funilEscolhido = parametros.get("funil") ?? TODOS;
  const [busca, setBusca] = useState("");
  // "Agora" fixado na montagem: a tela não recalcula o relógio a cada render.
  const [agora] = useState(() => Date.now());
  const [configurando, setConfigurando] = useState(false);
  const [selecionadas, setSelecionadas] = useState<ReadonlySet<string>>(new Set());
  const [perdendo, setPerdendo] = useState<{ leadId: string; funilId: string } | null>(null);
  const [novoLeadAberto, setNovoLeadAberto] = useState(false);
  /** O número do topo que está "aberto": a lista mostra só quem compõe aquele número. */
  const [destaque, setDestaque] = useState<
    null | "abertos" | "compraram" | "vendas" | "mql" | "semcontato"
  >(null);
  const [importarAberto, setImportarAberto] = useState(false);

  const chaveDaConsulta = ["clientes", funilEscolhido] as const;
  const consulta = useQuery({
    queryKey: chaveDaConsulta,
    queryFn: async () =>
      (await apiClient.get<{ data: Dados }>(`/api/v1/clientes?funil=${funilEscolhido}`)).data,
    staleTime: 10_000,
  });
  const dados = consulta.data;
  const funilAtual = dados?.funis.find((f) => f.id === funilEscolhido) ?? null;
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
  const padrao = useVisualizacao("clientes");
  const { visoes, salvarConfig, criarVisao, editarVisao, apagarVisao } = useVisoesSalvas(
    "clientes",
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
  const vista = visaoAtiva?.type === "kanban" ? "quadro" : "tabela";
  const preferencias: PreferenciasDaTabela = visaoAtiva ? visaoAtiva.config : padrao.preferencias;
  const atualizar = (mudar: (atual: PreferenciasDaTabela) => PreferenciasDaTabela) => {
    if (visaoAtiva) salvarConfig(visaoAtiva.id, mudar(visaoAtiva.config));
    else padrao.atualizar(mudar);
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
    return base.map((c) => {
      const doFunil =
        funilAtual === null
          ? null
          : (c.participacoes.find((p) => p.funil_id === funilAtual.id && p.status === "open") ??
            c.participacoes.find((p) => p.funil_id === funilAtual.id) ??
            null);
      return { ...c, participacao: doFunil };
    });
  }, [dados, funilAtual]);

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
  const valorAberto = (l: Linha) =>
    (l.participacao ? [l.participacao] : l.participacoes)
      .filter((p) => p.status === "open")
      .reduce((s, p) => s + (p.valor_cents ?? 0), 0);
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
      // Lead ganho: o banco efetiva a venda e o pop-up global (casca do app) a abre na hora.
      if (dados?.etapas.find((e) => e.id === etapaId)?.is_won) {
        await queryClient.invalidateQueries({ queryKey: CHAVE_DE_VENDAS_PENDENTES });
      }
    } catch (e) {
      showApiError(e);
    }
  }

  /** Os negócios que a linha mostra: o do funil escolhido, ou um por funil em "Todos". */
  const partes = (l: Linha): ParticipacaoDoCliente[] =>
    l.participacao ? [l.participacao] : porFunil(l);
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
  const ganhar = (p: ParticipacaoDoCliente) =>
    executar(async () => {
      await apiClient.post(`/api/v1/leads/${p.lead_id}/win`, {});
      // O banco efetiva a venda e o pop-up global (casca do app) a abre na hora.
      await queryClient.invalidateQueries({ queryKey: CHAVE_DE_VENDAS_PENDENTES });
    });
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
      titulo: t("Nome"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 300,
      semOcultar: true,
      celula: (l) => (
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
                  // Etapa de perda pede o motivo (o mesmo diálogo de antes).
                  if (etapasPorId.get(id)?.is_lost) {
                    setPerdendo({ leadId: p.lead_id, funilId: p.funil_id });
                    return;
                  }
                  // Etapa de ganho: fecha como venda (o banco efetiva a venda e abre o pop-up).
                  if (etapasPorId.get(id)?.is_won) {
                    void ganhar(p);
                    return;
                  }
                  void moverEtapa(p, id);
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
        const alvo = alvoDaLinha(l);
        const nomes = [
          ...new Set(
            partes(l)
              .map((p) => (p.campanha_id ? campanhasPorId.get(p.campanha_id) : null))
              .filter((n): n is string => Boolean(n)),
          ),
        ];
        const conteudo = (
          <span className="block min-w-0 truncate text-sm" title={nomes.join(", ")}>
            {nomes.length > 0 ? nomes.join(", ") : "—"}
          </span>
        );
        if (!alvo) return <div className="px-2">{conteudo}</div>;
        return (
          <SeletorDeOpcao
            opcoes={(dados?.campanhas ?? []).map((c) => ({
              id: c.id,
              rotulo: c.name,
              cor: "gray" as CorDaOpcao,
            }))}
            valorId={alvo.campanha_id ?? undefined}
            podeEditar={podeEditar}
            rotulo={t("Campanha de origem")}
            aoEscolher={(id) => void salvarOrigem(l, alvo, { campaign_id: id })}
            aoLimpar={() => void salvarOrigem(l, alvo, { campaign_id: null })}
          >
            {conteudo}
          </SeletorDeOpcao>
        );
      },
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
      id: "valor",
      titulo: t("Valor"),
      icone: <Rows size={14} aria-hidden />,
      largura: 150,
      celula: (l) => {
        const alvo = alvoDaLinha(l);
        const v = valorAberto(l);
        const exibicao = v > 0 ? moeda(v) : "—";
        if (!alvo) return <span className="block truncate px-2 text-sm">{exibicao}</span>;
        const atual = alvo.valor_cents ?? 0;
        return (
          <CelulaDeTexto
            valor={atual > 0 ? String(atual / 100).replace(".", ",") : ""}
            exibir={atual > 0 ? moeda(atual) : "—"}
            rotulo={t("Valor")}
            vazioRotulo="—"
            permitirVazio
            inputMode="decimal"
            podeEditar={podeEditar}
            aoSalvar={(texto) => {
              const n = texto.trim() === "" ? 0 : lerNumero(texto);
              if (n === null || n < 0) return;
              const cents = Math.round(n * 100);
              void salvarNegocio(l, alvo, { value_cents: cents }, { valor_cents: cents });
            }}
          />
        );
      },
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
      id: "telefone",
      titulo: t("Telefone"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 180,
      celula: (l) => (
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
      titulo: t("LTV atual"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      celula: (l) => (
        <span className="block truncate px-2 text-sm font-medium tabular-nums">
          {l.ltv_cents > 0 ? moeda(l.ltv_cents) : "—"}
        </span>
      ),
    },
    {
      id: "ltv-previsto",
      titulo: t("LTV previsto"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      celula: (l) => (
        <span className="block truncate px-2 text-sm tabular-nums">
          {l.ltv_previsto_cents > 0 ? moeda(l.ltv_previsto_cents) : "—"}
        </span>
      ),
    },
    {
      id: "interesse",
      titulo: t("Em interesse"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      padrao: false,
      celula: (l) => (
        <span className="block truncate px-2 text-sm tabular-nums">
          {l.interesse_cents > 0 ? moeda(l.interesse_cents) : "—"}
        </span>
      ),
    },
    {
      id: "vendas",
      titulo: t("Vendas pagas (qtd)"),
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
        const lista = (l.vendas_ativas ?? []).filter(
          (v) => !funilAtual || v.funil_id === funilAtual.id,
        );
        if (lista.length === 0) return semValor;
        return empilhado(
          lista.map((v) => (
            <span key={v.id} className="flex min-w-0 items-center gap-1.5 px-2 text-sm">
              <span className="min-w-0 truncate" title={v.nome}>
                {v.nome || t("Sem produto")}
              </span>
              <span
                className={`shrink-0 rounded-full border px-1.5 text-[11px] font-medium ${
                  COR_DA_VENDA[v.status] ?? ""
                }`}
              >
                {t(ROTULO_DA_VENDA[v.status] ?? v.status)}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {moeda(v.valor_cents)}
              </span>
            </span>
          )),
        );
      },
    },
    {
      id: "anuncio",
      titulo: t("Anúncio"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 220,
      celula: (l) =>
        l.anuncios && l.anuncios.length > 0 ? (
          <span className="block min-w-0 truncate px-2 text-sm" title={l.anuncios.join(", ")}>
            {l.anuncios.join(", ")}
          </span>
        ) : (
          semValor
        ),
    },
    {
      id: "lp",
      titulo: t("Landing page"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 220,
      celula: (l) =>
        l.lps && l.lps.length > 0 ? (
          <span className="block min-w-0 truncate px-2 text-sm" title={l.lps.join(", ")}>
            {l.lps.join(", ")}
          </span>
        ) : (
          semValor
        ),
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
      id: "mql",
      titulo: "MQL",
      tipo: "caixa",
      valorDe: (l) => l.is_mql,
      rotuloDoValor: (v) => (v === "1" ? t("Sim") : t("Não")),
    },
    { id: "valor", titulo: t("Valor"), tipo: "numero", valorDe: (l) => valorAberto(l) / 100 },
    { id: "origem", titulo: t("Origem"), tipo: "texto", valorDe: (l) => l.origem },
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
    { id: "ltv", titulo: t("LTV atual"), tipo: "numero", valorDe: (l) => l.ltv_cents / 100 },
    {
      id: "ltv-previsto",
      titulo: t("LTV previsto"),
      tipo: "numero",
      valorDe: (l) => l.ltv_previsto_cents / 100,
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
  const campos = todosOsCampos.filter(
    (c) => funilAtual !== null || (c.id !== "etapa" && c.id !== "status"),
  );

  const camposDaBarra: CampoDaBarra[] = campos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    opcoes: c.opcoes,
  }));

  const resolvidas = resolverColunas(colunas, preferencias);
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
  const seteDias = agora - 7 * 86_400_000;
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
      case "abertos":
        return emAberto.length > 0;
      case "compraram":
      case "vendas":
        return vendasDoLead(l) > 0;
      case "mql":
        return l.is_mql;
      case "semcontato":
        return estaSemContato(l);
      default:
        return true;
    }
  };
  const visiveis = destaque ? buscadas.filter(passaNoDestaque) : buscadas;

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

  const numeros: Array<{
    id: "todos" | NonNullable<typeof destaque>;
    rotulo: string;
    valor: string;
    detalhe?: string;
  }> = [
    { id: "todos", rotulo: t("Total de leads"), valor: String(alvos.length) },
    {
      id: "abertos",
      rotulo: t("Valor em aberto"),
      valor: moeda(abertas.reduce((s2, p) => s2 + (p.valor_cents ?? 0), 0)),
      detalhe: `${abertas.length} ${abertas.length === 1 ? t("negócio aberto") : t("negócios abertos")}`,
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
  ];

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
          <h1 className="text-2xl font-semibold tracking-tight">{t("Clientes")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Todos os seus leads, em cada funil, num só lugar.")}
          </p>
        </div>
        {dados?.pode_editar ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/vendas"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {t("Vendas")}
              <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
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
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3 xl:grid-cols-6"
      >
        {numeros.map((n) => {
          const clicavel = n.id !== "todos";
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
              onClick={() => setDestaque(n.id === "todos" || destaque === n.id ? null : n.id)}
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

      {destaque ? (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>
            {t("Mostrando só quem compõe")}{" "}
            <strong>{numeros.find((n) => n.id === destaque)?.rotulo}</strong> · {visiveis.length}{" "}
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
        podeOrganizar
        aoEscolher={(id) => ir({ funil: id })}
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

      {!funilValido && !consulta.isLoading ? (
        <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          {t("Este funil não existe mais.")}
        </p>
      ) : (
        <>
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
            aoConfigurar={() => setConfigurando(true)}
          />

          {vista === "quadro" ? (
            funilAtual ? (
              <PipelinePageClient
                key={funilAtual.id}
                pipelineId={funilAtual.id}
                initialName={funilAtual.name}
                role={role}
              />
            ) : (
              <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                {t("Escolha um funil na linha de cima para ver o quadro.")}
              </p>
            )
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
              ) : (
                <TabelaDoMotor
                  linhas={resultado.linhas}
                  idDe={(l) => l.contact_id}
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
                      const ids = resultado.linhas.map((l) => l.contact_id);
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
                      marcar ? new Set(resultado.linhas.map((l) => l.contact_id)) : new Set(),
                    )
                  }
                />
              )}
              {podeEditar ? (
                <AcoesEmMassaDeClientes
                  contatoIds={[...selecionadas]}
                  podeGerir={ROLE_RANK[role] >= ROLE_RANK.manager}
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
            podeEditar={podeEditar}
            ehPadrao={!visaoAtiva}
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
