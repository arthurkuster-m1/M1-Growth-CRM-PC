"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AbasDeVisualizacao } from "@/components/motor/AbasDeVisualizacao";
import { ConfigurarVisualizacao } from "@/components/motor/ConfigurarVisualizacao";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { CelulaDeData } from "@/components/motor/CelulaDeData";
import { CelulaDePessoa } from "@/components/motor/CelulaDePessoa";
import { CelulaDeTexto } from "@/components/motor/CelulaDeTexto";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { EditorDeOpcoesDePropriedade } from "@/components/motor/EditorDeOpcoesDePropriedade";
import { MenuDaColuna } from "@/components/motor/MenuDaColuna";
import { NovaPropriedade } from "@/components/motor/NovaPropriedade";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";
import { TabelaDoMotor, type ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import {
  LARGURA_DO_TIPO,
  iconeDoTipo,
  rotuloDoTipo,
} from "@/components/motor/tipos-de-propriedade";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import { useVisoesSalvas } from "@/hooks/motor/useVisoesSalvas";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { toast } from "sonner";

import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { useModelosDeTarefa } from "@/hooks/tarefas/useModelosDeTarefa";
import { useOpcoesDeStatus } from "@/hooks/tarefas/useOpcoesDeStatus";
import { usePropriedadesDaTarefa } from "@/hooks/tarefas/usePropriedadesDaTarefa";
import { useTarefasDoMotor } from "@/hooks/tarefas/useTarefasDoMotor";
import {
  aplicarConsulta,
  consultaAtiva,
  filtrar,
  filtrosQueReprovam,
  valoresDeNascimento,
  type CampoConsultavel,
  type ConsultaDaTabela,
} from "@/lib/motor/consulta";
import { formatarDiaBr } from "@/lib/motor/calendario";
import { hojeNoFuso, rotuloDaData } from "@/lib/motor/datas-do-campo";
import { moverColuna, resolverColunas, type PreferenciasDaTabela } from "@/lib/motor/layout";
import type { TipoDeVisualizacao } from "@/lib/motor/visualizacoes";
import { alternarId, faixaEntre, podarSelecao } from "@/lib/motor/selecao";
import { opcaoDaTarefa, type CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { metasDaTarefa } from "@/lib/tarefas/campos-da-tarefa";
import { tarefaDoModelo, type ModeloDeTarefa } from "@/lib/tarefas/modelos";
import { tarefaQueNasce } from "@/lib/tarefas/nascer-com-filtros";
import { TIPOS_COM_OPCOES } from "@/lib/tarefas/propriedades";
import {
  SITUACOES_DA_TAREFA,
  estaAtrasada,
  type PrioridadeDaTarefa,
  type Tarefa,
} from "@/lib/tarefas/tipos";
import {
  ArrowsClockwise,
  CalendarBlank,
  CaretDown,
  DotsThree,
  MagnifyingGlass,
  X,
  Flag,
  Plus,
  Tag,
  TextAa,
  Trash,
  UserCircle,
} from "@/lib/ui/icons";

import { AcoesEmMassa } from "./AcoesEmMassa";
import { CelulaDePropriedade } from "./CelulaDePropriedade";
import { EditorDeOpcoesDeStatus } from "./EditorDeOpcoesDeStatus";
import { PainelDaTarefa } from "./PainelDaTarefa";
import { ModelosDeTarefa } from "./ModelosDeTarefa";
import { CalendarioDeTarefas } from "./CalendarioDeTarefas";
import { LinhaDoTempo } from "./LinhaDoTempo";
import { QuadroKanban } from "./QuadroKanban";

/** `2026-10-01` → "Outubro de 2026" (no idioma da pessoa). */
const rotuloDoMes = (chave: string, tag: string) => {
  const texto = new Intl.DateTimeFormat(tag, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${chave}T12:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** Busca sem acento e sem diferença de maiúscula. */
const normalizarBusca = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const SEM_IDS: ReadonlySet<string> = new Set();

/** O relógio fica fora do componente: é lido só quando a pessoa cria a tarefa, nunca ao desenhar a tela. */
const relogioEmSegundos = () => Date.now() / 1000;

interface Props {
  fuso: string;
  usuarioId: string;
  /** `agent` ou acima: edita, cria, apaga e reordena. */
  podeEditar: boolean;
  /** `manager` ou acima: edita as opções de status. */
  podeConfigurar: boolean;
  /** O instante em que o servidor pintou a tela — o mesmo "agora" do Início. */
  agoraIso: string;
}

/**
 * TAREFAS — a tabela estilo Notion. Células que se editam no lugar, status com nome e cor
 * da organização, propriedades que se escolhem, linhas que se arrastam.
 *
 * Usa as MESMAS tarefas (`crm_tasks`) da tela de Tarefas atual e do Início: o que se
 * muda aqui aparece lá, e vice-versa. O que é novo é só a forma de editar.
 */
export function TarefasMotorClient({
  fuso,
  usuarioId,
  podeEditar,
  podeConfigurar,
  agoraIso,
}: Props) {
  void usuarioId;
  const t = useT();
  const tag = useTagDeIdioma();
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);

  const {
    tarefas,
    carregando,
    falhou,
    editarTarefa,
    reordenar,
    criarTarefa,
    apagarTarefa,
    editarVarias,
    apagarVarias,
  } = useTarefasDoMotor();
  const { modelos, criarModelo, editarModelo, apagarModelo } = useModelosDeTarefa();
  const { opcoes, criarOpcao, editarOpcao, apagarOpcao } = useOpcoesDeStatus();
  const { propriedades, criarPropriedade, editarPropriedade, apagarPropriedade } =
    usePropriedadesDaTarefa();
  const membrosDaEquipe = useAssignableMembers(podeEditar);
  const membros = (membrosDaEquipe.data ?? []).map((m) => ({
    id: m.user_id,
    nome: m.full_name?.trim() || t("Sem nome"),
  }));

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const aoAbrirDoInicio = useSearchParams().get("abrir");
  // `?abrir=<id>` (o link da tela Início) abre a tarefa direto no painel.
  const [abertaId, setAbertaId] = useState<string | null>(aoAbrirDoInicio);
  const [configurando, setConfigurando] = useState(false);
  const [modelosAberto, setModelosAberto] = useState(false);
  const [modeloNovo, setModeloNovo] = useState(false);
  const [fixadas, setFixadas] = useState<{ chave: string; ids: ReadonlySet<string> }>({
    chave: "",
    ids: new Set(),
  });
  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [apagarVisaoId, setApagarVisaoId] = useState<string | null>(null);
  const [apagarId, setApagarId] = useState<string | null>(null);
  const [apagarPropriedadeId, setApagarPropriedadeId] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set());
  const [apagarVariasAberto, setApagarVariasAberto] = useState(false);
  const ultimoMarcado = useRef<string | null>(null);

  const titulosDosGrupos = {
    pending: t("A fazer"),
    in_progress: t("Em andamento"),
    done: t("Concluído"),
    cancelled: t("Cancelado"),
  };
  const prioridades: { id: PrioridadeDaTarefa; rotulo: string; cor: CorDaOpcao }[] = [
    { id: "low", rotulo: t("Baixa"), cor: "gray" },
    { id: "medium", rotulo: t("Média"), cor: "blue" },
    { id: "high", rotulo: t("Alta"), cor: "orange" },
    { id: "urgent", rotulo: t("Urgente"), cor: "red" },
  ];

  const colunasDeFabrica: ColunaDoMotor<Tarefa>[] = [
    {
      id: "titulo",
      titulo: t("Título"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 340,
      semOcultar: true,
      celula: (tarefa) => (
        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1 max-md:[&_button]:text-base">
            <CelulaDeTexto
              valor={tarefa.title}
              rotulo={t("Título da tarefa")}
              podeEditar={podeEditar}
              riscado={tarefa.status === "done"}
              iniciarEditando={editandoId === tarefa.id}
              aoTerminarEdicao={() =>
                setEditandoId((atual) => (atual === tarefa.id ? null : atual))
              }
              aoSalvar={(title) => void editarTarefa(tarefa.id, { title }, { title })}
            />
          </div>
          <button
            type="button"
            aria-label={t("Abrir tarefa")}
            title={t("Abrir tarefa")}
            onClick={() => setAbertaId(tarefa.id)}
            className="inline-flex h-7 shrink-0 items-center rounded-md border bg-card px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase transition-opacity hover:bg-secondary hover:text-foreground focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
          >
            {t("Abrir")}
          </button>
        </div>
      ),
    },
    {
      id: "status",
      titulo: t("Status"),
      icone: <Tag size={14} aria-hidden />,
      largura: 190,
      celula: (tarefa) => {
        const atual = opcaoDaTarefa(tarefa, opcoes);
        return (
          <SeletorDeOpcao
            opcoes={opcoes.map((o) => ({ id: o.id, rotulo: o.name, cor: o.color, grupo: o.grupo }))}
            valorId={atual?.id}
            podeEditar={podeEditar}
            rotulo={t("Status da tarefa")}
            secoes={SITUACOES_DA_TAREFA.map((grupo) => ({
              grupo,
              titulo: titulosDosGrupos[grupo],
            }))}
            aoEscolher={(id) => {
              const escolhida = opcoes.find((o) => o.id === id);
              if (!escolhida) return;
              void editarTarefa(
                tarefa.id,
                { status_option_id: id },
                { status_option_id: id, status: escolhida.grupo },
              );
            }}
            renderizarEditor={
              podeConfigurar
                ? (voltar) => (
                    <EditorDeOpcoesDeStatus
                      opcoes={opcoes}
                      titulosDosGrupos={titulosDosGrupos}
                      voltar={voltar}
                      aoCriar={criarOpcao}
                      aoEditar={editarOpcao}
                      aoApagar={apagarOpcao}
                    />
                  )
                : undefined
            }
          >
            <Etiqueta ponto cor={atual?.color ?? "gray"}>
              {atual?.name ?? titulosDosGrupos[tarefa.status]}
            </Etiqueta>
          </SeletorDeOpcao>
        );
      },
    },
    {
      id: "prioridade",
      titulo: t("Prioridade"),
      icone: <Flag size={14} aria-hidden />,
      largura: 140,
      celula: (tarefa) => {
        const atual = prioridades.find((p) => p.id === tarefa.priority) ?? prioridades[1]!;
        return (
          <SeletorDeOpcao
            opcoes={prioridades}
            valorId={atual.id}
            podeEditar={podeEditar}
            rotulo={t("Prioridade da tarefa")}
            aoEscolher={(id) => {
              const priority = id as PrioridadeDaTarefa;
              void editarTarefa(tarefa.id, { priority }, { priority });
            }}
          >
            <Etiqueta cor={atual.cor}>{atual.rotulo}</Etiqueta>
          </SeletorDeOpcao>
        );
      },
    },
    {
      id: "inicio",
      titulo: t("Início"),
      icone: <CalendarBlank size={14} aria-hidden />,
      largura: 170,
      padrao: false,
      celula: (tarefa) => (
        <CelulaDeData
          valor={tarefa.start_date ?? null}
          fuso={fuso}
          tag={tag}
          agora={agora}
          podeEditar={podeEditar}
          atrasada={false}
          rotulo={t("Início da tarefa")}
          aoSalvar={(start_date) => void editarTarefa(tarefa.id, { start_date }, { start_date })}
        />
      ),
    },
    {
      id: "prazo",
      titulo: t("Prazo"),
      icone: <CalendarBlank size={14} aria-hidden />,
      largura: 170,
      celula: (tarefa) => (
        <CelulaDeData
          valor={tarefa.due_date}
          fuso={fuso}
          tag={tag}
          agora={agora}
          podeEditar={podeEditar}
          atrasada={estaAtrasada(tarefa, agora, fuso)}
          rotulo={t("Prazo da tarefa")}
          aoSalvar={(due_date) => void editarTarefa(tarefa.id, { due_date }, { due_date })}
        />
      ),
    },
    {
      id: "responsavel",
      titulo: t("Responsável"),
      icone: <UserCircle size={14} aria-hidden />,
      largura: 180,
      celula: (tarefa) => (
        <CelulaDePessoa
          membros={membros}
          valorId={tarefa.assigned_to}
          podeEditar={podeEditar}
          rotulo={t("Responsável pela tarefa")}
          aoEscolher={(assigned_to) =>
            void editarTarefa(tarefa.id, { assigned_to }, { assigned_to })
          }
        />
      ),
    },
    // A coluna do cronograma do cliente: só para a gestão. Escolher "Agência" ou "Cliente" põe a
    // tarefa na semana do prazo, no cronograma; limpar a tira de lá.
    ...(podeConfigurar
      ? [
          {
            id: "cronograma",
            titulo: t("Cronograma"),
            icone: <CalendarBlank size={14} aria-hidden />,
            largura: 160,
            celula: (tarefa: Tarefa) => {
              const lados = [
                { id: "agencia", rotulo: t("Agência"), cor: "blue" as CorDaOpcao },
                { id: "cliente", rotulo: t("Cliente"), cor: "orange" as CorDaOpcao },
              ];
              const atual = lados.find((l) => l.id === tarefa.cronograma_lado);
              return (
                <SeletorDeOpcao
                  opcoes={lados}
                  valorId={atual?.id}
                  podeEditar={podeEditar}
                  rotulo={t("Cronograma da tarefa")}
                  aoEscolher={(id) => {
                    const cronograma_lado = id as "agencia" | "cliente";
                    void editarTarefa(tarefa.id, { cronograma_lado }, { cronograma_lado });
                  }}
                  aoLimpar={() =>
                    void editarTarefa(
                      tarefa.id,
                      { cronograma_lado: null },
                      { cronograma_lado: null },
                    )
                  }
                >
                  {atual ? (
                    <Etiqueta cor={atual.cor}>{atual.rotulo}</Etiqueta>
                  ) : (
                    <span className="px-2 text-sm text-muted-foreground">{t("Vazio")}</span>
                  )}
                </SeletorDeOpcao>
              );
            },
          } satisfies ColunaDoMotor<Tarefa>,
        ]
      : []),
    {
      id: "descricao",
      titulo: t("Descrição"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 280,
      padrao: false,
      celula: (tarefa) => (
        <CelulaDeTexto
          valor={tarefa.description ?? ""}
          rotulo={t("Descrição da tarefa")}
          vazioRotulo={t("Vazio")}
          permitirVazio
          podeEditar={podeEditar}
          aoSalvar={(texto) => {
            const description = texto || null;
            void editarTarefa(tarefa.id, { description }, { description });
          }}
        />
      ),
    },
    {
      id: "criada",
      titulo: t("Criada em"),
      icone: <CalendarBlank size={14} aria-hidden />,
      largura: 150,
      padrao: false,
      celula: (tarefa) => (
        <span className="block truncate px-2 text-sm text-muted-foreground">
          {rotuloDaData(tarefa.created_at, fuso, tag, agora)}
        </span>
      ),
    },
  ];

  // As propriedades que a organização criou: uma coluna cada, depois das de fábrica. O id
  // da coluna é `prop:<uuid>` — o mesmo que o layout da pessoa guarda.
  const colunasPersonalizadas: ColunaDoMotor<Tarefa>[] = propriedades.map((p) => ({
    id: `prop:${p.id}`,
    titulo: p.name,
    icone: iconeDoTipo(p.type),
    largura: LARGURA_DO_TIPO[p.type],
    celula: (tarefa) => (
      <CelulaDePropriedade
        propriedade={p}
        valor={tarefa.custom_fields?.[p.id]}
        podeEditar={podeEditar}
        podeConfigurar={podeConfigurar}
        tag={tag}
        aoSalvar={(valor) => {
          const restantes = { ...tarefa.custom_fields };
          if (valor === null) delete restantes[p.id];
          else restantes[p.id] = valor;
          void editarTarefa(
            tarefa.id,
            { custom_fields: { [p.id]: valor } },
            { custom_fields: restantes },
          );
        }}
        aoMudarOpcoes={(options) => void editarPropriedade(p.id, { options })}
      />
    ),
  }));
  const colunas = [...colunasDeFabrica, ...colunasPersonalizadas];

  // O layout (ordem, largura, visibilidade) é da PESSOA e mora na conta dela.
  const padrao = useVisualizacao("tarefas");
  const { visoes, salvarConfig, criarVisao, editarVisao, apagarVisao } = useVisoesSalvas(
    "tarefas",
    podeEditar,
  );
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  // Já abriu: tira o `?abrir=` do endereço, para recarregar ou voltar não reabrir a tarefa.
  useEffect(() => {
    if (aoAbrirDoInicio) router.replace(caminho, { scroll: false });
    // Só na chegada à tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ID_DA_PADRAO = "padrao";
  const visaoAtiva = visoes.find((v) => v.id === parametros.get("v"));
  const ativaId = visaoAtiva?.id ?? ID_DA_PADRAO;
  const preferencias: PreferenciasDaTabela = visaoAtiva ? visaoAtiva.config : padrao.preferencias;
  const atualizar = (mudar: (atual: PreferenciasDaTabela) => PreferenciasDaTabela) => {
    if (visaoAtiva) salvarConfig(visaoAtiva.id, mudar(visaoAtiva.config));
    else padrao.atualizar(mudar);
  };
  function duplicarVisao(id: string) {
    const origem = visoes.find((v) => v.id === id);
    if (!origem) return;
    void criarVisao({
      name: `${t("Cópia de")} ${origem.name}`.slice(0, 60),
      type: origem.type,
      config: origem.config,
    }).then((v) => v && escolherAba(v.id));
  }
  const escolherAba = (id: string) =>
    router.replace(id === ID_DA_PADRAO ? caminho : `${caminho}?v=${id}`, { scroll: false });
  const abas = [
    {
      id: ID_DA_PADRAO,
      nome: padrao.preferencias.nome ?? t("Tabela"),
      tipo: "tabela" as TipoDeVisualizacao,
    },
    ...visoes.map((v) => ({ id: v.id, nome: v.name, tipo: v.type })),
  ];
  const resolvidas = resolverColunas(colunas, preferencias);
  const mostradas = resolvidas.filter((c) => c.visivel);
  const visualizacao: TipoDeVisualizacao = visaoAtiva?.type ?? "tabela";

  function moverColunaNoLayout(idMovido: string, idAlvo: string) {
    // A ordem completa, escondidas inclusive: esconder uma coluna não pode embaralhar as
    // outras quando ela voltar. A coluna fixa (o título) fica de fora, sempre primeira.
    const ordemAtual = resolvidas.filter((c) => !c.fixa).map((c) => c.id);
    atualizar((p) => ({ ...p, ordem: moverColuna(ordemAtual, idMovido, idAlvo) }));
  }

  function redimensionarColuna(id: string, largura: number) {
    atualizar((p) => ({ ...p, larguras: { ...p.larguras, [id]: largura } }));
  }

  function larguraPadrao(id: string) {
    atualizar((p) => ({
      ...p,
      larguras: Object.fromEntries(Object.entries(p.larguras ?? {}).filter(([k]) => k !== id)),
    }));
  }

  function alternarColuna(id: string) {
    const atual = resolvidas.find((c) => c.id === id);
    if (!atual || atual.fixa || atual.semOcultar) return;
    atualizar((p) => ({ ...p, visiveis: { ...p.visiveis, [id]: !atual.visivel } }));
  }

  // ── filtros, ordenação e agrupamento ────────────────────────────────────────────────
  // Os campos consultáveis moram em `lib/tarefas/campos-da-tarefa.ts`: a MESMA lista serve à
  // barra de filtros, ao motor de consulta e à regra "a tarefa nova nasce com os filtros".
  const metasDeCampo = metasDaTarefa({
    t,
    opcoes,
    prioridades,
    membros,
    propriedades,
    fuso,
    cronograma: podeConfigurar,
  });
  const camposConsultaveis: CampoConsultavel<Tarefa>[] = metasDeCampo.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    valorDe: m.valorDe,
    rotuloDoValor: m.opcoes
      ? (v) => m.opcoes!.find((o) => o.id === v)?.rotulo ?? v
      : m.tipo === "caixa"
        ? (v) => (v === "1" ? t("Marcado") : t("Desmarcado"))
        : m.tipo === "data"
          ? (v) => formatarDiaBr(v) || v
          : undefined,
    ordemDoValor:
      m.opcoes && m.tipo !== "pessoa" ? (v) => m.opcoes!.findIndex((o) => o.id === v) : undefined,
  }));
  const camposDaBarra: CampoDaBarra[] = metasDeCampo.map(({ valorDe, ...resto }) => {
    void valorDe;
    return resto;
  });

  // A busca é só desta tela (não se salva na visualização): olha título e descrição.
  const termo = normalizarBusca(busca);
  const tarefasBuscadas = termo
    ? tarefas.filter((x) => normalizarBusca(`${x.title} ${x.description ?? ""}`).includes(termo))
    : tarefas;
  // GARANTIA: a tarefa que a pessoa acabou de criar SEMPRE aparece. Normalmente ela já nasce
  // passando nos filtros; se por qualquer motivo não passar, ela fica à vista (e a tela avisa
  // em qual filtro) até a pessoa mudar os filtros — em vez de sumir como se não tivesse sido criada.
  const contextoDaConsulta = { hoje: hojeNoFuso(agora, fuso) };
  const chaveDosFiltros = JSON.stringify(preferencias.filtros ?? []);
  const idsFixados = fixadas.chave === chaveDosFiltros ? fixadas.ids : SEM_IDS;
  const passamNosFiltros =
    idsFixados.size === 0
      ? null
      : new Set(
          filtrar(
            tarefasBuscadas,
            camposConsultaveis,
            preferencias.filtros,
            contextoDaConsulta,
          ).map((x) => x.id),
        );
  const resultado = aplicarConsulta(
    passamNosFiltros
      ? tarefasBuscadas.filter((x) => passamNosFiltros.has(x.id) || idsFixados.has(x.id))
      : tarefasBuscadas,
    camposConsultaveis,
    passamNosFiltros ? { ...preferencias, filtros: undefined } : preferencias,
    contextoDaConsulta,
  );
  const tarefasVisiveis = resultado.linhas;
  const gruposDaTabela = resultado.grupos?.map((g) => {
    const meta = metasDeCampo.find((m) => m.id === preferencias.agrupar);
    const cor = meta?.opcoes?.find((o) => o.id === g.chave)?.cor;
    const nome =
      g.chave === ""
        ? t("Sem valor")
        : meta?.tipo === "caixa"
          ? g.chave === "1"
            ? t("Marcado")
            : t("Desmarcado")
          : meta?.tipo === "data" && preferencias.agruparPor === "semana"
            ? `${t("Semana de")} ${formatarDiaBr(g.chave)}`
            : meta?.tipo === "data" && preferencias.agruparPor === "mes"
              ? rotuloDoMes(g.chave, tag)
              : g.rotulo;
    return {
      chave: g.chave || "__vazio",
      titulo: cor ? <Etiqueta cor={cor}>{nome}</Etiqueta> : <strong>{nome}</strong>,
      linhas: g.linhas,
    };
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

  // ── seleção de linhas e ações em massa ──────────────────────────────────────────────
  // A seleção é derivada: ids de tarefas que já não existem (apagadas por outra aba, ou por
  // esta mesma ação) saem dela sozinhos, e a contagem nunca mente. Vale o que está À VISTA:
  // linha escondida por um filtro não entra numa ação em massa.
  // Agrupando por um campo de vários valores, a mesma tarefa pode aparecer em mais de um grupo.
  const idsDaTabela = [...new Set(tarefasVisiveis.map((tarefa) => tarefa.id))];
  const selecionadasVivas = podarSelecao(selecionadas, idsDaTabela);
  const idsSelecionados = idsDaTabela.filter((id) => selecionadasVivas.has(id));

  function selecionar(id: string, { faixa }: { faixa: boolean }) {
    setSelecionadas((atual) => {
      const base = podarSelecao(atual, idsDaTabela);
      if (faixa && ultimoMarcado.current) {
        const proximo = new Set(base);
        for (const marcada of faixaEntre(idsDaTabela, ultimoMarcado.current, id))
          proximo.add(marcada);
        return proximo;
      }
      return alternarId(base, id);
    });
    ultimoMarcado.current = id;
  }

  function selecionarTodas(marcar: boolean) {
    setSelecionadas(marcar ? new Set(idsDaTabela) : new Set());
    ultimoMarcado.current = null;
  }

  /** A tarefa recém-criada não passa nos filtros? Mantém à vista e diz em qual. */
  function garantirQueAparece(criada: Tarefa) {
    const reprovam = filtrosQueReprovam(
      criada,
      camposConsultaveis,
      preferencias.filtros,
      contextoDaConsulta,
    );
    if (reprovam.length === 0) return;
    setFixadas((atual) => ({
      chave: chaveDosFiltros,
      ids: new Set([...(atual.chave === chaveDosFiltros ? atual.ids : []), criada.id]),
    }));
    const nomes = [
      ...new Set(
        reprovam.map((f) => metasDeCampo.find((m) => m.id === f.campo)?.titulo ?? f.campo),
      ),
    ].join(", ");
    toast.info(`${t("Tarefa criada, mas ela não combina com o filtro")}: ${nomes}`);
  }

  function abrirModelos(novo: boolean) {
    setModeloNovo(novo);
    setModelosAberto(true);
  }

  /** Cria a tarefa a partir de um modelo: início e prazo contados a partir de HOJE. */
  async function novaDoModelo(modelo: ModeloDeTarefa) {
    const maiorPosicao = tarefas.reduce((m, tarefa) => Math.max(m, tarefa.position ?? 0), 0);
    try {
      const criada = await criarTarefa({
        ...tarefaDoModelo(modelo, hojeNoFuso(agora, fuso), fuso),
        position: Math.max(maiorPosicao + 1, relogioEmSegundos()),
      });
      garantirQueAparece(criada);
      setAbertaId(criada.id);
    } catch {
      // O hook já mostrou o erro da API.
    }
  }

  /**
   * Cria uma tarefa. Ela já nasce com o que a tela está pedindo — como no Notion:
   *  1. os FILTROS ativos (status "é" X, nome "contém" teste, início "é" hoje…);
   *  2. o GRUPO em que a pessoa clicou no "+" (ou a coluna do Quadro): o valor do grupo
   *     vale mais que o filtro sobre o mesmo campo; o grupo "Sem valor" deixa o campo vazio;
   *  3. o DIA em que a pessoa clicou no Calendário (vira o prazo).
   */
  async function novaTarefa(origem?: { dia?: string; grupo?: { campo: string; chave: string } }) {
    // No fim da lista: acima da maior posição existente E do relógio, para a tarefa nova
    // não ficar atrás de uma que foi arrastada para o fim.
    const maiorPosicao = tarefas.reduce((m, tarefa) => Math.max(m, tarefa.position ?? 0), 0);
    const herdados: Record<string, string | number | boolean | string[]> = {
      ...valoresDeNascimento(preferencias.filtros, camposConsultaveis, {
        hoje: hojeNoFuso(agora, fuso),
      }),
    };
    const grupo = origem?.grupo;
    if (grupo) {
      const meta = metasDeCampo.find((m) => m.id === grupo.campo);
      delete herdados[grupo.campo];
      if (meta && grupo.chave !== "") {
        if (meta.tipo === "multi") herdados[grupo.campo] = [grupo.chave];
        else if (meta.tipo === "caixa") herdados[grupo.campo] = grupo.chave === "1";
        else if (meta.tipo === "numero") herdados[grupo.campo] = Number(grupo.chave);
        else herdados[grupo.campo] = grupo.chave;
      }
    }

    const { tarefa, personalizados, tituloVeioDoFiltro } = tarefaQueNasce(herdados, {
      opcoes,
      propriedades,
      fuso,
      tituloPadrao: t("Sem título"),
      dia: origem?.dia,
    });
    try {
      const criada = await criarTarefa({
        ...tarefa,
        position: Math.max(maiorPosicao + 1, relogioEmSegundos()),
      });
      // A criação não aceita propriedades personalizadas: elas entram logo em seguida.
      if (Object.keys(personalizados).length > 0) {
        void editarTarefa(criada.id, { custom_fields: personalizados });
      }
      garantirQueAparece({
        ...criada,
        custom_fields: { ...criada.custom_fields, ...personalizados },
      });
      // O título já veio do filtro? Então não há o que digitar; senão, abre para nomear.
      if (!tituloVeioDoFiltro) setEditandoId(criada.id);
    } catch {
      // O hook já mostrou o erro da API.
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{t("Tarefas")}</h1>
            <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
              {t("Clique para editar. Arraste pelo ícone para reordenar.")}
            </p>
          </div>
          {podeEditar ? (
            // Botão dividido, como no Notion: a parte grande cria em branco; a seta abre os modelos.
            <div className="flex shrink-0 items-stretch rounded-xl bg-primary shadow-sm">
              <button
                aria-label={t("Nova tarefa")}
                type="button"
                onClick={() => void novaTarefa()}
                className="inline-flex h-9 items-center gap-2 rounded-l-xl px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--color-accent-hover)]"
              >
                <Plus size={16} weight="bold" aria-hidden />
                <span className="hidden sm:inline">{t("Nova tarefa")}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("Modelos de tarefa")}
                    title={t("Modelos de tarefa")}
                    className="grid h-9 w-8 place-items-center rounded-r-xl border-l border-primary-foreground/25 text-primary-foreground transition-colors hover:bg-[var(--color-accent-hover)]"
                  >
                    <CaretDown size={14} weight="bold" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {modelos.length > 0 ? (
                    <>
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        {t("Criar a partir de um modelo")}
                      </p>
                      {modelos.map((m) => (
                        <DropdownMenuItem
                          key={m.id}
                          className="gap-2"
                          onSelect={() => void novaDoModelo(m)}
                        >
                          {m.repeat_enabled ? (
                            <ArrowsClockwise
                              size={14}
                              className="shrink-0 text-primary"
                              aria-hidden
                            />
                          ) : null}
                          <span className="truncate">{m.name}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem className="gap-2" onSelect={() => abrirModelos(true)}>
                    <Plus size={14} aria-hidden />
                    {t("Novo modelo")}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onSelect={() => abrirModelos(false)}>
                    <ArrowsClockwise size={14} aria-hidden />
                    {t("Gerenciar modelos e repetições")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
        <AbasDeVisualizacao
          abas={abas}
          ativaId={ativaId}
          podeEditar={podeEditar}
          aoEscolher={escolherAba}
          aoCriar={(nome, tipo) =>
            void criarVisao({ name: nome, type: tipo }).then((v) => v && escolherAba(v.id))
          }
          aoConfigurar={() => setConfigurando(true)}
        />
      </header>

      {falhou ? (
        <p className="rounded-xl border border-error/30 bg-error-bg px-4 py-3 text-sm text-error-fg">
          {t("Não foi possível carregar as tarefas.")}
        </p>
      ) : null}

      {/* Uma fila só, que rola para o lado dentro dela mesma (como as abas): filtro novo não
          derruba o último botão para a linha de baixo. */}
      <div className="-mx-1 flex min-w-0 [scrollbar-width:none] items-center gap-2 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden">
        {buscaAberta ? (
          <div className="flex h-9 w-56 shrink-0 items-center gap-2 rounded-xl border bg-background px-3">
            <MagnifyingGlass size={16} className="shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={busca}
              aria-label={t("Buscar tarefas")}
              placeholder={t("Buscar tarefas")}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setBusca("");
                  setBuscaAberta(false);
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-sm outline-hidden"
            />
            <button
              type="button"
              aria-label={t("Fechar busca")}
              onClick={() => {
                setBusca("");
                setBuscaAberta(false);
              }}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={t("Buscar tarefas")}
            title={t("Buscar tarefas")}
            onClick={() => setBuscaAberta(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <MagnifyingGlass size={16} aria-hidden />
          </button>
        )}
        <BarraDeConsulta campos={camposDaBarra} consulta={preferencias} aoMudar={mudarConsulta} />
      </div>

      {visualizacao === "calendario" ? (
        <CalendarioDeTarefas
          tarefas={tarefasVisiveis}
          opcoes={opcoes}
          fuso={fuso}
          tag={tag}
          hoje={hojeNoFuso(agora, fuso)}
          podeEditar={podeEditar}
          aoMudarPrazo={(tarefa, due_date) =>
            void editarTarefa(tarefa.id, { due_date }, { due_date })
          }
          aoCriarNoDia={(dia) => void novaTarefa({ dia })}
          aoAbrir={(tarefa) => setAbertaId(tarefa.id)}
        />
      ) : visualizacao === "timeline" ? (
        <LinhaDoTempo
          tarefas={tarefasVisiveis}
          opcoes={opcoes}
          fuso={fuso}
          tag={tag}
          hoje={hojeNoFuso(agora, fuso)}
          podeEditar={podeEditar}
          aoMudarDatas={(tarefa, datas) => void editarTarefa(tarefa.id, datas, datas)}
          aoAbrir={(tarefa) => setAbertaId(tarefa.id)}
        />
      ) : visualizacao === "kanban" ? (
        <QuadroKanban
          tarefas={tarefasVisiveis}
          opcoes={opcoes}
          colunas={mostradas.filter((c) => c.id !== "titulo" && c.id !== "status")}
          podeEditar={podeEditar}
          aoAbrir={(tarefa) => setAbertaId(tarefa.id)}
          aoCriarNaColuna={
            podeEditar
              ? (opcao) => void novaTarefa({ grupo: { campo: "status", chave: opcao.id } })
              : undefined
          }
          aoMudarStatus={(tarefa, opcao) =>
            void editarTarefa(
              tarefa.id,
              { status_option_id: opcao.id },
              { status_option_id: opcao.id, status: opcao.grupo },
            )
          }
        />
      ) : (
        <TabelaDoMotor
          rotuloDaTabela={t("Tarefas")}
          linhas={tarefasVisiveis}
          grupos={gruposDaTabela}
          idDe={(tarefa) => tarefa.id}
          colunas={mostradas}
          aoMoverColuna={moverColunaNoLayout}
          aoRedimensionarColuna={redimensionarColuna}
          fimDoCabecalho={
            podeConfigurar ? <NovaPropriedade aoCriar={criarPropriedade} /> : undefined
          }
          menuDaColuna={(coluna, titulo) => {
            const propriedade = propriedades.find((p) => `prop:${p.id}` === coluna.id);
            const comOpcoes = propriedade && TIPOS_COM_OPCOES.includes(propriedade.type);
            return (
              <MenuDaColuna
                titulo={titulo}
                nome={
                  propriedade && podeConfigurar
                    ? {
                        valor: propriedade.name,
                        aoSalvar: (name) => void editarPropriedade(propriedade.id, { name }),
                      }
                    : undefined
                }
                tipo={propriedade ? rotuloDoTipo(t, propriedade.type) : undefined}
                aoOcultar={
                  coluna.fixa || coluna.semOcultar ? undefined : () => alternarColuna(coluna.id)
                }
                aoLarguraPadrao={coluna.fixa ? undefined : () => larguraPadrao(coluna.id)}
                aoApagar={
                  propriedade && podeConfigurar
                    ? () => setApagarPropriedadeId(propriedade.id)
                    : undefined
                }
                renderizarEditor={
                  propriedade && podeConfigurar && comOpcoes
                    ? (voltar) => (
                        <EditorDeOpcoesDePropriedade
                          opcoes={propriedade.options}
                          aoMudar={(options) => void editarPropriedade(propriedade.id, { options })}
                          voltar={voltar}
                        />
                      )
                    : coluna.id === "status" && podeConfigurar
                      ? (voltar) => (
                          <EditorDeOpcoesDeStatus
                            opcoes={opcoes}
                            titulosDosGrupos={titulosDosGrupos}
                            voltar={voltar}
                            aoCriar={criarOpcao}
                            aoEditar={editarOpcao}
                            aoApagar={apagarOpcao}
                          />
                        )
                      : undefined
                }
              />
            );
          }}
          carregando={carregando}
          podeReordenar={podeEditar && !consultaAtiva(preferencias)}
          selecionadas={selecionadasVivas}
          aoSelecionar={podeEditar ? selecionar : undefined}
          aoSelecionarTodas={podeEditar ? selecionarTodas : undefined}
          aoReordenar={(id, destino) => void reordenar(id, destino)}
          aoCriar={podeEditar ? () => void novaTarefa() : undefined}
          aoCriarNoGrupo={
            podeEditar && preferencias.agrupar
              ? (chave) =>
                  void novaTarefa({
                    grupo: {
                      campo: preferencias.agrupar!,
                      chave: chave === "__vazio" ? "" : chave,
                    },
                  })
              : undefined
          }
          rotuloDeCriarNoGrupo={t("Nova tarefa neste grupo")}
          rotuloDeCriar={t("Nova tarefa")}
          vazio={
            tarefas.length > 0 ? t("Nenhuma tarefa com esses filtros.") : t("Nenhuma tarefa ainda.")
          }
          acoesDaLinha={
            podeEditar
              ? (tarefa) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("Ações da tarefa")}
                        className="grid h-8 w-8 place-items-center rounded-md text-text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-secondary focus-visible:opacity-100 data-[state=open]:opacity-100"
                      >
                        <DotsThree size={18} weight="bold" aria-hidden />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="gap-2 text-error-fg"
                        onSelect={() => setApagarId(tarefa.id)}
                      >
                        <Trash size={14} aria-hidden />
                        {t("Apagar")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              : undefined
          }
        />
      )}

      {podeEditar && visualizacao === "tabela" ? (
        <AcoesEmMassa
          quantidade={idsSelecionados.length}
          opcoesDeStatus={opcoes}
          titulosDosGrupos={titulosDosGrupos}
          prioridades={prioridades}
          membros={membros}
          fuso={fuso}
          aoAplicar={(mudancas, local) => void editarVarias(idsSelecionados, mudancas, local)}
          aoApagar={() => setApagarVariasAberto(true)}
          aoLimpar={() => setSelecionadas(new Set())}
        />
      ) : null}

      <ModelosDeTarefa
        // `key`: reabrir pelo "Novo modelo" volta ao formulário em branco, e pelo "Gerenciar" à lista.
        key={`${modelosAberto}-${modeloNovo}`}
        aberto={modelosAberto}
        aoFechar={() => setModelosAberto(false)}
        modelos={modelos}
        opcoesDeStatus={opcoes}
        membros={membros}
        fuso={fuso}
        tag={tag}
        agora={agora}
        podeEditar={podeEditar}
        comecarNovo={modeloNovo}
        aoCriar={criarModelo}
        aoEditar={editarModelo}
        aoApagar={apagarModelo}
      />

      <ConfigurarVisualizacao
        aberto={configurando}
        aoFechar={() => setConfigurando(false)}
        nome={visaoAtiva?.name ?? padrao.preferencias.nome ?? t("Tabela")}
        tipo={visualizacao}
        podeEditar={podeEditar}
        ehPadrao={!visaoAtiva}
        aoRenomear={(nome) =>
          visaoAtiva
            ? void editarVisao(visaoAtiva.id, { name: nome })
            : padrao.atualizar((p) => ({ ...p, nome }))
        }
        aoTrocarTipo={(tipo) => visaoAtiva && void editarVisao(visaoAtiva.id, { type: tipo })}
        propriedades={
          visualizacao === "tabela" || visualizacao === "kanban"
            ? resolvidas.map((c) => ({
                id: c.id,
                titulo: c.titulo,
                icone: c.icone,
                visivel: c.visivel,
                obrigatoria: c.fixa || c.semOcultar,
              }))
            : []
        }
        aoMover={moverColunaNoLayout}
        aoAlternar={alternarColuna}
        aoMostrarTodas={(mostrar) =>
          atualizar((p) => ({
            ...p,
            visiveis: Object.fromEntries(
              resolvidas.filter((c) => !c.fixa && !c.semOcultar).map((c) => [c.id, mostrar]),
            ),
          }))
        }
        aoDuplicar={visaoAtiva ? () => duplicarVisao(visaoAtiva.id) : undefined}
        aoApagar={visaoAtiva ? () => setApagarVisaoId(visaoAtiva.id) : undefined}
      />

      <PainelDaTarefa
        tarefa={tarefas.find((x) => x.id === abertaId) ?? null}
        colunas={colunas}
        podeEditar={podeEditar}
        aoSalvarDescricao={(tarefa, description) =>
          void editarTarefa(tarefa.id, { description }, { description })
        }
        aoApagar={(tarefa) => {
          setAbertaId(null);
          setApagarId(tarefa.id);
        }}
        aoFechar={() => setAbertaId(null)}
      />

      <AlertDialog
        open={apagarVisaoId !== null}
        onOpenChange={(aberto) => !aberto && setApagarVisaoId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Apagar visualização?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("A visualização some para todos. As tarefas não são apagadas.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (apagarVisaoId) {
                  if (apagarVisaoId === ativaId) escolherAba(ID_DA_PADRAO);
                  void apagarVisao(apagarVisaoId);
                }
                setApagarVisaoId(null);
              }}
            >
              {t("Apagar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={apagarVariasAberto} onOpenChange={setApagarVariasAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Apagar tarefas selecionadas?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("As tarefas selecionadas serão apagadas. Esta ação não pode ser desfeita.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void apagarVarias(idsSelecionados);
                setSelecionadas(new Set());
                setApagarVariasAberto(false);
              }}
            >
              {t("Apagar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={apagarId !== null} onOpenChange={(aberto) => !aberto && setApagarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Apagar tarefa?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Esta ação não pode ser desfeita.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (apagarId) void apagarTarefa(apagarId);
                setApagarId(null);
              }}
            >
              {t("Apagar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={apagarPropriedadeId !== null}
        onOpenChange={(aberto) => !aberto && setApagarPropriedadeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Apagar propriedade?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Os valores desta propriedade em todas as tarefas serão apagados. Esta ação não pode ser desfeita.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (apagarPropriedadeId) void apagarPropriedade(apagarPropriedadeId);
                setApagarPropriedadeId(null);
              }}
            >
              {t("Apagar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
