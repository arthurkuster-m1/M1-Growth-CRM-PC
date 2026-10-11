"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { CelulaDeCaixa } from "@/components/motor/CelulaDeCaixa";
import { CelulaDePessoa } from "@/components/motor/CelulaDePessoa";
import { ConfigurarVisualizacao } from "@/components/motor/ConfigurarVisualizacao";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";
import { TabelaDoMotor, type ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { PipelinePageClient } from "@/app/app/pipelines/[id]/_client";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import { apiClient } from "@/lib/api/client";
import { ROLE_RANK } from "@/lib/auth/types";
import {
  aplicarConsulta,
  type CampoConsultavel,
  type ConsultaDaTabela,
} from "@/lib/motor/consulta";
import { moverColuna, resolverColunas, type PreferenciasDaTabela } from "@/lib/motor/layout";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { MagnifyingGlass, Rows, Kanban, TextAa, Users } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
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

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * O CRM FINAL: a página Clientes. Uma lista de leads (um por telefone), a seleção do funil
 * ("Todos" é a lista completa), a alternância Tabela | Kanban e o motor das Tarefas —
 * filtros, ordem, agrupamento e colunas que se escondem e reordenam.
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
  const vistaPedida = parametros.get("vista") === "quadro" ? "quadro" : "tabela";
  const [busca, setBusca] = useState("");
  // "Agora" fixado na montagem: a tela não recalcula o relógio a cada render.
  const [agora] = useState(() => Date.now());
  const [configurando, setConfigurando] = useState(false);

  const consulta = useQuery({
    queryKey: ["clientes", funilEscolhido],
    queryFn: async () =>
      (await apiClient.get<{ data: Dados }>(`/api/v1/clientes?funil=${funilEscolhido}`)).data,
    staleTime: 10_000,
  });
  const dados = consulta.data;
  const funilAtual = dados?.funis.find((f) => f.id === funilEscolhido) ?? null;
  const funilValido = funilEscolhido === TODOS || funilAtual !== null;
  const vista = funilAtual && vistaPedida === "quadro" ? "quadro" : "tabela";

  const membrosDaEquipe = useAssignableMembers(true);
  const membros = (membrosDaEquipe.data ?? []).map((m) => ({
    id: m.user_id,
    nome: m.full_name?.trim() || t("Sem nome"),
  }));
  const nomeDoMembro = (id: string | null) => membros.find((m) => m.id === id)?.nome ?? null;

  const chavePrefs = `clientes-${funilEscolhido === TODOS ? TODOS : funilEscolhido}`;
  const prefs = useVisualizacao(chavePrefs);
  const preferencias: PreferenciasDaTabela = prefs.preferencias;
  const atualizar = prefs.atualizar;

  function ir(novo: { funil?: string; vista?: "tabela" | "quadro" }) {
    const p = new URLSearchParams(parametros.toString());
    if (novo.funil !== undefined) {
      if (novo.funil === TODOS) p.delete("funil");
      else p.set("funil", novo.funil);
      if (novo.funil === TODOS) p.delete("vista");
    }
    if (novo.vista !== undefined) {
      if (novo.vista === "tabela") p.delete("vista");
      else p.set("vista", novo.vista);
    }
    const qs = p.toString();
    router.replace(qs ? `${caminho}?${qs}` : caminho, { scroll: false });
  }

  const etapasPorId = useMemo(() => new Map((dados?.etapas ?? []).map((e) => [e.id, e])), [dados]);
  const funisPorId = useMemo(() => new Map((dados?.funis ?? []).map((f) => [f.id, f])), [dados]);

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
  const rotuloDoStatus = (s: string) =>
    s === "won" ? t("Ganho") : s === "lost" ? t("Perdido") : t("Aberto");
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
    } catch (e) {
      showApiError(e);
    }
  }

  const podeEditar = (dados?.pode_editar ?? false) && ROLE_RANK[role] >= ROLE_RANK.agent;

  const opcoesDeEtapa = (dados?.etapas ?? [])
    .filter((e) => !funilAtual || e.pipeline_id === funilAtual.id)
    .map((e) => ({ id: e.id, rotulo: e.name, cor: corDaEtapa(e), pipeline_id: e.pipeline_id }));

  const colunas: ColunaDoMotor<Linha>[] = [
    {
      id: "nome",
      titulo: t("Nome"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 280,
      semOcultar: true,
      celula: (l) => (
        <Link
          href={`/app/contacts/${l.contact_id}`}
          className="flex min-w-0 items-center gap-2 px-2 text-sm font-medium hover:text-primary hover:underline"
        >
          <span
            aria-hidden
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-primary"
          >
            {[...l.nome.trim()][0]?.toUpperCase() ?? "?"}
          </span>
          <span className="truncate">{l.nome}</span>
        </Link>
      ),
    },
    {
      id: "funis",
      titulo: t("Funis"),
      icone: <Rows size={14} aria-hidden />,
      largura: 240,
      celula: (l) => {
        const lista = porFunil(l);
        return (
          <div className="flex min-w-0 flex-col items-start gap-1 px-2 py-0.5">
            {lista.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              lista.map((p) => (
                <Etiqueta key={p.funil_id} cor="gray">
                  {funisPorId.get(p.funil_id)?.name ?? "—"}
                </Etiqueta>
              ))
            )}
          </div>
        );
      },
    },
    {
      id: "etapa",
      titulo: t("Etapa"),
      icone: <Kanban size={14} aria-hidden />,
      largura: 230,
      celula: (l) => {
        if (l.participacao) {
          const atual = etapasPorId.get(l.participacao.etapa_id);
          const fechado = l.participacao.status !== "open";
          const livres = opcoesDeEtapa.filter((o) => {
            const e = etapasPorId.get(o.id);
            return e && !e.is_won && !e.is_lost;
          });
          return (
            <SeletorDeOpcao
              opcoes={livres}
              valorId={atual?.id}
              podeEditar={podeEditar && !fechado}
              rotulo={t("Etapa do negócio")}
              aoEscolher={(id) => void moverEtapa(l.participacao!, id)}
            >
              <Etiqueta ponto cor={corDaEtapa(atual)}>
                {atual?.name ?? "—"}
              </Etiqueta>
            </SeletorDeOpcao>
          );
        }
        const lista = porFunil(l);
        return (
          <div className="flex min-w-0 flex-col items-start gap-1 px-2 py-0.5">
            {lista.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              lista.map((p) => {
                const etapa = etapasPorId.get(p.etapa_id);
                const fechado =
                  p.status === "won" ? t("Ganho") : p.status === "lost" ? t("Perdido") : null;
                return (
                  <Etiqueta key={p.funil_id} cor={corDaEtapa(etapa)}>
                    {`${funisPorId.get(p.funil_id)?.name ?? "—"} - ${etapa?.name ?? "—"}${fechado ? ` (${fechado})` : ""}`}
                  </Etiqueta>
                );
              })
            )}
          </div>
        );
      },
    },
    {
      id: "status",
      titulo: t("Situação"),
      icone: <Rows size={14} aria-hidden />,
      largura: 130,
      padrao: false,
      celula: (l) =>
        l.participacao ? (
          <Etiqueta
            cor={
              l.participacao.status === "won"
                ? "green"
                : l.participacao.status === "lost"
                  ? "red"
                  : "blue"
            }
          >
            {rotuloDoStatus(l.participacao.status)}
          </Etiqueta>
        ) : null,
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
      largura: 140,
      celula: (l) => {
        const v = valorAberto(l);
        return <span className="block truncate px-2 text-sm">{v > 0 ? moeda(v) : "—"}</span>;
      },
    },
    {
      id: "responsavel",
      titulo: t("Responsável"),
      icone: <Users size={14} aria-hidden />,
      largura: 190,
      celula: (l) =>
        l.participacao ? (
          <CelulaDePessoa
            membros={membros}
            valorId={l.participacao.responsavel_id}
            podeEditar={false}
            rotulo={t("Responsável pela tarefa")}
            aoEscolher={() => undefined}
          />
        ) : (
          <span className="block truncate px-2 text-sm text-muted-foreground">
            {nomeDoMembro(l.participacoes.find((p) => p.responsavel_id)?.responsavel_id ?? null) ??
              "—"}
          </span>
        ),
    },
    {
      id: "telefone",
      titulo: t("Telefone"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      celula: (l) => <span className="block truncate px-2 text-sm">{l.telefone ?? "—"}</span>,
    },
    {
      id: "email",
      titulo: t("E-mail"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 220,
      padrao: false,
      celula: (l) => <span className="block truncate px-2 text-sm">{l.email ?? "—"}</span>,
    },
    {
      id: "origem",
      titulo: t("Origem"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 150,
      celula: (l) => <span className="block truncate px-2 text-sm">{l.origem ?? "—"}</span>,
    },
    {
      id: "tags",
      titulo: t("Tags"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 260,
      padrao: false,
      celula: (l) => (
        <div className="flex min-w-0 flex-wrap gap-1 px-2">
          {l.tags.map((x) => (
            <Etiqueta key={x} cor="gray">
              {x}
            </Etiqueta>
          ))}
        </div>
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
      id: "etapa",
      titulo: t("Etapa"),
      tipo: "opcao",
      valorDe: (l) => l.participacao?.etapa_id,
      opcoes: opcoesDeEtapa,
      rotuloDoValor: (v) => etapasPorId.get(v)?.name ?? v,
      ordemDoValor: (v) => etapasPorId.get(v)?.position ?? 0,
    },
    {
      id: "status",
      titulo: t("Situação"),
      tipo: "opcao",
      valorDe: (l) => l.participacao?.status,
      opcoes: [
        { id: "open", rotulo: t("Aberto"), cor: "blue" },
        { id: "won", rotulo: t("Ganho"), cor: "green" },
        { id: "lost", rotulo: t("Perdido"), cor: "red" },
      ],
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

  const resolvidas = resolverColunas(
    colunas.filter((c) => funilAtual !== null || c.id !== "status"),
    preferencias,
  );
  const mostradas = resolvidas.filter((c) => c.visivel);

  const termo = semAcento(busca);
  const buscadas = termo
    ? linhas.filter((l) =>
        semAcento(`${l.nome} ${l.telefone ?? ""} ${l.email ?? ""} ${l.tags.join(" ")}`).includes(
          termo,
        ),
      )
    : linhas;
  const resultado = aplicarConsulta(buscadas, campos, preferencias, {
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

  // Os números do topo (como na referência), sobre o que a lista mostra.
  const alvos = buscadas;
  const abertas = alvos.flatMap((l) =>
    (l.participacao ? [l.participacao] : l.participacoes).filter((p) => p.status === "open"),
  );
  const ganhas = alvos.flatMap((l) =>
    (l.participacao ? [l.participacao] : l.participacoes).filter((p) => p.status === "won"),
  );
  const perdidas = alvos.flatMap((l) =>
    (l.participacao ? [l.participacao] : l.participacoes).filter((p) => p.status === "lost"),
  );
  const decididas = ganhas.length + perdidas.length;
  const taxa = decididas > 0 ? Math.round((ganhas.length / decididas) * 100) : 0;
  const seteDias = agora - 7 * 86_400_000;
  const semContato = abertas.filter((p) => {
    const u = p.ultima_atividade ?? p.criado_em;
    return new Date(u).getTime() < seteDias;
  }).length;
  const numeros: Array<[string, string]> = [
    [t("Total de leads"), String(alvos.length)],
    [t("Valor em aberto"), moeda(abertas.reduce((s, p) => s + (p.valor_cents ?? 0), 0))],
    [t("Taxa de conversão"), `${taxa}%`],
    [t("Ganhos"), String(ganhas.length)],
    [t("MQL"), String(alvos.filter((l) => l.is_mql).length)],
    [t("Sem contato (+7d)"), String(semContato)],
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Clientes")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Todos os seus leads, em cada funil, num só lugar.")}
        </p>
      </header>

      <section
        aria-label={t("Resumo")}
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3 xl:grid-cols-6"
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
        <div
          role="tablist"
          aria-label={t("Funis")}
          className="-mx-1 flex min-w-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden"
        >
          {[{ id: TODOS, name: t("Todos") }, ...(dados?.funis ?? [])].map((f) => {
            const ativa = f.id === funilEscolhido;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => ir({ funil: f.id })}
                className={cn(
                  "h-9 shrink-0 rounded-xl border px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  ativa
                    ? "border-primary bg-primary/10 text-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {f.name}
              </button>
            );
          })}
        </div>
        <div
          role="group"
          aria-label={t("Como ver os leads")}
          className="ml-auto inline-flex rounded-xl bg-secondary p-0.5"
        >
          {(
            [
              ["tabela", t("Tabela"), <Rows key="t" size={14} aria-hidden />],
              ["quadro", t("Quadro"), <Kanban key="k" size={14} aria-hidden />],
            ] as const
          ).map(([valor, rotulo, icone]) => {
            const desligado = valor === "quadro" && funilAtual === null;
            return (
              <button
                key={valor}
                type="button"
                aria-pressed={vista === valor}
                disabled={desligado}
                title={desligado ? t("Escolha um funil para ver o quadro.") : undefined}
                onClick={() => ir({ vista: valor })}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-40",
                  vista === valor
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {icone}
                {rotulo}
              </button>
            );
          })}
        </div>
      </div>

      {!funilValido && !consulta.isLoading ? (
        <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          {t("Este funil não existe mais.")}
        </p>
      ) : vista === "quadro" && funilAtual ? (
        <PipelinePageClient pipelineId={funilAtual.id} initialName={funilAtual.name} role={role} />
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
                className="h-10 w-full rounded-xl border bg-background pr-3 pl-9 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <button
              type="button"
              onClick={() => setConfigurando(true)}
              className="h-10 rounded-xl border bg-card px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
            >
              {t("Colunas")}
            </button>
          </div>
          <BarraDeConsulta
            campos={camposDaBarra}
            consulta={{
              filtros: preferencias.filtros,
              ordenacao: preferencias.ordenacao,
              agrupar: preferencias.agrupar,
              agruparPor: preferencias.agruparPor,
            }}
            aoMudar={mudarConsulta}
          />
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
            vazio={
              <p className="p-6 text-center text-sm text-muted-foreground">
                {consulta.isError
                  ? t("Não foi possível carregar os leads.")
                  : t("Nenhum lead por aqui ainda.")}
              </p>
            }
          />
          <ConfigurarVisualizacao
            aberto={configurando}
            aoFechar={() => setConfigurando(false)}
            nome={preferencias.nome ?? funilAtual?.name ?? t("Todos")}
            tipo="tabela"
            tipos={["tabela"]}
            podeEditar={podeEditar}
            ehPadrao
            aoRenomear={(nome) => atualizar((p) => ({ ...p, nome }))}
            aoTrocarTipo={() => undefined}
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
          />
        </>
      )}
    </div>
  );
}
