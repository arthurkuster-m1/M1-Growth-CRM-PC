"use client";
import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

import { InterruptorAiDecide } from "@/app/app/settings/automacoes/_interruptor";
import type { Idioma } from "@/lib/i18n/idiomas";
import { ActivityTab } from "@/app/app/webhooks/_components/ActivityTab";
import { RulesTab } from "@/app/app/webhooks/_components/RulesTab";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/hooks/i18n/useT";
import { ArrowRight, FlowArrow, Sparkle } from "@/lib/ui/icons";

/** Aba em pílula: ativa em verde profundo, as outras em cartão branco. */
const ABA =
  "h-10 rounded-full border border-border bg-card px-4 font-medium text-foreground shadow-none hover:bg-secondary data-[state=active]:border-deep data-[state=active]:bg-deep data-[state=active]:font-bold data-[state=active]:text-deep-foreground data-[state=active]:shadow-none lg:h-9";

/**
 * As abas da central. "Regras" e "Execuções" são o motor de sempre (o mesmo editor e o mesmo
 * histórico que viviam em Conexões › Webhooks); Follow-ups e Ajustes são portas para as telas que
 * já existem, para ninguém precisar saber onde cada automação mora.
 */
export function AutomacoesClient({
  freioDaIa,
  idioma,
}: {
  freioDaIa: { ligado: boolean; erroDeLeitura: boolean };
  idioma: Idioma;
}) {
  const t = useT();
  // As abas do Radix geram ids por `useId`; com SSR os ids divergem na hidratação — mesmo padrão
  // da tela de Webhooks: esqueleto no servidor, abas depois de montar.
  const montado = useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => true,
    () => false,
  );
  if (!montado) return <Skeleton className="h-9 w-[360px]" />;

  return (
    <Tabs defaultValue="regras" className="flex flex-1 flex-col gap-4">
      <TabsList className="h-auto w-full justify-start gap-2 bg-transparent p-0 sm:w-auto">
        {(
          [
            ["regras", t("Regras")],
            ["execucoes", t("Execuções")],
            ["followups", t("Follow-ups")],
            ["ajustes", t("Ajustes")],
          ] as const
        ).map(([valor, rotulo]) => (
          <TabsTrigger key={valor} value={valor} className={ABA}>
            {rotulo}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="regras" className="mt-0">
        <RulesTab />
      </TabsContent>
      <TabsContent value="execucoes" className="mt-0">
        <ActivityTab />
      </TabsContent>
      <TabsContent value="followups" className="mt-0">
        <Porta
          titulo={t("Follow-ups da IA")}
          texto={t(
            "Como o agente retoma uma conversa que esfriou, para nenhuma morrer no silêncio.",
          )}
          href="/app/ai/followups"
          rotulo={t("Abrir Follow-ups")}
        />
      </TabsContent>
      <TabsContent value="ajustes" className="mt-0 flex max-w-2xl flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{t('Freio do passo "a IA decide"')}</h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "O freio único do passo em que a IA escolhe entre as opções de uma regra, para a empresa inteira.",
            )}
          </p>
        </div>
        {freioDaIa.erroDeLeitura ? (
          <p
            role="alert"
            className="rounded-2xl border border-destructive/40 bg-error-bg p-4 text-sm text-error-fg"
          >
            {t(
              "Não consegui ler agora o estado deste interruptor. Enquanto ele não puder ser lido, nenhum passo a IA decide consulta o modelo. Recarregue a página; se continuar, avise quem cuida da instalação.",
            )}
          </p>
        ) : (
          <InterruptorAiDecide ligado={freioDaIa.ligado} idioma={idioma} />
        )}
      </TabsContent>
    </Tabs>
  );
}

function Porta({
  titulo,
  texto,
  href,
  rotulo,
}: {
  titulo: string;
  texto: string;
  href: string;
  rotulo: string;
}) {
  return (
    <div className="flex max-w-2xl items-start gap-4 rounded-[22px] border border-border bg-card p-5 shadow-xs sm:p-6">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-primary">
        <FlowArrow size={22} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-lg font-bold tracking-tight">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{texto}</p>
        <Link
          href={href}
          className="mt-1 inline-flex h-10 w-fit items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent-hover"
        >
          <Sparkle size={14} aria-hidden />
          {rotulo}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
