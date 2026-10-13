"use client";

import { useEffect, useState } from "react";

import {
  COR_DO_STATUS_DO_CRIATIVO,
  rotuloDoStatusDoCriativo,
} from "@/components/marketing/campanhas/rotulos";
import { toast } from "sonner";

import {
  FiltroDePeriodoDaCampanha,
  usePeriodoDaCampanha,
} from "@/components/marketing/campanhas/FiltroDePeriodoDaCampanha";
import {
  ColecaoDaCampanha,
  type CampoDaColecao,
} from "@/components/marketing/campanhas/ColecaoDaCampanha";
import { LinkComVer } from "@/components/marketing/campanhas/LinkComVer";
import { CelulaDeTexto } from "@/components/motor/CelulaDeTexto";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";
import type { ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { apiClient } from "@/lib/api/client";
import { useT } from "@/hooks/i18n/useT";
import {
  useCriativosDaCampanha,
  useLandingPagesDaCampanha,
  useOrigemDosLeads,
} from "@/hooks/marketing/useCampanhasDeDemanda";
import { STATUS_DA_LP, metricasDaLp, type LandingPage } from "@/lib/marketing/landing-pages";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { Check, LinkSimple, Plus, TextAa, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (n: number | null) =>
  n === null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const reais = (n: number | null) => (n === null ? "—" : moedaDoNumero(n));

function Texto({
  valor,
  aoGravar,
  desabilitado,
  rotulo,
  max,
}: {
  valor: string;
  aoGravar: (v: string) => void;
  desabilitado: boolean;
  rotulo: string;
  max: number;
}) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  return (
    <input
      className={CAMPO}
      value={v}
      maxLength={max}
      disabled={desabilitado}
      placeholder={rotulo}
      aria-label={rotulo}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== valor && aoGravar(v)}
    />
  );
}

/** Os números de uma LP: a entrega dos criativos que apontam para ela e o que vem do CRM. */
interface LinhaDaLp {
  id: string;
  position: number;
  lp: LandingPage;
  m: ReturnType<typeof metricasDaLp>;
  leads: number;
  /** Vendas fechadas atreladas à LP e o que já caiu delas, em reais. */
  vendas: number;
  faturamento: number;
}

/**
 * As LANDING PAGES da campanha: o cadastro dos links que estão rodando, a pré-visualização e a
 * análise comparativa (métricas de entrega dos criativos que apontam para cada LP). Cartões para
 * editar, tabela para comparar; filtros, ordem, grupos e visualizações salvas como em Tarefas.
 */
export function LandingPagesDaCampanha({
  campanhaId,
  podeEditar,
  periodoPadrao,
}: {
  campanhaId: string;
  podeEditar: boolean;
  /** O período da campanha (início e fim; contínua = mês atual). */
  periodoPadrao: { de: string; ate: string };
}) {
  const t = useT();
  const { lps, carregando, criar, editar, apagar } = useLandingPagesDaCampanha(campanhaId);
  const { criativos } = useCriativosDaCampanha(campanhaId);
  const periodo = usePeriodoDaCampanha(periodoPadrao);
  const { origem } = useOrigemDosLeads(campanhaId, periodo.janela);
  const [novaId, setNovaId] = useState<string | null>(null);

  const linhas: LinhaDaLp[] = lps.map((lp) => ({
    id: lp.id,
    position: lp.position,
    lp,
    m: metricasDaLp(lp, criativos),
    leads: origem?.porLandingPage[lp.id] ?? 0,
    vendas: origem?.faturamento?.vendasPorLandingPage?.[lp.id] ?? 0,
    faturamento: (origem?.faturamento?.porLandingPage[lp.id] ?? 0) / 100,
  }));
  const opcoesDeStatus = STATUS_DA_LP.map((s) => ({
    id: s,
    rotulo: rotuloDoStatusDoCriativo(t, s),
    cor: COR_DO_STATUS_DO_CRIATIVO[s],
  }));
  const conversao = (l: LinhaDaLp) =>
    periodo.ehPadrao && l.m.lp_views > 0 ? (l.leads / l.m.lp_views) * 100 : null;
  const cplReal = (l: LinhaDaLp) =>
    periodo.ehPadrao && l.leads > 0 && l.m.spend > 0 ? l.m.spend / l.leads : null;

  const campos: CampoDaColecao<LinhaDaLp>[] = [
    { id: "nome", titulo: t("Landing page"), tipo: "texto", valorDe: (l) => l.lp.name },
    {
      id: "status",
      titulo: t("Status"),
      tipo: "opcao",
      valorDe: (l) => l.lp.status,
      opcoes: opcoesDeStatus,
      ordemDoValor: (v) => STATUS_DA_LP.indexOf(v as (typeof STATUS_DA_LP)[number]),
    },
    { id: "url", titulo: t("Link"), tipo: "texto", valorDe: (l) => l.lp.url },
    { id: "investido", titulo: t("Investido"), tipo: "numero", valorDe: (l) => l.m.spend },
    {
      id: "cliques",
      titulo: t("Cliques no link"),
      tipo: "numero",
      valorDe: (l) => l.m.link_clicks,
    },
    { id: "visitas", titulo: t("Visitas à LP"), tipo: "numero", valorDe: (l) => l.m.lp_views },
    {
      id: "connection",
      titulo: t("Connection rate"),
      tipo: "numero",
      valorDe: (l) => l.m.connectRate,
    },
    { id: "leads", titulo: t("Leads (CRM)"), tipo: "numero", valorDe: (l) => l.leads },
    { id: "conversao", titulo: t("Conversão da LP"), tipo: "numero", valorDe: conversao },
    { id: "cpl", titulo: t("CPL real"), tipo: "numero", valorDe: cplReal },
    { id: "vendas", titulo: t("Vendas"), tipo: "numero", valorDe: (l) => l.vendas },
    {
      id: "faturamento",
      titulo: t("Faturamento"),
      tipo: "numero",
      valorDe: (l) => l.faturamento,
    },
  ];

  const numero = (texto: string) => (
    <span className="block truncate px-2 text-sm tabular-nums">{texto}</span>
  );
  const colunas: ColunaDoMotor<LinhaDaLp>[] = [
    {
      id: "nome",
      titulo: t("Landing page"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 260,
      semOcultar: true,
      celula: (l) => (
        <CelulaDeTexto
          valor={l.lp.name}
          rotulo={t("Nome da LP")}
          podeEditar={podeEditar}
          aoSalvar={(name) => void editar(l.lp.id, { name })}
        />
      ),
    },
    {
      id: "status",
      titulo: t("Status"),
      icone: <Check size={14} aria-hidden />,
      largura: 150,
      celula: (l) => (
        <SeletorDeOpcao
          opcoes={opcoesDeStatus}
          valorId={l.lp.status}
          podeEditar={podeEditar}
          rotulo={t("Status")}
          aoEscolher={(id) => void editar(l.lp.id, { status: id as LandingPage["status"] })}
        >
          <Etiqueta ponto cor={COR_DO_STATUS_DO_CRIATIVO[l.lp.status]}>
            {rotuloDoStatusDoCriativo(t, l.lp.status)}
          </Etiqueta>
        </SeletorDeOpcao>
      ),
    },
    {
      id: "url",
      titulo: t("Link"),
      icone: <LinkSimple size={14} aria-hidden />,
      largura: 360,
      celula: (l) => (
        <LinkComVer url={l.lp.url}>
          <CelulaDeTexto
            valor={l.lp.url}
            rotulo={t("Link da LP (https://…)")}
            vazioRotulo="—"
            permitirVazio
            inputMode="url"
            podeEditar={podeEditar}
            aoSalvar={(url) => void editar(l.lp.id, { url })}
          />
        </LinkComVer>
      ),
    },
    {
      id: "investido",
      titulo: t("Investido"),
      largura: 130,
      celula: (l) => numero(moedaDoNumero(l.m.spend)),
    },
    {
      id: "cliques",
      titulo: t("Cliques no link"),
      largura: 130,
      celula: (l) => numero(inteiro(l.m.link_clicks)),
    },
    {
      id: "visitas",
      titulo: t("Visitas à LP"),
      largura: 120,
      celula: (l) => numero(inteiro(l.m.lp_views)),
    },
    {
      id: "connection",
      titulo: t("Connection rate"),
      largura: 140,
      celula: (l) => numero(pct(l.m.connectRate)),
    },
    {
      id: "cpc",
      titulo: t("CPC"),
      largura: 100,
      padrao: false,
      celula: (l) => numero(reais(l.m.cpc)),
    },
    {
      id: "leads",
      titulo: t("Leads (CRM)"),
      largura: 120,
      celula: (l) => numero(inteiro(l.leads)),
    },
    {
      id: "conversao",
      titulo: t("Conversão da LP"),
      largura: 140,
      celula: (l) => numero(pct(conversao(l))),
    },
    {
      id: "cpl",
      titulo: t("CPL real"),
      largura: 120,
      celula: (l) => numero(reais(cplReal(l))),
    },
    {
      id: "vendas",
      titulo: t("Vendas"),
      largura: 100,
      celula: (l) => numero(inteiro(l.vendas)),
    },
    {
      id: "faturamento",
      titulo: t("Faturamento"),
      largura: 140,
      celula: (l) => numero(l.faturamento > 0 ? moedaDoNumero(l.faturamento) : "—"),
    },
    {
      id: "criativos",
      titulo: t("Criativos"),
      largura: 110,
      padrao: false,
      celula: (l) => numero(inteiro(l.m.criativos)),
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Landing pages")}</h2>
        {podeEditar ? (
          <button
            type="button"
            onClick={async () => {
              const nova = await criar({ name: t("Nova landing page") });
              if (nova) {
                setNovaId(nova.id);
                toast.success(t("Landing page criada. Preencha o nome e o link."));
              }
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Nova landing page")}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "Cadastre o link de cada LP que está rodando. As métricas vêm dos criativos cuja página de destino é o mesmo link. Leads, conversão, vendas e faturamento vêm do CRM, pela origem de cada lead e de cada venda.",
        )}
      </p>

      <FiltroDePeriodoDaCampanha periodo={periodo} />
      <p className="text-xs text-muted-foreground">
        {periodo.ehPadrao
          ? t(
              "Leads, vendas e faturamento são do período escolhido. Gasto, impressões e cliques são o acumulado do Meta.",
            )
          : t(
              "Leads, vendas e faturamento são do período escolhido. Gasto, impressões e cliques são o acumulado do Meta, por isso CPL, conversão e ROAS ficam em “—” fora do período da campanha.",
            )}
      </p>

      <ColecaoDaCampanha
        tela="campanha-lps"
        itens={linhas}
        carregando={carregando}
        podeEditar={podeEditar}
        vazio={t("Nenhuma landing page ainda. Cadastre a primeira.")}
        rotuloDaTabela={t("Landing pages")}
        campos={campos}
        colunas={colunas}
        textoDaBusca={(l) => `${l.lp.name} ${l.lp.url} ${l.lp.notes}`}
        gradeDosCartoes="grid grid-cols-1 gap-3"
        aoMudarPosicao={(id, position) => void editar(id, { position })}
        destacarId={novaId}
        cartao={(l) => (
          <CartaoDaLp
            lp={l.lp}
            m={l.m}
            leads={l.leads}
            vendas={l.vendas}
            faturamento={l.faturamento}
            conversao={conversao(l)}
            cplReal={cplReal(l)}
            campanhaId={campanhaId}
            podeEditar={podeEditar}
            editar={(patch) => void editar(l.lp.id, patch)}
            apagar={() => void apagar(l.lp.id)}
          />
        )}
      />
    </section>
  );
}

function CartaoDaLp({
  lp,
  m,
  leads,
  vendas,
  faturamento,
  conversao,
  cplReal,
  campanhaId,
  podeEditar,
  editar,
  apagar,
}: {
  conversao: number | null;
  cplReal: number | null;
  lp: LandingPage;
  m: ReturnType<typeof metricasDaLp>;
  leads: number;
  vendas: number;
  faturamento: number;
  campanhaId: string;
  podeEditar: boolean;
  editar: (patch: Partial<Pick<LandingPage, "name" | "url" | "status" | "notes">>) => void;
  apagar: () => void;
}) {
  const t = useT();
  const [vendo, setVendo] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [laudo, setLaudo] = useState<Laudo | null>(null);

  async function pre() {
    if (vendo) return setVendo(false);
    setVerificando(true);
    try {
      const r = await apiClient.post<{ data: Laudo }>(
        `/api/v1/demand-campaigns/${campanhaId}/landing-pages/${lp.id}/check-embed`,
        {},
      );
      setLaudo(r.data);
      setVendo(r.data.pode !== false);
    } catch {
      setLaudo({ pode: null, motivo: "nao_foi_possivel_verificar", origem_do_painel: "" });
      setVendo(true);
    } finally {
      setVerificando(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl border p-3">
      <div className="flex flex-wrap items-center gap-2 pr-20">
        <Etiqueta cor={COR_DO_STATUS_DO_CRIATIVO[lp.status]}>
          {rotuloDoStatusDoCriativo(t, lp.status)}
        </Etiqueta>
        <span className="text-xs text-muted-foreground">
          {m.criativos} {t("criativos apontam para ela")}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <Texto
          valor={lp.name}
          aoGravar={(name) => name.trim() && editar({ name })}
          desabilitado={!podeEditar}
          rotulo={t("Nome da LP")}
          max={160}
        />
        <Texto
          valor={lp.url}
          aoGravar={(url) => editar({ url })}
          desabilitado={!podeEditar}
          rotulo={t("Link da LP (https://…)")}
          max={1000}
        />
        <select
          className={cn(CAMPO, "sm:w-36")}
          disabled={!podeEditar}
          value={lp.status}
          aria-label={t("Status")}
          onChange={(e) => editar({ status: e.target.value as LandingPage["status"] })}
        >
          {STATUS_DA_LP.map((s) => (
            <option key={s} value={s}>
              {rotuloDoStatusDoCriativo(t, s)}
            </option>
          ))}
        </select>
      </div>
      <Texto
        valor={lp.notes}
        aoGravar={(notes) => editar({ notes })}
        desabilitado={!podeEditar}
        rotulo={t("Observações")}
        max={2000}
      />
      <div className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-xl bg-secondary/40 p-3 sm:grid-cols-5">
        <Metrica rotulo={t("Investido")} valor={moedaDoNumero(m.spend)} />
        <Metrica rotulo={t("Impressões")} valor={inteiro(m.impressions)} />
        <Metrica rotulo={t("Cliques no link")} valor={inteiro(m.link_clicks)} />
        <Metrica rotulo={t("Visitas à LP")} valor={inteiro(m.lp_views)} />
        <Metrica rotulo={t("Connection rate")} valor={pct(m.connectRate)} />
        <Metrica rotulo={t("CPC")} valor={reais(m.cpc)} />
        <Metrica rotulo={t("Leads (CRM)")} valor={inteiro(leads)} />
        <Metrica rotulo={t("Conversão da LP")} valor={pct(conversao)} />
        <Metrica rotulo={t("CPL real")} valor={reais(cplReal)} />
        <Metrica rotulo={t("Vendas")} valor={inteiro(vendas)} />
        <Metrica
          rotulo={t("Faturamento")}
          valor={faturamento > 0 ? moedaDoNumero(faturamento) : "—"}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {lp.url ? (
          <>
            <button
              type="button"
              aria-expanded={vendo}
              disabled={verificando}
              onClick={() => void pre()}
              className="h-9 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary disabled:opacity-50"
            >
              {verificando
                ? t("Verificando…")
                : vendo
                  ? t("Fechar pré-visualização")
                  : t("Pré-visualizar")}
            </button>
            <a
              href={lp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
            >
              {t("Abrir em nova aba")}
            </a>
          </>
        ) : null}
        {podeEditar ? (
          <button
            type="button"
            aria-label={t("Apagar landing page")}
            onClick={() => {
              if (window.confirm(t("Apagar esta landing page?"))) apagar();
            }}
            className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
          >
            <Trash size={16} aria-hidden />
          </button>
        ) : null}
      </div>
      {laudo?.pode === false ? <GuiaDeEmbed laudo={laudo} /> : null}
      {vendo && lp.url ? (
        <div className="grid grid-cols-1 gap-1">
          <iframe
            src={lp.url}
            title={`${t("Pré-visualização")} — ${lp.name}`}
            sandbox="allow-scripts allow-same-origin allow-forms"
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-[560px] w-full rounded-xl border bg-background"
          />
          <p className="text-xs text-muted-foreground">
            {t(
              "Se a página ficar em branco, o site não permite aparecer aqui: use “Abrir em nova aba”.",
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{rotulo}</p>
      <p className="text-sm font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

interface Laudo {
  pode: boolean | null;
  motivo: string;
  detalhe?: string;
  origem_do_painel: string;
  status_http?: number | null;
}

/** Por que a página não aparece aqui dentro e como liberar — com a origem exata do painel. */
function GuiaDeEmbed({ laudo }: { laudo: Laudo }) {
  const t = useT();
  const origem = laudo.origem_do_painel;
  const csp = `Content-Security-Policy: frame-ancestors 'self' ${origem}`;
  const nginx = `# nginx — dentro do bloco server { } do seu site\nadd_header Content-Security-Policy "frame-ancestors 'self' ${origem}" always;\n# e remova qualquer linha: add_header X-Frame-Options ...`;
  const apache = `# Apache — .htaccess\nHeader unset X-Frame-Options\nHeader always set Content-Security-Policy "frame-ancestors 'self' ${origem}"`;
  const next = `// Next.js — next.config.js\nasync headers() {\n  return [{ source: "/(.*)", headers: [\n    { key: "Content-Security-Policy", value: "frame-ancestors 'self' ${origem}" },\n  ] }];\n}`;
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-warning/40 bg-warning-bg p-3 text-sm text-warning-fg">
      <p className="font-semibold">{t("Esta página não permite aparecer dentro do painel.")}</p>
      <p>
        {laudo.motivo === "x_frame_options"
          ? t(
              "O servidor dela envia o cabeçalho X-Frame-Options, que proíbe ser exibida em outro site. Para liberar só o seu painel, troque esse cabeçalho pelo abaixo (e remova o X-Frame-Options):",
            )
          : t(
              "O servidor dela envia um Content-Security-Policy com frame-ancestors que não inclui o seu painel. Acrescente o endereço do painel nessa lista:",
            )}
      </p>
      <pre className="overflow-x-auto rounded-lg bg-card p-2 text-xs text-foreground">{csp}</pre>
      <details>
        <summary className="cursor-pointer font-medium">{t("Como fazer no meu servidor")}</summary>
        <div className="mt-2 grid gap-2">
          <pre className="overflow-x-auto rounded-lg bg-card p-2 text-xs text-foreground">
            {nginx}
          </pre>
          <pre className="overflow-x-auto rounded-lg bg-card p-2 text-xs text-foreground">
            {apache}
          </pre>
          <pre className="overflow-x-auto rounded-lg bg-card p-2 text-xs text-foreground">
            {next}
          </pre>
          <p>
            {t(
              "Em plugins de WordPress ou na Cloudflare, procure por “X-Frame-Options” ou “cabeçalhos de segurança” e remova; depois adicione o Content-Security-Policy acima.",
            )}
          </p>
        </div>
      </details>
      <p>
        {t(
          "Isso libera só o seu painel — outros sites continuam sem poder exibir a página. Depois de salvar, clique em Pré-visualizar de novo.",
        )}
      </p>
    </div>
  );
}
