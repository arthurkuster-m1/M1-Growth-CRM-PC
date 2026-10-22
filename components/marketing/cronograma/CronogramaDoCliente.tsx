"use client";

import { useMemo, useRef, useState } from "react";

import { CompartilharPagina } from "@/components/marketing/CompartilharPagina";
import { EdicaoDaSemana } from "@/components/marketing/cronograma/EdicaoDaSemana";
import {
  GavetaDoCronograma,
  type VistaDaGaveta,
} from "@/components/marketing/cronograma/GavetaDoCronograma";
import { HistoricoDaSemana } from "@/components/marketing/cronograma/HistoricoDaSemana";
import { TarefasAdiadas } from "@/components/marketing/cronograma/TarefasAdiadas";
import {
  PainelDoCronograma,
  type SelecaoDoCronograma,
} from "@/components/marketing/cronograma/PainelDoCronograma";
import { rotulosDoCronograma } from "@/components/marketing/cronograma/rotulos";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { useBaixarImagem, useCronograma } from "@/hooks/marketing/useCronograma";
import { useEdicaoDoCronograma } from "@/hooks/marketing/useEdicaoDoCronograma";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useVerComoCliente } from "@/hooks/marketing/useVerComoCliente";
import { somarDias } from "@/lib/inicio/datas";
import {
  CONFIG_PADRAO,
  type DadosDaMeta,
  domingoDeHoje,
  inicioDaJanela,
  numeroDaSemana,
  periodoDaSemana,
} from "@/lib/marketing/cronograma";
import { nomeNovoDeFase } from "@/lib/marketing/cronograma-ordem";
import { CalendarBlank, CaretDown, CaretLeft, CaretRight, ShareNetwork } from "@/lib/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Aba = "geral" | "semana" | "historico" | "adiadas";

/**
 * O CRONOGRAMA do cliente: duas frentes (cronograma geral e tarefas da semana), o botão de
 * baixar a imagem para mandar ao cliente e o link sem login. A agência edita; o cliente só vê.
 */
export function CronogramaDoCliente() {
  const t = useT();
  const verComoCliente = useVerComoCliente();
  const [aba, setAba] = useState<Aba>("geral");
  const [menuDeVisoes, setMenuDeVisoes] = useState(false);
  const [editando, setEditando] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [inicio, setInicio] = useState(domingoDeHoje());
  const [janela, setJanela] = useState<number | null>(null);
  const tag = useTagDeIdioma();
  const captura = useRef<HTMLDivElement>(null);
  const baixar = useBaixarImagem();

  const [gaveta, setGaveta] = useState<VistaDaGaveta | null>(null);

  const c = useCronograma(inicio, aba === "historico");
  const acoes = useEdicaoDoCronograma(c, c.dados?.itens ?? [], c.dados?.metas ?? []);
  const empresa = useActiveOrg()?.name ?? "";
  const rotulos = useMemo(() => rotulosDoCronograma(t, empresa), [t, empresa]);

  if (c.carregando) {
    return <div className="h-64 animate-pulse rounded-3xl bg-secondary" aria-busy="true" />;
  }
  if (c.falhou || !c.dados) {
    return (
      <p className="rounded-xl border border-error/30 bg-error-bg px-4 py-3 text-sm text-error-fg">
        {t("Não foi possível carregar o cronograma.")}
      </p>
    );
  }

  const { config, itens, metas } = c.dados;
  const podeEditar = c.dados.pode_editar && !verComoCliente.ativo;
  const cfg = config ?? CONFIG_PADRAO;
  // "Hoje" no cronograma geral; a semana escolhida só conta na vista das tarefas.
  const semanaDeHoje = numeroDaSemana(cfg, domingoDeHoje());
  const janelaInicio = janela ?? inicioDaJanela(semanaDeHoje, cfg.total_semanas);
  const vista: "geral" | "semana" = aba === "semana" ? "semana" : "geral";

  const editandoGeral = podeEditar && editando && aba === "geral";
  const selecao: SelecaoDoCronograma =
    gaveta?.tipo === "meta" || gaveta?.tipo === "acao"
      ? { tipo: gaveta.tipo, id: gaveta.id }
      : gaveta?.tipo === "fase"
        ? { tipo: "fase", nome: gaveta.nome }
        : null;

  // Criar já cria de verdade (com o Ctrl+Z para desfazer) e abre as configurações do novo item.
  const novaMeta = async () => {
    const dados: DadosDaMeta = {
      titulo: t("Nova meta"),
      tipo: "numero",
      unidade: "",
      valor_alvo: null,
      valor_atual: null,
      descricao: "",
      fonte: "manual",
      periodo: "mes",
      periodo_de: null,
      periodo_ate: null,
      calculo: "soma",
    };
    const m = await acoes.criarMeta(dados);
    if (m) setGaveta({ tipo: "meta", id: m.id });
  };
  const novaAcao = async (fase: string) => {
    const daFase = itens.filter((i) => !i.arquivado && i.fase.trim() === fase);
    const sugerida = daFase.length ? Math.max(...daFase.map((i) => i.semana_fim)) : 1;
    const i = await acoes.criarItem({
      acao: t("Nova ação"),
      fase,
      semana_inicio: sugerida,
      semana_fim: sugerida,
      status: "planejado",
      destaque: false,
      notas: "",
      arquivado: false,
    });
    if (i) setGaveta({ tipo: "acao", id: i.id });
  };
  // Uma fase existe pelas ações que a têm: "nova fase" nasce com a sua primeira ação.
  const novaFase = async () => {
    const nome = nomeNovoDeFase(itens, t("Nova fase"));
    const i = await acoes.criarItem({
      acao: t("Nova ação"),
      fase: nome,
      semana_inicio: 1,
      semana_fim: 1,
      status: "planejado",
      destaque: false,
      notas: "",
      arquivado: false,
    });
    if (i) setGaveta({ tipo: "fase", nome });
  };

  const abas: Array<[Aba, string]> = [
    ["geral", t("Cronograma geral")],
    ["semana", t("Tarefas da semana")],
    ...(podeEditar
      ? ([
          ["historico", t("Histórico")],
          ["adiadas", t("Adiadas")],
        ] as Array<[Aba, string]>)
      : []),
  ];

  return (
    <div className={cn("flex flex-col gap-4", editandoGeral && gaveta && "lg:pr-[27.5rem]")}>
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        {/* Celular: uma visão por vez; toca e abre a lista com as outras. */}
        <Popover open={menuDeVisoes} onOpenChange={setMenuDeVisoes}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("Visão do cronograma")}
              className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-secondary px-4 text-sm font-semibold sm:hidden"
            >
              <span className="truncate">{abas.find(([v]) => v === aba)?.[1]}</span>
              <CaretDown size={14} weight="bold" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="grid w-[var(--radix-popover-trigger-width)] gap-1 p-1.5 sm:hidden"
          >
            {abas.map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={aba === valor}
                onClick={() => {
                  setAba(valor);
                  setMenuDeVisoes(false);
                }}
                className={cn(
                  "h-11 rounded-lg px-3 text-left text-sm font-medium",
                  aba === valor ? "bg-primary/10 text-primary" : "hover:bg-secondary",
                )}
              >
                {rotulo}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <div
          role="group"
          aria-label={t("Visão do cronograma")}
          className="hidden rounded-xl bg-secondary p-0.5 sm:inline-flex sm:w-auto sm:max-w-full sm:overflow-x-auto"
        >
          {abas.map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={aba === valor}
              onClick={() => {
                setAba(valor);
                setGaveta(null);
              }}
              className={cn(
                "h-10 shrink-0 rounded-[10px] px-3 text-sm font-medium whitespace-nowrap transition-colors sm:h-8",
                aba === valor
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {aba === "semana" || aba === "historico" ? (
          <div className="flex w-full items-center justify-between gap-1 sm:inline-flex sm:w-auto sm:justify-start">
            <button
              type="button"
              aria-label={t("Semana anterior")}
              onClick={() => setInicio(somarDias(inicio, -7))}
              className="grid h-9 w-9 place-items-center rounded-lg border hover:bg-secondary"
            >
              <CaretLeft size={14} aria-hidden />
            </button>
            <span className="min-w-28 text-center text-sm font-medium whitespace-nowrap">
              {periodoDaSemana(inicio)}
            </span>
            <button
              type="button"
              aria-label={t("Próxima semana")}
              onClick={() => setInicio(somarDias(inicio, 7))}
              className="grid h-9 w-9 place-items-center rounded-lg border hover:bg-secondary"
            >
              <CaretRight size={14} aria-hidden />
            </button>
            {inicio !== domingoDeHoje() ? (
              <button
                type="button"
                onClick={() => setInicio(domingoDeHoje())}
                className="ml-1 h-9 rounded-lg px-3 text-sm whitespace-nowrap text-primary hover:bg-secondary"
              >
                {t("Esta semana")}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex w-full flex-wrap items-center gap-2 border-t pt-3 sm:ml-auto sm:w-auto sm:border-t-0 sm:pt-0 [&>button]:h-10 [&>button]:flex-1 sm:[&>button]:h-9 sm:[&>button]:flex-none">
          {aba !== "historico" && aba !== "adiadas" ? (
            <button
              type="button"
              disabled={baixar.isPending}
              onClick={() =>
                captura.current &&
                baixar.mutate({
                  elemento: captura.current,
                  nome: aba === "geral" ? "cronograma.png" : "tarefas-da-semana.png",
                })
              }
              className="h-9 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary disabled:opacity-50"
            >
              {baixar.isPending ? t("Gerando…") : t("Baixar imagem")}
            </button>
          ) : null}
          {podeEditar ? (
            <>
              <button
                type="button"
                onClick={() => setCompartilhando(true)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
              >
                <ShareNetwork size={16} aria-hidden />
                {t("Compartilhar")}
              </button>
              <button
                type="button"
                aria-pressed={editando}
                onClick={() => {
                  setEditando((e) => !e);
                  setGaveta(null);
                }}
                className={cn(
                  "h-9 rounded-xl px-4 text-sm font-medium whitespace-nowrap",
                  editando ? "bg-primary text-primary-foreground" : "border hover:bg-secondary",
                )}
              >
                {editando ? t("Concluir edição") : t("Editar")}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {c.dados.pode_editar && verComoCliente.ativo ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <span className="font-medium">{t("Você está vendo como o cliente vê.")}</span>
          <button
            type="button"
            onClick={() => verComoCliente.definir(false)}
            className="ml-auto h-9 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t("Voltar a editar")}
          </button>
        </div>
      ) : null}

      {editandoGeral ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="mr-auto text-muted-foreground">
            {t("Clique numa meta, fase ou ação para editar · use + para criar · Ctrl+Z desfaz")}
          </span>
          <button
            type="button"
            onClick={() => setGaveta({ tipo: "config" })}
            className="h-9 rounded-xl border bg-card px-3 text-sm font-medium hover:bg-secondary"
          >
            {t("Configurar")}
          </button>
          <button
            type="button"
            onClick={() => setGaveta({ tipo: "arquivadas" })}
            className="h-9 rounded-xl border bg-card px-3 text-sm font-medium hover:bg-secondary"
          >
            {t("Arquivadas")} ({itens.filter((i) => i.arquivado).length})
          </button>
        </div>
      ) : null}

      {aba === "historico" ? (
        <HistoricoDaSemana eventos={c.historico} />
      ) : aba === "adiadas" ? (
        <TarefasAdiadas empresa={empresa} />
      ) : (
        <div ref={captura}>
          <PainelDoCronograma
            vista={vista}
            config={cfg}
            itens={itens}
            metas={metas}
            tarefas={c.tarefas}
            inicioDaSemana={inicio}
            semanaAtual={semanaDeHoje}
            rotulos={rotulos}
            mostrarAdiamentos={podeEditar}
            tag={tag}
            janelaInicio={janelaInicio}
            aoMudarJanela={setJanela}
            edicao={
              editandoGeral
                ? {
                    selecao,
                    aoSelecionar: (s) =>
                      setGaveta(
                        s === null
                          ? null
                          : s.tipo === "fase"
                            ? { tipo: "fase", nome: s.nome }
                            : { tipo: s.tipo, id: s.id },
                      ),
                    aoNovaMeta: () => void novaMeta(),
                    aoNovaFase: () => void novaFase(),
                    aoNovaAcao: (fase) => void novaAcao(fase),
                    rotulos: {
                      novaMeta: t("Nova meta"),
                      novaFase: t("Nova fase"),
                      novaAcao: t("Nova ação"),
                      editar: t("Clique para editar"),
                    },
                  }
                : undefined
            }
          />
        </div>
      )}

      {editandoGeral && gaveta ? (
        <GavetaDoCronograma
          vista={gaveta}
          itens={itens}
          metas={metas}
          config={cfg}
          aoSalvarConfig={c.salvarConfig}
          acoes={acoes}
          aoMudarVista={setGaveta}
          aoNovaAcao={(fase) => void novaAcao(fase)}
          aoFechar={() => setGaveta(null)}
        />
      ) : null}

      {podeEditar && editando && aba === "semana" ? (
        <EdicaoDaSemana
          empresa={empresa}
          tarefas={c.tarefas}
          inicioDaSemana={inicio}
          acoes={{
            adicionar: c.adicionarTarefa,
            editar: c.editarTarefa,
            fechar: c.fecharSemana,
            disponiveis: c.disponiveis,
          }}
        />
      ) : null}

      {podeEditar ? (
        <CompartilharPagina
          aberto={compartilhando}
          aoFechar={() => setCompartilhando(false)}
          chave="cronograma"
          temPublicado
        />
      ) : null}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarBlank size={14} aria-hidden />
        {t("As tarefas da semana vêm da base de Tarefas: o que muda lá aparece aqui.")}
      </p>
    </div>
  );
}
