"use client";

import { useMemo, useState } from "react";

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
import {
  CAMPANHAS_DE_EXEMPLO,
  CRIATIVOS_DE_EXEMPLO,
  trafegoDeExemplo,
  type DiaDeTrafego,
} from "@/components/dashboards/exemplo";
import { useT } from "@/hooks/i18n/useT";
import { somarDias } from "@/lib/inicio/datas";

type Visao = "geral" | "campanhas" | "anuncios" | "paginas" | "canais";

function totais(dias: DiaDeTrafego[]) {
  const soma = (k: keyof Omit<DiaDeTrafego, "data">) => dias.reduce((s, d) => s + d[k], 0);
  const investimento = soma("investimento");
  const leads = soma("leads");
  const vendas = soma("vendas");
  const recebido = soma("recebido");
  const cliques = soma("cliques");
  const impressoes = soma("impressoes");
  const viewsLP = soma("viewsLP");
  return {
    impressoes,
    alcance: soma("alcance"),
    cliques,
    viewsLP,
    leads,
    vendas,
    recebido,
    investimento,
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
export function TrafegoPago({ de, ate, campanha }: { de: string; ate: string; campanha: string }) {
  const t = useT();
  const [visao, setVisao] = useState<Visao>("geral");
  const dias = useMemo(() => trafegoDeExemplo(de, ate, campanha), [de, ate, campanha]);
  const anterior = useMemo(() => {
    const n = dias.length;
    return trafegoDeExemplo(somarDias(de, -n), somarDias(de, -1), campanha);
  }, [dias.length, de, campanha]);
  const a = totais(dias);
  const p = totais(anterior);

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
          meta={{ progresso: 72, rotulo: t("Meta do mês: 72% (exemplo)") }}
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
                { rotulo: t("Frequência"), valor: (a.impressoes / Math.max(1, a.alcance)).toFixed(2) },
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
            linhas={CAMPANHAS_DE_EXEMPLO.map((c) => [
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
              { titulo: t("CTR") },
              { titulo: t("CPL") },
              { titulo: t("Leads") },
              { titulo: t("Vendas") },
              { titulo: t("Recebido") },
            ]}
            linhas={CRIATIVOS_DE_EXEMPLO.map((c) => [
              c.nome,
              pct(c.ctr, 1),
              brl(c.cpl),
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
              { titulo: t("Visitas") },
              { titulo: t("Leads") },
              { titulo: t("Conversão") },
              { titulo: t("Vendas") },
              { titulo: t("Recebido") },
            ]}
            linhas={[
              ["LP Seletiva — Versão A", "2.140", "148", pct(6.9), "6", brl(14800)],
              ["LP Seletiva — Versão B", "1.020", "52", pct(5.1), "2", brl(4200)],
              ["LP Oferta Relâmpago", "780", "17", pct(2.2), "0", brl(0)],
            ]}
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
              [t("Extração de leads"), "—", "34", "3", brl(5400)],
              [t("Indicação"), "—", "12", "4", brl(7200)],
              [t("Base de clientes"), "—", "9", "2", brl(3000)],
            ]}
          />
        </Painel>
      ) : null}
    </div>
  );
}
