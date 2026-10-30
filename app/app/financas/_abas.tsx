"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/hooks/i18n/useT";

/**
 * As duas partes de Finanças: o que entrou (visão geral) e onde o dinheiro fica e como o cliente paga
 * (contas e formas de pagamento — antes uma página solta em Configurações). A aba vive na URL
 * (`?aba=contas`), para o link colado abrir onde deve.
 */
export function FinancasAbas({ visao, contas }: { visao: ReactNode; contas: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const aba = params.get("aba") === "contas" ? "contas" : "visao";

  const irPara = (proxima: string) => {
    const q = new URLSearchParams(params.toString());
    if (proxima === "contas") q.set("aba", "contas");
    else q.delete("aba");
    router.replace(q.size ? `${pathname}?${q.toString()}` : pathname, { scroll: false });
  };

  return (
    <Tabs value={aba} onValueChange={irPara} className="flex min-h-0 flex-1 flex-col gap-4">
      <TabsList className="h-11 w-full justify-start gap-1 sm:w-auto">
        <TabsTrigger value="visao">{t("Visão geral")}</TabsTrigger>
        <TabsTrigger value="contas">{t("Contas e formas de pagamento")}</TabsTrigger>
      </TabsList>
      <TabsContent value="visao" className="mt-0 flex min-h-0 flex-1 flex-col">
        {visao}
      </TabsContent>
      <TabsContent value="contas" className="mt-0 flex min-h-0 flex-1 flex-col">
        {contas}
      </TabsContent>
    </Tabs>
  );
}
