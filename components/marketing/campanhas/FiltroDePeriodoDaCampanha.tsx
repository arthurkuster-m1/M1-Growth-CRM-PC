"use client";

import { useState } from "react";

import { SeletorDePeriodo, type AtalhoDePeriodo } from "@/components/motor/CalendarioDePeriodo";
import { useT } from "@/hooks/i18n/useT";
import { PERIODOS, janelaDoPeriodo } from "@/lib/marketing/periodos";
import { hojeLocal, rotuloDoPeriodo } from "@/components/motor/atalhos-de-periodo";

/** O estado do filtro: `null` = o período da campanha (padrão). */
export function usePeriodoDaCampanha(padrao: { de: string; ate: string }) {
  const [escolhido, setEscolhido] = useState<{ de: string; ate: string } | null>(null);
  const janela = escolhido ?? padrao;
  const ehPadrao =
    escolhido === null || (escolhido.de === padrao.de && escolhido.ate === padrao.ate);
  return { janela, ehPadrao, escolhido, setEscolhido, padrao };
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
    ...PERIODOS.map((p) => ({ id: p, rotulo: rotuloDoPeriodo(t, p), ...janelaDoPeriodo(p, hoje) })),
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
