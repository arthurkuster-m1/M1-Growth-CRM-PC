"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Atendimento, type DadosDeAtendimento } from "@/components/dashboards/Atendimento";
import { Business, type DadosDeBusiness } from "@/components/dashboards/Business";
import { AnalisesDaAgenda } from "@/components/agenda/AnalisesDaAgenda";
import { ProspeccaoAtiva, type DadosDeProspeccao } from "@/components/dashboards/ProspeccaoAtiva";
import { SeletorDeCampanhas } from "@/components/dashboards/SeletorDeCampanhas";
import { TrafegoPago, type DadosDeTrafego } from "@/components/dashboards/TrafegoPago";
import { SeletorDePeriodo } from "@/components/motor/CalendarioDePeriodo";
import { CaixaRedonda } from "@/components/ui/CaixaRedonda";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAtalhosDePeriodo } from "@/components/motor/atalhos-de-periodo";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { PAINEIS, type IdDoPainel } from "@/lib/dashboards/visibilidade";
import { CalendarCheck, ChartLineUp, Eye, Megaphone, Receipt, UsersThree } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

type Painel = IdDoPainel;

/**
 * OS DASHBOARDS (D0 — protótipo visual): Tráfego Pago · Prospecção Ativa · Business · Atendimento.
 * Cabeçalho único (período, campanha, comparação); a cor de destaque é a da marca da empresa.
 * Os números são de EXEMPLO e a tela diz isso; cada painel liga nos dados reais por fases.
 */
export function DashboardsClient({
  empresa,
  painelInicial,
}: {
  empresa: string;
  painelInicial?: string;
}) {
  const t = useT();
  const [escolhido, setPainel] = useState<Painel>(
    (PAINEIS as readonly string[]).includes(painelInicial ?? "")
      ? (painelInicial as Painel)
      : "trafego",
  );
  const { atalhos, hoje } = useAtalhosDePeriodo();
  const [janela, setJanela] = useState(() => ({ de: `${hoje.slice(0, 7)}-01`, ate: hoje }));
  const [campanhas, setCampanhas] = useState<string[]>([]);
  const [campanhasDeProspeccao, setCampanhasDeProspeccao] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const visibilidade = useQuery({
    queryKey: ["dashboard-visibilidade"],
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { ocultos: Painel[]; podeEditar: boolean } }>(
          "/api/v1/dashboards/visibilidade",
        )
      ).data,
  });
  const ocultos = visibilidade.data?.ocultos ?? [];
  const salvarOcultos = async (novos: Painel[]) => {
    await apiClient.put("/api/v1/dashboards/visibilidade", { ocultos: novos });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-visibilidade"] });
  };

  const todasAsAbas: Array<{
    id: Painel;
    rotulo: string;
    icone: React.ReactNode;
    breve?: boolean;
  }> = [
    {
      id: "trafego",
      rotulo: t("Tráfego Pago"),
      icone: <Megaphone size={16} weight="duotone" aria-hidden />,
    },
    {
      id: "prospeccao",
      rotulo: t("Prospecção Ativa"),
      icone: <UsersThree size={16} weight="duotone" aria-hidden />,
    },
    {
      id: "comercial",
      rotulo: t("Comercial"),
      icone: <CalendarCheck size={16} weight="duotone" aria-hidden />,
    },
    {
      id: "atendimento",
      rotulo: t("Atendimento"),
      icone: <ChartLineUp size={16} weight="duotone" aria-hidden />,
    },
    {
      id: "business",
      rotulo: t("Business"),
      icone: <Receipt size={16} weight="duotone" aria-hidden />,
    },
  ];
  const abas = todasAsAbas.filter((a) => !ocultos.includes(a.id));
  // Se o painel escolhido foi escondido, cai no primeiro que sobrou.
  const painel: Painel = abas.some((a) => a.id === escolhido)
    ? escolhido
    : (abas[0]?.id ?? escolhido);

  const atendimento = useQuery({
    queryKey: ["dashboard-atendimento", janela.de, janela.ate],
    enabled: painel === "atendimento",
    staleTime: 30_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: DadosDeAtendimento }>(
          `/api/v1/dashboards/atendimento?de=${janela.de}&ate=${janela.ate}`,
        )
      ).data,
  });
  const [mesesAtivo, setMesesAtivo] = useState(6);
  const business = useQuery({
    queryKey: ["dashboard-business", janela.de, janela.ate, mesesAtivo],
    enabled: painel === "business",
    staleTime: 30_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: DadosDeBusiness }>(
          `/api/v1/dashboards/business?de=${janela.de}&ate=${janela.ate}&ativo=${mesesAtivo}`,
        )
      ).data,
  });
  const prospeccao = useQuery({
    queryKey: ["dashboard-prospeccao", janela.de, janela.ate, campanhasDeProspeccao.join(",")],
    enabled: painel === "prospeccao",
    staleTime: 30_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: DadosDeProspeccao }>(
          `/api/v1/dashboards/prospeccao?de=${janela.de}&ate=${janela.ate}${
            campanhasDeProspeccao.length > 0 ? `&campanhas=${campanhasDeProspeccao.join(",")}` : ""
          }`,
        )
      ).data,
  });
  const trafego = useQuery({
    queryKey: ["dashboard-trafego", janela.de, janela.ate, campanhas.join(",")],
    enabled: painel === "trafego",
    staleTime: 30_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: DadosDeTrafego }>(
          `/api/v1/dashboards/trafego?de=${janela.de}&ate=${janela.ate}${
            campanhas.length > 0 ? `&campanhas=${campanhas.join(",")}` : ""
          }`,
        )
      ).data,
  });

  return (
    <div className="mx-auto flex w-full max-w-[2000px] min-w-0 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground"
          >
            {empresa.trim().slice(0, 2).toUpperCase() || "M1"}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
              {t("Dashboards")}
            </h1>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {empresa} · {t("Performance ao vivo")}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
            "border-green-500/50 bg-green-500/10 text-green-800 dark:text-green-300",
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", "bg-green-500")} aria-hidden />
          {painel === "trafego"
            ? t("Dados reais · Meta Ads + CRM")
            : painel === "business"
              ? t("Dados reais · vendas e parcelas")
              : painel === "atendimento"
                ? t("Dados reais · conversas e mensagens")
                : painel === "comercial"
                  ? t("Dados reais · agenda e vendas")
                  : t("Dados reais · CRM, abordagens e vendas")}
        </span>
      </header>

      <div
        role="tablist"
        aria-label={t("Dashboards")}
        className="flex max-w-full [scrollbar-width:none] gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={painel === a.id}
            onClick={() => setPainel(a.id)}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium whitespace-nowrap transition-colors",
              painel === a.id
                ? "border-primary bg-primary/10 text-foreground"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {a.icone}
            {a.rotulo}
            {a.breve ? (
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px]">
                {t("Em breve")}
              </span>
            ) : null}
          </button>
        ))}
        {visibilidade.data?.podeEditar ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                title={t("Escolher quais dashboards esta empresa usa")}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border bg-card px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                <Eye size={16} aria-hidden />
                {t("Dashboards desta empresa")}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2">
              <p className="px-1 pb-1 text-xs font-semibold tracking-wider text-text-subtle uppercase">
                {t("Mostrar para esta empresa")}
              </p>
              {todasAsAbas.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary"
                >
                  <CaixaRedonda
                    checked={!ocultos.includes(a.id)}
                    onChange={(e) =>
                      void salvarOcultos(
                        e.target.checked ? ocultos.filter((o) => o !== a.id) : [...ocultos, a.id],
                      )
                    }
                  />
                  {a.rotulo}
                </label>
              ))}
              <p className="px-1 pt-1 text-[11px] text-muted-foreground">
                {t("Só o administrador da plataforma vê esta opção.")}
              </p>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {/* No celular os filtros dividem a largura do bloco por igual (sem sobra à direita). */}
      <div className="grid grid-cols-2 items-center gap-2 rounded-2xl border bg-card p-3 sm:flex sm:flex-wrap">
        <div
          className={cn(
            "min-w-0 [&_button]:w-full [&_button]:justify-center sm:[&_button]:w-auto",
            painel !== "prospeccao" && painel !== "trafego" && "col-span-2",
          )}
        >
          <SeletorDePeriodo
            de={janela.de}
            ate={janela.ate}
            rotulo={t("Período")}
            atalhos={atalhos}
            aoMudar={setJanela}
          />
        </div>
        {painel === "prospeccao" ? (
          <div className="min-w-0 [&_button]:w-full [&_button]:justify-center sm:[&_button]:w-auto">
            <SeletorDeCampanhas
              catalogo={prospeccao.data?.catalogo ?? []}
              escolhidas={campanhasDeProspeccao}
              aoMudar={setCampanhasDeProspeccao}
            />
          </div>
        ) : null}
        {painel === "trafego" ? (
          <div className="min-w-0 [&_button]:w-full [&_button]:justify-center sm:[&_button]:w-auto">
            <SeletorDeCampanhas
              catalogo={trafego.data?.catalogo ?? []}
              escolhidas={campanhas}
              aoMudar={setCampanhas}
            />
          </div>
        ) : null}
        <span className="col-span-2 text-center text-xs text-muted-foreground sm:ml-auto sm:text-right">
          {t("Variações (▲▼) comparam com o período anterior de mesmo tamanho.")}
        </span>
      </div>

      {painel === "trafego" ? (
        trafego.isLoading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />
        ) : trafego.isError || !trafego.data ? (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            {t("Não consegui carregar os números de tráfego agora. Tente de novo em instantes.")}
          </p>
        ) : trafego.data.catalogo.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            {t(
              "Nenhuma campanha de tráfego pago cadastrada. Crie uma em Campanhas para ver os números aqui.",
            )}
          </p>
        ) : (
          <TrafegoPago dados={trafego.data} />
        )
      ) : null}
      {painel === "business" ? (
        business.isLoading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />
        ) : business.isError || !business.data ? (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            {t("Não consegui carregar os números do Business agora. Tente de novo em instantes.")}
          </p>
        ) : (
          <Business dados={business.data} aoMudarMeses={setMesesAtivo} />
        )
      ) : null}
      {painel === "atendimento" ? (
        atendimento.isLoading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />
        ) : atendimento.isError || !atendimento.data ? (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            {t(
              "Não consegui carregar os números de atendimento agora. Tente de novo em instantes.",
            )}
          </p>
        ) : (
          <Atendimento
            dados={atendimento.data}
            aoSalvarHorario={async (h) => {
              await apiClient.put("/api/v1/dashboards/atendimento", h);
              await queryClient.invalidateQueries({ queryKey: ["dashboard-atendimento"] });
            }}
          />
        )
      ) : null}
      {painel === "comercial" ? <AnalisesDaAgenda periodo={janela} /> : null}
      {painel === "prospeccao" ? (
        prospeccao.isLoading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />
        ) : prospeccao.isError || !prospeccao.data ? (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            {t("Não consegui carregar os números de prospecção agora. Tente de novo em instantes.")}
          </p>
        ) : (
          <ProspeccaoAtiva dados={prospeccao.data} />
        )
      ) : null}
    </div>
  );
}
