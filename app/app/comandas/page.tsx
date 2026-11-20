import { redirect } from "next/navigation";

/**
 * As comandas saíram do fluxo do CRM (decisão do Arthur, 20/11/2026): o dinheiro que entra vem das
 * Vendas (Oportunidades › Vendas) e é acompanhado em Finanças. O endereço antigo leva para lá; o
 * código e as tabelas das comandas seguem no repositório até uma limpeza pedida à parte.
 */
export default function ComandasRedirect(): never {
  redirect("/app/financas");
}
