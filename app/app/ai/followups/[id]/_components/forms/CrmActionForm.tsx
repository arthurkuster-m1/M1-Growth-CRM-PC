"use client";

import { useState } from "react";

import {
  ActionConfigForm,
  defaultActionConfig,
  type ActionItem,
} from "@/app/app/webhooks/_components/ActionConfigForm";
import { ACTION_LABELS, type ActionType } from "@/app/app/webhooks/_components/labels";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/hooks/i18n/useT";
import { crmActionConfigSchema } from "@/lib/followup/graph-schema";

import type { ConfigOf } from "./shared";

/**
 * O nó `crm_action` — UMA ação de automação de CRM (motor único). O tipo é escolhido aqui e cada ação usa o
 * MESMO formulário que as regras usam (`ActionConfigForm`), então não há segunda tela para manter.
 *
 * Mesma doutrina dos outros formulários: o fluxo só recebe o que passa no schema. Enquanto a ação está
 * incompleta (tag vazia, canal não escolhido...), o formulário guarda o que a pessoa digitou e AVISA que o
 * fluxo continua com a ação anterior — nunca um valor pela metade, e nunca em silêncio.
 */
export function CrmActionForm({
  config,
  onChange,
}: {
  config: ConfigOf<"crm_action">;
  onChange: (c: ConfigOf<"crm_action">) => void;
}) {
  const t = useT();
  const doFluxo = config.action as unknown as ActionItem;
  const [local, setLocal] = useState<ActionItem>(doFluxo);
  const [pendente, setPendente] = useState<string | null>(null);

  // "A IA decide" não tem formulário aqui ainda: mantém o que está, sem inventar edição.
  const editavel = doFluxo.type in ACTION_LABELS;

  const tentar = (proxima: ActionItem) => {
    setLocal(proxima);
    const parsed = crmActionConfigSchema.safeParse({ action: proxima });
    if (!parsed.success) {
      setPendente(parsed.error.issues[0]?.message ?? t("Configuração inválida."));
      return;
    }
    setPendente(null);
    onChange(parsed.data);
  };

  if (!editavel) {
    return (
      <p className="text-sm text-text-muted">
        {t(
          "Esta ação (a IA decide) vem de uma regra migrada e ainda não tem formulário no editor. Ela continua funcionando como está.",
        )}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="crm-action-type">{t("O que fazer")}</Label>
        <Select
          value={local.type}
          onValueChange={(valor) => tentar(defaultActionConfig(valor as ActionItem["type"]))}
        >
          <SelectTrigger id="crm-action-type" data-testid="crm-action-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ACTION_LABELS) as ActionType[]).map((tipo) => (
              <SelectItem key={tipo} value={tipo}>
                {t(ACTION_LABELS[tipo])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ActionConfigForm action={local} onChange={tentar} />

      {pendente && (
        <p
          role="status"
          data-testid="crm-action-pendente"
          className="rounded-md border border-warning/40 bg-warning-bg p-2 text-xs text-warning-fg"
        >
          {t("Falta preencher:")} {pendente}{" "}
          {t("Enquanto isso, o fluxo continua com a ação anterior.")}
        </p>
      )}
    </div>
  );
}
