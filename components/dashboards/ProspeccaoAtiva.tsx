"use client";

import { useMemo, useState } from "react";

import {
  Kpi,
  Painel,
  Variacao,
  Visoes,
  brl,
  inteiro,
  pct,
  vezes,
  GradeDeKpis,
} from "@/components/dashboards/base";
import { CustosDeCaptacao } from "@/components/dashboards/CustosDeCaptacao";
import { FunilComTaxas, FunilEmColunas } from "@/components/dashboards/funil";
import { GraficoComparativo } from "@/components/dashboards/GraficoComparativo";
import {
  TabelaDeMetricas,
  type ColunaDaTabela,
  type ColunaDeMetrica,
  type FormatoDaMetrica,
  type LinhaDeMetricas,
  type RegraDaTabela,
} from "@/components/dashboards/TabelaDeMetricas";
import { useT } from "@/hooks/i18n/useT";
import {
  ROTULO_DO_TIPO,
  TIPOS_DE_CONTATO,
  agregarProspeccao,
  agruparExtracoes,
  derivarProspeccao,
  diasDoRecorte,
  recorteAnterior,
  type BaseDaProspeccao,
  type BrutoDeProspeccao,
  type DerivadasDeProspeccao,
  type ExtracaoDoPainel,
} from "@/lib/dashboards/prospeccao";

/** O que a rota `/api/v1/dashboards/prospeccao` devolve. */
export interface DadosDeProspeccao extends BaseDaProspeccao {
  de: string;
  ate: string;
  abordagens: Array<{ id: string; nome: string; meio: string; campanha: string }>;
  catalogo: Array<{ id: string; nome: string }>;
  extracoes: Array<{ id: string; nome: string; dia: string; usd: number; brl: number | null }>;
  /** Todas as extrações e importações de onde vêm os leads do período. */
  lotes: ExtracaoDoPainel[];
  cambio: { taxa: number | null; origem: "automatica" | "manual" | "indisponivel"; iofPct: number };
  /** Abordagens registradas sem resultado (históricas): contam como sem contato. */
  semResultado: number;
}

type Visao = "geral" | "fontes" | "extracoes" | "abordagens" | "tipos";
type Coluna = ColunaDeMetrica<DerivadasDeProspeccao>;

const m = (
  id: string,
  titulo: string,
  formato: FormatoDaMetrica,
  valor: (d: DerivadasDeProspeccao) => number | null,
): Coluna => ({ tipo: "metrica", id, titulo, formato, valor });

/** Todas as colunas do funil de prospecção, na ordem do funil. */
const COLUNAS: Coluna[] = [
  m("leads", "Leads Captados", "inteiro", (d) => d.leads),
  m("cpl", "CPL", "brl", (d) => d.cpl),
  m("abordagens", "Abordagens", "inteiro", (d) => d.abordagens),
  m("leadsAbordados", "Leads Abordados", "inteiro", (d) => d.leadsAbordados),
  m("custoPorAbordagem", "Custo por Abordagem", "brl", (d) => d.custoPorAbordagem),
  m("taxaDeAbordados", "Taxa de Abordados", "pct1", (d) => d.taxaDeAbordados),
  m("contatos", "Contatos", "inteiro", (d) => d.contatos),
  m("custoPorContato", "Custo por Contato", "brl", (d) => d.custoPorContato),
  m("taxaDeResposta", "Taxa de Resposta", "pct1", (d) => d.taxaDeResposta),
  m("decisores", "Contatos com Decisor", "inteiro", (d) => d.decisores),
  m("custoPorDecisor", "Custo por Decisor", "brl", (d) => d.custoPorDecisor),
  m("taxaDeDecisor", "Taxa de Conversão (Decisor)", "pct1", (d) => d.taxaDeDecisor),
  m("reunioesAgendadas", "Reuniões Agendadas", "inteiro", (d) => d.reunioesAgendadas),
  m(
    "custoPorReuniaoAgendada",
    "Custo por Reunião Agendada",
    "brl",
    (d) => d.custoPorReuniaoAgendada,
  ),
  m("taxaDeAgendamento", "Taxa de Agendamento", "pct1", (d) => d.taxaDeAgendamento),
  m("reunioesFeitas", "Reuniões Feitas", "inteiro", (d) => d.reunioesFeitas),
  m("custoPorReuniaoFeita", "Custo por Reunião Feita", "brl", (d) => d.custoPorReuniaoFeita),
  m("taxaDeComparecimento", "Taxa de Comparecimento", "pct1", (d) => d.taxaDeComparecimento),
  m("vendas", "Vendas", "inteiro", (d) => d.vendas),
  m("cac", "CAC", "brl", (d) => d.cac),
  m("taxaDeConversao", "Taxa de Conversão", "pct1", (d) => d.taxaDeConversao),
  m("investimento", "Investido", "brl", (d) => d.investimento),
  m("recebido", "Faturado", "brl", (d) => d.recebido),
  m("lucro", "Lucro", "brl", (d) => d.lucro),
  m("roas", "ROAS", "vezes", (d) => d.roas),
];

/** O que cada recorte tem como medir: fonte só mede o que vem do lead; abordagem e tipo, só a abordagem. */
const SO_DA_ABORDAGEM = new Set([
  "abordagens",
  "leadsAbordados",
  "contatos",
  "taxaDeResposta",
  "decisores",
  "taxaDeDecisor",
]);
/** Fonte tem lead e custo lançado: leva o funil inteiro, com custos, lucro e ROAS. */
const COLUNAS_DA_FONTE = COLUNAS;
const DO_CONTATO = COLUNAS.filter((c) => SO_DA_ABORDAGEM.has(c.id));

const REGRA: RegraDaTabela<BrutoDeProspeccao, DerivadasDeProspeccao> = {
  derivar: derivarProspeccao,
};

const texto = (id: string, titulo: string): ColunaDaTabela<DerivadasDeProspeccao> => ({
  tipo: "texto",
  id,
  titulo,
});

/** PROSPECÇÃO ATIVA: o dashboard do contato direto, com tudo lido do CRM. */
export function ProspeccaoAtiva({ dados }: { dados: DadosDeProspeccao }) {
  const t = useT();
  const [visao, setVisao] = useState<Visao>("geral");
  const recorte = useMemo(() => ({ de: dados.de, ate: dados.ate }), [dados.de, dados.ate]);
  const base: BaseDaProspeccao = dados;
  const total = useMemo(() => agregarProspeccao(base, recorte), [base, recorte]);
  const a = derivarProspeccao(total);
  const p = derivarProspeccao(agregarProspeccao(base, recorteAnterior(recorte)));
  const dias = useMemo(() => diasDoRecorte(recorte), [recorte]);

  const porDia = useMemo(
    () => dias.map((d) => ({ d, b: agregarProspeccao(base, recorte, { dia: d }) })),
    [dias, base, recorte],
  );
  const serie = porDia.map(({ d, b }) => ({ data: d, ...b }));
  const metricas = [
    { id: "leads", rotulo: t("Leads captados"), formato: inteiro },
    { id: "abordagens", rotulo: t("Abordagens"), formato: inteiro },
    { id: "leadsAbordados", rotulo: t("Leads abordados"), formato: inteiro },
    { id: "contatos", rotulo: t("Contatos"), formato: inteiro },
    { id: "decisores", rotulo: t("Contatos com decisor"), formato: inteiro },
    { id: "reunioesAgendadas", rotulo: t("Reuniões agendadas"), formato: inteiro },
    { id: "reunioesFeitas", rotulo: t("Reuniões feitas"), formato: inteiro },
    { id: "vendas", rotulo: t("Vendas"), formato: inteiro },
    { id: "recebido", rotulo: t("Faturamento recebido"), formato: brl },
    { id: "investimento", rotulo: t("Investido"), formato: brl },
  ];

  const linhasDeDias: LinhaDeMetricas<BrutoDeProspeccao>[] = porDia.map(({ d, b }) => ({
    chave: d,
    textos: { nome: `${d.slice(8, 10)}/${d.slice(5, 7)}` },
    bruto: b,
  }));

  const fontes = useMemo(() => {
    const vistas = new Map<string, string>();
    for (const f of [...dados.leads.map((l) => l.fonte), ...dados.custos.map((c) => c.fonte)]) {
      if (!vistas.has(f.trim().toLowerCase())) vistas.set(f.trim().toLowerCase(), f.trim());
    }
    return [...vistas.values()].sort();
  }, [dados.leads, dados.custos]);
  const linhasDeFontes: LinhaDeMetricas<BrutoDeProspeccao>[] = fontes.map((f) => ({
    chave: f,
    textos: { nome: f },
    bruto: agregarProspeccao(base, recorte, { fonte: f }),
  }));
  // Por extração, termo e cidade: cada grupo soma só os leads e os custos das extrações dele.
  const lotes = dados.lotes ?? [];
  const nomeDoModo = (e: ExtracaoDoPainel) =>
    e.tipo === "importacao" ? t("Importação") : e.modo === "volume" ? t("Volume") : t("Completa");
  const linhasDeExtracoes: LinhaDeMetricas<BrutoDeProspeccao>[] = agruparExtracoes(
    lotes,
    "extracao",
  ).map((g) => {
    const e = lotes.find((x) => x.id === [...g.ids][0])!;
    return {
      chave: g.chave,
      textos: {
        nome: g.nome,
        tipo: nomeDoModo(e),
        termo: e.termo ?? "",
        cidade: e.cidade ?? "",
      },
      bruto: agregarProspeccao(base, recorte, { extracoes: g.ids }),
    };
  });
  const linhasPor = (por: "termo" | "cidade"): LinhaDeMetricas<BrutoDeProspeccao>[] =>
    agruparExtracoes(lotes, por).map((g) => ({
      chave: g.chave,
      textos: { nome: g.nome },
      bruto: agregarProspeccao(base, recorte, { extracoes: g.ids }),
    }));
  const linhasDeAbordagens: LinhaDeMetricas<BrutoDeProspeccao>[] = [
    ...dados.abordagens.map((x) => ({
      chave: x.id,
      textos: { nome: x.nome, campanha: x.campanha, meio: x.meio },
      bruto: agregarProspeccao(base, recorte, { abordagemId: x.id }),
      semMidia: true,
    })),
    {
      chave: "sem",
      textos: { nome: t("Sem abordagem definida"), campanha: "", meio: "" },
      bruto: agregarProspeccao(base, recorte, { abordagemId: null }),
      semMidia: true,
    },
  ];
  const linhasDeTipos: LinhaDeMetricas<BrutoDeProspeccao>[] = TIPOS_DE_CONTATO.map((tipo) => ({
    chave: tipo,
    textos: { nome: t(ROTULO_DO_TIPO[tipo]) },
    bruto: agregarProspeccao(base, recorte, { tipo }),
    semMidia: true,
  }));
  const regraComTotal = (): RegraDaTabela<BrutoDeProspeccao, DerivadasDeProspeccao> => ({
    derivar: REGRA.derivar,
    total: () => total,
  });

  const p1 = (v: number | null) => (v === null ? "—" : pct(v, 1));
  const item = (rotulo: string, valor: string) => ({ rotulo, valor });

  return (
    <div className="grid min-w-0 gap-4">
      <Visoes
        valor={visao}
        aoMudar={setVisao}
        opcoes={[
          { id: "geral", rotulo: t("Visão geral") },
          { id: "fontes", rotulo: t("Por fonte de lead") },
          { id: "extracoes", rotulo: t("Por extração") },
          { id: "abordagens", rotulo: t("Por abordagem") },
          { id: "tipos", rotulo: t("Por tipo de contato") },
        ]}
      />

      {dados.catalogo.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          {t(
            "Nenhuma campanha de prospecção cadastrada. Crie uma em Campanhas para ver os números aqui.",
          )}
        </p>
      ) : null}

      {dados.semResultado > 0 ? (
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {dados.semResultado}{" "}
          {t(
            "abordagens antigas foram registradas sem resultado e contam como sem contato. Agora o resultado é obrigatório.",
          )}
        </p>
      ) : null}

      <GradeDeKpis className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          apoio={t("Orçamento das campanhas de prospecção")}
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
          rotulo={t("Leads abordados")}
          valor={inteiro(a.leadsAbordados)}
          variacao={<Variacao atual={a.leadsAbordados} anterior={p.leadsAbordados} />}
          apoio={`${inteiro(a.abordagens)} ${t("abordagens no total")}`}
        />
        <Kpi
          rotulo={t("Custo por abordagem (API/SDR)")}
          valor={brl(a.custoPorAbordagem)}
          variacao={
            <Variacao atual={a.custoPorAbordagem} anterior={p.custoPorAbordagem} menorEMelhor />
          }
          apoio={t("Investido ÷ abordagens")}
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
      </GradeDeKpis>

      {visao === "geral" ? (
        <>
          <Painel titulo={t("Funil completo")} nota={t("Consolidado do período")}>
            <FunilEmColunas
              colunas={[
                {
                  rotulo: t("Leads captados"),
                  valor: inteiro(a.leads),
                  itens: [
                    item(t("CPL"), brl(a.cpl)),
                    item(t("Investimento total"), brl(a.investimento)),
                  ],
                },
                {
                  rotulo: t("Abordagens"),
                  valor: inteiro(a.abordagens),
                  itens: [
                    item(t("Custo por abordagem"), brl(a.custoPorAbordagem)),
                    item(t("Taxa de abordados"), p1(a.taxaDeAbordados)),
                  ],
                },
                {
                  rotulo: t("Contatos"),
                  valor: inteiro(a.contatos),
                  itens: [
                    item(t("Custo por contato"), brl(a.custoPorContato)),
                    item(t("Taxa de resposta"), p1(a.taxaDeResposta)),
                  ],
                },
                {
                  rotulo: t("Contatos com decisor"),
                  valor: inteiro(a.decisores),
                  itens: [
                    item(t("Custo por decisor"), brl(a.custoPorDecisor)),
                    item(t("Taxa de conversão"), p1(a.taxaDeDecisor)),
                  ],
                },
                {
                  rotulo: t("Reuniões agendadas"),
                  valor: inteiro(a.reunioesAgendadas),
                  itens: [
                    item(t("Custo por reunião"), brl(a.custoPorReuniaoAgendada)),
                    item(t("Taxa de agendamento"), p1(a.taxaDeAgendamento)),
                  ],
                },
                {
                  rotulo: t("Reuniões feitas"),
                  valor: inteiro(a.reunioesFeitas),
                  itens: [
                    item(t("Custo por reunião"), brl(a.custoPorReuniaoFeita)),
                    item(t("Taxa de comparecimento"), p1(a.taxaDeComparecimento)),
                  ],
                },
                {
                  rotulo: t("Vendas"),
                  valor: inteiro(a.vendas),
                  itens: [
                    item(t("CAC"), brl(a.cac)),
                    item(t("Taxa de conversão"), p1(a.taxaDeConversao)),
                  ],
                },
              ]}
            />
          </Painel>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Painel titulo={t("Volume diário")} nota={t("Compare duas métricas")}>
              <GraficoComparativo
                dados={serie}
                metricas={metricas}
                inicial={["abordagens", "contatos"]}
              />
            </Painel>
            <Painel titulo={t("Fluxo")} nota={t("Do lead captado à venda")}>
              <FunilComTaxas
                etapas={[
                  { rotulo: t("Leads"), valor: inteiro(a.leads) },
                  { rotulo: t("Abordados"), valor: inteiro(a.leadsAbordados) },
                  { rotulo: t("Contatos"), valor: inteiro(a.contatos) },
                  { rotulo: t("Decisores"), valor: inteiro(a.decisores) },
                  { rotulo: t("Reuniões agendadas"), valor: inteiro(a.reunioesAgendadas) },
                  { rotulo: t("Reuniões feitas"), valor: inteiro(a.reunioesFeitas) },
                  { rotulo: t("Vendas"), valor: inteiro(a.vendas) },
                ]}
                taxas={[
                  {
                    rotulo: t("Taxa de abordados"),
                    valor: p1(a.taxaDeAbordados),
                    detalhe: t("abordados ÷ leads"),
                  },
                  {
                    rotulo: t("Taxa de resposta"),
                    valor: p1(a.taxaDeResposta),
                    detalhe: t("contatos ÷ abordados"),
                  },
                  {
                    rotulo: t("Decisor"),
                    valor: p1(a.taxaDeDecisor),
                    detalhe: t("decisores ÷ contatos"),
                  },
                  {
                    rotulo: t("Agendamento"),
                    valor: p1(a.taxaDeAgendamento),
                    detalhe: t("agendadas ÷ decisores"),
                  },
                  {
                    rotulo: t("Comparecimento"),
                    valor: p1(a.taxaDeComparecimento),
                    detalhe: t("feitas ÷ agendadas"),
                  },
                  {
                    rotulo: t("Conversão"),
                    valor: p1(a.taxaDeConversao),
                    detalhe: t("vendas ÷ feitas"),
                  },
                ]}
              />
            </Painel>
          </div>

          <Painel titulo={t("Detalhamento diário")} nota={`${dias.length} ${t("dias")}`}>
            <TabelaDeMetricas
              id="prospeccao-dias"
              regra={regraComTotal()}
              colunas={[texto("nome", t("Dia")), ...COLUNAS]}
              linhas={linhasDeDias}
            />
          </Painel>
        </>
      ) : null}

      {visao === "fontes" ? (
        <Painel
          titulo={t("Por fonte de lead")}
          nota={t(
            "De onde vieram os leads: extração, importação, indicação… (origem gravada no lead)",
          )}
        >
          <TabelaDeMetricas
            id="prospeccao-fontes"
            regra={regraComTotal()}
            colunas={[texto("nome", t("Fonte")), ...COLUNAS_DA_FONTE]}
            linhas={linhasDeFontes}
          />
        </Painel>
      ) : null}

      {visao === "fontes" ? (
        <Painel
          titulo={t("Custos de captação")}
          nota={t("Quanto investimos para captar leads de cada fonte")}
        >
          <CustosDeCaptacao
            de={dados.de}
            ate={dados.ate}
            fontes={fontes}
            campanhas={dados.catalogo}
            extracoes={dados.extracoes}
            cambio={dados.cambio}
          />
        </Painel>
      ) : null}

      {visao === "extracoes" ? (
        <>
          <Painel
            titulo={t("Por extração")}
            nota={t(
              "Cada extração ou importação da campanha, com os leads que trouxe, o custo e o que virou venda",
            )}
          >
            <TabelaDeMetricas
              id="prospeccao-extracoes"
              regra={regraComTotal()}
              colunas={[
                texto("nome", t("Extração")),
                texto("tipo", t("Tipo")),
                texto("termo", t("Termo")),
                texto("cidade", t("Cidade")),
                ...COLUNAS_DA_FONTE,
              ]}
              linhas={linhasDeExtracoes}
            />
          </Painel>
          <Painel titulo={t("Por termo")} nota={t("Qual segmento buscado rende mais")}>
            <TabelaDeMetricas
              id="prospeccao-termos"
              regra={regraComTotal()}
              colunas={[texto("nome", t("Termo")), ...COLUNAS_DA_FONTE]}
              linhas={linhasPor("termo")}
            />
          </Painel>
          <Painel titulo={t("Por cidade")} nota={t("Qual cidade ou bairro rende mais")}>
            <TabelaDeMetricas
              id="prospeccao-cidades"
              regra={regraComTotal()}
              colunas={[texto("nome", t("Cidade")), ...COLUNAS_DA_FONTE]}
              linhas={linhasPor("cidade")}
            />
          </Painel>
        </>
      ) : null}

      {visao === "abordagens" ? (
        <Painel
          titulo={t("Por abordagem")}
          nota={t(
            "Roteiros definidos na campanha. Disparos de campanha entram em “Sem abordagem definida”",
          )}
        >
          <TabelaDeMetricas
            id="prospeccao-abordagens"
            regra={regraComTotal()}
            colunas={[
              texto("nome", t("Abordagem")),
              texto("campanha", t("Campanha")),
              texto("meio", t("Meio")),
              ...DO_CONTATO,
            ]}
            linhas={linhasDeAbordagens}
          />
        </Painel>
      ) : null}

      {visao === "tipos" ? (
        <Painel
          titulo={t("Por tipo de contato")}
          nota={t("Qual tipo de contato tem a melhor resposta")}
        >
          <TabelaDeMetricas
            id="prospeccao-tipos"
            regra={regraComTotal()}
            colunas={[texto("nome", t("Tipo de contato")), ...DO_CONTATO]}
            linhas={linhasDeTipos}
          />
        </Painel>
      ) : null}
    </div>
  );
}
