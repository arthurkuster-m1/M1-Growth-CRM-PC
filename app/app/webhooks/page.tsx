import { redirect } from "next/navigation";

// Webhooks virou uma aba de Conexões; a rota fica para links salvos e favoritos antigos.
export default function WebhooksPage(): never {
  redirect("/app/connections?aba=webhooks");
}
