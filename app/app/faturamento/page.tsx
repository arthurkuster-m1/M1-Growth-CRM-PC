import { redirect } from "next/navigation";

/** Faturamento virou Finanças. Mantido por links salvos. */
export default function FaturamentoRedirect(): never {
  redirect("/app/financas");
}
