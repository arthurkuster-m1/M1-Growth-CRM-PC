import { redirect } from "next/navigation";

/** As análises da Agenda moraram aqui; hoje são a aba Comercial dos Dashboards. Mantido por links salvos. */
export default function Page() {
  redirect("/app/marketing/dashboards?painel=comercial");
}
