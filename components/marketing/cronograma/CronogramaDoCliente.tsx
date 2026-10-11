"use client";

import { useMemo, useRef, useState } from "react";

import { CompartilharPagina } from "@/components/marketing/CompartilharPagina";
import { EdicaoDaSemana } from "@/components/marketing/cronograma/EdicaoDaSemana";
import { EdicaoDoCronograma } from "@/components/marketing/cronograma/EdicaoDoCronograma";
import { HistoricoDaSemana } from "@/components/marketing/cronograma/HistoricoDaSemana";
import { PainelDoCronograma } from "@/components/marketing/cronograma/PainelDoCronograma";
import { rotulosDoCronograma } from "@/components/marketing/cronograma/rotulos";
import { useT } from "@/hooks/i18n/useT";
import { useBaixarImagem, useCronograma } from "@/hooks/marketing/useCronograma";
import { useVerComoCliente } from "@/hooks/marketing/useVerComoCliente";
import { somarDias } from "@/lib/inicio/datas";
import {
  CONFIG_PADRAO,
  numeroDaSemana,
  periodoDaSemana,
  segundaDeHoje,
} from "@/lib/marketing/cronograma";
import { CalendarBlank, CaretLeft, CaretRight, ShareNetwork } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

type Aba = "geral" | "semana" | "historico";

/**
 * O CRONOGRAMA do cliente: duas frentes (cronograma geral e tarefas da semana), o botão de
 * baixar a imagem para mandar ao cliente e o link sem login. A agência edita; o cliente só vê.
 */
export function CronogramaDoCliente() {
  const t = useT();
  const verComoCliente = useVerComoCliente();
  const [aba, setAba] = useState<Aba>("geral");
  const [editando, setEditando] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [inicio, setInicio] = useState(segundaDeHoje());
  const captura = useRef<HTMLDivElement>(null);
  const baixar = useBaixarImagem();

  const c = useCronograma(inicio, aba === "historico");
  const rotulos = useMemo(() => rotulosDoCronograma(t), [t]);

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
  const semanaAtual = numeroDaSemana(config ?? CONFIG_PADRAO, inicio);
  const vista: "geral" | "semana" = aba === "semana" ? "semana" : "geral";

  const abas: Array<[Aba, string]> = [
    ["geral", t("Cronograma geral")],
    ["semana", t("Tarefas da semana")],
    ...(podeEditar ? ([["historico", t("Histórico")]] as Array<[Aba, string]>) : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm">
        <div
          role="group"
          aria-label={t("Visão do cronograma")}
          className="inline-flex rounded-xl bg-secondary p-0.5"
        >
          {abas.map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={aba === valor}
              onClick={() => setAba(valor)}
              className={cn(
                "h-8 rounded-[10px] px-3 text-sm font-medium transition-colors",
                aba === valor
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {aba !== "geral" ? (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              aria-label={t("Semana anterior")}
              onClick={() => setInicio(somarDias(inicio, -7))}
              className="grid h-9 w-9 place-items-center rounded-lg border hover:bg-secondary"
            >
              <CaretLeft size={14} aria-hidden />
            </button>
            <span className="min-w-36 text-center text-sm font-medium">
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
            {inicio !== segundaDeHoje() ? (
              <button
                type="button"
                onClick={() => setInicio(segundaDeHoje())}
                className="ml-1 h-9 rounded-lg px-3 text-sm text-primary hover:bg-secondary"
              >
                {t("Esta semana")}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {aba !== "historico" ? (
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
              className="h-9 rounded-xl border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
            >
              {baixar.isPending ? t("Gerando…") : t("Baixar imagem")}
            </button>
          ) : null}
          {podeEditar ? (
            <>
              <button
                type="button"
                onClick={() => setCompartilhando(true)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium hover:bg-secondary"
              >
                <ShareNetwork size={16} aria-hidden />
                {t("Compartilhar")}
              </button>
              <button
                type="button"
                aria-pressed={editando}
                onClick={() => setEditando((e) => !e)}
                className={cn(
                  "h-9 rounded-xl px-4 text-sm font-medium",
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

      {aba === "historico" ? (
        <HistoricoDaSemana eventos={c.historico} />
      ) : (
        <div ref={captura}>
          <PainelDoCronograma
            vista={vista}
            config={config ?? CONFIG_PADRAO}
            itens={itens}
            metas={metas}
            tarefas={c.tarefas}
            inicioDaSemana={inicio}
            semanaAtual={semanaAtual}
            rotulos={rotulos}
            mostrarAdiamentos={podeEditar}
          />
        </div>
      )}

      {podeEditar && editando && aba === "geral" ? (
        <EdicaoDoCronograma
          config={config ?? CONFIG_PADRAO}
          itens={itens}
          metas={metas}
          aoSalvarConfig={c.salvarConfig}
          aoCriarItem={c.criarItem}
          aoEditarItem={c.editarItem}
          aoApagarItem={c.apagarItem}
          aoCriarMeta={c.criarMeta}
          aoEditarMeta={c.editarMeta}
          aoApagarMeta={c.apagarMeta}
        />
      ) : null}

      {podeEditar && editando && aba === "semana" ? (
        <EdicaoDaSemana
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
