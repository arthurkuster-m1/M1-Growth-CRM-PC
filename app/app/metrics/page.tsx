import { redirect } from "next/navigation";

/** O Desempenho acabou: seus números vivem nos Dashboards (Atendimento). Mantido por links salvos. */
export default function MetricsRedirect(): never {
  redirect("/app/marketing/dashboards?painel=atendimento");
}
