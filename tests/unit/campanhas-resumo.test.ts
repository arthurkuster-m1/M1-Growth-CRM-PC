import { describe, expect, it } from "vitest";

import type { CampanhaDeDemanda } from "@/lib/marketing/campanhas";
import {
  colunasDoDiaAdia,
  funilDeTrafego,
  periodoDaCampanha,
  resumoDaCampanha,
  type DiaDaCampanha,
} from "@/lib/marketing/campanhas-resumo";

const campanha = (p: Partial<CampanhaDeDemanda> = {}): CampanhaDeDemanda => ({
  id: "c1",
  name: "Teste",
  channel: "trafego_pago",
  status: "ativa",
  description: "",
  idea: "",
  objective: "",
  start_date: "2026-09-01",
  end_date: "2026-09-30",
  continuous: false,
  pipeline_id: null,
  owner_id: null,
  budget: 600,
  budget_period: "total",
  tax_pct: 12.5,
  goal_leads: 150,
  goal_cpl: null,
  goal_sales: null,
  goal_revenue: null,
  platform: "",
  sheet_url: "",
  platform_campaigns: [],
  position: 1,
  created_at: "2026-09-01T00:00:00Z",
  ...p,
});

const dia = (p: Partial<DiaDaCampanha>): DiaDaCampanha => ({
  day: "2026-09-01",
  impressions: 0,
  reach: 0,
  link_clicks: 0,
  lp_views: 0,
  leads: 0,
  spend: 0,
  extras: {},
  source: "manual",
  ...p,
});

describe("resumo da campanha — as contas da planilha", () => {
  // O print da planilha: 30 dias, 11 passados, R$ 600 bruto (12,5%), R$ 138,52 investidos,
  // 62 leads de uma meta de 150.
  const dias = [
    dia({
      day: "2026-09-01",
      spend: 100,
      leads: 40,
      impressions: 10000,
      link_clicks: 200,
      lp_views: 160,
    }),
    dia({
      day: "2026-09-02",
      spend: 38.52,
      leads: 22,
      impressions: 5000,
      link_clicks: 100,
      lp_views: 90,
    }),
  ];
  const r = resumoDaCampanha(campanha(), dias, "2026-09-11");

  it("período", () => {
    expect(r.periodo).toEqual({ totais: 30, passados: 11, restantes: 19 });
  });
  it("investimento líquido e valor restante", () => {
    expect(r.investimentoLiquido).toBeCloseTo(533.33, 2);
    expect(r.valorRestante).toBeCloseTo(394.81, 2);
  });
  it("metas de leads", () => {
    expect(r.metas.metaDeCpl).toBeCloseTo(3.56, 2);
    expect(r.metas.faltam).toBe(88);
    expect(r.metas.cplNecessario).toBeCloseTo(4.49, 2);
    expect(r.metas.porDia).toBe(5);
    expect(r.metas.metaParaHoje).toBe(55);
    expect(r.metas.adiantamento).toBe(7);
    expect(r.metas.novaMetaDiaria).toBeCloseTo(4.63, 2);
  });
  it("pace de gastos", () => {
    expect(r.pace.metaDiaria).toBeCloseTo(17.78, 2);
    expect(r.pace.mediaAtual).toBeCloseTo(12.59, 2);
    expect(r.pace.diferenca).toBeCloseTo(5.19, 2);
    expect(r.pace.novoOrcamentoDiario).toBeCloseTo(20.78, 2);
  });
  it("funil", () => {
    expect(r.funil.cpm).toBeCloseTo(9.23, 2);
    expect(r.funil.ctr).toBeCloseTo(2, 5);
    expect(r.funil.cpl).toBeCloseTo(2.23, 2);
    expect(r.funil.connectionRate).toBeCloseTo(83.33, 2);
    expect(r.funil.conversaoDaLp).toBeCloseTo(24.8, 1);
  });
});

describe("período", () => {
  it("contínua ou sem datas não tem período", () => {
    expect(periodoDaCampanha(campanha({ continuous: true }), "2026-09-10")).toBeNull();
    expect(periodoDaCampanha(campanha({ end_date: null }), "2026-09-10")).toBeNull();
  });
  it("antes do início: 0 passados; depois do fim: tudo passado", () => {
    expect(periodoDaCampanha(campanha(), "2026-08-20")).toEqual({
      totais: 30,
      passados: 0,
      restantes: 30,
    });
    expect(periodoDaCampanha(campanha(), "2026-10-20")).toEqual({
      totais: 30,
      passados: 30,
      restantes: 0,
    });
  });
});

describe("investimento por período", () => {
  it("diário multiplica pelos dias", () => {
    const r = resumoDaCampanha(
      campanha({ budget: 20, budget_period: "diario", tax_pct: 0 }),
      [],
      "2026-09-05",
    );
    expect(r.investimentoBruto).toBe(600);
  });
});

describe("alertas", () => {
  it("CTR baixo pede criativos novos; conexão e LP ruins pedem verificação", () => {
    const d = [dia({ impressions: 5000, link_clicks: 40, lp_views: 20, leads: 1, spend: 50 })];
    const codigos = resumoDaCampanha(campanha(), d, "2026-09-05").alertas.map((a) => a.codigo);
    expect(codigos).toContain("testar_criativos");
    expect(codigos).toContain("conexao_da_lp");
  });
  it("gastando abaixo do necessário pede mais orçamento", () => {
    const d = [dia({ impressions: 20000, link_clicks: 600, lp_views: 560, leads: 60, spend: 10 })];
    const a = resumoDaCampanha(campanha(), d, "2026-09-11").alertas.find(
      (x) => x.codigo === "aumentar_orcamento",
    );
    expect(a?.valor).toBeGreaterThan(10);
  });
  it("sem nenhum problema, 'no ritmo'", () => {
    const d = [
      dia({ impressions: 20000, link_clicks: 600, lp_views: 560, leads: 150, spend: 17.78 * 11 }),
    ];
    const a = resumoDaCampanha(campanha(), d, "2026-09-11").alertas;
    expect(a.map((x) => x.codigo)).toEqual(["no_ritmo"]);
  });
  it("canais sem tráfego pago não geram alerta de funil", () => {
    expect(resumoDaCampanha(campanha({ channel: "prospeccao" }), [], "2026-09-05").alertas).toEqual(
      [],
    );
  });
});

describe("modelo da planilha por canal", () => {
  it("tráfego pago e prospecção têm colunas próprias", () => {
    expect(colunasDoDiaAdia("trafego_pago")).toContain("visitas_a_lp");
    expect(colunasDoDiaAdia("prospeccao")).toContain("reunioes_feitas");
  });
  it("funil vazio não quebra", () => {
    expect(funilDeTrafego([]).cpl).toBeNull();
  });
});

import { dataDoTexto, lerDias, modeloDoDiaAdia } from "@/lib/marketing/campanhas-csv";

describe("planilha do dia a dia (CSV)", () => {
  it("lê datas nos dois formatos e rejeita datas impossíveis", () => {
    expect(dataDoTexto("05/10/2026")).toBe("2026-10-05");
    expect(dataDoTexto("2026-10-05")).toBe("2026-10-05");
    expect(dataDoTexto("5-10-26")).toBe("2026-10-05");
    expect(dataDoTexto("31/02/2026")).toBeNull();
    expect(dataDoTexto("ontem")).toBeNull();
  });
  it("lê o modelo de tráfego pago, com vírgula decimal e nomes alternativos", () => {
    const csv =
      "Data;Impressões;Alcance;Cliques no link;Visitas;Leads;Valor Investido\r\n" +
      "01/10/2026;1.200;900;40;30;5;R$ 25,50\r\n" +
      "02/10/2026;;;;;;\r\n";
    const r = lerDias(csv, "trafego_pago");
    expect(r.erro).toBeNull();
    expect(r.dias).toHaveLength(2);
    expect(r.dias[0]).toMatchObject({
      day: "2026-10-01",
      impressions: 1200,
      link_clicks: 40,
      lp_views: 30,
      leads: 5,
      spend: 25.5,
    });
    expect(r.dias[1]!.spend).toBe(0);
  });
  it("aponta a linha com dia ou número inválido", () => {
    const r = lerDias("dia;leads\r\nxx;1\r\n01/10/2026;abc\r\n", "trafego_pago");
    expect(r.problemas).toEqual([
      { linha: 2, erro: "dia_invalido" },
      { linha: 3, erro: "numero_invalido" },
    ]);
  });
  it("prospecção lê as métricas do canal", () => {
    const r = lerDias(
      "dia;abordagens;reunioes_feitas;valor_total\r\n01/10/2026;50;3;4500\r\n",
      "prospeccao",
    );
    expect(r.dias[0]!.extras).toEqual({ abordagens: 50, reunioes_feitas: 3, valor_total: 4500 });
  });
  it("sem coluna de dia, erro; o modelo volta a ser lido", () => {
    expect(lerDias("leads\r\n1\r\n", "trafego_pago").erro).toBe("sem_dia");
    expect(lerDias(modeloDoDiaAdia("trafego_pago"), "trafego_pago").dias).toHaveLength(1);
  });
});

import { somarPorDia } from "@/lib/plataformas-de-anuncio/meta/insights-por-dia";
import { janelaDaSync } from "@/lib/marketing/campanhas-resumo";

describe("Meta por dia (C3)", () => {
  it("soma as campanhas do mesmo dia e lê leads de results ou das ações", () => {
    const dias = somarPorDia([
      {
        date_start: "2026-10-02",
        spend: "10.5",
        impressions: "1000",
        reach: "800",
        inline_link_clicks: "30",
        actions: [{ action_type: "landing_page_view", value: "25" }],
        results: [{ indicator: "actions:lead", values: [{ value: "4" }] }],
      },
      {
        date_start: "2026-10-02",
        spend: "4.25",
        impressions: "500",
        actions: [
          { action_type: "landing_page_view", value: "10" },
          { action_type: "lead", value: "2" },
        ],
      },
      { date_start: "2026-10-01", spend: "1" },
      { spend: "99" },
    ]);
    expect(dias.map((d) => d.day)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(dias[1]).toEqual({
      day: "2026-10-02",
      impressions: 1500,
      reach: 800,
      link_clicks: 30,
      lp_views: 35,
      leads: 6,
      spend: 14.75,
    });
  });
  it("janela: do início até hoje; futura = nada; contínua = 30 dias", () => {
    const agora = new Date("2026-10-10T12:00:00Z");
    expect(janelaDaSync({ start_date: "2026-10-01", end_date: "2026-10-31" }, agora)).toEqual({
      de: "2026-10-01",
      ate: "2026-10-10",
    });
    expect(janelaDaSync({ start_date: "2026-09-01", end_date: "2026-09-30" }, agora)).toEqual({
      de: "2026-09-01",
      ate: "2026-09-30",
    });
    expect(janelaDaSync({ start_date: "2026-11-01", end_date: null }, agora)).toBeNull();
    expect(janelaDaSync({ start_date: null, end_date: null }, agora)).toEqual({
      de: "2026-09-10",
      ate: "2026-10-10",
    });
  });
});
