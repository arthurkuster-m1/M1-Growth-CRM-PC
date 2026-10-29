"use client";
import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

import { ActivityTab } from "@/app/app/webhooks/_components/ActivityTab";
import { RulesTab } from "@/app/app/webhooks/_components/RulesTab";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/hooks/i18n/useT";
import { ArrowRight } from "@/lib/ui/icons";

/**
 * As abas da central. "Regras" e "Execuções" são o motor de sempre (o mesmo editor e o mesmo
 * histórico que viviam em Conexões › Webhooks); Follow-ups e Ajustes são portas para as telas que
 * já existem, para ninguém precisar saber onde cada automação mora.
 */
export function AutomacoesClient() {
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
      <TabsList className="w-full justify-start sm:w-auto">
        <TabsTrigger value="regras">{t("Regras")}</TabsTrigger>
        <TabsTrigger value="execucoes">{t("Execuções")}</TabsTrigger>
        <TabsTrigger value="followups">{t("Follow-ups")}</TabsTrigger>
        <TabsTrigger value="ajustes">{t("Ajustes")}</TabsTrigger>
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
          texto={t("Como o agente retoma uma conversa que esfriou, para nenhuma morrer no silêncio.")}
          href="/app/ai/followups"
          rotulo={t("Abrir Follow-ups")}
        />
      </TabsContent>
      <TabsContent value="ajustes" className="mt-0">
        <Porta
          titulo={t("Freio do passo \"a IA decide\"")}
          texto={t("Liga ou desliga, para a empresa inteira, o passo em que a IA escolhe entre as opções de uma regra.")}
          href="/app/settings/automacoes"
          rotulo={t("Abrir ajustes")}
        />
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
    <div className="flex max-w-2xl flex-col gap-2 rounded-2xl border border-border bg-card/50 p-4">
      <h2 className="text-base font-semibold">{titulo}</h2>
      <p className="text-sm text-muted-foreground">{texto}</p>
      <Link
        href={href}
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        {rotulo}
        <ArrowRight size={14} aria-hidden />
      </Link>
    </div>
  );
}
