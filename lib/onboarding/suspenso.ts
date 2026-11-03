/**
 * O NOVO ONBOARDING (02-03/11/2026) é curto: **Seu negócio** (nome, fuso e aceite dos Termos) e **Sua equipe**
 * (convidar, opcional). Os passos ANTIGOS — telefone/WhatsApp, treinar a IA, funil e "ver ele atender" — estão
 * SUSPENSOS junto com a área de IA e voltam, se for o caso, trocando esta chave para `false`
 * (`lib/onboarding/passos.ts` lê daqui; nada foi apagado).
 */
export const ONBOARDING_ANTIGO_SUSPENSO = process.env.M1_ONBOARDING_ANTIGO_SUSPENSO !== "false";
