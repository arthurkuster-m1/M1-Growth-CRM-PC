"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { finishOnboarding } from "@/app/actions/onboarding/finishOnboarding";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import type { ItemDoResumo } from "@/lib/onboarding/passos";

/** Por onde começar: as quatro telas do dia a dia. Só apresenta; a pessoa não precisa abrir nenhuma agora. */
const POR_ONDE_COMECAR = [
  {
    href: "/app/inicio",
    titulo: "Início",
    texto: "O resumo do seu dia: tarefas, compromissos e o que precisa de atenção.",
  },
  {
    href: "/app/clientes",
    titulo: "Clientes (CRM)",
    texto: "Os leads e as oportunidades, em tabela ou quadro.",
  },
  {
    href: "/app/agenda",
    titulo: "Agenda",
    texto: "Seus compromissos, com lembretes para o cliente não faltar.",
  },
  {
    href: "/app/tarefas",
    titulo: "Tarefas",
    texto: "O que precisa ser feito, por você, pela equipe e pela agência.",
  },
] as const;

export function DoneClient({ itens }: { itens: ItemDoResumo[] }) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6 rounded-lg border bg-background p-6">
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">{t("Tudo pronto!")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "A sua empresa está configurada. O que ficou para depois pode ser feito quando quiser.",
          )}
        </p>
      </div>

      <ul className="mx-auto max-w-sm space-y-2 text-left text-sm">
        {itens.map((it) => (
          <li key={it.segmento} className="flex items-center gap-2">
            <span
              aria-hidden
              className={
                "inline-block h-2 w-2 rounded-full " +
                (it.feito ? "bg-emerald-500" : "bg-muted-foreground/30")
              }
            />
            <span className={it.feito ? "" : "text-muted-foreground"}>
              {t(it.rotulo)}
              {it.pulado ? ` (${t("você pulou")})` : it.feito ? "" : ` (${t("ainda não")})`}
            </span>
          </li>
        ))}
      </ul>

      <section className="space-y-3 border-t pt-6">
        <div>
          <h3 className="text-sm font-medium">{t("Por onde começar")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("Você não precisa mexer em nada disso agora. É só para saber onde fica.")}
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {POR_ONDE_COMECAR.map((p) => (
            <li key={p.href} className="rounded-md border p-3">
              <a href={p.href} className="text-sm font-medium underline-offset-2 hover:underline">
                {t(p.titulo)}
              </a>
              <p className="mt-1 text-xs text-muted-foreground">{t(p.texto)}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex justify-center">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await finishOnboarding();
              if (res && !res.ok) toast.error(`${t("Falha:")} ${res.error}`);
            })
          }
        >
          {pending ? t("Finalizando...") : t("Começar a usar")}
        </Button>
      </div>
    </div>
  );
}
