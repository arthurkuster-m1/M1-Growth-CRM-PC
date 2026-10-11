"use client";

import type { ReactNode } from "react";

import { rotuloDaMetrica } from "@/components/marketing/campanhas/rotulos";
import { useT } from "@/hooks/i18n/useT";
import type { CampanhaDeDemanda } from "@/lib/marketing/campanhas";
import {
  METRICAS_DO_CANAL,
  resumoDaCampanha,
  somaDoExtra,
  type Alerta,
  type DiaDaCampanha,
} from "@/lib/marketing/campanhas-resumo";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { cn } from "@/lib/utils";

const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const decimal = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function Numero({
  rotulo,
  valor,
  destaque,
  tom,
}: {
  rotulo: string;
  valor: string | null;
  destaque?: boolean;
  tom?: "bom" | "ruim";
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{rotulo}</p>
      <p
        className={cn(
          "font-semibold tabular-nums",
          destaque ? "text-xl" : "text-base",
          tom === "bom" && "text-success-fg",
          tom === "ruim" && "text-error-fg",
          valor === null && "text-muted-foreground",
        )}
      >
        {valor ?? "—"}
      </p>
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function textoDoAlerta(t: (s: string) => string, a: Alerta): string {
  switch (a.codigo) {
    case "sem_periodo":
      return t("Defina início e fim da campanha para ver o pace de gastos e de leads.");
    case "orcamento_estourado":
      return t("O investido passou do orçamento líquido da campanha.");
    case "aumentar_orcamento":
      return `${t("Aumentar o orçamento diário para")} ${moedaDoNumero(a.valor ?? 0)}.`;
    case "testar_criativos":
      return t("Testar novos criativos: o CTR está baixo.");
    case "conexao_da_lp":
      return t("Verificar a conexão da LP: muita gente clica e não carrega a página.");
    case "verificar_lp":
      return t("Verificar a LP: poucas visitas viram lead.");
    case "cpl_acima_da_meta":
      return t("O CPL está acima da meta.");
    case "leads_atrasados":
      return `${t("Leads atrasados em relação à meta de hoje:")} ${inteiro(a.valor ?? 0)}.`;
    case "no_ritmo":
      return t("Tudo no ritmo: nenhum alerta por enquanto.");
  }
}

/**
 * O RESUMO da campanha: a parte de cima da planilha — período, investimento, metas de leads,
 * pace de gastos, funil completo e o que fazer agora. Recalcula a cada dia digitado.
 */
export function ResumoDaCampanha({
  c,
  dias,
  hoje,
}: {
  c: CampanhaDeDemanda;
  dias: DiaDaCampanha[];
  hoje: string;
}) {
  const t = useT();
  const r = resumoDaCampanha(c, dias, hoje);
  const dinheiro = (n: number | null) => (n === null ? null : moedaDoNumero(n));
  const trafego = c.channel === "trafego_pago";
  const progresso = r.periodo ? Math.round((r.periodo.passados / r.periodo.totais) * 100) : null;
  const adiant = r.metas.adiantamento;

  return (
    <div className="grid gap-3">
      {r.alertas.length > 0 ? (
        <section className="grid gap-2 rounded-2xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">{t("O que fazer agora")}</h3>
          <ul className="grid gap-1.5">
            {r.alertas.map((a) => (
              <li
                key={a.codigo}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm",
                  a.nivel === "atencao" && "bg-warning-bg text-warning-fg",
                  a.nivel === "ok" && "bg-success-bg text-success-fg",
                  a.nivel === "info" && "bg-secondary text-foreground",
                )}
              >
                {textoDoAlerta(t, a)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Cartao titulo={t("Período e investimento")}>
        <Numero rotulo={t("Dias totais")} valor={r.periodo ? inteiro(r.periodo.totais) : null} />
        <Numero
          rotulo={t("Dias passados")}
          valor={r.periodo ? inteiro(r.periodo.passados) : null}
        />
        <Numero
          rotulo={t("Dias restantes")}
          valor={r.periodo ? inteiro(r.periodo.restantes) : null}
        />
        <Numero rotulo={t("Investimento bruto")} valor={dinheiro(r.investimentoBruto)} />
        <Numero rotulo={t("Investimento líquido")} valor={dinheiro(r.investimentoLiquido)} />
        <Numero rotulo={t("Valor investido")} valor={moedaDoNumero(r.funil.investido)} destaque />
        <Numero
          rotulo={t("Valor restante")}
          valor={dinheiro(r.valorRestante)}
          tom={r.valorRestante !== null && r.valorRestante < 0 ? "ruim" : undefined}
        />
        {progresso !== null ? (
          <div className="col-span-2 self-end sm:col-span-2">
            <div
              className="h-2 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-valuenow={progresso}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("Dias passados")}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${progresso}%` }} />
            </div>
          </div>
        ) : null}
      </Cartao>

      {trafego ? (
        <>
          <Cartao titulo={t("Metas de leads")}>
            <Numero
              rotulo={t("Meta de leads")}
              valor={r.metas.metaDeLeads === null ? null : inteiro(r.metas.metaDeLeads)}
            />
            <Numero rotulo={t("Leads captados")} valor={inteiro(r.metas.captados)} destaque />
            <Numero
              rotulo={t("Faltam")}
              valor={r.metas.faltam === null ? null : inteiro(r.metas.faltam)}
            />
            <Numero rotulo={t("Meta de CPL")} valor={dinheiro(r.metas.metaDeCpl)} />
            <Numero
              rotulo={t("CPL atual")}
              valor={dinheiro(r.funil.cpl)}
              tom={
                r.funil.cpl !== null && r.metas.metaDeCpl !== null
                  ? r.funil.cpl <= r.metas.metaDeCpl
                    ? "bom"
                    : "ruim"
                  : undefined
              }
            />
            <Numero rotulo={t("CPL necessário")} valor={dinheiro(r.metas.cplNecessario)} />
            <Numero
              rotulo={t("Leads por dia (meta)")}
              valor={r.metas.porDia === null ? null : decimal(r.metas.porDia)}
            />
            <Numero
              rotulo={t("Meta para hoje")}
              valor={r.metas.metaParaHoje === null ? null : inteiro(r.metas.metaParaHoje)}
            />
            <Numero
              rotulo={adiant !== null && adiant < 0 ? t("Atrasado em") : t("Adiantado em")}
              valor={adiant === null ? null : inteiro(Math.abs(adiant))}
              tom={adiant === null ? undefined : adiant >= 0 ? "bom" : "ruim"}
            />
            <Numero
              rotulo={t("Nova meta diária")}
              valor={r.metas.novaMetaDiaria === null ? null : decimal(r.metas.novaMetaDiaria)}
            />
          </Cartao>

          <Cartao titulo={t("Pace de gastos")}>
            <Numero rotulo={t("Meta de orçamento diário")} valor={dinheiro(r.pace.metaDiaria)} />
            <Numero rotulo={t("Média atual por dia")} valor={dinheiro(r.pace.mediaAtual)} />
            <Numero
              rotulo={
                r.pace.diferenca !== null && r.pace.diferenca < 0
                  ? t("Acima do previsto")
                  : t("Abaixo do previsto")
              }
              valor={dinheiro(r.pace.diferenca === null ? null : Math.abs(r.pace.diferenca))}
            />
            <Numero
              rotulo={t("Novo orçamento diário")}
              valor={dinheiro(r.pace.novoOrcamentoDiario)}
              destaque
            />
          </Cartao>

          <Cartao titulo={t("Funil completo")}>
            <Numero rotulo={t("Impressões")} valor={inteiro(r.funil.impressoes)} />
            <Numero rotulo={t("Alcance")} valor={inteiro(r.funil.alcance)} />
            <Numero rotulo={t("CPM")} valor={dinheiro(r.funil.cpm)} />
            <Numero rotulo={t("Cliques no link")} valor={inteiro(r.funil.cliques)} />
            <Numero rotulo={t("CPC")} valor={dinheiro(r.funil.cpc)} />
            <Numero rotulo={t("CTR")} valor={r.funil.ctr === null ? null : pct(r.funil.ctr)} />
            <Numero rotulo={t("Visitas à LP")} valor={inteiro(r.funil.visitas)} />
            <Numero rotulo={t("Custo por visita")} valor={dinheiro(r.funil.custoPorVisita)} />
            <Numero
              rotulo={t("Connection rate")}
              valor={r.funil.connectionRate === null ? null : pct(r.funil.connectionRate)}
            />
            <Numero rotulo={t("Leads")} valor={inteiro(r.funil.leads)} />
            <Numero rotulo={t("CPL")} valor={dinheiro(r.funil.cpl)} />
            <Numero
              rotulo={t("Conversão da LP")}
              valor={r.funil.conversaoDaLp === null ? null : pct(r.funil.conversaoDaLp)}
            />
          </Cartao>
        </>
      ) : (
        <FunilDoCanal c={c} dias={dias} leads={r.funil.leads} investido={r.funil.investido} />
      )}
    </div>
  );
}

/** Os canais sem API: os totais de cada etapa e a taxa de uma etapa para a seguinte. */
function FunilDoCanal({
  c,
  dias,
  leads,
  investido,
}: {
  c: CampanhaDeDemanda;
  dias: DiaDaCampanha[];
  leads: number;
  investido: number;
}) {
  const t = useT();
  if (c.channel === "trafego_pago") return null;
  const metricas = METRICAS_DO_CANAL[c.channel];
  const vendas = somaDoExtra(dias, "vendas");
  const valor = somaDoExtra(dias, "valor_total");
  let anterior: number | null = null;
  return (
    <>
      <Cartao titulo={t("Resultado do canal")}>
        <Numero rotulo={t("Valor investido")} valor={moedaDoNumero(investido)} />
        <Numero rotulo={t("Leads")} valor={inteiro(leads)} />
        <Numero
          rotulo={t("Custo por lead")}
          valor={leads > 0 && investido > 0 ? moedaDoNumero(investido / leads) : null}
        />
        <Numero rotulo={t("Vendas")} valor={inteiro(vendas)} />
        <Numero rotulo={t("Valor total")} valor={moedaDoNumero(valor)} />
        <Numero
          rotulo={t("Ticket médio")}
          valor={vendas > 0 ? moedaDoNumero(valor / vendas) : null}
        />
      </Cartao>
      <Cartao titulo={t("Funil do canal")}>
        {metricas
          .filter((m) => m.tipo === "contagem")
          .map((m) => {
            const total = somaDoExtra(dias, m.chave);
            const taxa = anterior !== null && anterior > 0 ? (total / anterior) * 100 : null;
            anterior = total;
            return (
              <Numero
                key={m.chave}
                rotulo={
                  taxa === null
                    ? rotuloDaMetrica(t, m.chave)
                    : `${rotuloDaMetrica(t, m.chave)} (${pct(taxa)})`
                }
                valor={inteiro(total)}
              />
            );
          })}
      </Cartao>
    </>
  );
}
