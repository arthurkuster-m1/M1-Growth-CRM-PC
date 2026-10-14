"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  COR_DA_MARCA,
  COR_DO_APOIO,
  GradeDeNumeros,
  Kpi,
  Painel,
  TabelaDeDados,
  Variacao,
  brl,
  dividir,
  inteiro,
  pct,
  vezes,
} from "@/components/dashboards/base";
import { receitaMensalDeExemplo, trafegoDeExemplo } from "@/components/dashboards/exemplo";
import { useT } from "@/hooks/i18n/useT";
import { somarDias } from "@/lib/inicio/datas";

/**
 * BUSINESS: faturamento e saúde da base — o que entrou, o que saiu, CAC, LTV, clientes, tempo até
 * a primeira compra e, para quem vende por recorrência, MRR e churn. Protótipo (D0): dados de
 * exemplo; o "saiu" é só o investimento em mídia até a gestão financeira existir.
 */
export function Business({ de, ate }: { de: string; ate: string }) {
  const t = useT();
  const [mesesAtivo, setMesesAtivo] = useState(6);
  const dias = useMemo(() => trafegoDeExemplo(de, ate, "todas"), [de, ate]);
  const anterior = useMemo(
    () => trafegoDeExemplo(somarDias(de, -dias.length), somarDias(de, -1), "todas"),
    [de, dias.length],
  );
  const soma = (l: typeof dias, k: "recebido" | "investimento" | "vendas" | "leads") =>
    l.reduce((s, d) => s + d[k], 0);

  const recebido = soma(dias, "recebido");
  const saiu = soma(dias, "investimento");
  const vendas = soma(dias, "vendas");
  const recebidoAnt = soma(anterior, "recebido");
  const saiuAnt = soma(anterior, "investimento");
  const lucro = recebido - saiu;
  const lucroAnt = recebidoAnt - saiuAnt;

  // Base (exemplo). "Ativo" = comprou nos últimos N meses (o cliente define).
  const clientes = 214;
  const ativos = Math.round(clientes * (mesesAtivo === 3 ? 0.31 : mesesAtivo === 6 ? 0.46 : mesesAtivo === 12 ? 0.63 : 0.78));
  const novos = Math.max(1, Math.round(vendas * 0.78));
  const cac = dividir(saiu, novos);
  const ltvMedio = 4180; // só recebido, por ora
  const ticket = dividir(recebido, vendas);
  const mensal = receitaMensalDeExemplo();

  return (
    <div className="grid min-w-0 gap-4">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          rotulo={t("Entrou (recebido)")}
          valor={brl(recebido)}
          variacao={<Variacao atual={recebido} anterior={recebidoAnt} />}
          apoio={t("Parcelas pagas no período")}
          meta={{ progresso: 64, rotulo: t("Meta do mês: 64% (exemplo)") }}
        />
        <Kpi
          rotulo={t("Saiu (mídia)")}
          valor={brl(saiu)}
          variacao={<Variacao atual={saiu} anterior={saiuAnt} menorEMelhor />}
          apoio={t("Por ora só investimento em mídia")}
        />
        <Kpi
          rotulo={t("Lucro")}
          valor={brl(lucro)}
          destaque
          variacao={<Variacao atual={lucro} anterior={lucroAnt} />}
          apoio={`${t("Margem")} ${pct(dividir(lucro * 100, recebido), 1)}`}
        />
        <Kpi
          rotulo={t("A receber (próx. 60 dias)")}
          valor={brl(23100)}
          apoio={t("Parcelas previstas, assinaturas incluídas")}
        />
        <Kpi
          rotulo={t("CAC (só mídia)")}
          valor={brl(cac)}
          variacao={<Variacao atual={cac} anterior={dividir(saiuAnt, Math.max(1, soma(anterior, "vendas") * 0.78))} menorEMelhor />}
          apoio={t("Mídia ÷ clientes novos")}
        />
        <Kpi
          rotulo={t("LTV médio (recebido)")}
          valor={brl(ltvMedio)}
          apoio={t("Todo o recebido por cliente")}
        />
        <Kpi
          rotulo={t("LTV / CAC")}
          valor={vezes(dividir(ltvMedio, cac ?? 0))}
          destaque
          apoio={t("Real, com custos, na gestão financeira")}
        />
        <Kpi
          rotulo={t("Ticket médio")}
          valor={brl(ticket)}
          apoio={`${(vendas / Math.max(1, novos)).toFixed(1).replace(".", ",")} ${t("vendas por cliente")}`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Painel titulo={t("Entrou × saiu × previsto")} nota={t("Por mês")}>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mensal} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(v) => brl(Number(v))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="recebido" name={t("Recebido")} fill={COR_DA_MARCA} radius={[6, 6, 0, 0]} />
                <Bar dataKey="previsto" name={t("Previsto")} fill={COR_DA_MARCA} fillOpacity={0.35} radius={[6, 6, 0, 0]} />
                <Bar dataKey="saiu" name={t("Saiu (mídia)")} fill={COR_DO_APOIO} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Painel>

        <Painel titulo={t("Recorrência")} nota={t("Para quem vende assinatura")}>
          <div className="grid gap-3">
            <GradeDeNumeros
              itens={[
                { rotulo: "MRR", valor: brl(18400), destaque: true },
                { rotulo: t("Churn do mês"), valor: pct(3.2) },
                { rotulo: t("Assinaturas ativas"), valor: inteiro(61) },
                { rotulo: t("Encerradas no mês"), valor: inteiro(2) },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {t("Recorrente × avulso")}: <strong className="tabular-nums">63%</strong> /{" "}
              <strong className="tabular-nums">37%</strong> {t("da receita do mês")}.
            </p>
            <p className="text-xs text-muted-foreground">
              {t("Churn = assinaturas encerradas no mês ÷ ativas no início do mês.")}
            </p>
          </div>
        </Painel>
      </div>

      <Painel
        titulo={t("Base de clientes")}
        acao={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {t("Cliente ativo = comprou nos últimos")}
            <select
              value={mesesAtivo}
              onChange={(e) => setMesesAtivo(Number(e.target.value))}
              className="h-8 rounded-lg border bg-background px-2 text-xs text-foreground"
            >
              {[3, 6, 12, 24].map((m) => (
                <option key={m} value={m}>
                  {m} {t("meses")}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <GradeDeNumeros
          itens={[
            { rotulo: t("Clientes (com compra paga)"), valor: inteiro(clientes), destaque: true },
            { rotulo: t("Clientes ativos"), valor: inteiro(ativos), destaque: true },
            { rotulo: t("Inativos"), valor: inteiro(clientes - ativos) },
            { rotulo: t("Novos no período"), valor: inteiro(novos) },
            { rotulo: t("Lead → 1ª compra (mediana)"), valor: `18 ${t("dias")}` },
            { rotulo: t("Lead → 1ª compra (média)"), valor: `27 ${t("dias")}` },
            { rotulo: t("Tempo médio de resposta"), valor: "11 min" },
            { rotulo: t("Vendas por cliente"), valor: "1,8" },
          ]}
        />
      </Painel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo={t("Por produto")} nota={t("Vendas e faturamento")}>
          <TabelaDeDados
            colunas={[
              { titulo: t("Produto") },
              { titulo: t("Vendas") },
              { titulo: t("Recebido") },
              { titulo: t("Ticket") },
            ]}
            linhas={[
              ["Assessoria M1: Infraestrutura", "9", brl(21600), brl(2400)],
              ["Gestão de tráfego pago", "6", brl(8400), brl(1400)],
              ["Oferta 5", "3", brl(2100), brl(700)],
            ]}
          />
        </Painel>
        <Painel titulo={t("Saúde da carteira")} nota={t("Inadimplência e concentração")}>
          <GradeDeNumeros
            itens={[
              { rotulo: t("Parcelas vencidas"), valor: brl(3200) },
              { rotulo: t("Inadimplência"), valor: pct(4.8) },
              { rotulo: t("Top 10 clientes"), valor: pct(38) },
              { rotulo: t("Payback do CAC"), valor: `2,4 ${t("meses")}` },
            ]}
          />
        </Painel>
      </div>

      <div className="rounded-2xl border border-dashed bg-card/60 p-4 text-sm text-muted-foreground">
        {t(
          "Gestão financeira (em breve): cadastre os custos da empresa (equipe, locação, eventos…) e o CAC, o LTV/CAC e a margem passam a ser os reais, não só mídia.",
        )}
      </div>
    </div>
  );
}
