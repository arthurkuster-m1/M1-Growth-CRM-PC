"use client";

import { useState } from "react";

import { SeletorDePeriodo, type AtalhoDePeriodo } from "@/components/motor/CalendarioDePeriodo";
import { useT } from "@/hooks/i18n/useT";
import { PERIODOS, janelaDoPeriodo, type Periodo } from "@/lib/marketing/periodos";

const hojeLocal = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/** O estado do filtro: `null` = o período da campanha (padrão). */
export function usePeriodoDaCampanha(padrao: { de: string; ate: string }) {
  const [escolhido, setEscolhido] = useState<{ de: string; ate: string } | null>(null);
  const janela = escolhido ?? padrao;
  const ehPadrao =
    escolhido === null || (escolhido.de === padrao.de && escolhido.ate === padrao.ate);
  return { janela, ehPadrao, escolhido, setEscolhido, padrao };
}

function rotuloDoAtalho(t: (s: string) => string, p: Periodo): string {
  switch (p) {
    case "hoje":
      return t("Hoje");
    case "ontem":
      return t("Ontem");
    case "ultimos_5_dias":
      return t("Últimos 5 dias");
    case "ultimos_7_dias":
      return t("Últimos 7 dias");
    case "ultimos_30_dias":
      return t("Últimos 30 dias");
    case "semana":
      return t("Esta semana");
    case "mes":
      return t("Este mês");
    case "mes_passado":
      return t("Mês passado");
  }
}

/**
 * O FILTRO DE DATA de uma tela da campanha: abre no período da campanha (início e fim; contínua
 * = mês atual) e deixa escolher qualquer outro — para olhar um pedaço da campanha (teste A/B)
 * sem sair da tela. Cada tela tem o seu.
 */
export function FiltroDePeriodoDaCampanha({
  periodo,
}: {
  periodo: ReturnType<typeof usePeriodoDaCampanha>;
}) {
  const t = useT();
  const hoje = hojeLocal();
  const atalhos: AtalhoDePeriodo[] = [
    { id: "padrao", rotulo: t("Período da campanha"), ...periodo.padrao },
    ...PERIODOS.map((p) => ({ id: p, rotulo: rotuloDoAtalho(t, p), ...janelaDoPeriodo(p, hoje) })),
  ];
  return (
    <SeletorDePeriodo
      de={periodo.janela.de}
      ate={periodo.janela.ate}
      rotulo={t("Período analisado")}
      atalhos={atalhos}
      aoMudar={(p) => periodo.setEscolhido(p)}
      aoVoltarAoPadrao={periodo.ehPadrao ? undefined : () => periodo.setEscolhido(null)}
    />
  );
}
