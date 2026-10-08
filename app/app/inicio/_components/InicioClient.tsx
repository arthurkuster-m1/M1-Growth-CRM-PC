"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { useAgendamentos } from "@/hooks/agenda/useAgendamentos";
import { useAgentInbox } from "@/hooks/ai/useAgentInbox";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useTasks } from "@/hooks/tasks/useTasks";
import {
  chaveDoDia,
  diasDaSemana,
  inicioDoDia,
  partesNoFuso,
  saudacaoDaHora,
  somarDias,
} from "@/lib/inicio/datas";
import { tarefasDoDia } from "@/lib/inicio/tarefas-do-dia";
import type { Tarefa } from "@/lib/tarefas/tipos";
import { CalendarBlank, CaretLeft, CaretRight, CheckCircle, ListChecks, Plus } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Props {
  nome: string;
  fuso: string;
  usuarioId: string;
  podeEditar: boolean;
  /** O instante em que o servidor pintou a tela — ver `page.tsx`. */
  agoraIso: string;
}



const COR_DA_PRIORIDADE: Record<Tarefa["priority"], string> = {
  urgent: "bg-error",
  high: "bg-warning",
  medium: "bg-info",
  low: "bg-border-strong",
};

const COR_DA_GRAVIDADE = {
  info: "bg-info",
  warn: "bg-warning",
  critical: "bg-error",
} as const;

const CARTAO = "flex min-h-[24rem] flex-col rounded-2xl border bg-card p-5 shadow-sm";

type Evento = {
  id: string;
  dia: string;
  inicio: number;
  hora: string;
  titulo: string;
  detalhe?: string;
  tipo: "agenda" | "tarefa";
};

function Vazio({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-success-bg text-success">
        <CheckCircle size={28} aria-hidden />
      </span>
      <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
      {texto ? <p className="text-xs text-text-subtle">{texto}</p> : null}
    </div>
  );
}

function CabecalhoDoCartao({
  id,
  icone,
  titulo,
  children,
}: {
  id: string;
  icone?: ReactNode;
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2
        id={id}
        className="flex items-center gap-2 whitespace-nowrap text-base font-semibold tracking-tight"
      >
        {icone ? <span className="text-muted-foreground">{icone}</span> : null}
        {titulo}
      </h2>
      {children}
    </div>
  );
}

export function InicioClient({ nome, fuso, usuarioId, podeEditar, agoraIso }: Props) {
  const t = useT();
  const tag = useTagDeIdioma();

  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);
  const hoje = chaveDoDia(agora, fuso);
  const [selecionada, setSelecionada] = useState(hoje);
  const [modo, setModo] = useState<"semana" | "dia">("semana");
  const [escopo, setEscopo] = useState<"minhas" | "equipe">("minhas");

  const semana = useMemo(() => diasDaSemana(selecionada), [selecionada]);

  // ── dados: as mesmas rotas e hooks das telas de origem ──────────────────────
  const tarefas = useTasks({ aberto: true });
  const recorte = useMemo(
    () => ({
      de: inicioDoDia(semana[0]!, fuso).toISOString(),
      ate: inicioDoDia(somarDias(semana[6]!, 1), fuso).toISOString(),
    }),
    [semana, fuso],
  );
  const agenda = useAgendamentos(recorte);
  const alertas = useAgentInbox("open");

  // ── formatadores (idioma da interface, fuso da organização) ─────────────────
  const fmtHora = useMemo(
    () => new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", timeZone: fuso }),
    [tag, fuso],
  );
  const rotuloDoDia = (chave: string, opcoes: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag, { ...opcoes, timeZone: "UTC" }).format(
      new Date(`${chave}T12:00:00Z`),
    );

  // ── saudação, data por extenso e frase do dia ───────────────────────────────
  const saudacao = {
    bom_dia: t("Bom dia"),
    boa_tarde: t("Boa tarde"),
    boa_noite: t("Boa noite"),
  }[saudacaoDaHora(partesNoFuso(agora, fuso).hora)];
  const dataPorExtenso = (() => {
    const texto = new Intl.DateTimeFormat(tag, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: fuso,
    }).format(agora);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  })();
  const frases = [
    t("O progresso, não a perfeição, é o objetivo."),
    t("Grandes resultados nascem de pequenas ações repetidas todos os dias."),
    t("Foco no processo: o resultado é consequência."),
    t("Quem acompanha os números, melhora os números."),
    t("Vender é ajudar alguém a tomar uma boa decisão."),
    t("O que não é medido não é gerenciado."),
    t("Consistência vence intensidade."),
    t("Cada conversa é uma chance de resolver um problema real."),
    t("Organização hoje, tranquilidade amanhã."),
    t("Comece pelo mais importante, o resto se ajeita."),
    t("Clareza é o primeiro passo da execução."),
    t("Hoje é um bom dia para fechar o que ficou aberto."),
  ];
  // Uma frase por dia, escolhida pela data: muda sozinha e não pisca a cada render.
  const frase = frases[Number(hoje.replaceAll("-", "")) % frases.length]!;

  // ── tarefas do dia ──────────────────────────────────────────────────────────
  const daAgenda = tarefas.tarefas.filter(
    (tarefa) => escopo === "equipe" || !tarefa.assigned_to || tarefa.assigned_to === usuarioId,
  );
  const { atrasadas, hoje: deHoje } = tarefasDoDia(daAgenda, hoje, fuso);
  const tarefasDoDiaLista = [...atrasadas, ...deHoje];

  // ── eventos do calendário (agendamentos + prazos de tarefas) ────────────────
  const eventos = useMemo(() => {
    const lista: Evento[] = [];
    for (const a of agenda.data ?? []) {
      if (a.situacao === "cancelled") continue;
      const inicio = new Date(a.comeca);
      lista.push({
        id: `a-${a.id}`,
        dia: chaveDoDia(inicio, fuso),
        inicio: inicio.getTime(),
        hora: fmtHora.format(inicio),
        titulo: a.titulo,
        detalhe: a.quemSeraAtendido,
        tipo: "agenda",
      });
    }
    for (const tarefa of tarefas.tarefas) {
      if (!tarefa.due_date) continue;
      const prazo = new Date(tarefa.due_date);
      const dia = chaveDoDia(prazo, fuso);
      if (dia < semana[0]! || dia > semana[6]!) continue;
      lista.push({
        id: `t-${tarefa.id}`,
        dia,
        inicio: prazo.getTime(),
        hora: fmtHora.format(prazo),
        titulo: tarefa.title,
        tipo: "tarefa",
      });
    }
    return lista.sort((x, y) => x.inicio - y.inicio);
  }, [agenda.data, tarefas.tarefas, semana, fuso, fmtHora]);

  const diasComEvento = new Set(eventos.map((e) => e.dia));
  const diasVisiveis = modo === "dia" ? [selecionada] : semana;

  // ── alertas e o "selo" do topo ──────────────────────────────────────────────
  const itensDeAlerta = alertas.data?.items ?? [];
  const totalDeAlertas = alertas.data?.open_count ?? itensDeAlerta.length;
  const pendencias = atrasadas.length + totalDeAlertas;

  const passo = modo === "dia" ? 1 : 7;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 p-4 sm:p-6">
      {/* ── saudação ─────────────────────────────────────────────────────── */}
      <section
        aria-labelledby="inicio-saudacao"
        className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-accent-soft"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 id="inicio-saudacao" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {saudacao}, {nome}!
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{dataPorExtenso}</p>
            <blockquote className="mt-5 border-l-2 border-border-strong pl-3 text-sm italic text-muted-foreground">
              “{frase}”
            </blockquote>
          </div>
          {pendencias === 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-bg px-3 py-1 text-xs font-medium text-success-fg">
              <CheckCircle size={14} aria-hidden />
              {t("Tudo em dia!")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-bg px-3 py-1 text-xs font-medium text-warning-fg">
              {pendencias} {t(pendencias === 1 ? "pendência" : "pendências")}
            </span>
          )}
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* ── tarefas do dia ─────────────────────────────────────────────── */}
        <section aria-labelledby="inicio-tarefas" className={CARTAO}>
          <CabecalhoDoCartao
            id="inicio-tarefas"
            icone={<ListChecks size={18} aria-hidden />}
            titulo={t("Tarefas do Dia")}
          >
            <select
              aria-label={t("Quais tarefas mostrar")}
              value={escopo}
              onChange={(e) => setEscopo(e.target.value as "minhas" | "equipe")}
              className="h-8 rounded-lg border bg-background px-2 text-xs text-muted-foreground"
            >
              <option value="minhas">{t("Minha agenda")}</option>
              <option value="equipe">{t("Toda a equipe")}</option>
            </select>
          </CabecalhoDoCartao>

          {tarefas.carregando ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-secondary" />
              ))}
            </div>
          ) : tarefas.falhou ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("Não foi possível carregar as tarefas.")}
            </p>
          ) : tarefasDoDiaLista.length === 0 ? (
            <Vazio
              titulo={t("Nenhuma tarefa pendente!")}
              texto={t("Você está em dia com tudo.")}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {tarefasDoDiaLista.map((tarefa) => {
                const atrasada = atrasadas.includes(tarefa);
                const prazo = new Date(tarefa.due_date!);
                return (
                  <li
                    key={tarefa.id}
                    className="flex items-start gap-3 rounded-xl border bg-background px-3 py-2.5"
                  >
                    <button
                      type="button"
                      aria-label={t("Concluir tarefa")}
                      disabled={!podeEditar}
                      onClick={() => void tarefas.alternarConcluida(tarefa)}
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-border-strong transition-colors hover:border-primary hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tarefa.title}</p>
                      <p
                        className={cn(
                          "text-xs",
                          atrasada ? "font-medium text-error-fg" : "text-muted-foreground",
                        )}
                      >
                        {atrasada
                          ? `${t("Atrasada")} · ${rotuloDoDia(chaveDoDia(prazo, fuso), { day: "numeric", month: "short" })}`
                          : fmtHora.format(prazo)}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", COR_DA_PRIORIDADE[tarefa.priority])}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href="/app/tasks"
            className="mt-auto pt-4 text-xs font-medium text-primary hover:underline"
          >
            {t("Ver todas as tarefas")} →
          </Link>
        </section>

        {/* ── calendário ─────────────────────────────────────────────────── */}
        <section aria-labelledby="inicio-calendario" className={CARTAO}>
          <CabecalhoDoCartao
            id="inicio-calendario"
            icone={<CalendarBlank size={18} aria-hidden />}
            titulo={t("Calendário")}
          >
            <div className="flex items-center gap-2">
              <Link
                href="/app/agenda"
                aria-label={t("Novo agendamento")}
                title={t("Novo agendamento")}
                className="grid h-8 w-8 place-items-center rounded-lg border bg-background text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus size={16} aria-hidden />
              </Link>
              <div className="flex rounded-lg bg-secondary p-0.5 text-xs">
                {(["dia", "semana"] as const).map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={modo === valor}
                    onClick={() => setModo(valor)}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium transition-colors",
                      modo === valor
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(valor === "dia" ? "Dia" : "Semana")}
                  </button>
                ))}
              </div>
            </div>
          </CabecalhoDoCartao>

          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <button
              type="button"
              aria-label={t("Período anterior")}
              onClick={() => setSelecionada(somarDias(selecionada, -passo))}
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-secondary"
            >
              <CaretLeft size={14} aria-hidden />
            </button>
            <span>
              {rotuloDoDia(semana[0]!, { day: "numeric", month: "short" })} —{" "}
              {rotuloDoDia(semana[6]!, { day: "numeric", month: "short" })}
            </span>
            <button
              type="button"
              aria-label={t("Próximo período")}
              onClick={() => setSelecionada(somarDias(selecionada, passo))}
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-secondary"
            >
              <CaretRight size={14} aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {semana.map((dia) => {
              const ativo = dia === selecionada;
              return (
                <button
                  key={dia}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setSelecionada(dia)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 transition-colors",
                    ativo
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : dia === hoje
                        ? "text-primary ring-1 ring-primary/40 hover:bg-accent-soft"
                        : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <span className="text-[11px] lowercase">
                    {rotuloDoDia(dia, { weekday: "short" }).replace(".", "")}
                  </span>
                  <span className="text-base font-bold leading-none">
                    {rotuloDoDia(dia, { day: "numeric" })}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "h-1 w-1 rounded-full",
                      diasComEvento.has(dia) ? (ativo ? "bg-primary-foreground" : "bg-primary") : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-1 flex-col">
            {agenda.isLoading ? (
              <div className="space-y-2" aria-busy="true">
                {[0, 1].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-secondary" />
                ))}
              </div>
            ) : !diasVisiveis.some((d) => diasComEvento.has(d)) ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
                <CalendarBlank size={32} className="text-text-subtle" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  {t(modo === "dia" ? "Nenhum evento neste dia" : "Nenhum evento esta semana")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {diasVisiveis
                  .filter((d) => diasComEvento.has(d))
                  .map((dia) => (
                    <div key={dia}>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                        {rotuloDoDia(dia, { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {eventos
                          .filter((e) => e.dia === dia)
                          .map((e) => (
                            <li
                              key={e.id}
                              className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2"
                            >
                              <span className="w-11 shrink-0 text-xs font-semibold text-primary">
                                {e.hora}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{e.titulo}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {e.detalhe || t(e.tipo === "agenda" ? "Agendamento" : "Tarefa")}
                                </p>
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>

        {/* ── alertas ────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="inicio-alertas"
          className={cn(CARTAO, "md:col-span-2 xl:col-span-1")}
        >
          <CabecalhoDoCartao id="inicio-alertas" titulo={t("Alertas")} />
          {alertas.isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-secondary" />
              ))}
            </div>
          ) : itensDeAlerta.length === 0 ? (
            <Vazio titulo={t("Nenhum alerta!")} texto={t("Tudo funcionando bem.")} />
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {itensDeAlerta.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <Link
                      href="/app/ai/inbox"
                      className="flex items-start gap-3 rounded-xl border bg-background px-3 py-2.5 transition-colors hover:bg-secondary"
                    >
                      <span
                        aria-hidden
                        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", COR_DA_GRAVIDADE[item.severity] ?? "bg-info")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        {item.body ? (
                          <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/app/ai/inbox"
                className="mt-auto pt-4 text-xs font-medium text-primary hover:underline"
              >
                {t("Ver todos os alertas")} →
              </Link>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
