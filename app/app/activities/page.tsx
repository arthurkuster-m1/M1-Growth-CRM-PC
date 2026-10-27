import { redirect } from "next/navigation";

/** Atividades virou uma aba dos Dashboards. Mantido por links salvos. */
export default function ActivitiesRedirect(): never {
  redirect("/app/marketing/dashboards?painel=atividades");
}
