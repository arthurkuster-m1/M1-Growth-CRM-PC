"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as EventoDePonteiro,
  type ReactNode,
} from "react";

import { somarDias } from "@/lib/inicio/datas";
import type { ItemDoCronograma } from "@/lib/marketing/cronograma";
import {
  baseDoCronograma,
  diferencaEmDias,
  gerarDias,
  LARGURA_DO_DIA,
  mesesDoEixo,
  nomeDoMes,
  periodoDoItem,
  semanasDepoisDoArrasto,
  semanasDoEixo,
  type EscalaDoCronograma,
  type ModoDeArrasto,
} from "@/lib/marketing/cronograma-linha-do-tempo";

import lt from "./LinhaDoTempoDoCronograma.module.css";

const FOLGA_DIR = 120;
const BORDA = 500;
const DIAS_INICIAIS = 560;
const LIMIAR_DO_ARRASTO = 5;

/** As propriedades de edição sem o `className` (ele é somado ao da coluna, não a substitui). */
const propsSemClasse = (p: Record<string, unknown>): Record<string, never> => {
  const { className: _classe, ...resto } = p;
  void _classe;
  return resto as Record<string, never>;
};
const classeDe = (p: Record<string, unknown>): string =>
  typeof p.className === "string" ? p.className : "";

export interface FaseDaLinhaDoTempo {
  nome: string;
  itens: ItemDoCronograma[];
}

export interface RotulosDaLinhaDoTempo {
  acao: string;
  hoje: string;
  dia: string;
  semana: string;
  semanaCurta: string;
  arraste: string;
}

/**
 * A LINHA DO TEMPO do cronograma geral (a mesma ideia da linha do tempo do app Gestão de Frota):
 * a 1ª coluna, FIXA, são as ações (agrupadas por fase); ao lado correm os dias, sem fim — o eixo
 * cresce para os dois lados conforme se rola. Clicar no fundo e arrastar anda pelo tempo. Com a
 * edição ligada, arrastar uma barra (ou as pontas dela) muda as semanas da ação, de semana em
 * semana.
 */
export function LinhaDoTempoDoCronograma({
  grupos,
  dataInicio,
  hoje,
  semanaAtual,
  rotulos,
  linhaProps,
  aoAlterarSemanas,
  marcarArraste,
  rodape,
}: {
  grupos: FaseDaLinhaDoTempo[];
  dataInicio: string | null;
  /** O dia de hoje (AAAA-MM-DD, no fuso do cronograma). */
  hoje: string;
  semanaAtual: number | null;
  rotulos: RotulosDaLinhaDoTempo;
  /** Propriedades de quem edita (clicável, selecionado…) para cada fase e ação; vazio se só lê. */
  linhaProps: (
    alvo: { tipo: "acao"; id: string } | { tipo: "fase"; nome: string },
  ) => Record<string, unknown>;
  /** Só na edição: a ação mudou de semanas (arrastou a barra). Rejeita se não deu. */
  aoAlterarSemanas?: (
    item: ItemDoCronograma,
    semanas: { semana_inicio: number; semana_fim: number },
  ) => Promise<unknown> | unknown;
  /** Avisa que o último gesto foi um arraste (o clique que sobra dele não seleciona nada). */
  marcarArraste: (v: boolean) => void;
  /** Botões extras (por fase: "+ Nova ação") entram aqui, ao lado do nome da fase. */
  rodape?: (fase: string) => ReactNode;
}) {
  const [escala, setEscala] = useState<EscalaDoCronograma>("dia");
  const larguraDia = LARGURA_DO_DIA[escala];
  const base = useMemo(() => baseDoCronograma(dataInicio, hoje), [dataInicio, hoje]);

  // O eixo COMEÇA no início do projeto (a semana 1 do cronograma) e não volta além disso: antes da
  // primeira ação não há nada para mostrar, e uma linha que crescia para a esquerda sem fim fazia a
  // tela "voltar para sempre". Se o projeto ainda não começou, o eixo abre uma semana antes de hoje.
  // Só o lado DIREITO cresce, e só quando a pessoa rola até lá.
  const origem = useMemo(() => {
    const primeira = grupos
      .flatMap((g) => g.itens)
      .reduce<string | null>((m, i) => {
        const ini = periodoDoItem(base, i.semana_inicio, i.semana_fim).inicio;
        return m === null || ini < m ? ini : m;
      }, null);
    const inicioDoProjeto = primeira && primeira < base ? primeira : base;
    const maisAntigo = inicioDoProjeto < hoje ? inicioDoProjeto : somarDias(hoje, -7);
    return somarDias(maisAntigo, -7);
  }, [grupos, base, hoje]);
  const [dias, setDias] = useState(() =>
    Math.max(DIAS_INICIAIS, diferencaEmDias(origem, hoje) + 365),
  );
  const larguraEixo = dias * larguraDia;

  const rolagem = useRef<HTMLDivElement>(null);
  const aplicarScroll = useRef<number | null>(null);
  const [larguraEsq, setLarguraEsq] = useState(260);
  const [arrastandoFundo, setArrastandoFundo] = useState(false);
  const [arrasto, setArrasto] = useState<{
    id: string;
    modo: ModoDeArrasto;
    delta: number;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const pos = useCallback(
    (dia: string) => diferencaEmDias(origem, dia) * larguraDia,
    [origem, larguraDia],
  );

  // Coluna das ações: 260px, menos no celular.
  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const ler = () => setLarguraEsq(el.clientWidth < 560 ? 150 : 260);
    ler();
    const ro = new ResizeObserver(ler);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const irPara = useCallback(
    (dia: string, margemDias = 7) => {
      const el = rolagem.current;
      if (!el) return;
      el.scrollLeft = Math.max(0, pos(dia) - margemDias * larguraDia);
    },
    [pos, larguraDia],
  );

  // Primeira vez: olhar para hoje.
  const jaOlhouHoje = useRef(false);
  useLayoutEffect(() => {
    if (jaOlhouHoje.current) return;
    jaOlhouHoje.current = true;
    irPara(hoje);
  }, [irPara, hoje]);

  // Depois de o eixo crescer para a esquerda, devolve o scroll para o mesmo dia.
  useLayoutEffect(() => {
    const el = rolagem.current;
    if (el && aplicarScroll.current !== null) {
      el.scrollLeft = aplicarScroll.current;
      aplicarScroll.current = null;
    }
  }, [origem, dias]);

  const aoRolar = () => {
    const el = rolagem.current;
    if (!el || aplicarScroll.current !== null) return;
    const x = el.scrollLeft;
    // Para a esquerda não há mais o que carregar: o eixo termina no início do projeto.
    if (x + el.clientWidth > larguraEsq + larguraEixo - BORDA) setDias((d) => d + FOLGA_DIR);
  };

  const mudarEscala = (e: EscalaDoCronograma) => {
    const el = rolagem.current;
    if (!el || e === escala) return;
    // Mantém o mesmo dia no começo da tela quando o tamanho do dia muda.
    const diaNoInicio = el.scrollLeft / larguraDia;
    aplicarScroll.current = Math.max(0, Math.round(diaNoInicio * LARGURA_DO_DIA[e]));
    setEscala(e);
  };

  // ---- Clicar no fundo e arrastar anda pelo tempo (no toque, o dedo já rola) ----
  const panoramica = useRef<{ x: number; y: number; scrollX: number; scrollY: number } | null>(
    null,
  );
  const aoApertarFundo = (e: EventoDePonteiro<HTMLDivElement>) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    if ((e.target as HTMLElement).closest("[data-barra], button, [data-editavel]")) return;
    const el = rolagem.current;
    if (!el) return;
    marcarArraste(false);
    panoramica.current = {
      x: e.clientX,
      y: e.clientY,
      scrollX: el.scrollLeft,
      scrollY: el.scrollTop,
    };
  };
  const aoMoverFundo = (e: EventoDePonteiro<HTMLDivElement>) => {
    const p = panoramica.current;
    const el = rolagem.current;
    if (!p || !el) return;
    const dx = e.clientX - p.x;
    if (!arrastandoFundo && Math.abs(dx) < LIMIAR_DO_ARRASTO) return;
    if (!arrastandoFundo) {
      marcarArraste(true);
      setArrastandoFundo(true);
      el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = p.scrollX - dx;
    el.scrollTop = p.scrollY - (e.clientY - p.y);
  };
  const aoSoltarFundo = () => {
    panoramica.current = null;
    setArrastandoFundo(false);
  };

  // ---- Arrastar uma barra (só na edição) ----
  function comecarArrasto(e: EventoDePonteiro<HTMLElement>, item: ItemDoCronograma) {
    if (!aoAlterarSemanas || e.button !== 0) return;
    const alvo = e.target as HTMLElement;
    const modo: ModoDeArrasto =
      alvo.dataset.alca === "inicio" ? "inicio" : alvo.dataset.alca === "fim" ? "fim" : "mover";
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    let delta = 0;
    marcarArraste(false);
    setArrasto({ id: item.id, modo, delta: 0 });
    const mover = (ev: PointerEvent) => {
      delta = Math.round((ev.clientX - x0) / larguraDia);
      if (Math.abs(ev.clientX - x0) >= LIMIAR_DO_ARRASTO) marcarArraste(true);
      setArrasto({ id: item.id, modo, delta });
    };
    const soltar = () => {
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerup", soltar);
      el.removeEventListener("pointercancel", soltar);
      setArrasto(null);
      const novas = semanasDepoisDoArrasto(item, modo, delta);
      if (novas.semana_inicio === item.semana_inicio && novas.semana_fim === item.semana_fim)
        return;
      Promise.resolve(aoAlterarSemanas?.(item, novas)).then(
        () => setErro(null),
        (er: unknown) => setErro(er instanceof Error ? er.message : String(er)),
      );
    };
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);
  }

  const dias_ = useMemo(() => gerarDias(origem, dias), [origem, dias]);
  const meses = useMemo(() => mesesDoEixo(origem, dias), [origem, dias]);
  const semanas = useMemo(() => semanasDoEixo(origem, dias, base), [origem, dias, base]);
  const grade = {
    backgroundSize: `${escala === "dia" ? larguraDia : larguraDia * 7}px 100%`,
  } as const;
  const posHoje = pos(hoje);
  const posicaoDeBarra = (item: ItemDoCronograma) => {
    let ini = item.semana_inicio;
    let fim = item.semana_fim;
    if (arrasto && arrasto.id === item.id) {
      const n = semanasDepoisDoArrasto(item, arrasto.modo, arrasto.delta);
      ini = n.semana_inicio;
      fim = n.semana_fim;
    }
    const p = periodoDoItem(base, ini, fim);
    return { left: pos(p.inicio), width: (diferencaEmDias(p.inicio, p.fim) + 1) * larguraDia };
  };

  return (
    <div data-testid="linha-do-tempo-do-cronograma">
      <div className={lt.controles} data-sem-imagem="">
        <button type="button" className={lt.botao} onClick={() => irPara(hoje)}>
          {rotulos.hoje}
        </button>
        {(["dia", "semana"] as const).map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={escala === e}
            className={`${lt.botao} ${escala === e ? lt.botaoAtivo : ""}`}
            onClick={() => mudarEscala(e)}
          >
            {e === "dia" ? rotulos.dia : rotulos.semana}
          </button>
        ))}
        <span className={lt.dica}>{rotulos.arraste}</span>
      </div>
      {erro ? (
        <p role="alert" className={lt.erro}>
          {erro}
        </p>
      ) : null}
      <div
        ref={rolagem}
        className={`${lt.rolagem} ${arrastandoFundo ? lt.arrastando : ""}`}
        onScroll={aoRolar}
        onPointerDown={aoApertarFundo}
        onPointerMove={aoMoverFundo}
        onPointerUp={aoSoltarFundo}
        onPointerCancel={aoSoltarFundo}
        data-testid="rolagem-do-cronograma"
      >
        <div
          className={lt.grade}
          style={{
            width: larguraEsq + larguraEixo,
            ["--esq" as string]: `${larguraEsq}px`,
          }}
        >
          <div className={lt.cabecalho}>
            <div className={`${lt.esq} ${lt.cabEsq}`} style={{ width: larguraEsq, height: 76 }}>
              {rotulos.acao}
            </div>
            <div className={lt.eixo} style={{ width: larguraEixo }}>
              <div className={lt.meses}>
                {meses.map((m) => (
                  <div key={m.chave} className={lt.mes} style={{ width: m.dias * larguraDia }}>
                    <span>{nomeDoMes(m.chave)}</span>
                  </div>
                ))}
              </div>
              <div className={lt.semanasLinha}>
                {semanas.map((s) => (
                  <div
                    key={s.domingo}
                    className={`${lt.semanaRotulo} ${s.numero !== null && s.numero === semanaAtual ? lt.semanaHoje : ""}`}
                    style={{ left: pos(s.domingo), width: larguraDia * 7 }}
                  >
                    {s.numero !== null ? `${rotulos.semanaCurta}${s.numero}` : ""}
                    <span className={lt.semanaData}>
                      {s.domingo.slice(8, 10)}/{s.domingo.slice(5, 7)}
                    </span>
                  </div>
                ))}
              </div>
              <div className={lt.dias} style={{ width: larguraEixo }}>
                {escala === "dia"
                  ? dias_.map((d) => {
                      const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
                      return (
                        <div
                          key={d}
                          className={`${lt.dia} ${dow === 0 || dow === 6 ? lt.fds : ""} ${d === hoje ? lt.hojeDia : ""}`}
                          style={{ width: larguraDia }}
                          title={d}
                        >
                          <b>{d.slice(8, 10)}</b>
                          <span>{"DSTQQSS"[dow]}</span>
                        </div>
                      );
                    })
                  : null}
              </div>
            </div>
          </div>

          {grupos.map((g) => (
            <section key={g.nome || "sem-fase"}>
              {g.nome ? (
                <div className={lt.linhaFase} style={{ width: larguraEsq + larguraEixo }}>
                  <div
                    {...propsSemClasse(linhaProps({ tipo: "fase", nome: g.nome }))}
                    className={`${lt.esq} ${classeDe(linhaProps({ tipo: "fase", nome: g.nome }))}`}
                    style={{ width: larguraEsq }}
                  >
                    <span className="truncate">{g.nome}</span>
                    <span className={lt.faseContagem}>
                      {g.itens.filter((i) => i.status === "concluido").length}/{g.itens.length}
                    </span>
                    {rodape?.(g.nome)}
                  </div>
                </div>
              ) : null}
              {g.itens.map((i) => {
                const propsDaLinha = linhaProps({ tipo: "acao", id: i.id }) as {
                  "aria-pressed"?: boolean;
                } & Record<string, never>;
                const barraEstilo = posicaoDeBarra(i);
                const movel = !!aoAlterarSemanas;
                return (
                  <div
                    key={i.id}
                    className={`${lt.linha} ${propsDaLinha["aria-pressed"] ? lt.linhaSelecionada : ""}`}
                    data-testid="linha-do-cronograma"
                  >
                    <div
                      {...propsSemClasse(propsDaLinha)}
                      className={`${lt.esq} ${classeDe(propsDaLinha)}`}
                      style={{ width: larguraEsq }}
                    >
                      <div className={lt.acaoTexto}>
                        <span className={lt.acao}>{i.acao}</span>
                        {i.notas ? <span className={lt.acaoNotas}>{i.notas}</span> : null}
                      </div>
                    </div>
                    <div className={lt.corpo} style={{ width: larguraEixo, ...grade }}>
                      <span
                        className={lt.hojeLinha}
                        style={{ left: posHoje + larguraDia / 2 }}
                        aria-hidden
                      />
                      <div
                        data-barra={i.id}
                        className={[
                          lt.barra,
                          i.status === "concluido"
                            ? lt.barraFeita
                            : i.status === "andamento" || i.destaque
                              ? lt.barraAndamento
                              : "",
                          movel ? lt.barraMovel : "",
                          arrasto?.id === i.id ? lt.barraArrastando : "",
                        ].join(" ")}
                        style={{ left: barraEstilo.left, width: Math.max(barraEstilo.width, 10) }}
                        title={i.acao}
                        onPointerDown={(e) => comecarArrasto(e, i)}
                        onClick={(e) => {
                          // Clique na barra = clique na ação (abre a edição); depois de arrastar, não.
                          const alvo = e.currentTarget
                            .closest(`.${lt.linha}`)
                            ?.querySelector<HTMLElement>(`.${lt.esq}`);
                          alvo?.click();
                        }}
                      >
                        {movel ? (
                          <span className={`${lt.alca} ${lt.alcaIni}`} data-alca="inicio" />
                        ) : null}
                        <span className={lt.barraRotulo} data-rotulo={i.acao} aria-hidden />
                        {movel ? (
                          <span className={`${lt.alca} ${lt.alcaFim}`} data-alca="fim" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
