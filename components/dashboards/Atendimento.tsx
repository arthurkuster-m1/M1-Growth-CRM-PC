"use client";

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
}: {
  dados: DadosDeAtendimento;
  aoSalvarHorario: (h: { inicio: string; fim: string; dias: number[] }) => Promise<void>;
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
          <input
            type="time"
            value={inicio}
            disabled={!dados.podeEditarHorario}
            onChange={(e) => setInicio(e.target.value)}
            className="h-9 rounded-lg border bg-card px-2 text-sm text-foreground"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t("às")}
          <input
            type="time"
            value={fim}
            disabled={!dados.podeEditarHorario}
            onChange={(e) => setFim(e.target.value)}
            className="h-9 rounded-lg border bg-card px-2 text-sm text-foreground"
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
        <Painel titulo={t("Por atendente")} nota={t("Volume, velocidade e prazo")}>
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
