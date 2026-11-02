import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { caminhoDeIaSuspenso } from "@/lib/navigation/suspensao";

/**
 * As abas de seção que viviam aqui foram removidas: só apareciam para quem já
 * estava dentro de `/app/ai/*`, o que deixava Conhecimento, Credenciais, Uso,
 * Casos e Alertas invisíveis do resto do sistema. Quem faz esse trabalho agora
 * é o hub em `/app/ai`, alcançável pelo sidebar.
 */
export default async function AiLayout({ children }: { children: React.ReactNode }) {
  // Área de IA suspensa (`lib/navigation/suspensao.ts`): só passa o que é Central de Avisos e follow-ups.
  const caminho = (await headers()).get("x-pathname") ?? "";
  if (caminhoDeIaSuspenso(caminho)) redirect("/app");
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
