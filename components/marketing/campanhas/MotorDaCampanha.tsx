"use client";

import { ProspectingClient } from "@/app/app/prospecting/_client";
import { ListaDeCampanhas } from "@/app/app/campaigns/_client";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { ROLE_RANK } from "@/lib/auth/types";

/**
 * Os motores da campanha de prospecção: a extração de leads e os disparos. Eram telas soltas no
 * CRM; agora moram dentro da campanha, como subpáginas. Por enquanto reaproveitam as mesmas telas
 * (ainda sem filtro por campanha) — o vínculo e o registro de cada extração vêm no passo seguinte.
 */
export function MotorDaCampanha({ motor }: { motor: "extracao" | "disparos" }) {
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
  return motor === "extracao" ? <ProspectingClient /> : <ListaDeCampanhas />;
}
