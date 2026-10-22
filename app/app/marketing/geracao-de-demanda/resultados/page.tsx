import { redirect } from "next/navigation";

/** Os resultados das campanhas viraram o Dashboard de Tráfego Pago. Mantido por links salvos. */
export default function ResultadosPage() {
  redirect("/app/marketing/dashboards?painel=trafego");
}
