"use client";

import { useMemo, useRef, type KeyboardEvent } from "react";

import css from "@/components/marketing/cronograma/Cronograma.module.css";
import { LinhaDoTempoDoCronograma } from "@/components/marketing/cronograma/LinhaDoTempoDoCronograma";
import { chaveDoDia } from "@/lib/inicio/datas";
import {
  FUSO_DO_CRONOGRAMA,
  diaMes,
  formatarValorDaMeta,
  periodoDaSemana,
  corDaBarraDaMeta,
  leituraDaMeta,
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
  /** Título da 1ª coluna da linha do tempo ("Ação") e botão de escala em dias. */
  acao: string;
  dia: string;
  /** "concluídas", "em andamento", "a fazer" — o painel monta a frase com os números. */
  resumo: readonly [string, string, string];
}

export type TemaDoCronograma = "claro" | "escuro";

/** O que está aberto para edição no painel (uma meta, uma ação ou uma fase inteira). */
export type SelecaoDoCronograma =
  { tipo: "meta" | "acao"; id: string } | { tipo: "fase"; nome: string } | null;

/**
 * Só o editor passa isto: o painel ganha os botões "+ Nova meta / fase / ação" nos lugares onde
 * elas aparecem, e meta, fase e ação passam a ser clicáveis (abrem as configurações ao lado).
 */
export interface EdicaoDoPainel {
  selecao: SelecaoDoCronograma;
  aoSelecionar: (s: SelecaoDoCronograma) => void;
  aoNovaMeta: () => void;
  aoNovaFase: () => void;
  aoNovaAcao: (fase: string) => void;
  rotulos: { novaMeta: string; novaFase: string; novaAcao: string; editar: string };
  /** Arrastou a barra de uma ação na linha do tempo: grava as novas semanas (com Ctrl+Z). */
  aoAlterarSemanas?: (
    item: ItemDoCronograma,
    semanas: { semana_inicio: number; semana_fim: number },
  ) => Promise<unknown> | unknown;
}

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

/** Lembra se o último gesto foi um arraste da janela (o clique que sobra dele não seleciona nada). */
function useMarcaDeArraste() {
  const ref = useRef(false);
  return useMemo(
    () => ({
      marcar: (v: boolean) => {
        ref.current = v;
      },
      consumir: () => {
        const v = ref.current;
        ref.current = false;
        return v;
      },
    }),
    [],
  );
}

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
  edicao,
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
  edicao?: EdicaoDoPainel;
}) {
  const visiveis = itens.filter((i) => !i.arquivado);
  const feitas = visiveis.filter((i) => i.status === "concluido").length;
  const andando = visiveis.filter((i) => i.status === "andamento").length;
  const aFazer = visiveis.length - feitas - andando;

  // Depois de arrastar a linha do tempo, o clique que o navegador solta não é seleção.
  const houveArraste = useMarcaDeArraste();

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

  /** As propriedades de um item clicável no modo de edição (vazio fora dele). */
  const editavel = (selecao: Exclude<SelecaoDoCronograma, null>) => {
    if (!edicao) return {};
    const atual = edicao.selecao;
    const ativo =
      atual !== null &&
      atual.tipo === selecao.tipo &&
      ("id" in atual && "id" in selecao
        ? atual.id === selecao.id
        : "nome" in atual && "nome" in selecao && atual.nome === selecao.nome);
    const abrir = () => {
      if (houveArraste.consumir()) return;
      edicao.aoSelecionar(selecao);
    };
    return {
      role: "button" as const,
      tabIndex: 0,
      "aria-label": edicao.rotulos.editar,
      "aria-pressed": ativo,
      "data-editavel": "",
      onClick: abrir,
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrir();
        }
      },
      className: `${css.editavel} ${ativo ? css.selecionado : ""}`,
    };
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
          {metas.length === 0 && !edicao ? (
            <p className={css.vazio}>{rotulos.nenhumaMeta}</p>
          ) : (
            <div className={css.metas}>
              {metas.map((m) => {
                const leitura = leituraDaMeta(m);
                const p = leitura?.barra ?? null;
                const ruim = leitura?.bom === false;
                const ed = editavel({ tipo: "meta", id: m.id });
                const { className: classeEd, ...restoEd } = ed as { className?: string };
                return (
                  <div key={m.id} className={`${css.meta} ${classeEd ?? ""}`} {...restoEd}>
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
                            className={`${css.progressoBarra} ${
                              corDaBarraDaMeta(p) === "vermelha"
                                ? css.progressoBarraRuim
                                : corDaBarraDaMeta(p) === "amarela"
                                  ? css.progressoBarraAmarela
                                  : css.progressoBarraCheia
                            }`}
                            style={{ width: `${p}%` }}
                          />
                        </div>
                        <span
                          className={`${css.progressoPct} ${
                            leitura?.menorEMelhor && leitura.variacao !== null
                              ? ruim
                                ? css.pctRuim
                                : css.pctBom
                              : ""
                          }`}
                        >
                          {leitura?.menorEMelhor && leitura.variacao !== null
                            ? `${leitura.variacao > 0 ? "+" : ""}${leitura.variacao}%`
                            : `${p}%`}
                        </span>
                      </div>
                    ) : null}
                    {leitura?.menorEMelhor && leitura.reduzir ? (
                      <div className={css.metaDescricao}>
                        {`Reduzir ${leitura.reduzir}% para bater a meta`}
                      </div>
                    ) : null}
                    {m.descricao ? <div className={css.metaDescricao}>{m.descricao}</div> : null}
                  </div>
                );
              })}
              {edicao ? (
                <button
                  type="button"
                  data-sem-imagem=""
                  className={css.novo}
                  onClick={edicao.aoNovaMeta}
                >
                  + {edicao.rotulos.novaMeta}
                </button>
              ) : null}
            </div>
          )}
        </section>

        {fases.length > 0 || edicao ? (
          <section className={css.painel} aria-label={rotulos.fase}>
            <ol className={css.fases}>
              {fases.map((f, k) => {
                const ed = editavel({ tipo: "fase", nome: f.nome }) as { className?: string };
                const { className: classeEd, ...restoEd } = ed;
                return (
                  <li
                    key={f.nome}
                    {...restoEd}
                    className={[
                      css.fase,
                      f.situacao === "ativa" ? css.faseAtiva : "",
                      f.situacao === "feita" ? css.faseFeita : "",
                      classeEd ?? "",
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
                );
              })}
              {edicao ? (
                <li className={css.fase} style={{ background: "transparent", clipPath: "none" }}>
                  <button
                    type="button"
                    data-sem-imagem=""
                    className={css.novo}
                    onClick={edicao.aoNovaFase}
                  >
                    + {edicao.rotulos.novaFase}
                  </button>
                </li>
              ) : null}
            </ol>
          </section>
        ) : null}

        <section className={`${css.painel} ${css.rolagem}`} aria-label={rotulos.caminho}>
          <h3 className={css.secao}>{rotulos.caminho}</h3>
          {visiveis.length === 0 ? (
            <>
              <p className={css.vazio}>{rotulos.nenhumaAcao}</p>
              {edicao ? (
                <button
                  type="button"
                  data-sem-imagem=""
                  className={css.novo}
                  onClick={() => edicao.aoNovaAcao("")}
                >
                  + {edicao.rotulos.novaAcao}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <LinhaDoTempoDoCronograma
                grupos={grupos}
                dataInicio={config.data_inicio}
                hoje={chaveDoDia(agora ?? new Date(), FUSO_DO_CRONOGRAMA)}
                semanaAtual={semanaAtual}
                rotulos={{
                  acao: rotulos.acao,
                  hoje: rotulos.hoje,
                  dia: rotulos.dia,
                  semana: rotulos.semanas,
                  semanaCurta: rotulos.semanaCurta,
                  arraste: rotulos.arraste,
                }}
                linhaProps={(alvo) =>
                  editavel(alvo.tipo === "acao" ? alvo : { tipo: "fase", nome: alvo.nome })
                }
                aoAlterarSemanas={edicao?.aoAlterarSemanas}
                marcarArraste={houveArraste.marcar}
                rodape={(fase) =>
                  edicao ? (
                    <button
                      type="button"
                      data-sem-imagem=""
                      className={`${css.novo} ${css.novoPequeno}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        edicao.aoNovaAcao(fase);
                      }}
                    >
                      + {edicao.rotulos.novaAcao}
                    </button>
                  ) : null
                }
              />
              {edicao ? (
                <div style={{ padding: "14px 0 4px" }}>
                  <button
                    type="button"
                    data-sem-imagem=""
                    className={css.novo}
                    onClick={() => edicao.aoNovaAcao("")}
                  >
                    + {edicao.rotulos.novaAcao}
                  </button>
                </div>
              ) : null}
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
                {t.item_id && visiveis.find((i) => i.id === t.item_id) ? (
                  <span className={css.etiqueta}>
                    {visiveis.find((i) => i.id === t.item_id)!.acao}
                  </span>
                ) : null}
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
        {rotulos.semana} <b className={css.tituloData}>{periodoDaSemana(inicioDaSemana)}</b>
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
