"use client";

import { useState } from "react";

import {
  FunilEmDegraus,
  GradeDeNumeros,
  Kpi,
  Painel,
  TabelaDeDados,
  Variacao,
  Visoes,
  brl,
  dividir,
  inteiro,
  pct,
  vezes,
} from "@/components/dashboards/base";
import { GraficoComparativo } from "@/components/dashboards/GraficoComparativo";
import type { DiaDeTrafego } from "@/lib/dashboards/trafego";
import { useT } from "@/hooks/i18n/useT";

/** O que a rota `/api/v1/dashboards/trafego` devolve. */
export interface DadosDeTrafego {
  de: string;
  ate: string;
  dias: DiaDeTrafego[];
  totais: Omit<DiaDeTrafego, "data">;
  totaisAnterior: Omit<DiaDeTrafego, "data">;
  campanhas: Array<{
    id: string;
    nome: string;
    canal: string;
    investido: number;
    impressoes: number;
    cliques: number;
    viewsLP: number;
    leads: number;
    vendas: number;
    recebido: number;
  }>;
  anuncios: Array<{ id: string; nome: string; leads: number; vendas: number; recebido: number }>;
  paginas: Array<{ id: string; nome: string; leads: number; vendas: number; recebido: number }>;
  catalogo: Array<{ id: string; nome: string }>;
}

type Visao = "geral" | "campanhas" | "anuncios" | "paginas" | "canais";

function derivar(soma: Omit<DiaDeTrafego, "data">) {
  const { investimento, leads, vendas, recebido, cliques, impressoes, viewsLP } = soma;
  return {
    ...soma,
    cpl: dividir(investimento, leads),
    cac: dividir(investimento, vendas),
    cpm: dividir(investimento * 1000, impressoes),
    cpc: dividir(investimento, cliques),
    ctr: dividir(cliques * 100, impressoes),
    connect: dividir(viewsLP * 100, cliques),
    convLP: dividir(leads * 100, viewsLP),
    roas: dividir(recebido, investimento),
    lucro: recebido - investimento,
  };
}

/** TRÁFEGO PAGO: o dashboard do ONE, com leads do CRM, vendas e faturamento pago. */
export function TrafegoPago({ dados }: { dados: DadosDeTrafego }) {
  const t = useT();
  const [visao, setVisao] = useState<Visao>("geral");
  const dias = dados.dias;
  const a = derivar(dados.totais);
  const p = derivar(dados.totaisAnterior);

  const metricas = [
    { id: "leads", rotulo: t("Leads"), formato: inteiro },
    { id: "investimento", rotulo: t("Investido"), formato: brl },
    { id: "cpl", rotulo: t("CPL"), formato: brl },
    { id: "cliques", rotulo: t("Cliques"), formato: inteiro },
    { id: "viewsLP", rotulo: t("Visitas à LP"), formato: inteiro },
    { id: "vendas", rotulo: t("Vendas"), formato: inteiro },
    { id: "recebido", rotulo: t("Faturamento recebido"), formato: brl },
  ];
  const serie = dias.map((d) => ({ ...d, cpl: d.leads > 0 ? d.investimento / d.leads : 0 }));

  return (
    <div className="grid min-w-0 gap-4">
      <Visoes
        valor={visao}
        aoMudar={setVisao}
        opcoes={[
          { id: "geral", rotulo: t("Visão geral") },
          { id: "campanhas", rotulo: t("Por campanha") },
          { id: "anuncios", rotulo: t("Por anúncio") },
          { id: "paginas", rotulo: t("Por landing page") },
          { id: "canais", rotulo: t("Por canal") },
        ]}
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          rotulo={t("Investido no período")}
          valor={brl(a.investimento)}
          variacao={<Variacao atual={a.investimento} anterior={p.investimento} menorEMelhor />}
          apoio={t("Meta Ads")}
        />
        <Kpi
          rotulo={t("Leads (CRM)")}
          valor={inteiro(a.leads)}
          variacao={<Variacao atual={a.leads} anterior={p.leads} />}
          apoio={`${t("Média")}: ${inteiro(a.leads / Math.max(1, dias.length))} ${t("leads/dia")}`}
        />
        <Kpi
          rotulo={t("CPL")}
          valor={brl(a.cpl)}
          destaque
          variacao={<Variacao atual={a.cpl} anterior={p.cpl} menorEMelhor />}
          apoio={`${t("CPM")} ${brl(a.cpm)} · ${t("CPC")} ${brl(a.cpc)}`}
        />
        <Kpi
          rotulo={t("Conversão da LP")}
          valor={pct(a.convLP, 2)}
          destaque
          variacao={<Variacao atual={a.convLP} anterior={p.convLP} />}
          apoio={t("Leads ÷ visitas à LP")}
        />
        <Kpi
          rotulo={t("Vendas")}
          valor={inteiro(a.vendas)}
          variacao={<Variacao atual={a.vendas} anterior={p.vendas} />}
          apoio={t("Com algo pago")}
        />
        <Kpi
          rotulo={t("CAC (só mídia)")}
          valor={brl(a.cac)}
          variacao={<Variacao atual={a.cac} anterior={p.cac} menorEMelhor />}
          apoio={t("Investido ÷ vendas")}
        />
        <Kpi
          rotulo={t("Faturamento recebido")}
          valor={brl(a.recebido)}
          variacao={<Variacao atual={a.recebido} anterior={p.recebido} />}
          apoio={`${t("Lucro")} ${brl(a.lucro)}`}
        />
        <Kpi
          rotulo={t("ROAS")}
          valor={vezes(a.roas)}
          destaque
          variacao={<Variacao atual={a.roas} anterior={p.roas} />}
          apoio={t("Recebido ÷ investido")}
        />
      </section>

      {visao === "geral" ? (
        <>
          <Painel titulo={t("Funil completo")} nota={t("Consolidado do período")}>
            <GradeDeNumeros
              itens={[
                { rotulo: t("Impressões"), valor: inteiro(a.impressoes), destaque: true },
                { rotulo: t("Cliques no link"), valor: inteiro(a.cliques), destaque: true },
                { rotulo: t("Visitas à LP"), valor: inteiro(a.viewsLP), destaque: true },
                { rotulo: t("Leads"), valor: inteiro(a.leads), destaque: true },
                { rotulo: t("Alcance"), valor: inteiro(a.alcance) },
                { rotulo: t("CPC"), valor: brl(a.cpc) },
                { rotulo: t("CP visita LP"), valor: brl(dividir(a.investimento, a.viewsLP)) },
                { rotulo: t("CPL"), valor: brl(a.cpl) },
                { rotulo: t("CPM"), valor: brl(a.cpm) },
                { rotulo: t("CTR"), valor: pct(a.ctr, 2) },
                { rotulo: t("Connect rate"), valor: pct(a.connect, 2) },
                { rotulo: t("Frequência"), valor: a.alcance > 0 ? (a.impressoes / a.alcance).toFixed(2).replace(".", ",") : "—" },
              ]}
            />
          </Painel>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Painel titulo={t("Volume diário")} nota={t("Compare duas métricas")}>
              <GraficoComparativo
                dados={serie}
                metricas={metricas}
                inicial={["leads", "cpl"]}
              />
            </Painel>
            <Painel titulo={t("Fluxo")} nota={t("Da impressão à venda")}>
              <FunilEmDegraus
                etapas={[
                  { rotulo: t("Impressões"), valor: a.impressoes },
                  { rotulo: t("Cliques"), valor: a.cliques, taxa: `CTR ${pct(a.ctr, 2)}` },
                  { rotulo: t("Visitas à LP"), valor: a.viewsLP, taxa: `Connect ${pct(a.connect, 1)}` },
                  { rotulo: t("Leads"), valor: a.leads, taxa: `Conversão ${pct(a.convLP, 1)}` },
                  { rotulo: t("Vendas"), valor: a.vendas, taxa: `Lead→venda ${pct(dividir(a.vendas * 100, a.leads), 1)}` },
                ]}
              />
            </Painel>
          </div>

          <Painel titulo={t("Detalhamento diário")} nota={`${dias.length} ${t("dias")}`}>
            <TabelaDeDados
              colunas={[
                { titulo: t("Dia") },
                { titulo: t("Impressões") },
                { titulo: t("Cliques") },
                { titulo: t("CTR") },
                { titulo: t("Visitas LP") },
                { titulo: t("Leads") },
                { titulo: t("CPL") },
                { titulo: t("Vendas") },
                { titulo: t("Recebido") },
                { titulo: t("Investido") },
              ]}
              linhas={dias.slice(-14).map((d) => [
                `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`,
                inteiro(d.impressoes),
                inteiro(d.cliques),
                pct(dividir(d.cliques * 100, d.impressoes), 2),
                inteiro(d.viewsLP),
                inteiro(d.leads),
                brl(dividir(d.investimento, d.leads)),
                inteiro(d.vendas),
                brl(d.recebido),
                brl(d.investimento),
              ])}
              rodape={[
                t("Total / média"),
                inteiro(a.impressoes),
                inteiro(a.cliques),
                pct(a.ctr, 2),
                inteiro(a.viewsLP),
                inteiro(a.leads),
                brl(a.cpl),
                inteiro(a.vendas),
                brl(a.recebido),
                brl(a.investimento),
              ]}
            />
          </Painel>
        </>
      ) : null}

      {visao === "campanhas" ? (
        <Painel titulo={t("Por campanha")} nota={t("Canal, lucro e LTV/CAC")}>
          <TabelaDeDados
            colunas={[
              { titulo: t("Campanha") },
              { titulo: t("Canal"), alinhar: "left" },
              { titulo: t("Investido") },
              { titulo: t("Leads") },
              { titulo: t("CPL") },
              { titulo: t("Vendas") },
              { titulo: t("CAC") },
              { titulo: t("Recebido") },
              { titulo: t("Lucro") },
              { titulo: t("ROAS") },
            ]}
            linhas={dados.campanhas.map((c) => [
              c.nome,
              c.canal,
              brl(c.investido),
              inteiro(c.leads),
              brl(dividir(c.investido, c.leads)),
              inteiro(c.vendas),
              brl(dividir(c.investido, c.vendas)),
              brl(c.recebido),
              brl(c.recebido - c.investido),
              vezes(dividir(c.recebido, c.investido)),
            ])}
          />
        </Painel>
      ) : null}

      {visao === "anuncios" ? (
        <Painel titulo={t("Por anúncio (criativo)")} nota={t("Quem traz lead e quem traz venda")}>
          <TabelaDeDados
            colunas={[
              { titulo: t("Anúncio") },
              { titulo: t("Leads") },
              { titulo: t("Vendas") },
              { titulo: t("Recebido") },
            ]}
            linhas={dados.anuncios.map((c) => [
              c.nome,
              inteiro(c.leads),
              inteiro(c.vendas),
              brl(c.recebido),
            ])}
          />
        </Painel>
      ) : null}

      {visao === "paginas" ? (
        <Painel titulo={t("Por landing page")} nota={t("Visitas, conversão e venda por página")}>
          <TabelaDeDados
            colunas={[
              { titulo: t("Página") },
              { titulo: t("Leads") },
              { titulo: t("Vendas") },
              { titulo: t("Recebido") },
            ]}
            linhas={dados.paginas.map((c) => [
              c.nome,
              inteiro(c.leads),
              inteiro(c.vendas),
              brl(c.recebido),
            ])}
          />
        </Painel>
      ) : null}

      {visao === "canais" ? (
        <Painel titulo={t("Por canal e origem")} nota={t("Meta × Google × outras origens")}>
          <TabelaDeDados
            colunas={[
              { titulo: t("Canal / origem") },
              { titulo: t("Investido") },
              { titulo: t("Leads") },
              { titulo: t("Vendas") },
              { titulo: t("Recebido") },
            ]}
            linhas={[
              ["Meta Ads", brl(a.investimento), inteiro(a.leads), inteiro(a.vendas), brl(a.recebido)],
              [`Google Ads (${t("não conectado")})`, "—", "—", "—", "—"],
            ]}
          />
        </Painel>
      ) : null}
    </div>
  );
}
