import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Vendas agora é uma visão da página CRM. A rota antiga leva para lá. */
export default function VendasPage() {
  redirect("/app/clientes?visao=vendas");
}
