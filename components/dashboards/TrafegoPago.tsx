"use client";

import { useState } from "react";

import {
  Kpi,
  Painel,
  Variacao,
  Visoes,
  brl,
  inteiro,
  pct,
  vezes,
} from "@/components/dashboards/base";
import { FunilComTaxas, FunilEmColunas } from "@/components/dashboards/funil";
import { GraficoComparativo } from "@/components/dashboards/GraficoComparativo";
import {
  TabelaDeMetricas,
  colunasDoFunil,
  type ColunaDaTabela,
  type LinhaDeMetricas,
} from "@/components/dashboards/TabelaDeMetricas";
import { derivarTrafego, type BrutoDeTrafego } from "@/lib/dashboards/metricas-de-trafego";
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
  anuncios: Array<{
    id: string;
    nome: string;
    campanha: string;
    conjunto: string;
    investido: number;
    impressoes: number;
    cliques: number;
    viewsLP?: number;
    leads: number;
    desqualificados?: number;
    vendas: number;
    recebido: number;
  }>;
  conjuntos: Array<{
    id: string;
    nome: string;
    campanha: string;
    anuncios: number;
    investido: number;
    impressoes: number;
    cliques: number;
    viewsLP?: number;
    leads: number;
    desqualificados?: number;
    vendas: number;
    recebido: number;
  }>;
  paginas: Array<{
    id: string;
    nome: string;
    investido?: number;
    impressoes?: number;
    cliques?: number;
    viewsLP?: number;
    semMidia?: boolean;
    leads: number;
    desqualificados?: number;
    vendas: number;
    recebido: number;
  }>;
  catalogo: Array<{ id: string; nome: string }>;
}

type Visao = "geral" | "campanhas" | "conjuntos" | "anuncios" | "paginas" | "canais";

const hoje = (d: Omit<DiaDeTrafego, "data">): BrutoDeTrafego => ({
  impressoes: d.impressoes,
  alcance: d.alcance,
  cliques: d.cliques,
  viewsLP: d.viewsLP,
  leads: d.leads,
  vendas: d.vendas,
  investimento: d.investimento,
  recebido: d.recebido,
});

const bruto = (c: {
  investido?: number;
  impressoes?: number;
  cliques?: number;
  viewsLP?: number;
  leads: number;
  desqualificados?: number;
  vendas: number;
  recebido: number;
}): BrutoDeTrafego => ({
  impressoes: c.impressoes ?? 0,
  cliques: c.cliques ?? 0,
  viewsLP: c.viewsLP ?? 0,
  leads: c.leads,
  vendas: c.vendas,
  investimento: c.investido ?? 0,
  recebido: c.recebido,
  desqualificados: c.desqualificados,
});

const texto = (id: string, titulo: string): ColunaDaTabela => ({ tipo: "texto", id, titulo });

/** TRÁFEGO PAGO: o dashboard do ONE, com leads do CRM, vendas e faturamento pago. */
export function TrafegoPago({ dados }: { dados: DadosDeTrafego }) {
  const t = useT();
  const [visao, setVisao] = useState<Visao>("geral");
  const dias = dados.dias;
  const a = derivarTrafego(hoje(dados.totais));
  const p = derivarTrafego(hoje(dados.totaisAnterior));

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
  const decimal = (v: number | null) =>
    v === null
      ? "—"
      : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const p2 = (v: number | null) => (v === null ? "—" : pct(v, 2));
  const p1 = (v: number | null) => (v === null ? "—" : pct(v, 1));

  const linhasDeDias: LinhaDeMetricas[] = dias.map((d) => ({
    chave: d.data,
    textos: { nome: `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}` },
    bruto: hoje(d),
  }));

  return (
    <div className="grid min-w-0 gap-4">
      <Visoes
        valor={visao}
        aoMudar={setVisao}
        opcoes={[
          { id: "geral", rotulo: t("Visão geral") },
          { id: "campanhas", rotulo: t("Por campanha") },
          { id: "conjuntos", rotulo: t("Por conjunto") },
          { id: "anuncios", rotulo: t("Por criativo") },
          { id: "paginas", rotulo: t("Por landing page") },
          { id: "canais", rotulo: t("Por canal") },
        ]}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          rotulo={t("Faturamento recebido")}
          valor={brl(a.recebido)}
          destaque
          variacao={<Variacao atual={a.recebido} anterior={p.recebido} />}
          apoio={t("Parcelas recebidas no período")}
        />
        <Kpi
          rotulo={t("Investido no período")}
          valor={brl(a.investimento)}
          variacao={<Variacao atual={a.investimento} anterior={p.investimento} menorEMelhor />}
          apoio={t("Meta Ads")}
        />
        <Kpi
          rotulo={t("Lucro")}
          valor={brl(a.lucro)}
          variacao={<Variacao atual={a.lucro} anterior={p.lucro} />}
          apoio={t("Recebido − investido")}
        />
        <Kpi
          rotulo={t("ROAS")}
          valor={vezes(a.roas)}
          destaque
          variacao={<Variacao atual={a.roas} anterior={p.roas} />}
          apoio={t("Recebido ÷ investido")}
        />
        <Kpi
          rotulo={t("Leads")}
          valor={inteiro(a.leads)}
          variacao={<Variacao atual={a.leads} anterior={p.leads} />}
          apoio={`${t("Média")}: ${inteiro(a.leads / Math.max(1, dias.length))} ${t("leads/dia")}`}
        />
        <Kpi
          rotulo={t("CPL")}
          valor={brl(a.cpl)}
          variacao={<Variacao atual={a.cpl} anterior={p.cpl} menorEMelhor />}
          apoio={t("Investido ÷ leads")}
        />
        <Kpi
          rotulo={t("Vendas")}
          valor={inteiro(a.vendas)}
          variacao={<Variacao atual={a.vendas} anterior={p.vendas} />}
          apoio={t("Com algo pago")}
        />
        <Kpi
          rotulo={t("CAC")}
          valor={brl(a.cac)}
          variacao={<Variacao atual={a.cac} anterior={p.cac} menorEMelhor />}
          apoio={t("Investido ÷ vendas")}
        />
      </section>

      {visao === "geral" ? (
        <>
          <Painel titulo={t("Funil completo")} nota={t("Consolidado do período")}>
            <FunilEmColunas
              colunas={[
                {
                  rotulo: t("Impressões"),
                  valor: inteiro(a.impressoes),
                  itens: [
                    { rotulo: t("Frequência"), valor: decimal(a.frequencia) },
                    { rotulo: t("CPM"), valor: brl(a.cpm) },
                  ],
                },
                {
                  rotulo: t("Cliques no link"),
                  valor: inteiro(a.cliques),
                  itens: [
                    { rotulo: t("CPC"), valor: brl(a.cpc) },
                    { rotulo: t("CTR"), valor: p2(a.ctr) },
                  ],
                },
                {
                  rotulo: t("Visitas à LP"),
                  valor: inteiro(a.viewsLP),
                  itens: [
                    { rotulo: t("CP visita LP"), valor: brl(a.cpVisitaLP) },
                    { rotulo: t("Connect rate"), valor: p2(a.connect) },
                  ],
                },
                {
                  rotulo: t("Leads"),
                  valor: inteiro(a.leads),
                  itens: [
                    { rotulo: t("CPL"), valor: brl(a.cpl) },
                    { rotulo: t("Conversão da LP"), valor: p2(a.convLP) },
                  ],
                },
                {
                  rotulo: t("Vendas"),
                  valor: inteiro(a.vendas),
                  itens: [
                    { rotulo: t("CAC"), valor: brl(a.cac) },
                    { rotulo: t("Taxa de conversão"), valor: p2(a.convVenda) },
                  ],
                },
              ]}
            />
          </Painel>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Painel titulo={t("Volume diário")} nota={t("Compare duas métricas")}>
              <GraficoComparativo dados={serie} metricas={metricas} inicial={["leads", "cpl"]} />
            </Painel>
            <Painel titulo={t("Fluxo")} nota={t("Da impressão à venda")}>
              <FunilComTaxas
                etapas={[
                  { rotulo: t("Impressões"), valor: inteiro(a.impressoes) },
                  { rotulo: t("Cliques"), valor: inteiro(a.cliques) },
                  { rotulo: t("Landing page views"), valor: inteiro(a.viewsLP) },
                  { rotulo: t("Leads"), valor: inteiro(a.leads) },
                  { rotulo: t("Vendas"), valor: inteiro(a.vendas) },
                ]}
                taxas={[
                  { rotulo: t("CTR"), valor: p1(a.ctr), detalhe: t("cliques ÷ impressões") },
                  {
                    rotulo: t("Connect rate"),
                    valor: p1(a.connect),
                    detalhe: t("visitas ÷ cliques"),
                  },
                  {
                    rotulo: t("Conversão da LP"),
                    valor: p1(a.convLP),
                    detalhe: t("leads ÷ visitas"),
                  },
                  {
                    rotulo: t("Taxa de conversão"),
                    valor: p1(a.convVenda),
                    detalhe: t("vendas ÷ leads"),
                  },
                ]}
              />
            </Painel>
          </div>

          <Painel titulo={t("Detalhamento diário")} nota={`${dias.length} ${t("dias")}`}>
            <TabelaDeMetricas
              id="trafego-dias"
              colunas={[texto("nome", t("Dia")), ...colunasDoFunil({})]}
              linhas={linhasDeDias}
            />
          </Painel>
        </>
      ) : null}

      {visao === "campanhas" ? (
        <Painel
          titulo={t("Por campanha")}
          nota={t("Escolha as propriedades e arraste para o lado")}
        >
          <TabelaDeMetricas
            id="trafego-campanhas"
            colunas={[
              texto("nome", t("Campanha")),
              texto("canal", t("Canal")),
              ...colunasDoFunil({ roas: true }),
            ]}
            linhas={dados.campanhas.map((c) => ({
              chave: c.id,
              textos: { nome: c.nome, canal: c.canal },
              bruto: bruto(c),
            }))}
          />
        </Painel>
      ) : null}

      {visao === "conjuntos" ? (
        <Painel titulo={t("Por conjunto de anúncios")} nota={t("Campanha, entrega e resultado")}>
          <TabelaDeMetricas
            id="trafego-conjuntos"
            colunas={[
              texto("nome", t("Conjunto")),
              texto("campanha", t("Campanha")),
              ...colunasDoFunil({ roas: true, desqualificados: true }),
            ]}
            linhas={dados.conjuntos.map((c) => ({
              chave: c.id,
              textos: { nome: c.nome, campanha: c.campanha },
              bruto: bruto(c),
            }))}
          />
        </Painel>
      ) : null}

      {visao === "anuncios" ? (
        <Painel
          titulo={t("Por criativo")}
          nota={t("Mesmo nome em conjuntos diferentes aparece separado: veja campanha e conjunto")}
        >
          <TabelaDeMetricas
            id="trafego-criativos"
            colunas={[
              texto("nome", t("Criativo")),
              texto("campanha", t("Campanha")),
              texto("conjunto", t("Conjunto")),
              ...colunasDoFunil({ roas: true, desqualificados: true }),
            ]}
            linhas={dados.anuncios.map((c) => ({
              chave: c.id,
              textos: { nome: c.nome, campanha: c.campanha || "—", conjunto: c.conjunto || "—" },
              bruto: bruto(c),
            }))}
          />
        </Painel>
      ) : null}

      {visao === "paginas" ? (
        <Painel
          titulo={t("Por landing page")}
          nota={t("Gasto e visitas só aparecem quando a campanha tem uma única página")}
        >
          <TabelaDeMetricas
            id="trafego-paginas"
            colunas={[
              texto("nome", t("Página")),
              ...colunasDoFunil({
                roas: true,
                incluir: new Set([
                  "cliques",
                  "viewsLP",
                  "cpVisitaLP",
                  "connect",
                  "convLP",
                  "leads",
                  "cpl",
                  "convVenda",
                  "vendas",
                  "cac",
                  "investimento",
                  "recebido",
                  "lucro",
                  "roas",
                ]),
              }),
            ]}
            linhas={dados.paginas.map((c) => ({
              chave: c.id,
              textos: { nome: c.nome },
              bruto: bruto(c),
              semMidia: c.semMidia,
            }))}
          />
        </Painel>
      ) : null}

      {visao === "canais" ? (
        <Painel titulo={t("Por canal")} nota={t("Meta × Google × outras origens")}>
          <TabelaDeMetricas
            id="trafego-canais"
            colunas={[texto("nome", t("Canal")), ...colunasDoFunil({ roas: true })]}
            linhas={[
              { chave: "meta", textos: { nome: "Meta Ads" }, bruto: hoje(dados.totais) },
              {
                chave: "google",
                textos: { nome: `Google Ads (${t("não conectado")})` },
                bruto: {
                  impressoes: 0,
                  cliques: 0,
                  viewsLP: 0,
                  leads: 0,
                  vendas: 0,
                  investimento: 0,
                  recebido: 0,
                },
                semMidia: true,
              },
            ]}
          />
        </Painel>
      ) : null}
    </div>
  );
}
