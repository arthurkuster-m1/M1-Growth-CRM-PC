import { z } from "zod";
import { interfaceSettingsSchema, interfaceTemDestino } from "@/lib/navigation/interface";

/** Mesmo vocabulário no formulário e no limite HTTP. */
export const tenantCreationFields = {
  display_name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  legal_name: z.string().max(255).optional(),
  cnpj: z.string().max(18).optional(),
  owner_interface_settings: interfaceSettingsSchema.optional(),
  owner_email: z.string().trim().email(),
  /** A oportunidade desta empresa no CRM da agência (de onde saem entrada e mensalidade). */
  agencia_lead_id: z.string().uuid().optional(),
};
export const createTenantSchema = z
  .object(tenantCreationFields)
  .refine(
    (v) => !v.owner_interface_settings || interfaceTemDestino(v.owner_interface_settings, "admin"),
    { message: "Selecione ao menos uma área de trabalho.", path: ["owner_interface_settings"] },
  );
