import { redirect } from "next/navigation";

// A criação de empresa virou um popup na lista (`NovaEmpresaDialog`); este endereço antigo
// continua funcionando e abre o popup.
export default function NewTenantPage(): never {
  redirect("/admin/tenants?nova=1");
}
