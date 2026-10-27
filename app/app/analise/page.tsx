import { redirect } from "next/navigation";

/** O grupo Análise acabou: os números vivem nos Dashboards. Mantido por links salvos. */
export default function AnaliseRedirect(): never {
  redirect("/app/marketing/dashboards");
}
