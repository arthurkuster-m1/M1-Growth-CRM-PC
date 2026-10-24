"use client";

import { ProspectingClient } from "@/app/app/prospecting/_client";
import { ImportarLeadsDaCampanha } from "@/components/marketing/campanhas/ImportarLeadsDaCampanha";
import { LotesDaCampanha } from "@/components/marketing/campanhas/LotesDaCampanha";
import { ListaDeCampanhas } from "@/app/app/campaigns/_client";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { ROLE_RANK } from "@/lib/auth/types";

/**
 * Os motores da campanha de prospecção: a extração de leads e os disparos. Eram telas soltas no
 * CRM; agora moram dentro da campanha, como subpáginas. Por enquanto reaproveitam as mesmas telas
 * — a extração já é da campanha (lista só as dela e grava a origem no lead); os disparos ainda não.
 */
export function MotorDaCampanha({
  motor,
  campanhaId,
}: {
  motor: "extracao" | "disparos";
  campanhaId: string;
}) {
  const t = useT();
  const { activeOrg } = useAuth();
  const papel = activeOrg?.role ?? null;
  const minimo = motor === "extracao" ? "admin" : "manager";
  if (!papel || ROLE_RANK[papel] < ROLE_RANK[minimo]) {
    return (
      <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
        {motor === "extracao"
          ? t("A extração de leads é só para administradores.")
          : t("Os disparos são só para gerentes e administradores.")}
      </p>
    );
  }
  if (motor === "disparos") return <ListaDeCampanhas campanhaId={campanhaId} />;
  return (
    <div className="grid gap-6">
      <ProspectingClient campanhaId={campanhaId} />
      <ImportarLeadsDaCampanha campanhaId={campanhaId} />
      <LotesDaCampanha campanhaId={campanhaId} />
    </div>
  );
}
