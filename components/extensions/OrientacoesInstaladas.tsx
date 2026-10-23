import Link from "next/link";

import { Card } from "@/components/ui/card";
import { permissaoDaCapacidade } from "@/lib/extensions/capacidades";
import { portasLegiveis } from "@/lib/extensions/portas-legiveis";
import { localize, type ExtensionManifest } from "@/lib/extensions/manifest";
import type { ExtensionGuideView } from "@/lib/extensions/view";
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMA_PADRAO, type Idioma } from "@/lib/i18n/idiomas";
import { BookOpen, Lightbulb, ListChecks, Warning } from "@/lib/ui/icons";

const EXTENSION_ICONS: Record<ExtensionManifest["display"]["icon"], typeof ListChecks> = {
  ListChecks,
  BookOpen,
  Lightbulb,
};

/**
 * Os cartões que as extensões instaladas contribuem. Moravam na página "Ver tudo em CRM"; sem ela,
 * moram no topo de Extensões, que é onde a pessoa já gerencia o que instalou.
 */
export function OrientacoesInstaladas({
  extensionGuides,
  extensionsUnavailable,
  locale = IDIOMA_PADRAO,
}: {
  extensionGuides: ExtensionGuideView[];
  extensionsUnavailable: boolean;
  locale?: Idioma;
}) {
  if (extensionGuides.length === 0 && !extensionsUnavailable) return null;
  return (
    <section aria-labelledby="orientacoes-instaladas" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="orientacoes-instaladas"
            className="text-xs font-medium tracking-wider text-muted-foreground uppercase"
          >
            {traduzir("Orientações instaladas", locale)}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {traduzir(
              "Guias adicionados depois da instalação, sem acesso aos dados do CRM.",
              locale,
            )}
          </p>
        </div>
      </div>

      {extensionsUnavailable ? (
        <Card className="flex gap-3 border-warning/40 bg-warning-bg p-4">
          <Warning
            size={20}
            weight="duotone"
            aria-hidden
            className="mt-0.5 shrink-0 text-warning-fg"
          />
          <div>
            <h3 className="text-sm font-semibold">
              {traduzir("Não foi possível conferir as orientações instaladas", locale)}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {traduzir(
                "Abra Extensões para tentar novamente e ver o estado registrado no servidor.",
                locale,
              )}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {extensionGuides.flatMap((guide) =>
            guide.manifest.contributions.crm_cards.map((contribution) => {
              const Icon = EXTENSION_ICONS[contribution.icon];
              const compact = guide.configuration.density === "compact";
              return (
                <Link
                  key={`${guide.installation_id}:${contribution.id}`}
                  href={`/app/extensions/${encodeURIComponent(guide.installation_id)}?card=${encodeURIComponent(contribution.id)}`}
                  data-testid={`extension-contribution-${guide.installation_id}-${contribution.id}`}
                  className="block rounded-lg focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:outline-hidden"
                >
                  <Card
                    className={`flex h-full gap-3 transition-colors hover:border-border-strong ${compact ? "p-3" : "p-4"}`}
                  >
                    <Icon
                      size={20}
                      weight="duotone"
                      aria-hidden
                      className="mt-0.5 shrink-0 text-accent"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        {localize(guide.manifest.display.title, locale).text}
                      </p>
                      <h3 className="mt-0.5 text-sm font-semibold">
                        {localize(contribution.title, locale).text}
                      </h3>
                      {guide.configuration.show_description ? (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {localize(contribution.description, locale).text}
                        </p>
                      ) : null}
                      {localize(contribution.title, locale).fallback ||
                      (guide.configuration.show_description &&
                        localize(contribution.description, locale).fallback) ? (
                        <p className="mt-1 text-[11px] text-warning-fg">
                          {traduzir("Texto disponível em português.", locale)}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-text-subtle">
                        {portasLegiveis(
                          [permissaoDaCapacidade(contribution.action.capability)],
                          (texto) => traduzir(texto, locale),
                        )}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            }),
          )}
        </div>
      )}
    </section>
  );
}
