"use client";

import { useRef, useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { chaveDoDia, somarDias } from "@/lib/inicio/datas";
import { diasSeguidos, diferencaEmDias, trocarODia } from "@/lib/motor/calendario";
import { estiloDaEtiqueta } from "@/lib/motor/cores";
import { opcaoDaTarefa, type OpcaoDeStatus } from "@/lib/tarefas/opcoes-de-status";
import type { Tarefa } from "@/lib/tarefas/tipos";
import { CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const DIAS_NA_JANELA = 28;
const LARGURA_DO_DIA = 36;

type Gesto = "mover" | "inicio" | "fim";

interface Props {
  tarefas: Tarefa[];
  opcoes: OpcaoDeStatus[];
  fuso: string;
  tag: string;
  hoje: string;
  podeEditar: boolean;
  /** Grava as datas novas (ISO). Só as que mudaram vêm preenchidas. */
  aoMudarDatas: (tarefa: Tarefa, datas: { start_date?: string; due_date?: string }) => void;
  aoAbrir: (tarefa: Tarefa) => void;
}

/** Uma barra: do início (se tiver) até o prazo (se tiver); só um dos dois = um dia. */
function intervaloDa(tarefa: Tarefa, fuso: string): { de: string; ate: string } | null {
  const inicio = tarefa.start_date ? chaveDoDia(new Date(tarefa.start_date), fuso) : null;
  const prazo = tarefa.due_date ? chaveDoDia(new Date(tarefa.due_date), fuso) : null;
  if (!inicio && !prazo) return null;
  const de = inicio ?? prazo!;
  const ate = prazo ?? inicio!;
  return de <= ate ? { de, ate } : { de: ate, ate: de };
}

/**
 * A LINHA DO TEMPO — uma barra por tarefa, do INÍCIO ao PRAZO. Quatro semanas por vez; as
 * setas andam de semana em semana.
 *
 * Edita-se na própria barra: arrastar o meio move as duas datas; arrastar a ponta esquerda
 * muda o início; a direita, o prazo. Tocar (ou clicar) sem arrastar abre a tarefa.
 * Tarefa com só uma das datas vira uma barra de um dia — arrastar a ponta oposta cria a outra.
 * Sem nenhuma das duas, a tarefa não tem onde aparecer e fica numa faixa à parte.
 */
export function LinhaDoTempo({
  tarefas,
  opcoes,
  fuso,
  tag,
  hoje,
  podeEditar,
  aoMudarDatas,
  aoAbrir,
}: Props) {
  const t = useT();
  const [inicio, setInicio] = useState(() => somarDias(hoje, -7));
  const [ao_vivo, setAoVivo] = useState<{ id: string; de: string; ate: string } | null>(null);
  const gesto = useRef<{
    id: string;
    tipo: Gesto;
    x0: number;
    de: string;
    ate: string;
    moveu: boolean;
  } | null>(null);

  const dias = diasSeguidos(inicio, DIAS_NA_JANELA);
  const fim = dias[dias.length - 1]!;

  const comData = tarefas.flatMap((tarefa) => {
    const intervalo = intervaloDa(tarefa, fuso);
    if (!intervalo) return [];
    // Fora da janela = não aparece.
    if (intervalo.ate < inicio || intervalo.de > fim) return [];
    return [{ tarefa, ...intervalo }];
  });
  const semData = tarefas.filter((x) => !x.start_date && !x.due_date);

  const rotuloDoDia = (d: string) =>
    new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${d}T12:00:00Z`),
    );

  function comecar(
    e: React.PointerEvent,
    tarefa: Tarefa,
    tipo: Gesto,
    intervalo: { de: string; ate: string },
  ) {
    if (!podeEditar) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesto.current = { id: tarefa.id, tipo, x0: e.clientX, ...intervalo, moveu: false };
  }

  function mover(e: React.PointerEvent) {
    const g = gesto.current;
    if (!g) return;
    const delta = Math.round((e.clientX - g.x0) / LARGURA_DO_DIA);
    if (delta !== 0) g.moveu = true;
    let de = g.de;
    let ate = g.ate;
    if (g.tipo === "mover") {
      de = somarDias(g.de, delta);
      ate = somarDias(g.ate, delta);
    } else if (g.tipo === "inicio") {
      de = somarDias(g.de, delta);
      if (de > ate) de = ate;
    } else {
      ate = somarDias(g.ate, delta);
      if (ate < de) ate = de;
    }
    setAoVivo({ id: g.id, de, ate });
  }

  function terminar(tarefa: Tarefa) {
    const g = gesto.current;
    gesto.current = null;
    const vivo = ao_vivo;
    setAoVivo(null);
    if (!g) return;
    // Não saiu do lugar: foi um toque, não um arrasto.
    if (!g.moveu || !vivo || (vivo.de === g.de && vivo.ate === g.ate)) {
      aoAbrir(tarefa);
      return;
    }
    const datas: { start_date?: string; due_date?: string } = {};
    if (vivo.de !== g.de) datas.start_date = trocarODia(tarefa.start_date, vivo.de, fuso);
    if (vivo.ate !== g.ate || (!tarefa.due_date && g.tipo === "fim")) {
      datas.due_date = trocarODia(tarefa.due_date, vivo.ate, fuso);
    }
    // Mover a barra de uma tarefa que só tinha prazo cria o início no mesmo gesto.
    if (g.tipo === "mover" && !tarefa.start_date && vivo.de !== vivo.ate) {
      datas.start_date = trocarODia(null, vivo.de, fuso);
    }
    if (Object.keys(datas).length > 0) aoMudarDatas(tarefa, datas);
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
          {rotuloDoDia(inicio)} – {rotuloDoDia(fim)}
        </h2>
        <button
          type="button"
          onClick={() => setInicio(somarDias(hoje, -7))}
          className="h-8 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {t("Hoje")}
        </button>
        <button
          type="button"
          aria-label={t("Semana anterior")}
          onClick={() => setInicio((i) => somarDias(i, -7))}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"
        >
          <CaretLeft size={16} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t("Próxima semana")}
          onClick={() => setInicio((i) => somarDias(i, 7))}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"
        >
          <CaretRight size={16} aria-hidden />
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <div style={{ minWidth: 112 + DIAS_NA_JANELA * LARGURA_DO_DIA }}>
          <div className="flex border-b bg-secondary/50 text-[11px] text-muted-foreground">
            <div className="sticky left-0 z-10 w-28 shrink-0 bg-secondary px-2 py-2 md:w-48" />
            {dias.map((d) => (
              <div
                key={d}
                style={{ width: LARGURA_DO_DIA }}
                className={cn(
                  "shrink-0 py-2 text-center",
                  d === hoje && "font-semibold text-primary",
                )}
              >
                {Number(d.slice(8))}
              </div>
            ))}
          </div>
          {comData.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("Nenhuma tarefa com data nestas semanas.")}
            </p>
          ) : (
            comData.map(({ tarefa, de, ate }) => {
              const vivo = ao_vivo?.id === tarefa.id ? ao_vivo : null;
              const d0 = vivo?.de ?? de;
              const d1 = vivo?.ate ?? ate;
              const ini = Math.max(0, diferencaEmDias(inicio, d0));
              const fimIdx = Math.min(DIAS_NA_JANELA - 1, diferencaEmDias(inicio, d1));
              const cor = opcaoDaTarefa(tarefa, opcoes)?.color ?? "gray";
              const intervalo = { de, ate };
              return (
                <div key={tarefa.id} className="flex border-b last:border-b-0">
                  <button
                    type="button"
                    title={tarefa.title}
                    onClick={() => aoAbrir(tarefa)}
                    className="sticky left-0 z-10 w-28 shrink-0 truncate bg-card px-2 py-2 text-left text-sm hover:bg-secondary md:w-48"
                  >
                    {tarefa.title}
                  </button>
                  <div className="relative h-10" style={{ width: DIAS_NA_JANELA * LARGURA_DO_DIA }}>
                    {dias.includes(hoje) ? (
                      <span
                        aria-hidden
                        style={{
                          left: diferencaEmDias(inicio, hoje) * LARGURA_DO_DIA + LARGURA_DO_DIA / 2,
                        }}
                        className="absolute inset-y-0 w-px bg-primary/40"
                      />
                    ) : null}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`${tarefa.title}: ${rotuloDoDia(d0)} – ${rotuloDoDia(d1)}`}
                      style={{
                        ...estiloDaEtiqueta(cor),
                        left: ini * LARGURA_DO_DIA + 2,
                        width: Math.max(1, fimIdx - ini + 1) * LARGURA_DO_DIA - 4,
                      }}
                      onPointerDown={(e) => comecar(e, tarefa, "mover", intervalo)}
                      onPointerMove={mover}
                      onPointerUp={() => terminar(tarefa)}
                      onPointerCancel={() => {
                        gesto.current = null;
                        setAoVivo(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") aoAbrir(tarefa);
                      }}
                      className={cn(
                        "absolute top-2 flex h-6 touch-none items-center rounded-md select-none",
                        podeEditar ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                        vivo && "z-10 shadow-lg",
                      )}
                    >
                      {podeEditar ? (
                        <>
                          <span
                            aria-hidden
                            onPointerDown={(e) => comecar(e, tarefa, "inicio", intervalo)}
                            onPointerMove={mover}
                            onPointerUp={() => terminar(tarefa)}
                            className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize rounded-l-md bg-black/10"
                          />
                          <span
                            aria-hidden
                            onPointerDown={(e) => comecar(e, tarefa, "fim", intervalo)}
                            onPointerMove={mover}
                            onPointerUp={() => terminar(tarefa)}
                            className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize rounded-r-md bg-black/10"
                          />
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {podeEditar ? (
        <p className="text-xs text-muted-foreground">
          {t("Arraste a barra para mudar as datas; as pontas mudam só o início ou só o prazo.")}
        </p>
      ) : null}
      {semData.length > 0 ? (
        <section className="rounded-2xl border bg-card p-3">
          <h3 className="mb-2 text-sm font-semibold">
            {t("Sem data")} <span className="text-muted-foreground">{semData.length}</span>
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {semData.map((tarefa) => (
              <li key={tarefa.id} className="max-w-full">
                <button
                  type="button"
                  onClick={() => aoAbrir(tarefa)}
                  style={estiloDaEtiqueta(opcaoDaTarefa(tarefa, opcoes)?.color ?? "gray")}
                  className="block max-w-full truncate rounded-md px-2 py-1 text-xs font-medium"
                >
                  {tarefa.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
