import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { usuarioDaSessao } from "@/lib/auth/usuario-da-sessao";
import { branding } from "@/lib/branding";
import { traduzir } from "@/lib/i18n/dicionario";
import { idiomaDoVisitante } from "@/lib/i18n/idiomaAnonimo";
import { nomeDoOperador, resolverOperador } from "@/lib/legal/operador";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Plataforma de gestão de marketing, atendimento e vendas: estratégia, tarefas, cronograma e CRM num só lugar.",
};

/**
 * A PÁGINA INICIAL pública. Quem está logado segue para o painel; quem chega sem sessão (um
 * visitante, a revisão do Google do login) vê o que o sistema é, quem o opera, como os dados do
 * Google são usados e os links dos Termos e da Política — sem precisar entrar.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const { user } = await usuarioDaSessao(supabase.auth);
  if (user) redirect("/app");

  const idioma = await idiomaDoVisitante(null);
  const t = (texto: string) => traduzir(texto, idioma);
  const marca = branding();
  const op = await resolverOperador();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="space-y-4">
        <p className="text-xs tracking-wider text-muted-foreground uppercase">{marca.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("Marketing, atendimento e vendas num só lugar")}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          {t(
            "O sistema da Assessoria M1 organiza a estratégia de marketing de cada cliente, o atendimento por mensagens, o funil de vendas, as tarefas e o cronograma do projeto — e mostra o que está acontecendo, em tempo real.",
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            {t("Entrar")}
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-11 items-center rounded-xl border px-5 text-sm font-medium hover:bg-secondary"
          >
            {t("Criar conta")}
          </Link>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("O que o sistema faz")}</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>
            {t(
              "Estratégia de marketing: diagnóstico, público, concorrência, ofertas e planejamento.",
            )}
          </li>
          <li>{t("Atendimento e CRM: conversas, funis, leads e acompanhamento de vendas.")}</li>
          <li>{t("Tarefas e cronograma compartilhados entre a agência e o cliente.")}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("Como usamos os dados do Google")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(
            "Se você entrar com o Google, usamos apenas o seu nome, e-mail e foto de perfil para criar e identificar a sua conta. Não acessamos o seu Gmail, Drive, Agenda ou contatos, e não vendemos nem compartilhamos esses dados. Os detalhes estão na Política de Privacidade.",
          )}
        </p>
      </section>

      <footer className="mt-auto space-y-2 border-t pt-6 text-sm text-muted-foreground">
        <p>
          <Link className="underline underline-offset-2" href="/legal/privacy">
            {t("Política de Privacidade")}
          </Link>
          {" · "}
          <Link className="underline underline-offset-2" href="/legal/terms">
            {t("Termos de Uso")}
          </Link>
        </p>
        <p>
          {nomeDoOperador(op)}
          {op.cnpj ? ` — CNPJ ${op.cnpj}` : ""}
          {op.dpoEmail ? (
            <>
              {" — "}
              <a className="underline underline-offset-2" href={`mailto:${op.dpoEmail}`}>
                {op.dpoEmail}
              </a>
            </>
          ) : null}
        </p>
      </footer>
    </main>
  );
}
