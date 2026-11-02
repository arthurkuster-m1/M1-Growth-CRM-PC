/**
 * O `reason` de `failed` em POST /api/v1/team/invite (`app/api/v1/team/invite/route.ts`)
 * é código estável de contrato de API — `tests/e2e/invite-lifecycle.spec.ts` faz
 * `reason === "already_member"` — não frase para tela. Esta é a única tradução
 * de código para frase; o card não conhece os códigos.
 *
 * A frase é chave de `t()`: pt-BR aqui, espanhol em `lib/i18n/dicionario.ts`.
 */
const MOTIVOS_DE_FALHA: Record<string, string> = {
  already_member: "Já é membro desta organização.",
};

/** Código sem tradução conhecida: devolve o próprio código, nunca some da tela. */
export function descreverMotivoDaFalha(reason: string): string {
  return MOTIVOS_DE_FALHA[reason] ?? reason;
}

/**
 * Por que o e-mail do convite NÃO saiu, em palavras de quem opera (o convite em si foi criado: o link
 * vale e pode ser copiado e mandado por WhatsApp). Vocabulário de `lib/email/roteador.ts`.
 */
const MOTIVOS_DO_EMAIL: Record<string, string> = {
  not_configured: "O envio de e-mail ainda não está configurado nesta instalação (Admin › E-mail).",
  send_failed: "O provedor de e-mail recusou ou falhou o envio.",
  rate_limited: "O provedor de e-mail limitou os envios por agora. Tente de novo em instantes.",
  sender_rejected: "O provedor recusou o remetente configurado (Admin › E-mail).",
  dominio_nao_verificado: "O domínio do remetente ainda não foi verificado no provedor de e-mail.",
};

export function descreverMotivoDoEmail(erro: string | undefined): string {
  return MOTIVOS_DO_EMAIL[erro ?? "not_configured"] ?? MOTIVOS_DO_EMAIL.not_configured!;
}
