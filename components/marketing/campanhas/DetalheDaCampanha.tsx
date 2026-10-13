"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { SeletorDeData } from "@/components/marketing/cronograma/SeletorDeData";
import {
  COR_DA_NOTA,
  rotuloDaNota,
  rotuloDoCanal,
  rotuloDoPeriodo,
  rotuloDoStatus,
} from "@/components/marketing/campanhas/rotulos";
import { LandingPagesDaCampanha } from "@/components/marketing/campanhas/LandingPagesDaCampanha";
import { OrigemDosLeads } from "@/components/marketing/campanhas/OrigemDosLeads";
import { WebhooksDaCampanha } from "@/components/marketing/campanhas/WebhooksDaCampanha";
import { EntradaDeLeads } from "@/components/marketing/campanhas/EntradaDeLeads";
import { FunilDeConversao } from "@/components/marketing/campanhas/FunilDeConversao";
import { AbordagensDaCampanha } from "@/components/marketing/campanhas/AbordagensDaCampanha";
import { CriativosDaCampanha } from "@/components/marketing/campanhas/CriativosDaCampanha";
import { DiaADiaDaCampanha } from "@/components/marketing/campanhas/DiaADiaDaCampanha";
import { ResumoDaCampanha } from "@/components/marketing/campanhas/ResumoDaCampanha";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import { useCatalogoDeProdutos } from "@/hooks/vendas/useCatalogoDeProdutos";
import {
  useCampanhasDeDemanda,
  useDiasDaCampanha,
  useNotasDaCampanha,
  useOpcoesDoMeta,
  useSincronizarComMeta,
  type EdicaoDeCampanha,
} from "@/hooks/marketing/useCampanhasDeDemanda";
import { ApagarCampanhasDialog } from "@/components/marketing/campanhas/ApagarCampanhasDialog";
import { lerNumero } from "@/lib/marketing/calculadora";
import { diasParaOrcamento, equivalenciasDoOrcamento } from "@/lib/marketing/orcamento-equivalente";
import {
  investimentoBaseDasMetas,
  metasRelacionadas,
  type CampoQueMudou,
} from "@/lib/marketing/metas-calculo";
import {
  CANAIS_DA_CAMPANHA,
  PERIODOS_DO_ORCAMENTO,
  STATUS_DA_CAMPANHA,
  TIPOS_DE_NOTA,
  investimentoLiquido,
  type CampanhaDeDemanda,
  type TipoDeNota,
} from "@/lib/marketing/campanhas";
import {
  abaValida,
  ehAbaOpcional,
  opcionaisDaCampanha,
  type AbaDaCampanha,
} from "@/lib/marketing/campanhas-abas";
import { AbasDaCampanha } from "@/components/marketing/campanhas/AbasDaCampanha";
import { hojeIso } from "@/lib/marketing/campanhas-resumo";
import { periodoPadraoDaCampanha } from "@/lib/marketing/periodo-da-campanha";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { ArrowSquareOut, Plus, Trash, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const AREA =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

const FAIXA_DO_BLOCO = {
  blue: "border-l-blue-500",
  emerald: "border-l-emerald-500",
  violet: "border-l-violet-500",
  amber: "border-l-amber-500",
  teal: "border-l-teal-500",
  rose: "border-l-rose-500",
} as const;

function Bloco({
  titulo,
  children,
  tom = "blue",
}: {
  titulo: string;
  children: ReactNode;
  tom?: keyof typeof FAIXA_DO_BLOCO;
}) {
  return (
    <section
      className={cn(
        "grid grid-cols-1 gap-3 rounded-2xl border border-l-4 bg-card p-4 shadow-sm",
        FAIXA_DO_BLOCO[tom],
      )}
    >
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{texto}</span>
      {children}
    </label>
  );
}

/** Um campo de texto que grava ao sair (blur), só se mudou. */
function TextoGravavel({
  valor,
  aoGravar,
  desabilitado,
  rotulo,
  longo,
  max,
}: {
  valor: string;
  aoGravar: (v: string) => void;
  desabilitado: boolean;
  rotulo: string;
  longo?: boolean;
  max: number;
}) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  const comum = {
    value: v,
    maxLength: max,
    disabled: desabilitado,
    "aria-label": rotulo,
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
    onBlur: () => v !== valor && aoGravar(v),
  };
  return longo ? (
    <textarea rows={3} className={AREA} {...comum} />
  ) : (
    <input className={CAMPO} {...comum} />
  );
}

/** Um número (ou dinheiro) que grava ao sair; vazio limpa. */
function NumeroGravavel({
  valor,
  aoGravar,
  desabilitado,
  rotulo,
  inteiro,
  prefixo,
}: {
  valor: number | null;
  aoGravar: (n: number | null) => void;
  desabilitado: boolean;
  rotulo: string;
  inteiro?: boolean;
  prefixo?: string;
}) {
  const inicial = valor === null ? "" : String(valor).replace(".", ",");
  const [v, setV] = useState(inicial);
  useEffect(() => setV(inicial), [inicial]);
  return (
    <div className="relative">
      {prefixo ? (
        <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-muted-foreground">
          {prefixo}
        </span>
      ) : null}
      <input
        value={v}
        inputMode="decimal"
        maxLength={16}
        disabled={desabilitado}
        aria-label={rotulo}
        onChange={(e) => setV(e.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={() => {
          if (v === inicial) return;
          if (v.trim() === "") return aoGravar(null);
          const n = lerNumero(v);
          if (n === null || n < 0) return setV(inicial);
          aoGravar(inteiro ? Math.round(n) : n);
        }}
        className={cn(CAMPO, prefixo && "pl-10")}
      />
    </div>
  );
}

export function DetalheDaCampanha({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const { campanhas, funis, podeEditar, carregando, editar, apagar } = useCampanhasDeDemanda();
  const c = campanhas.find((x) => x.id === id);
  const dias = useDiasDaCampanha(id);
  const [apagando, setApagando] = useState(false);
  const { produtos } = useCatalogoDeProdutos();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const aba = abaValida(parametros.get("aba"), c?.channel ?? "trafego_pago", c?.optional_tabs);
  const irParaAba = (nova: AbaDaCampanha) => {
    const p = new URLSearchParams(parametros.toString());
    p.set("aba", nova);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  if (carregando) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;
  if (!c) {
    return (
      <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
        {t("Campanha não encontrada.")}{" "}
        <Link className="text-primary underline" href="/app/marketing/geracao-de-demanda">
          {t("Voltar")}
        </Link>
      </p>
    );
  }
  const periodoPadrao = periodoPadraoDaCampanha(c, hojeIso());
  const grava = (patch: EdicaoDeCampanha) => void editar([c.id], patch);
  const bloqueado = !podeEditar;
  const liquido = c.budget === null ? null : investimentoLiquido(c.budget, c.tax_pct);

  /** Grava e, no mesmo gesto, recalcula as metas que dependem do que mudou. */
  const gravaComMetas = (patch: EdicaoDeCampanha, mudou: CampoQueMudou) => {
    const m = { ...c, ...patch };
    const liq = m.budget === null ? null : investimentoLiquido(m.budget, m.tax_pct);
    const relacionadas = metasRelacionadas(
      {
        goal_leads: m.goal_leads,
        goal_cpl: m.goal_cpl,
        goal_sales: m.goal_sales,
        goal_revenue: m.goal_revenue,
        ticket: m.ticket_cents === null ? null : m.ticket_cents / 100,
        investimento: investimentoBaseDasMetas(liq, m.budget_period, m.goal_period),
      },
      mudou,
    );
    grava({ ...patch, ...relacionadas });
  };

  const idsDosProdutos =
    c.product_ids.length > 0 ? c.product_ids : c.product_id ? [c.product_id] : [];
  const precoDe = (ids: string[]) =>
    ids.reduce((soma, pid) => soma + (produtos.find((p) => p.id === pid)?.valor ?? 0), 0);
  const gravaProdutos = (ids: string[]) => {
    const nomes = ids
      .map((pid) => produtos.find((p) => p.id === pid)?.nome ?? "")
      .filter(Boolean)
      .join(" + ");
    const patch: EdicaoDeCampanha = {
      product_ids: ids,
      product_id: ids[0] ?? null,
      product_name: nomes,
    };
    // O ticket acompanha a soma dos preços enquanto ninguém o mudou à mão.
    const somaAntes = Math.round(precoDe(idsDosProdutos) * 100);
    const somaNova = Math.round(precoDe(ids) * 100);
    if (somaNova > 0 && (c.ticket_cents === null || c.ticket_cents === somaAntes)) {
      gravaComMetas({ ...patch, ticket_cents: somaNova }, "ticket");
    } else {
      grava(patch);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <AbasDaCampanha
        canal={c.channel}
        escolhidas={c.optional_tabs}
        aba={aba}
        aoEscolher={irParaAba}
        podeEditar={podeEditar}
        aoAdicionar={(nova) => {
          const atuais = opcionaisDaCampanha(c.channel, c.optional_tabs);
          grava({ optional_tabs: [...atuais, nova] });
          irParaAba(nova);
        }}
        aoRemover={(velha) => {
          if (
            !window.confirm(
              t(
                "Tirar esta página da campanha? Os dados ficam guardados e voltam se você adicionar a página de novo.",
              ),
            )
          ) {
            return;
          }
          grava({
            optional_tabs: opcionaisDaCampanha(c.channel, c.optional_tabs).filter(
              (x) => x !== velha,
            ),
          });
          if (aba === velha) irParaAba("cadastro");
        }}
      />

      {aba === "visao" ? (
        <>
          <ResumoDaCampanha c={c} dias={dias.dias} hoje={hojeIso()} />
          <OrigemDosLeads campanhaId={c.id} campanha={c} />
        </>
      ) : null}

      {aba === "dia" ? (
        <>
          <DiaADiaDaCampanha
            canal={c.channel}
            campanha={c}
            dias={dias.dias}
            funilDefinido={dias.funilDefinido}
            automatico={dias.automatico}
          />
          <DiarioDeBordo campanhaId={c.id} podeEditar={podeEditar} />
        </>
      ) : null}

      {aba === "criativos" ? (
        <CriativosDaCampanha
          campanhaId={c.id}
          podeEditar={podeEditar}
          periodoPadrao={periodoPadrao}
        />
      ) : null}

      {aba === "landing" ? (
        <>
          <LandingPagesDaCampanha
            campanhaId={c.id}
            podeEditar={podeEditar}
            periodoPadrao={periodoPadrao}
          />
          <WebhooksDaCampanha
            campanhaId={c.id}
            nomeDaCampanha={c.name}
            podeEditar={podeEditar}
            temFunil={Boolean(c.pipeline_id)}
          />
        </>
      ) : null}

      {podeEditar && ehAbaOpcional(aba) ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (
                !window.confirm(
                  t(
                    "Tirar esta página da campanha? Os dados ficam guardados e voltam se você adicionar a página de novo.",
                  ),
                )
              ) {
                return;
              }
              grava({
                optional_tabs: opcionaisDaCampanha(c.channel, c.optional_tabs).filter(
                  (x) => x !== aba,
                ),
              });
              irParaAba("cadastro");
            }}
            className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-error-fg"
          >
            <Trash size={14} aria-hidden />
            {t("Tirar esta página da campanha")}
          </button>
        </div>
      ) : null}

      {aba === "funil" ? (
        <>
          <FunilDeConversao c={c} podeEditar={podeEditar} />
          <EntradaDeLeads
            campanhaId={c.id}
            podeEditar={podeEditar}
            temFunil={Boolean(c.pipeline_id)}
          />
        </>
      ) : null}

      {aba === "abordagem" ? (
        <AbordagensDaCampanha
          campanhaId={c.id}
          podeEditar={podeEditar}
          periodoPadrao={periodoPadrao}
          canal={c.channel}
        />
      ) : null}

      {aba === "cadastro" ? (
        <>
          <Bloco titulo={t("Cadastro")}>
            <Rotulo texto={t("Nome da campanha")}>
              <TextoGravavel
                valor={c.name}
                aoGravar={(name) =>
                  name.trim() && void editar([c.id], { name }).then(() => router.refresh())
                }
                desabilitado={bloqueado}
                rotulo={t("Nome da campanha")}
                max={160}
              />
            </Rotulo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Rotulo texto={t("Canal")}>
                <select
                  className={CAMPO}
                  disabled={bloqueado}
                  value={c.channel}
                  onChange={(e) =>
                    grava({ channel: e.target.value as CampanhaDeDemanda["channel"] })
                  }
                >
                  {CANAIS_DA_CAMPANHA.map((x) => (
                    <option key={x} value={x}>
                      {rotuloDoCanal(t, x)}
                    </option>
                  ))}
                </select>
              </Rotulo>
              <Rotulo texto={t("Status")}>
                <select
                  className={CAMPO}
                  disabled={bloqueado}
                  value={c.status}
                  onChange={(e) => grava({ status: e.target.value as CampanhaDeDemanda["status"] })}
                >
                  {STATUS_DA_CAMPANHA.map((x) => (
                    <option key={x} value={x}>
                      {rotuloDoStatus(t, x)}
                    </option>
                  ))}
                </select>
              </Rotulo>
            </div>
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Rotulo texto={t("Início")}>
                <SeletorDeData
                  valor={c.start_date ?? ""}
                  rotulo={t("Início")}
                  aoMudar={(d) => !bloqueado && grava({ start_date: d || null })}
                />
              </Rotulo>
              <Rotulo texto={t("Fim")}>
                {c.continuous ? (
                  <p className="flex h-10 items-center text-sm text-muted-foreground">
                    {t("Contínua (sem data final)")}
                  </p>
                ) : (
                  <SeletorDeData
                    valor={c.end_date ?? ""}
                    rotulo={t("Fim")}
                    aoMudar={(d) => !bloqueado && grava({ end_date: d || null })}
                  />
                )}
              </Rotulo>
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={bloqueado}
                  checked={c.continuous}
                  onChange={(e) => grava({ continuous: e.target.checked })}
                />
                {t("Contínua")}
              </label>
            </div>
            <Rotulo texto={t("Descrição")}>
              <TextoGravavel
                valor={c.description}
                aoGravar={(description) => grava({ description })}
                desabilitado={bloqueado}
                rotulo={t("Descrição")}
                longo
                max={4000}
              />
            </Rotulo>
            <Rotulo texto={t("Link da planilha (opcional)")}>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <TextoGravavel
                    valor={c.sheet_url}
                    aoGravar={(sheet_url) => grava({ sheet_url })}
                    desabilitado={bloqueado}
                    rotulo={t("Link da planilha (opcional)")}
                    max={500}
                  />
                </div>
                {/^https?:\/\//i.test(c.sheet_url) ? (
                  <a
                    href={c.sheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-medium hover:bg-secondary"
                  >
                    <ArrowSquareOut size={16} aria-hidden />
                    {t("Abrir")}
                  </a>
                ) : null}
              </div>
            </Rotulo>
          </Bloco>

          <Bloco titulo={t("Investimento")} tom="emerald">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Rotulo texto={t("Investimento bruto")}>
                <NumeroGravavel
                  valor={c.budget}
                  aoGravar={(budget) => gravaComMetas({ budget }, "investimento")}
                  desabilitado={bloqueado}
                  rotulo={t("Investimento bruto")}
                  prefixo="R$"
                />
              </Rotulo>
              <Rotulo texto={t("Vale por")}>
                <select
                  className={CAMPO}
                  disabled={bloqueado}
                  value={c.budget_period}
                  onChange={(e) =>
                    gravaComMetas(
                      { budget_period: e.target.value as CampanhaDeDemanda["budget_period"] },
                      "investimento",
                    )
                  }
                >
                  {PERIODOS_DO_ORCAMENTO.map((p) => (
                    <option key={p} value={p}>
                      {rotuloDoPeriodo(t, p)}
                    </option>
                  ))}
                </select>
              </Rotulo>
              <Rotulo texto={t("Imposto sobre o investimento (%)")}>
                <NumeroGravavel
                  valor={c.tax_pct}
                  aoGravar={(n) =>
                    gravaComMetas({ tax_pct: Math.min(100, n ?? 0) }, "investimento")
                  }
                  desabilitado={bloqueado}
                  rotulo={t("Imposto sobre o investimento (%)")}
                  prefixo="%"
                />
              </Rotulo>
            </div>
            {c.budget !== null && c.budget > 0
              ? (() => {
                  const { dias, baseadoNoMes } = diasParaOrcamento(c);
                  const linhas = equivalenciasDoOrcamento(
                    c.budget,
                    c.budget_period,
                    dias,
                    c.tax_pct,
                  );
                  const rotulos: Record<string, string> = {
                    total: t("Total da campanha"),
                    mensal: t("Por mês"),
                    semanal: t("Por semana"),
                    diario: t("Por dia"),
                  };
                  return (
                    <div className="grid gap-2">
                      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                        {linhas.map((l) => (
                          <div
                            key={l.periodo}
                            className={cn(
                              "rounded-xl border px-3 py-2",
                              l.periodo === c.budget_period
                                ? "border-emerald-500/60 bg-emerald-500/10"
                                : "bg-secondary/40",
                            )}
                          >
                            <p className="text-xs text-muted-foreground">
                              {rotulos[l.periodo]}
                              {l.periodo === c.budget_period ? ` · ${t("o que você digitou")}` : ""}
                            </p>
                            <p className="text-base font-semibold tabular-nums">
                              {moedaDoNumero(l.bruto)}
                            </p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {t("líquido")} {moedaDoNumero(l.liquido)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {baseadoNoMes
                          ? t("Campanha contínua (ou sem datas): o total é o do mês, de 30 dias.")
                          : `${t("Calculado com")} ${dias} ${dias === 1 ? t("dia") : t("dias")} ${t("de campanha")}.`}
                        {c.tax_pct > 0
                          ? ` ${t("Imposto")}: ${String(c.tax_pct).replace(".", ",")}%.`
                          : ""}
                      </p>
                    </div>
                  );
                })()
              : null}
          </Bloco>

          <Bloco titulo={t("Produtos e ticket médio esperado")} tom="violet">
            <p className="text-xs text-muted-foreground">
              {t(
                "Todo lead que entra nesta campanha já gera uma venda de INTERESSE com estes produtos e este ticket — o LTV previsto. Na hora de fechar, o valor real é informado.",
              )}
            </p>
            <Rotulo texto={t("Produtos que a campanha vende")}>
              <div className="grid gap-2">
                {idsDosProdutos.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {idsDosProdutos.map((pid) => {
                      const p = produtos.find((x) => x.id === pid);
                      return (
                        <li
                          key={pid}
                          className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-1.5 text-sm"
                        >
                          <span>{p?.nome ?? t("Produto removido")}</span>
                          {p && p.valor > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {moedaDoNumero(p.valor)}
                            </span>
                          ) : null}
                          {podeEditar ? (
                            <button
                              type="button"
                              aria-label={`${t("Tirar")} ${p?.nome ?? ""}`}
                              onClick={() => gravaProdutos(idsDosProdutos.filter((x) => x !== pid))}
                              className="grid h-5 w-5 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-error-fg"
                            >
                              <X size={12} weight="bold" aria-hidden />
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {podeEditar ? (
                  <select
                    className={CAMPO}
                    value=""
                    aria-label={t("Adicionar produto")}
                    onChange={(e) =>
                      e.target.value && gravaProdutos([...idsDosProdutos, e.target.value])
                    }
                  >
                    <option value="">
                      {idsDosProdutos.length === 0
                        ? t("Escolha um produto cadastrado")
                        : t("Adicionar outro produto")}
                    </option>
                    {produtos
                      .filter((p) => !idsDosProdutos.includes(p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                  </select>
                ) : null}
              </div>
            </Rotulo>
            <Rotulo texto={t("Ticket médio esperado por lead")}>
              <NumeroGravavel
                valor={c.ticket_cents === null ? null : c.ticket_cents / 100}
                aoGravar={(n) =>
                  gravaComMetas({ ticket_cents: n === null ? null : Math.round(n * 100) }, "ticket")
                }
                desabilitado={bloqueado}
                rotulo={t("Ticket médio esperado por lead")}
                prefixo="R$"
              />
            </Rotulo>
            {idsDosProdutos.length > 1 ? (
              <p className="text-xs text-muted-foreground">
                {t("Soma dos preços de tabela")}: {moedaDoNumero(precoDe(idsDosProdutos))}.{" "}
                {t("O ticket é seu: pode ser menor que a soma (desconto).")}
              </p>
            ) : null}
          </Bloco>

          <Bloco titulo={t("Metas")} tom="amber">
            <Rotulo texto={t("As metas valem para")}>
              <select
                className={CAMPO}
                disabled={bloqueado}
                value={c.goal_period}
                onChange={(e) =>
                  gravaComMetas(
                    { goal_period: e.target.value as CampanhaDeDemanda["goal_period"] },
                    "investimento",
                  )
                }
              >
                <option value="total">{t("A campanha toda (início ao fim)")}</option>
                <option value="mensal">{t("Cada mês (renova todo mês)")}</option>
              </select>
            </Rotulo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Rotulo texto={t("Meta de leads")}>
                <NumeroGravavel
                  valor={c.goal_leads}
                  inteiro
                  aoGravar={(goal_leads) => gravaComMetas({ goal_leads }, "goal_leads")}
                  desabilitado={bloqueado}
                  rotulo={t("Meta de leads")}
                />
              </Rotulo>
              <Rotulo texto={t("Meta de CPL")}>
                <NumeroGravavel
                  valor={c.goal_cpl}
                  aoGravar={(goal_cpl) => gravaComMetas({ goal_cpl }, "goal_cpl")}
                  desabilitado={bloqueado}
                  rotulo={t("Meta de CPL")}
                  prefixo="R$"
                />
              </Rotulo>
              <Rotulo texto={t("Meta de vendas")}>
                <NumeroGravavel
                  valor={c.goal_sales}
                  inteiro
                  aoGravar={(goal_sales) => gravaComMetas({ goal_sales }, "goal_sales")}
                  desabilitado={bloqueado}
                  rotulo={t("Meta de vendas")}
                />
              </Rotulo>
              <Rotulo texto={t("Meta de faturamento")}>
                <NumeroGravavel
                  valor={c.goal_revenue}
                  aoGravar={(goal_revenue) => gravaComMetas({ goal_revenue }, "goal_revenue")}
                  desabilitado={bloqueado}
                  rotulo={t("Meta de faturamento")}
                  prefixo="R$"
                />
              </Rotulo>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "As metas se calculam sozinhas: vendas × ticket = faturamento (e o inverso); investimento líquido ÷ leads = CPL (e o inverso). Mude uma e a outra acompanha.",
              )}{" "}
              {investimentoBaseDasMetas(liquido, c.budget_period, c.goal_period) === null &&
              (c.goal_leads !== null || c.goal_cpl !== null)
                ? t(
                    "Leads e CPL só se calculam entre si quando o investimento e as metas valem pelo mesmo período (os dois pela campanha toda, ou os dois por mês).",
                  )
                : ""}
            </p>
          </Bloco>

          <CampanhasDaPlataforma c={c} podeEditar={podeEditar} aoGravar={grava} />

          {podeEditar ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setApagando(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium text-error-fg hover:bg-error-bg"
              >
                <Trash size={16} aria-hidden />
                {t("Apagar campanha")}
              </button>
            </div>
          ) : null}
          <ApagarCampanhasDialog
            ids={apagando ? [c.id] : []}
            aoFechar={() => setApagando(false)}
            aoConfirmar={async (destino) => {
              if (await apagar([c.id], destino)) {
                router.push("/app/marketing/geracao-de-demanda");
              }
            }}
          />
        </>
      ) : null}
    </div>
  );
}

/** O que cada código de falha da sincronização significa para quem opera. */
function textoDaFalhaDeSync(t: (s: string) => string, motivo: string): string {
  switch (motivo) {
    case "sem_campanhas":
      return t("Escolha da lista do Meta ao menos uma campanha para sincronizar.");
    case "sem_conta":
      return t("Escolha a conta de anúncio do Meta.");
    case "sem_conexao":
      return t("O Meta não está conectado. Conecte em Configurações › Meta Ads.");
    case "conta_nao_liberada":
      return t("Esta conta de anúncio não está liberada para a sua empresa. Fale com a agência.");
    case "token_invalido":
      return t("O Meta recusou o token de acesso. Gere um novo em Configurações › Meta Ads.");
    case "permissao_insuficiente":
      return t(
        "O token não tem permissão de leitura de anúncios (ads_read) ou não alcança esta conta.",
      );
    case "limite_de_chamadas":
      return t("O Meta limitou as chamadas. Tente de novo em alguns minutos.");
    default:
      return t("Não foi possível sincronizar com o Meta agora.");
  }
}

/** As campanhas da plataforma (Meta, Google…) atreladas a esta ação de vendas. */
function CampanhasDaPlataforma({
  c,
  podeEditar,
  aoGravar,
}: {
  c: CampanhaDeDemanda;
  podeEditar: boolean;
  aoGravar: (p: EdicaoDeCampanha) => void;
}) {
  const t = useT();
  const [nome, setNome] = useState("");
  const [escolhendo, setEscolhendo] = useState(false);
  const [busca, setBusca] = useState("");
  const [soSemAssociacao, setSoSemAssociacao] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const meta = useOpcoesDoMeta(c.meta_account_id, escolhendo);
  const sincronizar = useSincronizarComMeta(c.id);

  const adicionar = () => {
    const n = nome.trim();
    if (!n || c.platform_campaigns.some((p) => p.name.toLowerCase() === n.toLowerCase())) return;
    aoGravar({ platform_campaigns: [...c.platform_campaigns, { id: null, name: n }] });
    setNome("");
  };
  const atrelar = (id: string, name: string) => {
    if (c.platform_campaigns.some((p) => p.id === id)) return;
    // O nome digitado antes vira a campanha real (com id) em vez de ficar duplicado.
    const resto = c.platform_campaigns.filter(
      (p) => !(p.id === null && p.name.toLowerCase() === name.toLowerCase()),
    );
    aoGravar({ platform_campaigns: [...resto, { id, name }] });
  };
  const atreladas = c.platform_campaigns.filter((p) => p.id).length;
  const visiveis = (meta.opcoes?.campanhas ?? []).filter(
    (m) =>
      !c.platform_campaigns.some((p) => p.id === m.id) &&
      (!soSemAssociacao || m.associada_a === null) &&
      (busca.trim() === "" || m.name.toLowerCase().includes(busca.trim().toLowerCase())),
  );
  const quando = c.meta_synced_at
    ? new Date(c.meta_synced_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : null;

  return (
    <Bloco titulo={t("Campanhas da plataforma")} tom="teal">
      <p className="text-xs text-muted-foreground">
        {t(
          "Uma campanha do Software pode ter várias campanhas do Meta ou do Google atreladas ao mesmo objetivo. Escolha da lista do Meta para o dia a dia entrar sozinho, ou digite o nome.",
        )}
      </p>
      {c.platform_campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Nenhuma campanha atrelada ainda.")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {c.platform_campaigns.map((p, i) => (
            <li
              key={`${p.id ?? p.name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{p.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                <Etiqueta cor={p.id ? "green" : "gray"}>
                  {p.id ? t("Meta · automático") : t("Só o nome")}
                </Etiqueta>
                {podeEditar ? (
                  <button
                    type="button"
                    aria-label={t("Tirar campanha")}
                    onClick={() =>
                      aoGravar({
                        platform_campaigns: c.platform_campaigns.filter((_, k) => k !== i),
                      })
                    }
                    className="grid h-8 w-8 shrink-0 grid-cols-1 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                  >
                    <Trash size={14} aria-hidden />
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {podeEditar ? (
        <div className="flex flex-wrap gap-2">
          <input
            value={nome}
            maxLength={200}
            placeholder={t("Nome da campanha no Meta ou no Google")}
            aria-label={t("Nome da campanha da plataforma")}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            className={cn(CAMPO, "min-w-0 flex-1 basis-64")}
          />
          <button
            type="button"
            disabled={nome.trim() === ""}
            onClick={adicionar}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary disabled:opacity-50"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Atrelar pelo nome")}
          </button>
          <button
            type="button"
            aria-expanded={escolhendo}
            onClick={() => setEscolhendo((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground"
          >
            {escolhendo ? t("Fechar lista do Meta") : t("Escolher do Meta")}
          </button>
        </div>
      ) : null}

      {podeEditar && escolhendo ? (
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-dashed p-3">
          {meta.carregando && !meta.opcoes ? (
            <div className="h-16 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
          ) : meta.erro ? (
            <p role="alert" className="text-sm text-error-fg">
              {meta.erro}
            </p>
          ) : meta.opcoes ? (
            <>
              <Rotulo texto={t("Conta de anúncio")}>
                <select
                  className={CAMPO}
                  value={c.meta_account_id || meta.opcoes.account_id || ""}
                  onChange={(e) => aoGravar({ meta_account_id: e.target.value })}
                >
                  {(meta.opcoes.contas ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome || t("Conta sem nome")}
                      {a.status !== undefined && a.status !== 1 ? ` — ${t("inativa")}` : ""}
                    </option>
                  ))}
                </select>
              </Rotulo>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={busca}
                  placeholder={t("Buscar campanha do Meta")}
                  aria-label={t("Buscar campanha do Meta")}
                  onChange={(e) => setBusca(e.target.value)}
                  className={cn(CAMPO, "min-w-0 flex-1 basis-48")}
                />
                <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={soSemAssociacao}
                    onChange={(e) => setSoSemAssociacao(e.target.checked)}
                  />
                  {t("Só as sem associação")}
                </label>
              </div>
              {visiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("Nenhuma campanha do Meta para mostrar com esse filtro.")}
                </p>
              ) : (
                <ul className="grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto">
                  {visiveis.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => atrelar(m.id, m.name)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        <span className="min-w-0 truncate">{m.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {m.associada_a
                            ? `${t("Já está em")} ${m.associada_a.name}`
                            : (m.status ?? "")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
      ) : null}

      {atreladas > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {c.meta_sync_error
              ? textoDaFalhaDeSync(t, c.meta_sync_error)
              : quando
                ? `${t("Dia a dia atualizado do Meta em")} ${quando}. ${t("Atualiza sozinho a cada hora.")}`
                : t("Ainda não sincronizou com o Meta. Atualiza sozinho a cada hora.")}
            {aviso ? ` ${aviso}` : ""}
          </p>
          {podeEditar ? (
            <button
              type="button"
              disabled={sincronizando}
              onClick={async () => {
                setSincronizando(true);
                setAviso(null);
                const r = await sincronizar();
                setSincronizando(false);
                setAviso(
                  r.ok ? `${r.dias} ${t("dias atualizados.")}` : textoDaFalhaDeSync(t, r.motivo),
                );
              }}
              className="inline-flex h-9 items-center rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary disabled:opacity-50"
            >
              {sincronizando ? t("Sincronizando…") : t("Sincronizar agora")}
            </button>
          ) : null}
        </div>
      ) : null}
    </Bloco>
  );
}

/** O diário de bordo: análise, feedback do cliente, planejamento e otimização, com data. */
function DiarioDeBordo({ campanhaId, podeEditar }: { campanhaId: string; podeEditar: boolean }) {
  const t = useT();
  const { notas, carregando, adicionar, apagar } = useNotasDaCampanha(campanhaId);
  const [tipo, setTipo] = useState<TipoDeNota>("analise");
  const [texto, setTexto] = useState("");
  const [data, setData] = useState("");
  const [filtro, setFiltro] = useState<TipoDeNota | null>(null);
  const visiveis = filtro === null ? notas : notas.filter((n) => n.kind === filtro);

  return (
    <Bloco titulo={t("Diário de bordo")} tom="rose">
      {podeEditar ? (
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-dashed p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
            <select
              className={CAMPO}
              value={tipo}
              aria-label={t("Tipo da nota")}
              onChange={(e) => setTipo(e.target.value as TipoDeNota)}
            >
              {TIPOS_DE_NOTA.map((k) => (
                <option key={k} value={k}>
                  {rotuloDaNota(t, k)}
                </option>
              ))}
            </select>
            <SeletorDeData
              valor={data}
              rotulo={t("Data da nota")}
              placeholder={t("Hoje")}
              aoMudar={setData}
            />
          </div>
          <textarea
            rows={3}
            value={texto}
            maxLength={4000}
            placeholder={t("Escreva a análise, o feedback, o planejamento ou a otimização…")}
            aria-label={t("Texto da nota")}
            onChange={(e) => setTexto(e.target.value)}
            className={AREA}
          />
          <button
            type="button"
            disabled={texto.trim() === ""}
            onClick={async () => {
              await adicionar({
                kind: tipo,
                body: texto.trim(),
                ...(data ? { note_date: data } : {}),
              });
              setTexto("");
              setData("");
            }}
            className="inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Registrar")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={filtro === null}
          onClick={() => setFiltro(null)}
          className={cn(
            "h-8 rounded-lg border px-3 text-xs font-medium whitespace-nowrap",
            filtro === null ? "border-primary bg-primary/10" : "hover:bg-secondary",
          )}
        >
          {t("Todas")}
        </button>
        {TIPOS_DE_NOTA.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={filtro === k}
            onClick={() => setFiltro(k)}
            className={cn(
              "h-8 rounded-lg border px-3 text-xs font-medium whitespace-nowrap",
              filtro === k ? "border-primary bg-primary/10" : "hover:bg-secondary",
            )}
          >
            {rotuloDaNota(t, k)}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="h-16 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Nenhuma nota ainda.")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {visiveis.map((n) => (
            <li key={n.id} className="grid grid-cols-1 gap-1.5 rounded-xl border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Etiqueta cor={COR_DA_NOTA[n.kind]}>{rotuloDaNota(t, n.kind)}</Etiqueta>
                <span className="text-xs text-muted-foreground">
                  {n.note_date.split("-").reverse().join("/")}
                </span>
                {podeEditar ? (
                  <button
                    type="button"
                    aria-label={t("Apagar nota")}
                    onClick={() => void apagar(n.id)}
                    className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                  >
                    <Trash size={14} aria-hidden />
                  </button>
                ) : null}
              </div>
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Bloco>
  );
}
