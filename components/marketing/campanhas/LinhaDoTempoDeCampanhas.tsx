"use client";

import { SelectDoApp } from "@/components/ui/SelectDoApp";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";

import {
  COR_DO_CANAL,
  COR_DO_STATUS,
  rotuloDoStatus,
  textoDoEstado,
} from "@/components/marketing/campanhas/rotulos";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";
import { BASE_DA_COR } from "@/lib/motor/cores";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { chaveDoDia, somarDias } from "@/lib/inicio/datas";
import { STATUS_DA_CAMPANHA, type CampanhaDeDemanda } from "@/lib/marketing/campanhas";
import { CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export const DIAS_PADRAO_DA_LINHA = 91;
export const OPCOES_DE_DIAS = [14, 30, 60, 91, 180, 365] as const;
export type EscalaDaLinha = "dia" | "semana";
/**
 * A COR da barra é a do TIPO da campanha (tráfego, prospecção, social…): é o que separa uma da
 * outra de relance. O ESTADO muda o desenho dela: ativa é cheia; planejada é clara com borda
 * tracejada; pausada é listrada; encerrada fica apagada.
 */
function barraDaCampanha(c: Pick<CampanhaDeDemanda, "channel" | "status">): {
  className: string;
  style: CSSProperties;
} {
  const base = BASE_DA_COR[COR_DO_CANAL[c.channel]];
  const claro = `color-mix(in oklab, ${base} 22%, var(--color-surface))`;
  const texto = `color-mix(in oklab, ${base} 80%, var(--color-text))`;
  switch (c.status) {
    case "ativa":
      return {
        className: "border-transparent text-white shadow-sm",
        style: { backgroundColor: base },
      };
    case "pausada":
      return {
        className: "border-dashed",
        style: {
          color: texto,
          borderColor: base,
          backgroundColor: claro,
          backgroundImage: `repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklab, ${base} 30%, transparent) 6px 12px)`,
        },
      };
    case "encerrada":
      return {
        className: "border-transparent opacity-60",
        style: {
          color: texto,
          backgroundColor: `color-mix(in oklab, ${base} 14%, var(--color-muted))`,
        },
      };
    default:
      return {
        className: "border-dashed",
        style: { color: texto, borderColor: base, backgroundColor: claro },
      };
  }
}

export interface DatasDaCampanha {
  start_date: string;
  end_date: string | null;
  continuous: boolean;
}

/**
 * A coluna da campanha estica para caber a linha de números por inteiro (sem quebrar): parte do
 * piso e cresce com o texto mais longo (~6 px por caractere nesse tamanho), até o teto.
 */
const COLUNA_MINIMA = 340;
const COLUNA_MAXIMA = 680;
const PX_POR_CARACTERE = 6.2;
/** "Hoje" cai na 7ª coluna: 6 dias para trás e o resto para a frente. */
const DIAS_ANTES_DE_HOJE = 6;
const DURACAO_PADRAO = 14;

const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
const segundaAte = (dia: string) => {
  const d = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return somarDias(dia, -((d + 6) % 7));
};

/**
 * A LINHA DO TEMPO das campanhas: uma barra por campanha, do início ao fim (a contínua vai até
 * a borda, com uma seta). O tempo corre para os dois lados: arraste a linha com o mouse (ou use a
 * barra de rolagem e os dois dedos do trackpad), como no Notion. "Hoje" leva o dia de hoje para a
 * 7ª coluna. As campanhas sem datas ficam embaixo: arraste uma para dentro da linha e ela ganha
 * início (o dia onde soltou) e fim (duas semanas depois).
 */
export function LinhaDoTempoDeCampanhas({
  campanhas,
  base,
  fuso,
  dias: DIAS = DIAS_PADRAO_DA_LINHA,
  escala = "semana",
  aoMudar,
  aoDatas,
  aoStatus,
}: {
  campanhas: readonly CampanhaDeDemanda[];
  base: string;
  fuso: string;
  /** Quantos dias cabem na tela. */
  dias?: number;
  /** As colunas do cabeçalho: um dia cada, ou uma semana cada. */
  escala?: EscalaDaLinha;
  /** Salva a escolha (na aba da visualização); sem isso, os controles não aparecem. */
  aoMudar?: (config: { dias: number; escala: EscalaDaLinha }) => void;
  /** Grava as datas de uma campanha (solta na linha, movida ou esticada); sem isso, não dá para arrastar. */
  aoDatas?: (id: string, datas: DatasDaCampanha) => void;
  /** Grava o status de uma campanha; sem isso, o status só se vê. */
  aoStatus?: (id: string, status: CampanhaDeDemanda["status"]) => void;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const hoje = chaveDoDia(new Date(), fuso);
  const rolagem = useRef<HTMLDivElement | null>(null);
  const [largura, setLargura] = useState(0);
  const COLUNA_DO_NOME = useMemo(() => {
    const maior = campanhas.reduce((m, c) => Math.max(m, textoDoEstado(t, c.estado).length), 0);
    return Math.min(
      COLUNA_MAXIMA,
      Math.max(COLUNA_MINIMA, Math.ceil(maior * PX_POR_CARACTERE) + 56),
    );
  }, [campanhas, t]);
  const opcoesDeStatus = STATUS_DA_CAMPANHA.map((s) => ({
    id: s,
    rotulo: rotuloDoStatus(t, s),
    cor: COR_DO_STATUS[s],
  }));

  // A largura de cada dia vem do "Dias na tela": N dias ocupam a parte visível da linha.
  useLayoutEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const medir = () => setLargura(el.clientWidth);
    medir();
    const o = new ResizeObserver(medir);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const dw = Math.max(
    10,
    Math.floor(Math.max(0, largura - COLUNA_DO_NOME) / Math.max(1, DIAS)) || 12,
  );

  const comData = useMemo(
    () =>
      campanhas.flatMap((c) => {
        if (!c.start_date && !c.end_date) return [];
        const de = c.start_date ?? c.end_date!;
        const ate = c.continuous || !c.end_date ? null : c.end_date;
        return [{ c, de, ate }];
      }),
    [campanhas],
  );
  const semData = campanhas.filter((c) => !c.start_date && !c.end_date);

  // O intervalo que existe para rolar: de antes das primeiras campanhas até bem depois das últimas.
  const { inicio, total } = useMemo(() => {
    let ini = somarDias(hoje, -60);
    let fim = somarDias(hoje, DIAS + 180);
    for (const { de, ate } of comData) {
      if (de < ini) ini = somarDias(de, -14);
      const f = ate ?? de;
      if (f > fim) fim = somarDias(f, 30);
    }
    ini = segundaAte(ini);
    const n = Math.min(1500, diasEntre(ini, fim) + 1);
    return { inicio: ini, total: n };
  }, [comData, hoje, DIAS]);
  const idx = (dia: string) => Math.min(total - 1, Math.max(0, diasEntre(inicio, dia)));
  const idxHoje = diasEntre(inicio, hoje);

  const irParaHoje = (suave: boolean) => {
    const el = rolagem.current;
    if (!el) return;
    el.scrollTo({
      left: Math.max(0, (idxHoje - DIAS_ANTES_DE_HOJE) * dw),
      behavior: suave ? "smooth" : "auto",
    });
  };
  // Abre com hoje na 7ª coluna (e de novo quando a escala dos dias muda).
  useEffect(() => {
    if (largura > 0) irParaHoje(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [largura > 0, dw, inicio]);

  // Arrastar o mouse rola a linha para o lado (no toque, o dedo já rola).
  const arraste = useRef<{ x: number; esquerda: number } | null>(null);
  const moveu = useRef(false);
  const [arrastando, setArrastando] = useState(false);
  const aoApertar = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    arraste.current = { x: e.clientX, esquerda: rolagem.current?.scrollLeft ?? 0 };
    moveu.current = false;
  };
  const aoMover = (e: PointerEvent<HTMLDivElement>) => {
    const a = arraste.current;
    if (!a || !rolagem.current) return;
    const dx = e.clientX - a.x;
    if (!moveu.current && Math.abs(dx) < 4) return;
    if (!moveu.current) {
      moveu.current = true;
      setArrastando(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    rolagem.current.scrollLeft = a.esquerda - dx;
  };
  const aoSoltar = () => {
    arraste.current = null;
    setArrastando(false);
  };

  // Mover a barra (pelo meio) ou esticar uma ponta: o gesto vive até soltar; só aí as datas gravam.
  const [gesto, setGesto] = useState<{
    id: string;
    modo: "mover" | "inicio" | "fim";
    delta: number;
  } | null>(null);
  const emGesto = useRef<{
    id: string;
    modo: "mover" | "inicio" | "fim";
    x0: number;
    de: string;
    ate: string | null;
    delta: number;
    moveu: boolean;
  } | null>(null);
  const comecarGesto = (
    e: PointerEvent<HTMLElement>,
    c: { id: string },
    modo: "mover" | "inicio" | "fim",
    de: string,
    ate: string | null,
  ) => {
    if (!aoDatas || e.button !== 0 || e.pointerType === "touch") return;
    e.stopPropagation();
    const barra = e.currentTarget.closest("a");
    barra?.setPointerCapture(e.pointerId);
    emGesto.current = { id: c.id, modo, x0: e.clientX, de, ate, delta: 0, moveu: false };
  };
  const andarGesto = (e: PointerEvent<HTMLElement>) => {
    const g = emGesto.current;
    if (!g) return;
    let delta = Math.round((e.clientX - g.x0) / dw);
    // Não deixa o início passar do fim, nem o fim ficar antes do início.
    const fimAtual = g.ate ?? g.de;
    if (g.modo === "inicio" && g.ate !== null) delta = Math.min(delta, diasEntre(g.de, g.ate));
    if (g.modo === "fim") delta = Math.max(delta, -diasEntre(g.de, fimAtual));
    if (g.modo === "inicio" && g.ate === null) delta = Math.min(delta, 3650);
    if (Math.abs(e.clientX - g.x0) >= 4) g.moveu = true;
    if (!g.moveu) return;
    g.delta = delta;
    setGesto({ id: g.id, modo: g.modo, delta });
  };
  const terminarGesto = () => {
    const g = emGesto.current;
    setGesto(null);
    if (!g || !g.moveu || g.delta === 0 || !aoDatas) {
      // Um clique simples abre a campanha; arrastar não.
      if (g) window.setTimeout(() => (emGesto.current = null), 0);
      return;
    }
    const novoInicio = g.modo === "fim" ? g.de : somarDias(g.de, g.delta);
    let novoFim: string | null;
    if (g.modo === "inicio") novoFim = g.ate;
    else novoFim = g.ate === null && g.modo === "mover" ? null : somarDias(g.ate ?? g.de, g.delta);
    aoDatas(g.id, {
      start_date: novoInicio,
      end_date: novoFim,
      continuous: novoFim === null,
    });
    window.setTimeout(() => (emGesto.current = null), 0);
  };

  // Soltar uma campanha sem datas: o dia sob o ponteiro vira o início.
  const [soltandoEm, setSoltandoEm] = useState<string | null>(null);
  const diaSobOPonteiro = (clientX: number): string | null => {
    const el = rolagem.current;
    if (!el) return null;
    const x = clientX - el.getBoundingClientRect().left + el.scrollLeft - COLUNA_DO_NOME;
    if (x < 0) return null;
    const i = Math.floor(x / dw);
    return i >= 0 && i < total ? somarDias(inicio, i) : null;
  };

  const formato = new Intl.DateTimeFormat(tag, {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  const semanas = Array.from({ length: Math.ceil(total / 7) }, (_, i) => somarDias(inicio, i * 7));
  const colunas = `${COLUNA_DO_NOME}px repeat(${total}, ${dw}px)`;
  const larguraTotal = COLUNA_DO_NOME + total * dw;
  const rolarPor = (dir: -1 | 1) =>
    rolagem.current?.scrollBy({ left: dir * Math.round(DIAS / 2) * dw, behavior: "smooth" });

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("Semanas anteriores")}
            onClick={() => rolarPor(-1)}
            className="grid h-9 w-9 grid-cols-1 place-items-center rounded-lg border hover:bg-secondary"
          >
            <CaretLeft size={14} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("Próximas semanas")}
            onClick={() => rolarPor(1)}
            className="grid h-9 w-9 grid-cols-1 place-items-center rounded-lg border hover:bg-secondary"
          >
            <CaretRight size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => irParaHoje(true)}
            className="h-9 rounded-lg px-3 text-sm font-medium text-primary hover:bg-secondary"
          >
            {t("Hoje")}
          </button>
        </div>
        {aoMudar ? (
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
              <span>{t("Dias na tela")}</span>
              <SelectDoApp
                value={DIAS}
                onChange={(e) => aoMudar({ dias: Number(e.target.value), escala })}
                className="h-9 w-20 rounded-lg border bg-card px-2 text-sm text-foreground"
              >
                {[...new Set<number>([...OPCOES_DE_DIAS, DIAS])]
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
              </SelectDoApp>
            </label>
            <div
              role="group"
              aria-label={t("Dividir as colunas por")}
              className="inline-flex rounded-lg bg-secondary p-0.5"
            >
              {(
                [
                  ["dia", t("Dias")],
                  ["semana", t("Semanas")],
                ] as const
              ).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={escala === valor}
                  onClick={() => aoMudar({ dias: DIAS, escala: valor })}
                  className={cn(
                    "h-8 rounded-md px-3 text-sm font-medium whitespace-nowrap",
                    escala === valor
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div
        ref={rolagem}
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onClickCapture={(e) => {
          // Quem arrastou a linha não queria abrir a campanha onde o dedo parou.
          if (moveu.current) {
            e.preventDefault();
            e.stopPropagation();
            moveu.current = false;
          }
        }}
        onDragOver={(e) => {
          if (!aoDatas) return;
          e.preventDefault();
          setSoltandoEm(diaSobOPonteiro(e.clientX));
        }}
        onDragLeave={() => setSoltandoEm(null)}
        onDrop={(e) => {
          const id = e.dataTransfer.getData("text/campanha-sem-data");
          const dia = diaSobOPonteiro(e.clientX);
          setSoltandoEm(null);
          if (!aoDatas || !id || !dia) return;
          e.preventDefault();
          aoDatas(id, {
            start_date: dia,
            end_date: somarDias(dia, DURACAO_PADRAO - 1),
            continuous: false,
          });
        }}
        className={cn(
          "overflow-x-auto overscroll-x-contain rounded-2xl border bg-card",
          arrastando ? "cursor-grabbing select-none" : "cursor-grab",
        )}
      >
        <div style={{ width: larguraTotal, minWidth: "100%" }}>
          <div
            className="relative grid border-b text-xs text-muted-foreground"
            style={{ gridTemplateColumns: colunas }}
          >
            <div className="sticky left-0 z-20 border-r-2 border-border bg-card px-3 py-2 shadow-[6px_0_8px_-6px_rgba(0,0,0,0.18)]">
              {t("Campanha")}
            </div>
            {escala === "semana"
              ? semanas.map((s, i) => (
                  <div
                    key={s}
                    className="border-l px-1 py-2 whitespace-nowrap"
                    style={{ gridColumn: `${2 + i * 7} / span ${Math.min(7, total - i * 7)}` }}
                  >
                    {formato.format(new Date(`${s}T12:00:00Z`))}
                  </div>
                ))
              : Array.from({ length: total }, (_, i) => {
                  const dia = somarDias(inicio, i);
                  const d = new Date(`${dia}T12:00:00Z`);
                  const primeiro = d.getUTCDate() === 1 || i === 0;
                  return (
                    <div
                      key={dia}
                      className={cn(
                        "border-l px-0.5 py-1 text-center text-[11px] tabular-nums",
                        dia === hoje && "font-semibold text-primary",
                      )}
                      title={formato.format(d)}
                    >
                      <span className="block h-3 text-[9px] leading-3 whitespace-nowrap text-text-subtle uppercase">
                        {primeiro
                          ? new Intl.DateTimeFormat(tag, {
                              month: "short",
                              timeZone: "UTC",
                            }).format(d)
                          : ""}
                      </span>
                      {String(d.getUTCDate()).padStart(2, "0")}
                    </div>
                  );
                })}
          </div>
          {comData.length === 0 ? (
            <p className="sticky left-0 w-full max-w-full p-6 text-center text-sm text-muted-foreground">
              {t("Nenhuma campanha com datas ainda.")}
            </p>
          ) : (
            comData.map(({ c, de, ate }) => (
              <div
                key={c.id}
                className="relative grid items-center border-b last:border-b-0"
                style={{ gridTemplateColumns: colunas }}
              >
                <div
                  style={{
                    boxShadow: `inset 4px 0 0 ${BASE_DA_COR[COR_DO_CANAL[c.channel]]}, 6px 0 8px -6px rgba(0,0,0,0.18)`,
                  }}
                  className="group sticky left-0 z-10 min-w-0 border-r-2 border-border bg-card py-2 pr-3 pl-4 transition-colors hover:bg-secondary"
                >
                  {/* O bloco INTEIRO leva à campanha: o link cobre a célula, e só o status (que se
                      edita aqui) fica por cima, clicável por conta própria. */}
                  <Link
                    href={`${base}/${c.id}`}
                    aria-label={c.name}
                    className="absolute inset-0 z-0 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-hidden focus-visible:ring-inset"
                  />
                  <div className="pointer-events-none relative z-[1] min-w-0">
                    <p className="truncate text-sm font-medium group-hover:text-primary">
                      {c.name}
                    </p>
                    <div className="pointer-events-auto mt-0.5 w-fit">
                      <SeletorDeOpcao
                        compacto
                        opcoes={opcoesDeStatus}
                        valorId={c.status}
                        podeEditar={Boolean(aoStatus)}
                        rotulo={t("Status da campanha")}
                        aoEscolher={(id) => aoStatus?.(c.id, id as CampanhaDeDemanda["status"])}
                      >
                        <Etiqueta cor={COR_DO_STATUS[c.status]} ponto className="text-[11px]">
                          {rotuloDoStatus(t, c.status)}
                        </Etiqueta>
                      </SeletorDeOpcao>
                    </div>
                    <p
                      className="text-[11px] leading-snug whitespace-nowrap text-muted-foreground tabular-nums"
                      title={textoDoEstado(t, c.estado)}
                    >
                      {textoDoEstado(t, c.estado)}
                    </p>
                  </div>
                </div>
                {idxHoje >= 0 && idxHoje < total ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 w-px bg-primary/50"
                    style={{ left: COLUNA_DO_NOME + idxHoje * dw + dw / 2 }}
                  />
                ) : null}
                {soltandoEm ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 bg-primary/10"
                    style={{
                      left: COLUNA_DO_NOME + idx(soltandoEm) * dw,
                      width: dw * DURACAO_PADRAO,
                    }}
                  />
                ) : null}
                {(() => {
                  const g = gesto?.id === c.id ? gesto : null;
                  const deV = g && g.modo !== "fim" ? somarDias(de, g.delta) : de;
                  const ateV =
                    g && g.modo !== "inicio" && (ate !== null || g.modo === "fim")
                      ? somarDias(ate ?? de, g.delta)
                      : ate;
                  return (
                    <Link
                      href={`${base}/${c.id}`}
                      title={c.name}
                      draggable={false}
                      onPointerDown={(e) => comecarGesto(e, c, "mover", de, ate)}
                      onPointerMove={andarGesto}
                      onPointerUp={terminarGesto}
                      onPointerCancel={terminarGesto}
                      onClick={(e) => {
                        if (emGesto.current?.moveu) e.preventDefault();
                      }}
                      className={cn(
                        "relative my-2 flex h-7 items-center overflow-hidden rounded-lg border px-2 text-[11px] font-medium whitespace-nowrap",
                        barraDaCampanha(c).className,
                        aoDatas && "cursor-grab",
                        g && "z-10 cursor-grabbing opacity-90 ring-2 ring-primary/40",
                      )}
                      style={{
                        ...barraDaCampanha(c).style,
                        gridColumn: `${2 + idx(deV)} / ${ateV === null ? total + 2 : idx(ateV) + 3}`,
                      }}
                    >
                      {aoDatas ? (
                        <span
                          aria-hidden
                          title={t("Arraste para mudar o início")}
                          onPointerDown={(e) => comecarGesto(e, c, "inicio", de, ate)}
                          className="absolute inset-y-0 left-0 w-2 cursor-ew-resize hover:bg-foreground/20"
                        />
                      ) : null}
                      <span className="min-w-0 truncate">
                        {ateV === null ? `${c.name} →` : c.name}
                      </span>
                      {aoDatas ? (
                        <span
                          aria-hidden
                          title={t("Arraste para mudar o fim")}
                          onPointerDown={(e) => comecarGesto(e, c, "fim", de, ate)}
                          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-foreground/20"
                        />
                      ) : null}
                    </Link>
                  );
                })()}
              </div>
            ))
          )}
          {soltandoEm && comData.length === 0 ? (
            <div
              aria-hidden
              className="pointer-events-none relative h-10"
              style={{
                marginLeft: COLUNA_DO_NOME + idx(soltandoEm) * dw,
                width: dw * DURACAO_PADRAO,
              }}
            >
              <span className="absolute inset-0 rounded-lg bg-primary/15" />
            </div>
          ) : null}
        </div>
      </div>

      {semData.length > 0 ? (
        <div className="rounded-2xl border border-dashed p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            {aoDatas
              ? t(
                  "Sem datas definidas — arraste uma campanha para dentro da linha do tempo para dar início e fim a ela.",
                )
              : t("Sem datas definidas")}
          </p>
          <ul className="flex flex-wrap gap-2">
            {semData.map((c) => (
              <li
                key={c.id}
                draggable={Boolean(aoDatas)}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/campanha-sem-data", c.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className={cn(
                  "inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium",
                  barraDaCampanha(c).className,
                  aoDatas && "cursor-grab active:cursor-grabbing",
                )}
                style={barraDaCampanha(c).style}
              >
                <span className="truncate">{c.name}</span>
                <Link
                  href={`${base}/${c.id}`}
                  draggable={false}
                  className="shrink-0 text-xs underline-offset-2 opacity-80 hover:underline"
                >
                  {t("Abrir")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
