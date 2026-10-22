import { redirect } from "next/navigation";

/**
 * "Marketing" é só o grupo do menu lateral (um interruptor que abre e fecha), não uma página:
 * o conteúdo é o da Estratégia. Quem chega por um endereço ou favorito antigo cai nela.
 */
export default function MarketingPage() {
  redirect("/app/marketing/estrategia");
}
