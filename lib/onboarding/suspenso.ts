/**
 * O ONBOARDING ANTIGO (o assistente de boas-vindas, funil, WhatsApp, IA, equipe e teste) está SUSPENSO
 * desde 02/11/2026: o Arthur vai criar um processo novo. Enquanto `true`:
 *  - ninguém é mandado para `/onboarding` depois de entrar (`app/app/layout.tsx`);
 *  - qualquer passo de `/onboarding/*` volta para `/app` (`app/onboarding/layout.tsx`).
 * Nada foi apagado: o código dos passos e as ações continuam, e voltar é trocar para `false`.
 *
 * ⚠️ O passo "welcome" é onde hoje se aceitam os Termos de uso e se define o nome da empresa e o fuso.
 * O processo novo precisa cobrir isso (o nome já vem de quem cria a empresa).
 */
export const ONBOARDING_ANTIGO_SUSPENSO = true;
