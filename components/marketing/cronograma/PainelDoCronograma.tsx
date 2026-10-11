import type { CSSProperties } from "react";

import css from "@/components/marketing/cronograma/Cronograma.module.css";
import {
  diaMes,
  fasesDoCronograma,
  periodoDaSemana,
  progressoDaMeta,
  segundaDaSemana,
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
 * Ordem da página: onde queremos chegar (metas) → o caminho (fases e ações, em ordem lógica,
 * com o que já foi feito, o que está andando e o que vem) → a semana (tarefas da agência e do
 * cliente).
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
  resumo: (feitas: number, andando: number, aFazer: number) => string;
  alvo: string;
  atual: string;
}

const CLASSE_DA_SITUACAO: Record<SituacaoDaTarefa, string> = {
  feita: css.pontoFeita!,
  andamento: css.pontoAndamento!,
  a_fazer: css.pontoFazer!,
  atrasada: css.pontoFazer!,
  cancelada: css.pontoFazer!,
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
}: {
  vista: "geral" | "semana";
  config: ConfigDoCronograma;
  itens: readonly ItemDoCronograma[];
  metas: readonly MetaDoCronograma[];
  tarefas: readonly TarefaDoCronograma[];
  /** A segunda-feira da semana mostrada na vista "semana". */
  inicioDaSemana: string;
  /** Que semana do cronograma é a de hoje (1…n), se cair dentro dele. */
  semanaAtual: number | null;
  rotulos: RotulosDoCronograma;
  /** A agência vê quantas vezes o prazo foi empurrado; o cliente não precisa dessa conta. */
  mostrarAdiamentos: boolean;
  agora?: Date;
}) {
  const semanas = config.total_semanas;
  const fases = fasesDoCronograma(itens, semanaAtual);
  const feitas = itens.filter((i) => i.status === "concluido").length;
  const andando = itens.filter((i) => i.status === "andamento").length;
  const aFazer = itens.length - feitas - andando;

  const estiloDaGrade = { "--semanas": semanas } as CSSProperties;

  // Itens agrupados por fase, na ordem em que a primeira aparece; sem fase vão ao fim.
  const grupos: Array<{ nome: string; itens: ItemDoCronograma[] }> = [];
  for (const i of itens) {
    const nome = i.fase.trim();
    const g = grupos.find((x) => x.nome === nome);
    if (g) g.itens.push(i);
    else grupos.push({ nome, itens: [i] });
  }
  grupos.sort((a, b) => Number(a.nome === "") - Number(b.nome === ""));

  if (vista === "geral") {
    return (
      <div className={css.tema}>
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
                const p = progressoDaMeta(m.alvo, m.atual);
                return (
                  <div key={m.id} className={css.meta}>
                    <p className={css.metaTitulo}>{m.titulo}</p>
                    <div className={css.metaAlvo}>{m.alvo || "—"}</div>
                    {m.atual ? (
                      <div className={css.metaAtual}>
                        {rotulos.atual}: {m.atual}
                      </div>
                    ) : null}
                    {p !== null ? (
                      <div className={css.progresso} aria-label={`${p}%`}>
                        <div className={css.progressoBarra} style={{ width: `${p}%` }} />
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
          {itens.length === 0 ? (
            <p className={css.vazio}>{rotulos.nenhumaAcao}</p>
          ) : (
            <div className={css.grade} style={estiloDaGrade}>
              <div className={css.cabeca}>
                <div />
                {Array.from({ length: semanas }, (_, k) => {
                  const n = k + 1;
                  return (
                    <div
                      key={n}
                      className={`${css.semana} ${semanaAtual === n ? css.semanaHoje : ""}`}
                    >
                      {rotulos.semanaCurta}
                      {n}
                      {config.data_inicio ? (
                        <span className={css.semanaData}>
                          {diaMes(segundaDaSemana(config.data_inicio, n))}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {grupos.map((g) => (
                <div key={g.nome || "sem-fase"} style={{ display: "contents" }}>
                  {g.nome ? <div className={css.grupo}>{g.nome}</div> : null}
                  {g.itens.map((i) => {
                    const ini = Math.max(1, Math.min(i.semana_inicio, semanas));
                    const fim = Math.max(ini, Math.min(i.semana_fim, semanas));
                    const estado =
                      i.status === "concluido"
                        ? css.barraFeita
                        : i.status === "andamento" || i.destaque
                          ? css.barraAndamento
                          : "";
                    return (
                      <div key={i.id} className={css.linha}>
                        <div className={css.acao}>
                          {i.acao}
                          {i.notas ? <div className={css.acaoNotas}>{i.notas}</div> : null}
                        </div>
                        <div className={css.trilho}>
                          <div
                            className={`${css.barra} ${estado}`}
                            style={{ gridColumn: `${ini} / span ${fim - ini + 1}` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          <div className={css.legenda}>
            <span className={css.legendaItem}>
              <span className={`${css.amostra} ${css.barraFeita}`} /> {rotulos.concluido}
            </span>
            <span className={css.legendaItem}>
              <span className={`${css.amostra} ${css.barraAndamento}`} /> {rotulos.andamento}
            </span>
            <span className={css.legendaItem}>
              <span className={`${css.amostra} ${css.barra}`} /> {rotulos.planejado}
            </span>
            {itens.length > 0 ? (
              <span style={{ marginLeft: "auto" }}>{rotulos.resumo(feitas, andando, aFazer)}</span>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  // Vista da semana: as tarefas, da agência e do cliente.
  const agencia = tarefas.filter((t) => t.lado === "agencia");
  const cliente = tarefas.filter((t) => t.lado === "cliente");
  const etiqueta = (t: TarefaDoCronograma) => {
    const s = situacaoDaTarefa(t, agora);
    return s === "feita"
      ? rotulos.feita
      : s === "andamento"
        ? rotulos.andamento
        : s === "atrasada"
          ? rotulos.atrasada
          : rotulos.aFazer;
  };
  const prazo = (t: TarefaDoCronograma) => {
    if (!t.due_date) return "";
    return diaMes(new Date(t.due_date).toISOString().slice(0, 10));
  };
  const bloco = (titulo: string, lista: TarefaDoCronograma[]) =>
    lista.length === 0 ? null : (
      <div className={css.grupoTarefas}>
        <div className={css.grupoTitulo}>{titulo}</div>
        {lista.map((t) => (
          <div key={t.id} className={css.tarefa}>
            <span className={`${css.ponto} ${CLASSE_DA_SITUACAO[situacaoDaTarefa(t, agora)]}`} />
            <span className={css.tarefaTexto}>
              {t.title}
              {mostrarAdiamentos && t.adiamentos > 0 ? (
                <span className={css.tarefaAdiada}>
                  {rotulos.adiada} {t.adiamentos}x
                </span>
              ) : null}
            </span>
            <span className={css.tarefaEtiqueta}>{etiqueta(t)}</span>
            {prazo(t) ? <span className={css.tarefaPrazo}>{prazo(t)}</span> : null}
          </div>
        ))}
      </div>
    );

  return (
    <div className={css.tema}>
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
