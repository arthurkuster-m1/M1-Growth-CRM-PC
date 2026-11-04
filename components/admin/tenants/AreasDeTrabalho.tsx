"use client";

import { useState } from "react";

import { InterfaceEditor } from "@/components/team/InterfaceEditor";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import {
  interfaceSettingsSchema,
  interfaceTemDestino,
  type InterfaceSettings,
} from "@/lib/navigation/interface";

/**
 * As ÁREAS DE TRABALHO da empresa: o que aparece para ela no menu lateral, uma a uma — o mesmo
 * editor da criação da empresa. Diferente dos campos soltos da ficha, aqui se marcam várias
 * caixas e se SALVA de uma vez: salvar a cada clique deixaria passar estados que o servidor recusa
 * (nenhuma área marcada). O servidor revalida (`interface_settings`) e a empresa só enxerga o que
 * estiver marcado; as portas essenciais (perfil, configurações da empresa) nunca somem.
 */
export function AreasDeTrabalho({
  valor,
  onSalvar,
}: {
  valor: InterfaceSettings;
  onSalvar: (novo: InterfaceSettings, anterior: InterfaceSettings) => void;
}) {
  const t = useT();
  const [rascunho, setRascunho] = useState<InterfaceSettings>(valor);
  const mudou = JSON.stringify(rascunho) !== JSON.stringify(valor);
  const valido =
    interfaceSettingsSchema.safeParse(rascunho).success && interfaceTemDestino(rascunho, "admin");

  return (
    <div className="space-y-3">
      <InterfaceEditor value={rascunho} onChange={setRascunho} role="admin" />
      {!valido ? (
        <p className="text-xs text-error-fg">{t("Selecione ao menos uma área de trabalho.")}</p>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!mudou || !valido}
          onClick={() => onSalvar(rascunho, valor)}
        >
          {t("Salvar áreas")}
        </Button>
        {mudou ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setRascunho(valor)}>
            {t("Desfazer")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
