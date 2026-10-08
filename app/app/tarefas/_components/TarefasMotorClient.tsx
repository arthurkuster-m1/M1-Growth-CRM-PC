"use client";

import { useMemo, useRef, useState } from "react";

import { CelulaDeData } from "@/components/motor/CelulaDeData";
import { CelulaDePessoa } from "@/components/motor/CelulaDePessoa";
import { CelulaDeTexto } from "@/components/motor/CelulaDeTexto";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { EditorDeOpcoesDePropriedade } from "@/components/motor/EditorDeOpcoesDePropriedade";
import { MenuDaColuna } from "@/components/motor/MenuDaColuna";
import { MenuDePropriedades } from "@/components/motor/MenuDePropriedades";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { useOpcoesDeStatus } from "@/hooks/tarefas/useOpcoesDeStatus";
import { usePropriedadesDaTarefa } from "@/hooks/tarefas/usePropriedadesDaTarefa";
import { useTarefasDoMotor } from "@/hooks/tarefas/useTarefasDoMotor";
import { rotuloDaData } from "@/lib/motor/datas-do-campo";
import { moverColuna, resolverColunas } from "@/lib/motor/layout";
import { alternarId, faixaEntre, podarSelecao } from "@/lib/motor/selecao";
import { opcaoDaTarefa, type CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { TIPOS_COM_OPCOES } from "@/lib/tarefas/propriedades";
import {
  SITUACOES_DA_TAREFA,
  estaAtrasada,
  type PrioridadeDaTarefa,
  type Tarefa,
} from "@/lib/tarefas/tipos";
import {
  CalendarBlank,
  DotsThree,
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
  const { opcoes, criarOpcao, editarOpcao, apagarOpcao } = useOpcoesDeStatus();
  const { propriedades, criarPropriedade, editarPropriedade, apagarPropriedade } =
    usePropriedadesDaTarefa();
  const membrosDaEquipe = useAssignableMembers(podeEditar);
  const membros = (membrosDaEquipe.data ?? []).map((m) => ({
    id: m.user_id,
    nome: m.full_name?.trim() || t("Sem nome"),
  }));

  const [editandoId, setEditandoId] = useState<string | null>(null);
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
      fixa: true,
      celula: (tarefa) => (
        <CelulaDeTexto
          valor={tarefa.title}
          rotulo={t("Título da tarefa")}
          podeEditar={podeEditar}
          riscado={tarefa.status === "done"}
          iniciarEditando={editandoId === tarefa.id}
          aoTerminarEdicao={() => setEditandoId((atual) => (atual === tarefa.id ? null : atual))}
          aoSalvar={(title) => void editarTarefa(tarefa.id, { title }, { title })}
        />
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
            <Etiqueta cor={atual?.color ?? "gray"}>
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
          atrasada={estaAtrasada(tarefa, agora)}
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
  const { preferencias, atualizar } = useVisualizacao("tarefas");
  const resolvidas = resolverColunas(colunas, preferencias);
  const mostradas = resolvidas.filter((c) => c.visivel);

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
    if (!atual || atual.fixa) return;
    atualizar((p) => ({ ...p, visiveis: { ...p.visiveis, [id]: !atual.visivel } }));
  }

  // ── seleção de linhas e ações em massa ──────────────────────────────────────────────
  // A seleção é derivada: ids de tarefas que já não existem (apagadas por outra aba, ou por
  // esta mesma ação) saem dela sozinhos, e a contagem nunca mente.
  const idsDaTabela = tarefas.map((tarefa) => tarefa.id);
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

  async function novaTarefa() {
    // No fim da lista: acima da maior posição existente E do relógio, para a tarefa nova
    // não ficar atrás de uma que foi arrastada para o fim.
    const maiorPosicao = tarefas.reduce((m, tarefa) => Math.max(m, tarefa.position ?? 0), 0);
    try {
      const criada = await criarTarefa({
        title: t("Sem título"),
        position: Math.max(maiorPosicao + 1, Date.now() / 1000),
      });
      setEditandoId(criada.id);
    } catch {
      // O hook já mostrou o erro da API.
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Tarefas")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Clique para editar. Arraste pelo ícone para reordenar.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MenuDePropriedades
            propriedades={resolvidas.map((c) => ({
              id: c.id,
              titulo: c.titulo,
              fixa: c.fixa,
              visivel: c.visivel,
            }))}
            aoAlternar={alternarColuna}
          />
          {podeEditar ? (
            <button
              type="button"
              onClick={() => void novaTarefa()}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              <Plus size={16} weight="bold" aria-hidden />
              {t("Nova tarefa")}
            </button>
          ) : null}
        </div>
      </header>

      {falhou ? (
        <p className="rounded-xl border border-error/30 bg-error-bg px-4 py-3 text-sm text-error-fg">
          {t("Não foi possível carregar as tarefas.")}
        </p>
      ) : null}

      <TabelaDoMotor
        rotuloDaTabela={t("Tarefas")}
        linhas={tarefas}
        idDe={(tarefa) => tarefa.id}
        colunas={mostradas}
        aoMoverColuna={moverColunaNoLayout}
        aoRedimensionarColuna={redimensionarColuna}
        fimDoCabecalho={podeConfigurar ? <NovaPropriedade aoCriar={criarPropriedade} /> : undefined}
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
              aoOcultar={coluna.fixa ? undefined : () => alternarColuna(coluna.id)}
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
        podeReordenar={podeEditar}
        selecionadas={selecionadasVivas}
        aoSelecionar={podeEditar ? selecionar : undefined}
        aoSelecionarTodas={podeEditar ? selecionarTodas : undefined}
        aoReordenar={(id, destino) => void reordenar(id, destino)}
        aoCriar={podeEditar ? () => void novaTarefa() : undefined}
        rotuloDeCriar={t("Nova tarefa")}
        vazio={t("Nenhuma tarefa ainda.")}
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

      {podeEditar ? (
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
