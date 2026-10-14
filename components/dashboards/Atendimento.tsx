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
} from "@/components/dashboards/base";
import {
  ATENDENTES_DE_EXEMPLO,
  LEADS_PARADOS_DE_EXEMPLO,
  calorDeExemplo,
} from "@/components/dashboards/exemplo";
import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * ATENDIMENTO: velocidade e cobertura. O relógio de resposta respeita o horário de atendimento da
 * empresa: uma conversa que chega fora do horário conta a partir da abertura, e o prazo é 1 hora.
 */
export function Atendimento() {
  const t = useT();
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("18:00");
  const calor = calorDeExemplo();
  const maximo = Math.max(...calor.flat());

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 text-sm">
        <span className="font-medium">{t("Horário de atendimento")}</span>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t("Das")}
          <input
            type="time"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t("às")}
          <input
            type="time"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
          />
        </label>
        <span className="text-xs text-muted-foreground">
          {t("Resposta no prazo = até 1 hora depois do início do horário (ou da mensagem, dentro do horário).")}
        </span>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Kpi
          rotulo={t("Conversas iniciadas")}
          valor={inteiro(413)}
          variacao={<Variacao atual={413} anterior={377} />}
          apoio={t("No período, todos os canais")}
        />
        <Kpi
          rotulo={t("Conversas respondidas")}
          valor={inteiro(398)}
          variacao={<Variacao atual={96.4} anterior={93.1} />}
          apoio={`${pct(96.4)} ${t("do total")}`}
        />
        <Kpi
          rotulo={t("Tempo médio de 1ª resposta")}
          valor="11 min"
          destaque
          variacao={<Variacao atual={11} anterior={15} menorEMelhor />}
          apoio={`${t("Mediana")} 4 min`}
        />
        <Kpi
          rotulo={t("Respostas no prazo (SLA)")}
          valor={pct(87.2)}
          destaque
          variacao={<Variacao atual={87.2} anterior={82} />}
          apoio={t("Até 1 h do início do horário")}
          meta={{ progresso: 87, rotulo: t("Meta: 90% (exemplo)") }}
        />
        <Kpi
          rotulo={t("Leads > 24 h sem resposta")}
          valor={inteiro(7)}
          variacao={<Variacao atual={7} anterior={11} menorEMelhor />}
          apoio={t("Abertos, última mensagem do lead")}
        />
        <Kpi
          rotulo={t("Leads > 7 dias sem resposta")}
          valor={inteiro(2)}
          variacao={<Variacao atual={2} anterior={2} menorEMelhor />}
          apoio={t("Risco de perda")}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Painel titulo={t("Por atendente")} nota={t("Volume, velocidade e resultado")}>
          <TabelaDeDados
            colunas={[
              { titulo: t("Atendente") },
              { titulo: t("Conversas") },
              { titulo: t("Respondidas") },
              { titulo: t("Tempo médio") },
              { titulo: t("No prazo") },
              { titulo: t("Vendas") },
            ]}
            linhas={ATENDENTES_DE_EXEMPLO.map((a) => [
              a.nome,
              inteiro(a.conversas),
              inteiro(a.respondidas),
              a.tempo,
              <span
                key="s"
                className={cn(
                  "font-medium",
                  a.sla >= 90 ? "text-green-600" : a.sla >= 70 ? "text-amber-600" : "text-red-600",
                )}
              >
                {a.sla}%
              </span>,
              inteiro(a.vendas),
            ])}
          />
        </Painel>

        <Painel titulo={t("Tempo geral")} nota={t("Da abertura à resolução")}>
          <GradeDeNumeros
            itens={[
              { rotulo: t("Conversa até resolver"), valor: "1 d 4 h", destaque: true },
              { rotulo: t("1ª resposta (média)"), valor: "11 min" },
              { rotulo: t("Resposta ao longo da conversa"), valor: "7 min" },
              { rotulo: t("Fora do horário"), valor: pct(18.5) },
              { rotulo: t("IA resolveu sozinha"), valor: pct(34) },
              { rotulo: t("Passou para humano"), valor: inteiro(61) },
            ]}
          />
        </Painel>
      </div>

      <Painel titulo={t("Quando chegam as conversas")} nota={t("Dia da semana × hora (08h–20h)")}>
        <div className="overflow-x-auto">
          <div className="grid min-w-[30rem] gap-1" style={{ gridTemplateColumns: "3rem repeat(12, minmax(0,1fr))" }}>
            <span />
            {Array.from({ length: 12 }, (_, h) => (
              <span key={h} className="text-center text-[10px] text-muted-foreground">
                {8 + h}h
              </span>
            ))}
            {calor.map((linha, d) => (
              <div key={d} className="contents">
                <span className="self-center text-xs text-muted-foreground">{DIAS[d]}</span>
                {linha.map((v, h) => (
                  <span
                    key={h}
                    title={`${DIAS[d]} ${8 + h}h: ${v}`}
                    className="h-7 rounded-md"
                    style={{
                      background: `color-mix(in oklab, var(--primary) ${Math.round((v / maximo) * 90) + 6}%, var(--secondary))`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Painel>

      <Painel titulo={t("Leads esperando resposta")} nota={t("Abrir o lead e responder")}>
        <TabelaDeDados
          colunas={[
            { titulo: t("Lead") },
            { titulo: t("Canal"), alinhar: "left" },
            { titulo: t("Responsável"), alinhar: "left" },
            { titulo: t("Sem resposta há") },
          ]}
          linhas={LEADS_PARADOS_DE_EXEMPLO.map((l) => [
            l.nome,
            l.canal,
            l.dono,
            <span
              key="p"
              className={cn(
                "font-medium",
                l.parado.includes("dias") ? "text-red-600" : "text-amber-600",
              )}
            >
              {l.parado}
            </span>,
          ])}
        />
      </Painel>
    </div>
  );
}
