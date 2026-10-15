"use client";

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
import { useT } from "@/hooks/i18n/useT";

/** O que a rota `/api/v1/dashboards/business` devolve. */
export interface DadosDeBusiness {
  de: string;
  ate: string;
  mesesAtivo: number;
  recebido: number;
  recebidoAnterior: number;
  saiu: number;
  saiuAnterior: number;
  aReceber60: number;
  vendas: number;
  vendasAnterior: number;
  novosClientes: number;
  novosClientesAnterior: number;
  clientes: number;
  ativos: number;
  ltvMedio: number | null;
  vendasPorCliente: number | null;
  funisAteComprarMedia: number | null;
  funisAteComprarMediana: number | null;
  diasAte1aCompraMediana: number | null;
  diasAte1aCompraMedia: number | null;
  assinaturasAtivas: number;
  encerradasNoPeriodo: number;
  mrr: number;
  recorrenteNoPeriodo: number;
  avulsoNoPeriodo: number;
  vencidas: number;
  concentracaoTop10: number | null;
  serie: Array<{ mes: string; recebido: number; saiu: number; previsto: number }>;
  produtos: Array<{ nome: string; vendas: number; recebido: number; aReceber: number }>;
}

const NOME_DO_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/**
 * BUSINESS: faturamento e saúde da base — o que entrou, o que saiu (por ora, mídia), CAC, LTV,
 * clientes, tempo até a 1ª compra e, para quem vende por recorrência, MRR e churn.
 */
export function Business({
  dados,
  aoMudarMeses,
}: {
  dados: DadosDeBusiness;
  aoMudarMeses: (meses: number) => void;
}) {
  const t = useT();
  const lucro = dados.recebido - dados.saiu;
  const lucroAnt = dados.recebidoAnterior - dados.saiuAnterior;
  const cac = dividir(dados.saiu, dados.novosClientes);
  const cacAnt = dividir(dados.saiuAnterior, dados.novosClientesAnterior);
  const ticket = dividir(dados.recebido, dados.vendas);
  const ltvCac = dados.ltvMedio !== null && cac !== null && cac > 0 ? dados.ltvMedio / cac : null;
  const baseDoChurn = dados.assinaturasAtivas + dados.encerradasNoPeriodo;
  const churn = dividir(dados.encerradasNoPeriodo * 100, baseDoChurn);
  const recorrentePct = dividir(dados.recorrenteNoPeriodo * 100, dados.recebido);
  const inadimplencia = dividir(dados.vencidas * 100, dados.vencidas + dados.recebido);
  const mensal = dados.serie.map((s) => ({
    ...s,
    mes: NOME_DO_MES[Number(s.mes.slice(5, 7)) - 1] ?? s.mes,
  }));
  const paybackMeses =
    cac !== null && dados.assinaturasAtivas > 0 && dados.mrr > 0
      ? cac / (dados.mrr / dados.assinaturasAtivas)
      : null;

  return (
    <div className="grid min-w-0 gap-4">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          rotulo={t("Entrou (recebido)")}
          valor={brl(dados.recebido)}
          variacao={<Variacao atual={dados.recebido} anterior={dados.recebidoAnterior} />}
          apoio={t("Parcelas pagas no período")}
        />
        <Kpi
          rotulo={t("Saiu (mídia)")}
          valor={brl(dados.saiu)}
          variacao={<Variacao atual={dados.saiu} anterior={dados.saiuAnterior} menorEMelhor />}
          apoio={t("Por ora só investimento em mídia")}
        />
        <Kpi
          rotulo={t("Lucro")}
          valor={brl(lucro)}
          destaque
          variacao={<Variacao atual={lucro} anterior={lucroAnt} />}
          apoio={`${t("Margem")} ${dados.recebido > 0 ? pct((lucro / dados.recebido) * 100, 1) : "—"}`}
        />
        <Kpi
          rotulo={t("A receber (próx. 60 dias)")}
          valor={brl(dados.aReceber60)}
          apoio={t("Parcelas previstas, assinaturas incluídas")}
        />
        <Kpi
          rotulo={t("CAC (só mídia)")}
          valor={brl(cac)}
          variacao={<Variacao atual={cac} anterior={cacAnt} menorEMelhor />}
          apoio={t("Mídia ÷ clientes novos")}
        />
        <Kpi
          rotulo={t("LTV médio (recebido)")}
          valor={brl(dados.ltvMedio)}
          apoio={t("Todo o recebido por cliente")}
        />
        <Kpi
          rotulo={t("LTV / CAC")}
          valor={vezes(ltvCac)}
          destaque
          apoio={t("Real, com custos, na gestão financeira")}
        />
        <Kpi
          rotulo={t("Ticket médio")}
          valor={brl(ticket)}
          variacao={
            <Variacao
              atual={ticket}
              anterior={dividir(dados.recebidoAnterior, dados.vendasAnterior)}
            />
          }
          apoio={`${dados.vendasPorCliente === null ? "—" : dados.vendasPorCliente.toLocaleString("pt-BR")} ${t("vendas por cliente")}`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Painel titulo={t("Entrou × saiu × previsto")} nota={t("Por mês")}>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mensal} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
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
                <Bar
                  dataKey="previsto"
                  name={t("Previsto")}
                  fill={COR_DA_MARCA}
                  fillOpacity={0.35}
                  radius={[6, 6, 0, 0]}
                />
                <Bar dataKey="saiu" name={t("Saiu (mídia)")} fill={COR_DO_APOIO} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Painel>

        <Painel titulo={t("Recorrência")} nota={t("Para quem vende assinatura")}>
          <div className="grid gap-3">
            <GradeDeNumeros
              itens={[
                { rotulo: "MRR", valor: brl(dados.mrr), destaque: true },
                { rotulo: t("Churn do período"), valor: churn === null ? "—" : pct(churn) },
                { rotulo: t("Assinaturas ativas"), valor: inteiro(dados.assinaturasAtivas) },
                { rotulo: t("Encerradas no período"), valor: inteiro(dados.encerradasNoPeriodo) },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {t("Recorrente × avulso")}:{" "}
              <strong className="tabular-nums">
                {recorrentePct === null ? "—" : pct(recorrentePct, 0)}
              </strong>{" "}
              /{" "}
              <strong className="tabular-nums">
                {recorrentePct === null ? "—" : pct(100 - recorrentePct, 0)}
              </strong>{" "}
              {t("da receita do período")}.
            </p>
            <p className="text-xs text-muted-foreground">
              {t(
                "Churn = assinaturas encerradas no período ÷ (ativas + encerradas). A data do encerramento é a da última alteração da assinatura.",
              )}
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
              value={dados.mesesAtivo}
              onChange={(e) => aoMudarMeses(Number(e.target.value))}
              className="h-8 rounded-lg border bg-background px-2 text-xs text-foreground"
            >
              {[1, 3, 6, 12, 24].map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? t("mês") : t("meses")}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <GradeDeNumeros
          itens={[
            { rotulo: t("Clientes (com compra paga)"), valor: inteiro(dados.clientes), destaque: true },
            { rotulo: t("Clientes ativos"), valor: inteiro(dados.ativos), destaque: true },
            { rotulo: t("Inativos"), valor: inteiro(dados.clientes - dados.ativos) },
            {
              rotulo: t("Novos no período"),
              valor: inteiro(dados.novosClientes),
            },
            {
              rotulo: t("Lead → 1ª compra (mediana)"),
              valor:
                dados.diasAte1aCompraMediana === null
                  ? "—"
                  : `${Math.round(dados.diasAte1aCompraMediana)} ${t("dias")}`,
            },
            {
              rotulo: t("Lead → 1ª compra (média)"),
              valor:
                dados.diasAte1aCompraMedia === null
                  ? "—"
                  : `${Math.round(dados.diasAte1aCompraMedia)} ${t("dias")}`,
            },
            {
              rotulo: t("Funis até comprar (média)"),
              valor:
                dados.funisAteComprarMedia === null
                  ? "—"
                  : dados.funisAteComprarMedia.toLocaleString("pt-BR"),
            },
            { rotulo: t("Vendas no período"), valor: inteiro(dados.vendas) },
            {
              rotulo: t("Vendas por cliente"),
              valor:
                dados.vendasPorCliente === null
                  ? "—"
                  : dados.vendasPorCliente.toLocaleString("pt-BR"),
            },
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {t("O tempo médio de resposta está no dashboard de Atendimento.")}
        </p>
      </Painel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo={t("Por produto")} nota={t("Vendas e faturamento do período")}>
          {dados.produtos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Nenhuma venda de produto no período.")}</p>
          ) : (
            <TabelaDeDados
              colunas={[
                { titulo: t("Produto") },
                { titulo: t("Vendas") },
                { titulo: t("Recebido") },
                { titulo: t("A receber") },
              ]}
              linhas={dados.produtos.map((p) => [
                p.nome,
                inteiro(p.vendas),
                brl(p.recebido),
                brl(p.aReceber),
              ])}
            />
          )}
        </Painel>
        <Painel titulo={t("Saúde da carteira")} nota={t("Inadimplência e concentração")}>
          <GradeDeNumeros
            itens={[
              { rotulo: t("Parcelas vencidas"), valor: brl(dados.vencidas) },
              { rotulo: t("Inadimplência"), valor: inadimplencia === null ? "—" : pct(inadimplencia) },
              {
                rotulo: t("Top 10 clientes"),
                valor: dados.concentracaoTop10 === null ? "—" : pct(dados.concentracaoTop10, 0),
              },
              {
                rotulo: t("Payback do CAC"),
                valor: paybackMeses === null ? "—" : `${paybackMeses.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${t("meses")}`,
              },
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
