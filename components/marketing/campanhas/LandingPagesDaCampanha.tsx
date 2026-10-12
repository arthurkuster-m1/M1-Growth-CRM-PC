"use client";

import { useEffect, useState } from "react";

import {
  COR_DO_STATUS_DO_CRIATIVO,
  rotuloDoStatusDoCriativo,
} from "@/components/marketing/campanhas/rotulos";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { apiClient } from "@/lib/api/client";
import { useT } from "@/hooks/i18n/useT";
import {
  useCriativosDaCampanha,
  useLandingPagesDaCampanha,
  useOrigemDosLeads,
} from "@/hooks/marketing/useCampanhasDeDemanda";
import { STATUS_DA_LP, metricasDaLp, type LandingPage } from "@/lib/marketing/landing-pages";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { Plus, Trash } from "@/lib/ui/icons";
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

/**
 * As LANDING PAGES da campanha: o cadastro dos links que estão rodando, a pré-visualização e a
 * análise comparativa (métricas de entrega dos criativos que apontam para cada LP).
 */
export function LandingPagesDaCampanha({
  campanhaId,
  podeEditar,
}: {
  campanhaId: string;
  podeEditar: boolean;
}) {
  const t = useT();
  const { lps, carregando, criar, editar, apagar } = useLandingPagesDaCampanha(campanhaId);
  const { criativos } = useCriativosDaCampanha(campanhaId);
  const { origem } = useOrigemDosLeads(campanhaId);
  const leadsDaLp = (id: string) => origem?.porLandingPage[id] ?? 0;
  const [vendo, setVendo] = useState<string | null>(null);
  const [verificando, setVerificando] = useState<string | null>(null);
  const [laudos, setLaudos] = useState<Record<string, Laudo>>({});

  async function pre(lp: LandingPage) {
    if (vendo === lp.id) return setVendo(null);
    setVerificando(lp.id);
    try {
      const r = await apiClient.post<{ data: Laudo }>(
        `/api/v1/demand-campaigns/${campanhaId}/landing-pages/${lp.id}/check-embed`,
        {},
      );
      setLaudos((l) => ({ ...l, [lp.id]: r.data }));
      if (r.data.pode !== false) setVendo(lp.id);
      else setVendo(null);
    } catch {
      setLaudos((l) => ({
        ...l,
        [lp.id]: { pode: null, motivo: "nao_foi_possivel_verificar", origem_do_painel: "" },
      }));
      setVendo(lp.id);
    } finally {
      setVerificando(null);
    }
  }
  const linhas = lps.map((lp) => ({ lp, m: metricasDaLp(lp, criativos) }));
  const comDados = linhas.filter((l) => l.m.impressions > 0 || l.m.spend > 0);
  const melhorConexao = Math.max(...comDados.map((l) => l.m.connectRate ?? -1));

  return (
    <section className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Landing pages")}</h2>
        {podeEditar ? (
          <button
            type="button"
            onClick={() => void criar({ name: t("Nova landing page") })}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Nova landing page")}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "Cadastre o link de cada LP que está rodando. As métricas vêm dos criativos cuja página de destino é o mesmo link.",
        )}
      </p>

      {carregando ? (
        <div className="h-24 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
      ) : lps.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {t("Nenhuma landing page ainda. Cadastre a primeira.")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {linhas.map(({ lp, m }) => (
            <li key={lp.id} className="grid grid-cols-1 gap-3 rounded-2xl border p-3">
              <div className="flex flex-wrap items-center gap-2">
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
                  aoGravar={(name) => name.trim() && void editar(lp.id, { name })}
                  desabilitado={!podeEditar}
                  rotulo={t("Nome da LP")}
                  max={160}
                />
                <Texto
                  valor={lp.url}
                  aoGravar={(url) => void editar(lp.id, { url })}
                  desabilitado={!podeEditar}
                  rotulo={t("Link da LP (https://…)")}
                  max={1000}
                />
                <select
                  className={cn(CAMPO, "sm:w-36")}
                  disabled={!podeEditar}
                  value={lp.status}
                  aria-label={t("Status")}
                  onChange={(e) =>
                    void editar(lp.id, { status: e.target.value as LandingPage["status"] })
                  }
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
                aoGravar={(notes) => void editar(lp.id, { notes })}
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
                <Metrica rotulo={t("Leads (CRM)")} valor={inteiro(leadsDaLp(lp.id))} />
                <Metrica
                  rotulo={t("Conversão da LP")}
                  valor={pct(m.lp_views > 0 ? (leadsDaLp(lp.id) / m.lp_views) * 100 : null)}
                />
                <Metrica
                  rotulo={t("CPL real")}
                  valor={
                    leadsDaLp(lp.id) > 0 && m.spend > 0
                      ? moedaDoNumero(m.spend / leadsDaLp(lp.id))
                      : "—"
                  }
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {lp.url ? (
                  <>
                    <button
                      type="button"
                      aria-expanded={vendo === lp.id}
                      disabled={verificando === lp.id}
                      onClick={() => void pre(lp)}
                      className="h-9 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary disabled:opacity-50"
                    >
                      {verificando === lp.id
                        ? t("Verificando…")
                        : vendo === lp.id
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
                      if (window.confirm(t("Apagar esta landing page?"))) void apagar(lp.id);
                    }}
                    className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                  >
                    <Trash size={16} aria-hidden />
                  </button>
                ) : null}
              </div>
              {laudos[lp.id]?.pode === false ? <GuiaDeEmbed laudo={laudos[lp.id]!} /> : null}
              {vendo === lp.id && lp.url ? (
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
            </li>
          ))}
        </ul>
      )}

      {comDados.length > 1 ? (
        <div className="grid grid-cols-1 gap-2">
          <h3 className="text-sm font-semibold">{t("Comparativo das landing pages")}</h3>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("Landing page")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Investido")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Cliques no link")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Visitas à LP")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Connection rate")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("CPC")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Leads (CRM)")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Conversão da LP")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("CPL real")}</th>
                </tr>
              </thead>
              <tbody>
                {comDados.map(({ lp, m }) => (
                  <tr key={lp.id} className="border-t">
                    <td className="max-w-64 truncate px-3 py-2">{lp.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moedaDoNumero(m.spend)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inteiro(m.link_clicks)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inteiro(m.lp_views)}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        m.connectRate !== null &&
                          m.connectRate === melhorConexao &&
                          "font-semibold text-success-fg",
                      )}
                    >
                      {pct(m.connectRate)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais(m.cpc)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {inteiro(leadsDaLp(lp.id))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {pct(m.lp_views > 0 ? (leadsDaLp(lp.id) / m.lp_views) * 100 : null)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {leadsDaLp(lp.id) > 0 && m.spend > 0
                        ? moedaDoNumero(m.spend / leadsDaLp(lp.id))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("Leads e conversão vêm do CRM, pela origem de cada lead (UTM, anúncio ou página).")}
          </p>
        </div>
      ) : null}
    </section>
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
