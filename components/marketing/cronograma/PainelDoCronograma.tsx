"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

import css from "@/components/marketing/cronograma/Cronograma.module.css";
import { chaveDoDia } from "@/lib/inicio/datas";
import {
  FUSO_DO_CRONOGRAMA,
  MAXIMO_DE_SEMANAS,
  diaMes,
  domingoDaSemana,
  formatarValorDaMeta,
  periodoDaSemana,
  progressoDaMeta,
  situacaoDaTarefa,
  type ConfigDoCronograma,
  type ItemDoCronograma,
  type MetaDoCronograma,
  type SituacaoDaTarefa,
  type TarefaDoCronograma,
} from "@/lib/marketing/cronograma";

/**
 * O PAINEL do cronograma, só desenho: serve ao app (agência e cliente logados) e ao link sem
 * login. Texto fixo vem por `rotulos`, já traduzido por quem chama; o conteúdo (ações, metas,
 * tarefas) é da agência e entra como está.
 *
 * Ordem da página: onde queremos chegar (metas, com barra de progresso) → o caminho (fases em
 * seta e, dentro de cada fase, as ações-chave em ordem, na janela de semanas que anda para os
 * dois lados) → a semana (tarefas da agência e do cliente).
 *
 * O tema (claro/escuro) é do painel, não da página: a imagem baixada sai como está na tela.
 */
export interface RotulosDoCronograma {
  titulo: string;
  destaqueDoTitulo: string;
  metas: string;
  caminho: string;
  semana: string;
  agencia: string;
  cliente: string;
  feita: string;
  andamento: string;
  aFazer: string;
  atrasada: string;
  planejado: string;
  concluido: string;
  hoje: string;
  fase: string;
  semanaCurta: string;
  nenhumaMeta: string;
  nenhumaAcao: string;
  nenhumaTarefa: string;
  adiada: string;
  alvo: string;
  atual: string;
  anterior: string;
  proxima: string;
  semanas: string;
  arraste: string;
  /** "concluídas", "em andamento", "a fazer" — o painel monta a frase com os números. */
  resumo: readonly [string, string, string];
}

export type TemaDoCronograma = "claro" | "escuro";

const PONTO_DA_SITUACAO: Record<SituacaoDaTarefa, string> = {
  feita: css.pontoFeita!,
  andamento: css.pontoAndamento!,
  a_fazer: css.pontoAtencao!,
  atrasada: css.pontoAtraso!,
  cancelada: "",
};
const ETIQUETA_DA_SITUACAO: Record<SituacaoDaTarefa, string> = {
  feita: css.etiquetaFeita!,
  andamento: css.etiquetaAndamento!,
  a_fazer: css.etiquetaAtencao!,
  atrasada: css.etiquetaAtraso!,
  cancelada: "",
};

export function PainelDoCronograma({
  vista,
  config,
  itens,
  metas,
  tarefas,
  inicioDaSemana,
  semanaAtual,
  rotulos,
  mostrarAdiamentos,
  agora,
  tema,
  tag,
  janelaInicio = 1,
  aoMudarJanela,
}: {
  vista: "geral" | "semana";
  config: ConfigDoCronograma;
  itens: readonly ItemDoCronograma[];
  metas: readonly MetaDoCronograma[];
  tarefas: readonly TarefaDoCronograma[];
  /** O domingo da semana mostrada na vista "semana". */
  inicioDaSemana: string;
  /** Que semana do cronograma é a de hoje (1…), se houver data de início. */
  semanaAtual: number | null;
  rotulos: RotulosDoCronograma;
  /** A agência vê quantas vezes o prazo foi empurrado; o cliente não precisa dessa conta. */
  mostrarAdiamentos: boolean;
  agora?: Date;
  /** Sem valor, segue o tema do app (e do sistema). */
  tema?: TemaDoCronograma;
  /** Etiqueta do idioma (para formatar R$ e números). */
  tag: string;
  /** A primeira semana visível no cronograma geral (a janela anda para os dois lados). */
  janelaInicio?: number;
  aoMudarJanela?: (inicio: number) => void;
}) {
  const semanas = config.total_semanas;
  const visiveis = itens.filter((i) => !i.arquivado);
  const feitas = visiveis.filter((i) => i.status === "concluido").length;
  const andando = visiveis.filter((i) => i.status === "andamento").length;
  const aFazer = visiveis.length - feitas - andando;

  const maximoDaJanela = Math.max(1, MAXIMO_DE_SEMANAS - semanas + 1);
  const primeira = Math.min(maximoDaJanela, Math.max(1, janelaInicio));
  const ultima = primeira + semanas - 1;
  const estiloDaGrade = { "--semanas": semanas } as CSSProperties;

  const [arrastando, setArrastando] = useState(false);
  const arraste = useRef<{ x: number; inicio: number; largura: number } | null>(null);
  const clamp = (n: number) => Math.min(maximoDaJanela, Math.max(1, n));
  const aoApertar = (e: PointerEvent<HTMLDivElement>) => {
    // No toque o dedo rola a página; as setas mudam a janela.
    if (!aoMudarJanela || e.button !== 0 || e.pointerType === "touch") return;
    const trilho = e.currentTarget.querySelector<HTMLElement>("[data-trilho]");
    const largura = (trilho?.getBoundingClientRect().width ?? 600) / semanas;
    arraste.current = { x: e.clientX, inicio: primeira, largura: Math.max(20, largura) };
  };
  const aoMover = (e: PointerEvent<HTMLDivElement>) => {
    const a = arraste.current;
    if (!a || !aoMudarJanela) return;
    const dx = e.clientX - a.x;
    if (!arrastando && Math.abs(dx) < 6) return;
    if (!arrastando) {
      setArrastando(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const alvo = clamp(a.inicio - Math.round(dx / a.largura));
    if (alvo !== primeira) aoMudarJanela(alvo);
  };
  const aoSoltar = () => {
    arraste.current = null;
    setArrastando(false);
  };

  // Ações agrupadas por fase, na ordem em que a primeira aparece; sem fase vão ao fim.
  const grupos: Array<{ nome: string; itens: ItemDoCronograma[] }> = [];
  for (const i of visiveis) {
    const nome = i.fase.trim();
    const g = grupos.find((x) => x.nome === nome);
    if (g) g.itens.push(i);
    else grupos.push({ nome, itens: [i] });
  }
  grupos.sort((a, b) => Number(a.nome === "") - Number(b.nome === ""));

  const fases = grupos
    .filter((g) => g.nome)
    .map((g) => {
      const inicio = Math.min(...g.itens.map((i) => i.semana_inicio));
      const fim = Math.max(...g.itens.map((i) => i.semana_fim));
      const todas = g.itens.every((i) => i.status === "concluido");
      const algumaAndando = g.itens.some((i) => i.status === "andamento");
      const naJanela = semanaAtual !== null && semanaAtual >= inicio && semanaAtual <= fim;
      const situacao = todas ? "feita" : algumaAndando || naJanela ? "ativa" : "futura";
      return {
        nome: g.nome,
        inicio,
        fim,
        situacao,
        feitas: g.itens.filter((i) => i.status === "concluido").length,
        total: g.itens.length,
      };
    });

  const classeDaBarra = (status: ItemDoCronograma["status"], destaque = false) =>
    status === "concluido"
      ? css.barraFeita
      : status === "andamento" || destaque
        ? css.barraAndamento
        : "";

  /** Uma barra dentro da janela; fora dela vira uma indicação de para onde olhar. */
  const barra = (ini: number, fim: number, classe: string, fina = false) => {
    if (fim < primeira) {
      return (
        <span className={css.foraDaJanela} style={{ gridColumn: "1 / span 3" }}>
          ‹ {rotulos.semanaCurta}
          {ini}
          {fim !== ini ? `–${fim}` : ""}
        </span>
      );
    }
    if (ini > ultima) {
      return (
        <span
          className={css.foraDaJanela}
          style={{ gridColumn: `${Math.max(1, semanas - 2)} / span 3`, textAlign: "right" }}
        >
          {rotulos.semanaCurta}
          {ini}
          {fim !== ini ? `–${fim}` : ""} ›
        </span>
      );
    }
    const de = Math.max(ini, primeira) - primeira + 1;
    const ate = Math.min(fim, ultima) - primeira + 1;
    return (
      <div
        className={`${css.barra} ${fina ? css.barraFase : ""} ${classe}`}
        style={{ gridColumn: `${de} / span ${ate - de + 1}` }}
      />
    );
  };

  if (vista === "geral") {
    return (
      <div
        className={css.tema}
        data-theme={tema === "escuro" ? "dark" : tema === "claro" ? "light" : undefined}
      >
        <h2 className={css.titulo}>
          {rotulos.titulo} <b>{rotulos.destaqueDoTitulo}</b>
        </h2>
        {config.subtitulo_geral ? <p className={css.subtitulo}>{config.subtitulo_geral}</p> : null}

        <section className={css.painel} aria-label={rotulos.metas}>
          <h3 className={css.secao}>{rotulos.metas}</h3>
          {metas.length === 0 ? (
            <p className={css.vazio}>{rotulos.nenhumaMeta}</p>
          ) : (
            <div className={css.metas}>
              {metas.map((m) => {
                const p = progressoDaMeta(m);
                return (
                  <div key={m.id} className={css.meta}>
                    <p className={css.metaTitulo}>{m.titulo}</p>
                    <div className={css.metaValor}>
                      {formatarValorDaMeta(m.valor_alvo, m.tipo, m.unidade, tag)}
                    </div>
                    {m.valor_atual !== null ? (
                      <div className={css.metaAlvo}>
                        {rotulos.atual}:{" "}
                        {formatarValorDaMeta(m.valor_atual, m.tipo, m.unidade, tag)}
                      </div>
                    ) : null}
                    {p !== null ? (
                      <div className={css.progresso}>
                        <div
                          className={css.progressoTrilho}
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={p}
                          aria-label={m.titulo}
                        >
                          <div
                            className={`${css.progressoBarra} ${p >= 100 ? css.progressoBarraCheia : ""}`}
                            style={{ width: `${p}%` }}
                          />
                        </div>
                        <span className={css.progressoPct}>{p}%</span>
                      </div>
                    ) : null}
                    {m.descricao ? <div className={css.metaDescricao}>{m.descricao}</div> : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {fases.length > 0 ? (
          <section className={css.painel} aria-label={rotulos.fase}>
            <ol className={css.fases}>
              {fases.map((f, k) => (
                <li
                  key={f.nome}
                  className={[
                    css.fase,
                    f.situacao === "ativa" ? css.faseAtiva : "",
                    f.situacao === "feita" ? css.faseFeita : "",
                  ].join(" ")}
                >
                  <span className={css.faseNumero}>{String(k + 1).padStart(2, "0")}</span>
                  <span className={css.faseNome}>{f.nome}</span>
                  <span className={css.faseSemanas}>
                    {rotulos.semanaCurta}
                    {f.inicio}
                    {f.fim !== f.inicio ? `–${f.fim}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className={`${css.painel} ${css.rolagem}`} aria-label={rotulos.caminho}>
          <h3 className={css.secao}>{rotulos.caminho}</h3>
          {visiveis.length === 0 ? (
            <p className={css.vazio}>{rotulos.nenhumaAcao}</p>
          ) : (
            <>
              <div className={css.janela} data-sem-imagem="">
                <button
                  type="button"
                  className={css.janelaBotao}
                  disabled={!aoMudarJanela || primeira <= 1}
                  aria-label={rotulos.anterior}
                  onClick={() => aoMudarJanela?.(clamp(primeira - Math.max(1, semanas - 1)))}
                >
                  ‹
                </button>
                <span className={css.janelaFaixa}>
                  {rotulos.semanas} {primeira}–{ultima}
                </span>
                <button
                  type="button"
                  className={css.janelaBotao}
                  disabled={!aoMudarJanela || primeira >= maximoDaJanela}
                  aria-label={rotulos.proxima}
                  onClick={() => aoMudarJanela?.(clamp(primeira + Math.max(1, semanas - 1)))}
                >
                  ›
                </button>
                {semanaAtual !== null && (semanaAtual < primeira || semanaAtual > ultima) ? (
                  <button
                    type="button"
                    className={css.janelaBotao}
                    disabled={!aoMudarJanela}
                    onClick={() => aoMudarJanela?.(clamp(semanaAtual - 1))}
                  >
                    {rotulos.hoje}
                  </button>
                ) : null}
                {aoMudarJanela ? <span className={css.janelaDica}>{rotulos.arraste}</span> : null}
              </div>
              <div
                className={`${css.grade} ${arrastando ? css.arrastando : ""}`}
                style={estiloDaGrade}
                onPointerDown={aoApertar}
                onPointerMove={aoMover}
                onPointerUp={aoSoltar}
                onPointerCancel={aoSoltar}
              >
                <div className={css.cabeca}>
                  <div />
                  {Array.from({ length: semanas }, (_, k) => {
                    const n = primeira + k;
                    return (
                      <div
                        key={n}
                        className={`${css.semana} ${semanaAtual === n ? css.semanaHoje : ""}`}
                      >
                        {rotulos.semanaCurta}
                        {n}
                        {config.data_inicio ? (
                          <span className={css.semanaData}>
                            {diaMes(domingoDaSemana(config.data_inicio, n))}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {grupos.map((g) => {
                  const inicio = Math.min(...g.itens.map((i) => i.semana_inicio));
                  const fim = Math.max(...g.itens.map((i) => i.semana_fim));
                  const todas = g.itens.every((i) => i.status === "concluido");
                  const algumaAndando = g.itens.some((i) => i.status === "andamento");
                  const feitasDaFase = g.itens.filter((i) => i.status === "concluido").length;
                  return (
                    <div key={g.nome || "sem-fase"} style={{ display: "contents" }}>
                      {g.nome ? (
                        <div className={css.linhaFase}>
                          <div className={css.faseTitulo}>
                            {g.nome}
                            <span className={css.faseContagem}>
                              {feitasDaFase}/{g.itens.length}
                            </span>
                          </div>
                          <div className={css.trilho} style={{ gridColumn: "2 / -1" }}>
                            {barra(
                              inicio,
                              fim,
                              todas ? css.barraFeita! : algumaAndando ? css.barraAndamento! : "",
                              true,
                            )}
                          </div>
                        </div>
                      ) : null}
                      {g.itens.map((i) => (
                        <div key={i.id} className={css.linha}>
                          <div className={css.acao}>
                            {i.acao}
                            {i.notas ? <div className={css.acaoNotas}>{i.notas}</div> : null}
                          </div>
                          <div className={css.trilho} data-trilho="">
                            {barra(
                              i.semana_inicio,
                              i.semana_fim,
                              classeDaBarra(i.status, i.destaque) ?? "",
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className={css.legenda}>
                <span className={css.legendaItem}>
                  <span className={`${css.amostra} ${css.barra} ${css.barraFeita}`} />{" "}
                  {rotulos.concluido}
                </span>
                <span className={css.legendaItem}>
                  <span className={`${css.amostra} ${css.barra} ${css.barraAndamento}`} />{" "}
                  {rotulos.andamento}
                </span>
                <span className={css.legendaItem}>
                  <span className={`${css.amostra} ${css.barra}`} /> {rotulos.planejado}
                </span>
                <span style={{ marginLeft: "auto" }}>
                  {feitas} {rotulos.resumo[0]} · {andando} {rotulos.resumo[1]} · {aFazer}{" "}
                  {rotulos.resumo[2]}
                </span>
              </div>
            </>
          )}
        </section>
      </div>
    );
  }

  // Vista da semana: as tarefas, da agência e do cliente.
  const agencia = tarefas.filter((t) => t.lado === "agencia");
  const cliente = tarefas.filter((t) => t.lado === "cliente");
  const etiqueta = (s: SituacaoDaTarefa) =>
    s === "feita"
      ? rotulos.feita
      : s === "andamento"
        ? rotulos.andamento
        : s === "atrasada"
          ? rotulos.atrasada
          : rotulos.aFazer;
  const prazo = (t: TarefaDoCronograma) =>
    t.due_date ? diaMes(chaveDoDia(new Date(t.due_date), FUSO_DO_CRONOGRAMA)) : "";
  const bloco = (titulo: string, lista: TarefaDoCronograma[]) =>
    lista.length === 0 ? null : (
      <div className={css.grupoTarefas}>
        <div className={css.grupoTitulo}>
          {titulo}
          <span className={css.grupoContagem}>{lista.length}</span>
        </div>
        <div className={css.lista}>
          {lista.map((t) => {
            const s = situacaoDaTarefa(t, agora);
            return (
              <div key={t.id} className={`${css.tarefa} ${s === "feita" ? css.tarefaFeita : ""}`}>
                <span className={`${css.ponto} ${PONTO_DA_SITUACAO[s]}`} />
                <span className={css.tarefaTexto}>{t.title}</span>
                {mostrarAdiamentos && t.adiamentos > 0 ? (
                  <span className={`${css.etiqueta} ${css.etiquetaAtencao}`}>
                    {rotulos.adiada} {t.adiamentos}x
                  </span>
                ) : null}
                <span className={`${css.etiqueta} ${ETIQUETA_DA_SITUACAO[s]}`}>{etiqueta(s)}</span>
                {prazo(t) ? <span className={css.tarefaPrazo}>{prazo(t)}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    );

  return (
    <div
      className={css.tema}
      data-theme={tema === "escuro" ? "dark" : tema === "claro" ? "light" : undefined}
    >
      <h2 className={css.titulo}>
        {rotulos.semana} <b>{periodoDaSemana(inicioDaSemana)}</b>
      </h2>
      {config.subtitulo_semana ? <p className={css.subtitulo}>{config.subtitulo_semana}</p> : null}
      <section className={css.painel}>
        {tarefas.length === 0 ? (
          <p className={css.vazio}>{rotulos.nenhumaTarefa}</p>
        ) : (
          <>
            {bloco(rotulos.agencia, agencia)}
            {bloco(rotulos.cliente, cliente)}
          </>
        )}
      </section>
    </div>
  );
}
