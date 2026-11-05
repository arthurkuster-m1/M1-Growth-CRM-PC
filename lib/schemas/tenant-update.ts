import { z } from "zod";
import { IDIOMAS } from "@/lib/i18n/idiomas";
import { ehHexValido } from "@/lib/branding/rampa";
import { interfaceSettingsSchema, interfaceTemDestino } from "@/lib/navigation/interface";

function fusoValido(valor: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: valor });
    return true;
  } catch {
    return false;
  }
}

/** Texto opcional: vazio vira `null` (limpa o campo). */
const textoOuNulo = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

/**
 * Corpo do PATCH /api/v1/admin/tenants/[id].
 *
 * Fora de propósito: `slug` (identidade, só leitura), `status` e `suspended_*`
 * (só por `fn_suspender_organizacao` / `fn_reativar_organizacao`, rotas
 * `suspend` e `reactivate`), `created_at`/`created_by` e `settings.branding`
 * (escritor próprio). `.strict()`: campo desconhecido é erro, não silêncio.
 */
export const updateTenantSchema = z
  .object({
    display_name: z.string().trim().min(2).max(120),
    legal_name: z.string().trim().min(2).max(255),
    cnpj: textoOuNulo(18),
    timezone: z.string().trim().min(1).max(64).refine(fusoValido, "Fuso horário inválido"),
    locale: z.enum(IDIOMAS as unknown as [string, ...string[]]),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, "Moeda deve ser ISO-4217 (ex.: BRL)"),
    country: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, "País deve ser ISO-3166 alpha-2 (ex.: BR)")
      .nullable(),
    dpo_email: z
      .string()
      .trim()
      .email()
      .max(255)
      .transform((v) => v.toLowerCase())
      .nullable(),
    privacy_policy_url: z.string().trim().url().max(2000).nullable(),
    ai_budget_cents: z.number().int().min(0).max(1_000_000_000_000).nullable(),
    media_retention_days: z.number().int().min(1).max(3650),
    interface_settings: interfaceSettingsSchema,
    onboarded_at: z.string().datetime({ offset: true }).nullable(),
    /** Campo do onboarding editável pela agência (`onboarding_state.welcome.o_que_faz`). */
    onboarding: z.object({ o_que_faz: textoOuNulo(280) }).strict(),
    /** O lead da empresa no CRM da agência; `null` desliga o vínculo. */
    agencia_lead_id: z.string().uuid().nullable(),
    /** `null` volta ao que vem da instalação; cada campo `null` idem. */
    marca: z
      .object({
        app_name: textoOuNulo(80),
        accent_hex: z.string().trim().refine(ehHexValido, "Cor inválida").nullable(),
      })
      .strict()
      .nullable(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nenhum campo para alterar." })
  .refine((v) => !v.interface_settings || interfaceTemDestino(v.interface_settings, "admin"), {
    message: "Selecione ao menos uma área de trabalho.",
    path: ["interface_settings"],
  });
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
