"use client";

import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { CampoDeTexto, Linha } from "@/components/admin/tenants/FichaDaEmpresa";
import { Button } from "@/components/ui/button";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import type { TenantOrganization } from "@/hooks/useTenantDetail";
import { useUpdateTenant } from "@/hooks/useUpdateTenant";

/**
 * O ONBOARDING da empresa, do lado da agência: os campos que o dono preencheu na primeira entrada
 * (nome, o que a empresa faz, fuso, aceite dos Termos) e o botão que FINALIZA o onboarding — o
 * "start do projeto". Finalizar grava `onboarded_at`: o dono deixa de passar pelo passo a passo e
 * cai direto no app. Ctrl+Z desfaz (volta a pendente).
 */
export function OnboardingDaEmpresa({ org }: { org: TenantOrganization }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const { mutate } = useUpdateTenant(org.id);
  const [confirmando, setConfirmando] = useState(false);
  const boasVindas = org.onboarding_state?.welcome;
  const concluido = org.onboarded_at !== null;
  const dia = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">
        {t("Onboarding")}
      </h2>
      <Linha rotulo={t("Nome da empresa")}>
        <span className="text-sm">{org.display_name}</span>
      </Linha>
      <CampoDeTexto
        key={`faz-${boasVindas?.o_que_faz ?? ""}`}
        rotulo={t("O que a empresa faz")}
        valor={boasVindas?.o_que_faz ?? null}
        placeholder={t("Não informado")}
        onSalvar={(novo, anterior) =>
          mutate(
            {
              patch: { onboarding: { o_que_faz: novo } },
              anterior: { onboarding: { o_que_faz: anterior } },
              rotulo: t("O que a empresa faz"),
            },
            { onError: (e) => showApiError(e) },
          )
        }
      />
      <Linha rotulo={t("Fuso horário")}>
        <span className="text-sm">{org.timezone}</span>
        <span className="ml-2 text-xs text-text-muted">{t("(muda em Configurações)")}</span>
      </Linha>
      <Linha rotulo={t("Termos aceitos em")}>
        <span className="text-sm">{dia(boasVindas?.accepted_at)}</span>
      </Linha>
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3">
        {concluido ? (
          <p className="text-sm">
            <span className="font-medium">{t("Onboarding finalizado")}</span>{" "}
            <span className="text-text-muted">{dia(org.onboarded_at)}</span>
          </p>
        ) : confirmando ? (
          <>
            <p className="text-sm">
              {t("Finalizar agora? O dono deixa de ver o passo a passo e entra direto no app.")}
            </p>
            <Button
              size="sm"
              onClick={() => {
                setConfirmando(false);
                mutate(
                  {
                    patch: { onboarded_at: new Date().toISOString() },
                    anterior: { onboarded_at: null },
                    rotulo: t("Finalizar onboarding"),
                  },
                  { onError: (e) => showApiError(e) },
                );
              }}
            >
              {t("Confirmar")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmando(false)}>
              {t("Cancelar")}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-text-muted">{t("O onboarding ainda não foi finalizado.")}</p>
            <Button size="sm" onClick={() => setConfirmando(true)}>
              {t("Finalizar onboarding")}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
