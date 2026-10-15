import { redirect } from "next/navigation";

import { AnalisesDaAgenda } from "@/components/agenda/AnalisesDaAgenda";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** As análises da Agenda: comparecimento, conversão e quantidades. */
export default async function Page() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  return (
    <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
      <AnalisesDaAgenda />
    </div>
  );
}
