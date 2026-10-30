"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { definirOrigemDosLeads } from "@/app/actions/agencia/modoAgencia";
import { useT } from "@/hooks/i18n/useT";
import type { OrigemDosLeads as Origem } from "@/lib/agencia/campanhas";

/** De onde vêm os leads das campanhas deste cliente: do CRM dele, ou das conversas iniciadas do Meta. */
export function OrigemDosLeads({
  clienteId,
  nome,
  origem,
}: {
  clienteId: string;
  nome: string;
  origem: Origem;
}) {
  const t = useT();
  const router = useRouter();
  const [valor, setValor] = useState(origem);
  const [pendente, iniciar] = useTransition();
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {t("Leads vêm de")}
      <select
        value={valor}
        disabled={pendente}
        aria-label={`${t("Origem dos leads")} — ${nome}`}
        onChange={(e) => {
          const novo = e.target.value as Origem;
          setValor(novo);
          iniciar(async () => {
            const r = await definirOrigemDosLeads(clienteId, novo);
            if (!r.ok) {
              setValor(origem);
              toast.error(t("Não foi possível salvar."));
              return;
            }
            router.refresh();
          });
        }}
        className="h-8 rounded-lg border bg-card px-2 text-xs text-foreground"
      >
        <option value="crm">{t("CRM do cliente")}</option>
        <option value="meta">{t("Meta (conversas iniciadas)")}</option>
      </select>
    </label>
  );
}
