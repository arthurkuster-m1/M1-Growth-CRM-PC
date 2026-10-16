import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { ConteudoDaConfiguracaoDaAgenda } from "./_conteudo";

export const dynamic = "force-dynamic";

/**
 * TIPOS DE AGENDAMENTO — a configuração que o produto prometia e não tinha.
 *
 * ─── Por que aqui, e não dentro da Agenda ────────────────────────────────
 *
 * O comentário do `lib/navigation/registry.ts` já dizia, antes de esta tela
 * existir: *"Os TIPOS de agendamento e a disponibilidade — que são configuração
 * de verdade — vão para Configurações quando existirem."* A Agenda é onde o dia
 * ACONTECE; aqui é onde ele se configura.
 *
 * ─── O que estava faltando ───────────────────────────────────────────────
 *
 * A `calendar_event_types` tem dez categorias no CHECK, duração, buffers,
 * antecedência mínima, janela de agendamento e local — e não havia como criar ou
 * editar um tipo por lugar nenhum. Toda organização recebia três tipos semeados
 * (`fn_semear_tipos_de_agendamento`) e ficava com eles para sempre; uma clínica
 * que quisesse "Retorno de 15 minutos" não tinha caminho.
 */
export default async function TiposDeAgendamentoPage() {
  const user = await requireAuth();
  // `t` local em vez do hook: esta página é componente de SERVIDOR, e lá o
  // idioma vem resolvido em `user.idioma` (a cadeia pessoa → organização →
  // padrão vive em `lib/auth/server.ts`).
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Tipos de agendamento")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("O que se pode marcar, quanto dura e quem atende. É isto que a tela de marcar e o agente de IA oferecem ao cliente.")}
        </p>
      </header>
      <ConteudoDaConfiguracaoDaAgenda user={user} activeOrg={activeOrg} />
    </div>
  );
}
