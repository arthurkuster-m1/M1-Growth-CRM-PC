"use client";

import { useEffect, useRef, useState } from "react";

import { rotuloDaMetrica } from "@/components/marketing/campanhas/rotulos";
import { useT } from "@/hooks/i18n/useT";
import { lerNumero } from "@/lib/marketing/calculadora";
import { lerDias, modeloDoDiaAdia } from "@/lib/marketing/campanhas-csv";
import {
  METRICAS_DO_CANAL,
  hojeIso,
  janelaDoDiaADia,
  somarMeses,
  type DiaDaCampanha,
} from "@/lib/marketing/campanhas-resumo";
import type { CampanhaDeDemanda, CanalDaCampanha } from "@/lib/marketing/campanhas";
import { Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

type DiaParaGravar = Omit<DiaDaCampanha, "id" | "source">;

/** Uma coluna da tabela: o nome, onde o valor mora e se é dinheiro. */
interface Coluna {
  chave: string;
  rotulo: string;
  dinheiro: boolean;
  /** Vem do CRM: aparece, mas não se digita. */
  somenteLeitura?: boolean;
  ler: (d: DiaDaCampanha) => number;
  escrever: (d: DiaParaGravar, n: number) => DiaParaGravar;
}

const doCrm = (c: Coluna): Coluna => ({ ...c, somenteLeitura: true });

function colunasDoCanal(t: (s: string) => string, canal: CanalDaCampanha): Coluna[] {
  const fixa = (
    chave: string,
    rotulo: string,
    campo: "impressions" | "reach" | "link_clicks" | "lp_views" | "leads" | "spend",
  ): Coluna => ({
    chave,
    rotulo,
    dinheiro: campo === "spend",
    ler: (d) => d[campo],
    escrever: (d, n) => ({ ...d, [campo]: campo === "spend" ? n : Math.round(n) }),
  });
  if (canal === "trafego_pago") {
    return [
      fixa("impressions", t("Impressões"), "impressions"),
      fixa("reach", t("Alcance"), "reach"),
      fixa("link_clicks", t("Cliques no link"), "link_clicks"),
      fixa("lp_views", t("Visitas à LP"), "lp_views"),
      doCrm(fixa("leads", t("Leads (CRM)"), "leads")),
      fixa("spend", t("Investido"), "spend"),
    ];
  }
  return [
    doCrm(fixa("leads", t("Leads (CRM)"), "leads")),
    fixa("spend", t("Investido"), "spend"),
    ...METRICAS_DO_CANAL[canal].map((m): Coluna => ({
      chave: m.chave,
      rotulo: rotuloDaMetrica(t, m.chave),
      dinheiro: m.tipo === "moeda",
      ler: (d) => d.extras[m.chave] ?? 0,
      escrever: (d, n) => ({ ...d, extras: { ...d.extras, [m.chave]: n } }),
    })),
  ];
}

const paraGravar = (d: DiaDaCampanha): DiaParaGravar => ({
  day: d.day,
  impressions: d.impressions,
  reach: d.reach,
  link_clicks: d.link_clicks,
  lp_views: d.lp_views,
  leads: d.leads,
  spend: d.spend,
  extras: d.extras,
});

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** Uma célula numérica que grava ao sair, só se mudou. */
function CelulaNumerica({
  valor,
  dinheiro,
  rotulo,
  desabilitado,
  aoGravar,
}: {
  valor: number;
  dinheiro: boolean;
  rotulo: string;
  desabilitado: boolean;
  aoGravar: (n: number) => void;
}) {
  const inicial = valor === 0 ? "" : String(valor).replace(".", ",");
  const [v, setV] = useState(inicial);
  useEffect(() => setV(inicial), [inicial]);
  return (
    <input
      value={v}
      inputMode="decimal"
      maxLength={14}
      disabled={desabilitado}
      aria-label={rotulo}
      placeholder="0"
      onChange={(e) => setV(e.target.value.replace(/[^\d.,]/g, ""))}
      onBlur={() => {
        if (v === inicial) return;
        const n = v.trim() === "" ? 0 : lerNumero(v);
        if (n === null || n < 0) return setV(inicial);
        aoGravar(dinheiro ? Math.round(n * 100) / 100 : n);
      }}
      className="h-9 w-full min-w-20 rounded-lg border border-transparent bg-transparent px-2 text-right text-sm tabular-nums outline-hidden hover:border-border focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
    />
  );
}

/**
 * O DIA A DIA da campanha (a "aba diária" da planilha): uma linha por dia, editável na própria
 * tabela. Os canais com API (Meta) preenchem sozinhos na próxima sessão; os outros — e quem
 * prefere — digitam ou colam a planilha.
 */
export function DiaADiaDaCampanha({
  canal,
  campanha,
  dias,
  podeEditar,
  funilDefinido,
  gravar,
  apagar,
}: {
  canal: CanalDaCampanha;
  campanha: Pick<CampanhaDeDemanda, "start_date" | "end_date" | "continuous">;
  funilDefinido: boolean;
  dias: DiaDaCampanha[];
  podeEditar: boolean;
  gravar: (dias: DiaParaGravar[], source?: "manual" | "csv") => Promise<boolean>;
  apagar: (day: string) => Promise<void>;
}) {
  const t = useT();
  const colunas = colunasDoCanal(t, canal);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const [mes, setMes] = useState<string | null>(null);
  const [soComDados, setSoComDados] = useState(false);
  const hoje = hojeIso();
  const janela = janelaDoDiaADia(campanha, dias, hoje, mes, soComDados);
  const ordenados = janela.linhas;
  const guardados = new Set(dias.filter((d) => d.id).map((d) => d.day));
  const nomeDoMes = janela.mes
    ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${janela.mes}-01T12:00:00Z`),
      )
    : "";

  async function aoEscolherArquivo(f: File | undefined) {
    if (!f) return;
    setMensagem(null);
    const lido = lerDias(await f.text(), canal);
    if (arquivo.current) arquivo.current.value = "";
    if (lido.erro === "vazia") return setMensagem(t("A planilha está vazia."));
    if (lido.erro === "sem_dia") {
      return setMensagem(t('Não achei a coluna "dia" (ou "data") na planilha.'));
    }
    if (lido.erro === "muitas_linhas") {
      return setMensagem(t("A planilha tem linhas demais (máximo de 400 dias por envio)."));
    }
    if (lido.dias.length === 0) {
      return setMensagem(t("Nenhum dia válido na planilha."));
    }
    // Quem já existe é trocado pelo valor da planilha.
    const ok = await gravar(lido.dias, "csv");
    if (!ok) return;
    setMensagem(
      lido.problemas.length > 0
        ? `${lido.dias.length} ${t("dias importados;")} ${lido.problemas.length} ${t("linhas com problema foram ignoradas (linha")} ${lido.problemas
            .slice(0, 5)
            .map((p) => p.linha)
            .join(", ")}).`
        : `${lido.dias.length} ${t("dias importados.")}`,
    );
  }

  function baixarModelo() {
    const blob = new Blob([modeloDoDiaAdia(canal)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-dia-a-dia.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Dia a dia")}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={baixarModelo}
            className="h-9 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
          >
            {t("Baixar modelo")}
          </button>
          {podeEditar ? (
            <>
              <input
                ref={arquivo}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                aria-label={t("Escolher planilha")}
                onChange={(e) => void aoEscolherArquivo(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => arquivo.current?.click()}
                className="h-9 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
              >
                {t("Importar planilha")}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {janela.mensal ? (
          <div className="inline-flex items-center gap-1 rounded-xl bg-secondary p-0.5">
            <button
              type="button"
              aria-label={t("Mês anterior")}
              onClick={() => setMes(somarMeses(janela.mes!, -1))}
              className="grid h-9 w-9 grid-cols-1 place-items-center rounded-[10px] hover:bg-card"
            >
              ‹
            </button>
            <span className="min-w-36 text-center text-sm font-medium capitalize">{nomeDoMes}</span>
            <button
              type="button"
              aria-label={t("Próximo mês")}
              onClick={() => setMes(somarMeses(janela.mes!, 1))}
              className="grid h-9 w-9 grid-cols-1 place-items-center rounded-[10px] hover:bg-card"
            >
              ›
            </button>
            {janela.mes !== hoje.slice(0, 7) ? (
              <button
                type="button"
                onClick={() => setMes(null)}
                className="h-9 rounded-[10px] px-3 text-sm font-medium text-primary hover:bg-card"
              >
                {t("Mês atual")}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {dataBr(janela.de)} → {dataBr(janela.ate)}
          </p>
        )}
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            checked={soComDados}
            onChange={(e) => setSoComDados(e.target.checked)}
          />
          {t("Só os dias com dados")}
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        {funilDefinido
          ? t(
              "Os leads vêm do CRM: cada contato que entra no funil da campanha conta no dia em que entrou.",
            )
          : t("Escolha o funil da campanha (em Cadastro) para contar os leads do CRM.")}
      </p>
      {mensagem ? (
        <p role="status" className="text-sm text-muted-foreground">
          {mensagem}
        </p>
      ) : null}

      {ordenados.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {t("Nenhum dia com dados neste período.")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-secondary/60 text-xs text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left font-medium">
                  {t("Dia")}
                </th>
                {colunas.map((c) => (
                  <th key={c.chave} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                    {c.rotulo}
                  </th>
                ))}
                {podeEditar ? <th className="w-10" /> : null}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((d) => (
                <tr
                  key={d.day}
                  className={cn("border-t", d.day === hoje && "bg-primary/5")}
                  aria-current={d.day === hoje ? "date" : undefined}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 bg-card px-3 py-1 text-left whitespace-nowrap tabular-nums",
                    )}
                  >
                    {dataBr(d.day)}
                  </td>
                  {colunas.map((c) => (
                    <td key={c.chave} className="px-1 py-1">
                      {c.somenteLeitura ? (
                        <p className="px-2 text-right text-sm tabular-nums">{c.ler(d)}</p>
                      ) : (
                        <CelulaNumerica
                          valor={c.ler(d)}
                          dinheiro={c.dinheiro}
                          rotulo={`${c.rotulo} ${dataBr(d.day)}`}
                          desabilitado={!podeEditar}
                          aoGravar={(n) => void gravar([c.escrever(paraGravar(d), n)])}
                        />
                      )}
                    </td>
                  ))}
                  {podeEditar ? (
                    <td className="px-1">
                      {guardados.has(d.day) ? (
                        <button
                          type="button"
                          aria-label={t("Apagar dia")}
                          onClick={() => void apagar(d.day)}
                          className="grid h-8 w-8 grid-cols-1 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                        >
                          <Trash size={14} aria-hidden />
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
