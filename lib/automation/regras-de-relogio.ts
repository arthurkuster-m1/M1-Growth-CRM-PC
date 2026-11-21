/**
 * O QUE OS RELÓGIOS VARREM (motor único, Fase 4b — docs/PLANO-MOTOR-UNICO-M1.md).
 *
 * Os crons de gatilho por tempo ou data (`lead-time-triggers`, `lead-date-field-due`, `contact-birthdays`)
 * transformam um período em evento para quem o pediu. Antes só liam `automation_rules`; agora leem as DUAS
 * fontes, na mesma forma:
 *   - as regras ativas (o que existia);
 *   - os fluxos de automação de CRM ativos (`surface='crm_automation'`, gatilho `event`) desse tipo de
 *     evento, com `id` = id do fluxo e `trigger_config` = `params.config`.
 *
 * O evento sai "apontado" (`payload.rule_id`) para o `id` devolvido aqui: o motor de regras só roda a regra
 * de mesmo id e o gatilho por evento só inscreve o fluxo de mesmo id — as duas fontes nunca respondem ao
 * mesmo evento. Uma regra migrada tem a original DESLIGADA (Fase 4c), então nada dispara em dobro.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { triggerConfigSchema } from "@/lib/followup/api-schemas";

export interface RegraDeRelogio {
  id: string;
  organization_id: string;
  trigger_event: string;
  trigger_config: unknown;
}

type Resultado = { data: RegraDeRelogio[] | null; error: { message: string } | null };

export async function carregaRegrasDeRelogio(
  admin: SupabaseClient,
  eventTypes: readonly string[],
): Promise<Resultado> {
  const { data: regras, error } = await admin
    .from("automation_rules")
    .select("id, organization_id, trigger_event, trigger_config")
    .in("trigger_event", [...eventTypes])
    .eq("is_active", true);
  if (error) return { data: null, error };

  const { data: fluxos, error: erroFluxos } = await admin
    .from("followup_flow_pointers")
    .select("id, organization_id, trigger_config")
    .eq("surface", "crm_automation")
    .eq("status", "active")
    .not("active_version_id", "is", null);
  if (erroFluxos) return { data: null, error: erroFluxos };

  const doMotorUnico: RegraDeRelogio[] = [];
  for (const f of (fluxos ?? []) as Array<{
    id: string;
    organization_id: string;
    trigger_config: unknown;
  }>) {
    const gatilho = triggerConfigSchema.safeParse(f.trigger_config);
    if (!gatilho.success || gatilho.data.kind !== "event") continue;
    if (!eventTypes.includes(gatilho.data.params.event_type)) continue;
    doMotorUnico.push({
      id: f.id,
      organization_id: f.organization_id,
      trigger_event: gatilho.data.params.event_type,
      trigger_config: gatilho.data.params.config ?? {},
    });
  }

  return { data: [...((regras ?? []) as RegraDeRelogio[]), ...doMotorUnico], error: null };
}
