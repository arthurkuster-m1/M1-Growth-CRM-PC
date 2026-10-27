"use client";

import { SeletorDeHora } from "@/components/motor/SeletorDeHora";
import { useState } from "react";

import {
  GradeDeNumeros,
  Kpi,
  Painel,
  TabelaDeDados,
  Variacao,
  inteiro,
  pct,
  GradeDeKpis,
} from "@/components/dashboards/base";
import { useT } from "@/hooks/i18n/useT";
import { formatarMinutos } from "@/lib/dashboards/atendimento";
import { useAtritoMetrics } from "@/hooks/metrics/useAtritoMetrics";
import { formatarMedida, type Medida } from "@/lib/metrics/atrito";
import { cn } from "@/lib/utils";

interface Resumo {
  iniciadas: number;
  respondidas: number;
  tempoMedio: number | null;
  tempoMediana: number | null;
  noPrazoPct: number | null;
  foraDoHorarioPct: number | null;
  duracaoMedia: number | null;
  resolvidas: number;
  ia: number;
  passouParaHumano: number;
}

/** O que a rota `/api/v1/dashboards/atendimento` devolve. */
export interface DadosDeAtendimento {
  horario: { inicio: string; fim: string; dias: number[] };
  atual: Resumo;
  anterior: Resumo;
  atendentes: Array<{
    nome: string;
    conversas: number;
    respondidas: number;
    tempoMedio: number | null;
    noPrazoPct: number | null;
    /** Negócios ganhos e perdidos no período; ausentes na linha da IA e em "sem responsável". */
    ganhos?: number | null;
    perdidos?: number | null;
  }>;
  calor: number[][];
  parados24h: number;
  parados7d: number;
  lista: Array<{
    conversa_id: string;
    contato_id: string | null;
    nome: string;
    canal: string;
    responsavel: string;
    horas: number;
  }>;
  podeEditarHorario: boolean;
}

/**
 * Números do Índice de Atrito (página Desempenho) que dizem se o atendimento funciona de verdade, em
 * três painéis: o atrito em si (silêncio, repetição depois da passagem, espera na fila humana), a
 * automação (quanto a IA resolve) e a insistência do agente com as demandas sem próximo passo.
 * Seguem o período do dashboard; sem dado, mostram "—".
 */
function AtritoDoAtendimento({ periodo }: { periodo?: { de: string; ate: string } }) {
  const t = useT();
  const { data, isLoading, isError } = useAtritoMetrics(periodo);
  if (isError) return null;
  const pares = data?.data.pares ?? [];
  const par = (chave: string) => pares.find((p) => p.chave === chave);
  // Eficiência e danos de um par, achados pela chave da medida.
  const medida = (chaveDoPar: string, chave: string): Medida | undefined => {
    const p = par(chaveDoPar);
    if (!p) return undefined;
    return p.eficiencia.chave === chave ? p.eficiencia : p.danos.find((m) => m.chave === chave);
  };
  type Item = { rotulo: string; m: Medida | undefined };
  const grupos: Array<{ titulo: string; nota: string; itens: Item[] }> = [
    {
      titulo: t("Atrito do atendimento"),
      nota: t("O que o cliente sente além da velocidade"),
      itens: [
        { rotulo: t("Conversas que morreram no silêncio"), m: medida("conversao", "taxa_de_abandono") },
        {
          rotulo: t("Repetiram depois da passagem para humano"),
          m: medida("automacao", "repeticao_pos_passagem"),
        },
        {
          rotulo: t("Espera na fila humana (mediana)"),
          m: medida("custo_humano", "espera_humana_p50_s"),
        },
      ],
    },
    {
      titulo: t("Automação"),
      nota: t("Quanto a IA realmente resolve"),
      itens: [
        { rotulo: t("Respostas dadas pelo agente"), m: medida("automacao", "taxa_automacao") },
        { rotulo: t("Passagens para humano"), m: medida("automacao", "pedidos_de_humano") },
        {
          rotulo: t("Respostas humanas fora do sistema"),
          m: medida("automacao", "taxa_de_contorno"),
        },
        {
          rotulo: t("Perguntas que a pessoa teve de repetir"),
          m: medida("automacao", "taxa_de_repergunta"),
        },
      ],
    },
    {
      titulo: t("Insistência e demandas abertas"),
      nota: t("O custo de o agente voltar ao cliente e o que ficou sem dono"),
      itens: [
        {
          rotulo: t("Insistência do agente (média de retornos)"),
          m: medida("conversao", "insistencia_media"),
        },
        { rotulo: t("Insistência no pior caso"), m: medida("conversao", "insistencia_max") },
        {
          rotulo: t("Demandas abertas sem próximo passo"),
          m: medida("custo_humano", "demandas_sem_proximo_passo"),
        },
      ],
    },
  ];
  return (
    <>
      {grupos.map((g) => (
        <Painel key={g.titulo} titulo={g.titulo} nota={g.nota}>
          {isLoading ? (
            <div className="h-16 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
          ) : (
            <>
              <GradeDeNumeros
                itens={g.itens.map((i) => ({
                  rotulo: i.rotulo,
                  valor: i.m ? formatarMedida(i.m) : "—",
                }))}
              />
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {g.itens.map((i) =>
                  i.m?.nota ? (
                    <li key={i.rotulo}>
                      <span className="font-medium">{i.rotulo}:</span> {i.m.nota}
                    </li>
                  ) : null,
                )}
              </ul>
            </>
          )}
        </Painel>
      ))}
    </>
  );
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function tempoParado(horas: number): string {
  return horas >= 48 ? `${Math.round(horas / 24)} dias` : `${horas} h`;
}

/**
 * ATENDIMENTO: velocidade e cobertura. O relógio de resposta respeita o horário de atendimento da
 * empresa: mensagem fora do horário só começa a contar na abertura, e o prazo é 1 hora.
 */
export function Atendimento({
  dados,
  aoSalvarHorario,
  periodo,
  podeVerAtrito = false,
}: {
  dados: DadosDeAtendimento;
  aoSalvarHorario: (h: { inicio: string; fim: string; dias: number[] }) => Promise<void>;
  /** O período escolhido no topo do dashboard (`YYYY-MM-DD`): o atrito segue ele. */
  periodo?: { de: string; ate: string };
  /** O atrito é de quem atende (agente ou acima): abaixo disso o painel nem aparece. */
  podeVerAtrito?: boolean;
}) {
  const t = useT();
  const [inicio, setInicio] = useState(dados.horario.inicio);
  const [fim, setFim] = useState(dados.horario.fim);
  const [dias, setDias] = useState<number[]>(dados.horario.dias);
  const [salvando, setSalvando] = useState(false);
  const mudou =
    inicio !== dados.horario.inicio ||
    fim !== dados.horario.fim ||
    JSON.stringify(dias) !== JSON.stringify(dados.horario.dias);
  const maximo = Math.max(1, ...dados.calor.flat());
  const a = dados.atual;
  const p = dados.anterior;
  const respondidasPct = a.iniciadas > 0 ? (a.respondidas / a.iniciadas) * 100 : null;
  const respondidasPctAnt = p.iniciadas > 0 ? (p.respondidas / p.iniciadas) * 100 : null;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 text-sm">
        <span className="font-medium">{t("Horário de atendimento")}</span>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t("Das")}
          <SeletorDeHora
            rotulo={t("Das")}
            valor={inicio}
            desabilitado={!dados.podeEditarHorario}
            aoMudar={setInicio}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t("às")}
          <SeletorDeHora
            rotulo={t("às")}
            valor={fim}
            desabilitado={!dados.podeEditarHorario}
            aoMudar={setFim}
          />
        </label>
        <div className="flex items-center gap-1" role="group" aria-label={t("Dias de atendimento")}>
          {DIAS.map((d, i) => (
            <button
              key={d}
              type="button"
              disabled={!dados.podeEditarHorario}
              aria-pressed={dias.includes(i)}
              onClick={() =>
                setDias((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i].sort()))
              }
              className={cn(
                "h-8 w-9 rounded-lg border text-xs font-medium",
                dias.includes(i)
                  ? "border-primary bg-primary/10 text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {d}
            </button>
          ))}
        </div>
        {dados.podeEditarHorario && mudou ? (
          <button
            type="button"
            disabled={salvando || dias.length === 0 || inicio >= fim}
            onClick={async () => {
              setSalvando(true);
              try {
                await aoSalvarHorario({ inicio, fim, dias });
              } finally {
                setSalvando(false);
              }
            }}
            className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {salvando ? t("Salvando…") : t("Salvar horário")}
          </button>
        ) : null}
        <span className="w-full text-xs text-muted-foreground">
          {t(
            "Resposta no prazo = até 1 hora depois da mensagem, ou depois da abertura do horário se ela chegou fora dele.",
          )}
        </span>
      </div>

      <GradeDeKpis className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Kpi
          rotulo={t("Conversas iniciadas")}
          valor={inteiro(a.iniciadas)}
          variacao={<Variacao atual={a.iniciadas} anterior={p.iniciadas} />}
          apoio={t("No período, todos os canais")}
        />
        <Kpi
          rotulo={t("Conversas respondidas")}
          valor={inteiro(a.respondidas)}
          variacao={<Variacao atual={respondidasPct} anterior={respondidasPctAnt} />}
          apoio={`${respondidasPct === null ? "—" : pct(respondidasPct)} ${t("do total")}`}
        />
        <Kpi
          rotulo={t("Tempo médio de 1ª resposta")}
          valor={formatarMinutos(a.tempoMedio)}
          destaque
          variacao={<Variacao atual={a.tempoMedio} anterior={p.tempoMedio} menorEMelhor />}
          apoio={`${t("Mediana")} ${formatarMinutos(a.tempoMediana)}`}
        />
        <Kpi
          rotulo={t("Respostas no prazo (SLA)")}
          valor={a.noPrazoPct === null ? "—" : pct(a.noPrazoPct)}
          destaque
          variacao={<Variacao atual={a.noPrazoPct} anterior={p.noPrazoPct} />}
          apoio={t("Até 1 h do início do horário")}
          meta={
            a.noPrazoPct === null
              ? undefined
              : { progresso: a.noPrazoPct, rotulo: t("Quanto mais perto de 100%, melhor") }
          }
        />
        <Kpi
          rotulo={t("Leads > 24 h sem resposta")}
          valor={inteiro(dados.parados24h)}
          apoio={t("Conversas abertas, última mensagem do lead")}
        />
        <Kpi
          rotulo={t("Leads > 7 dias sem resposta")}
          valor={inteiro(dados.parados7d)}
          apoio={t("Risco de perda")}
        />
      </GradeDeKpis>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Painel titulo={t("Por atendente")} nota={t("Volume, velocidade, prazo e resultado")}>
          {dados.atendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Nenhuma conversa no período.")}</p>
          ) : (
            <TabelaDeDados
              colunas={[
                { titulo: t("Atendente") },
                { titulo: t("Conversas") },
                { titulo: t("Respondidas") },
                { titulo: t("Tempo médio") },
                { titulo: t("No prazo") },
                { titulo: t("Ganhos") },
                { titulo: t("Perdidos") },
              ]}
              linhas={dados.atendentes.map((x) => [
                x.nome,
                inteiro(x.conversas),
                inteiro(x.respondidas),
                formatarMinutos(x.tempoMedio),
                x.noPrazoPct === null ? (
                  "—"
                ) : (
                  <span
                    key="s"
                    className={cn(
                      "font-medium",
                      x.noPrazoPct >= 90
                        ? "text-green-600"
                        : x.noPrazoPct >= 70
                          ? "text-amber-600"
                          : "text-red-600",
                    )}
                  >
                    {pct(x.noPrazoPct, 0)}
                  </span>
                ),
                x.ganhos == null ? "—" : inteiro(x.ganhos),
                x.perdidos == null ? "—" : inteiro(x.perdidos),
              ])}
            />
          )}
        </Painel>

        <Painel titulo={t("Tempo geral")} nota={t("Da abertura à resolução")}>
          <GradeDeNumeros
            itens={[
              {
                rotulo: t("Conversa até resolver"),
                valor: formatarMinutos(a.duracaoMedia),
                destaque: true,
              },
              { rotulo: t("1ª resposta (média)"), valor: formatarMinutos(a.tempoMedio) },
              { rotulo: t("Resolvidas"), valor: inteiro(a.resolvidas) },
              {
                rotulo: t("Fora do horário"),
                valor: a.foraDoHorarioPct === null ? "—" : pct(a.foraDoHorarioPct),
              },
              { rotulo: t("Com a IA"), valor: inteiro(a.ia) },
              { rotulo: t("Passou para humano"), valor: inteiro(a.passouParaHumano) },
            ]}
          />
        </Painel>
      </div>

      {podeVerAtrito ? <AtritoDoAtendimento periodo={periodo} /> : null}

      <Painel titulo={t("Quando chegam as conversas")} nota={t("Dia da semana × hora (08h–20h)")}>
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[30rem] gap-1"
            style={{ gridTemplateColumns: "3rem repeat(12, minmax(0,1fr))" }}
          >
            <span />
            {Array.from({ length: 12 }, (_, h) => (
              <span key={h} className="text-center text-[10px] text-muted-foreground">
                {8 + h}h
              </span>
            ))}
            {dados.calor.map((linha, d) => (
              <div key={d} className="contents">
                <span className="self-center text-xs text-muted-foreground">{DIAS[d]}</span>
                {linha.map((v, h) => (
                  <span
                    key={h}
                    title={`${DIAS[d]} ${8 + h}h: ${v}`}
                    className="h-7 rounded-md"
                    style={{
                      background: `color-mix(in oklab, var(--primary) ${
                        v === 0 ? 0 : Math.round((v / maximo) * 90) + 6
                      }%, var(--secondary))`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Painel>

      <Painel
        titulo={t("Leads esperando resposta")}
        nota={t("Mais de 24 horas, os mais antigos primeiro")}
      >
        {dados.lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {dados.parados24h > 0
              ? t("A lista nominal é para quem atende (agente ou acima).")
              : t("Nenhum lead esperando resposta há mais de 24 horas.")}
          </p>
        ) : (
          <TabelaDeDados
            colunas={[
              { titulo: t("Lead") },
              { titulo: t("Canal"), alinhar: "left" },
              { titulo: t("Responsável"), alinhar: "left" },
              { titulo: t("Sem resposta há") },
            ]}
            linhas={dados.lista.map((l) => [
              l.contato_id ? (
                <a
                  key={l.conversa_id}
                  href={`/app/contacts/${l.contato_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {l.nome}
                </a>
              ) : (
                l.nome
              ),
              l.canal,
              l.responsavel,
              <span
                key="p"
                className={cn("font-medium", l.horas >= 168 ? "text-red-600" : "text-amber-600")}
              >
                {tempoParado(l.horas)}
              </span>,
            ])}
          />
        )}
      </Painel>
    </div>
  );
}
