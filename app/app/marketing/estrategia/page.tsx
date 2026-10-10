import type { Metadata } from "next";

import { CartaoDeModulo, classeDaGaleria } from "@/components/marketing/Cartoes";
import { iconeDoModulo } from "@/components/marketing/icones";
import { PublicacaoEmMassa } from "@/components/marketing/PublicacaoEmMassa";
import { Atalho, OQueVem, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { nomeDaFase, textosDoModulo } from "@/components/marketing/textos";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { modulosPublicados } from "@/lib/marketing/publicadas";
import { modulosDaFase } from "@/lib/marketing/modulos";
import { Compass } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estratégia" };

/** Estratégia: as duas primeiras fases do método (Diagnóstico e Produto e Oferta). */
export default async function EstrategiaPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const org = await resolveActiveOrg(user);
  const publicados = org ? await modulosPublicados(org.orgId) : new Set<string>();
  const emBreve = t("Em breve");

  return (
    <PaginaDeMarketing
      tom="orange"
      icone={<Compass weight="duotone" aria-hidden />}
      superior={t("Marketing")}
      titulo={t("Estratégia")}
      descricao={t(
        "O diagnóstico do negócio e a construção do produto e da oferta, etapa por etapa.",
      )}
      estado={publicados.size > 0 ? undefined : emBreve}
      voltar={{ href: "/app/marketing", rotulo: t("Marketing") }}
    >
      <PublicacaoEmMassa />

      <section aria-label={t("Atalhos da estratégia")} className="grid gap-3 sm:grid-cols-3">
        <Atalho
          href="/app/marketing/estrategia/estudo-de-persona"
          titulo={t("Público-alvo")}
          descricao={t("Estudo de persona")}
        />
        <Atalho
          href="/app/marketing/estrategia/posicionamento-zmot"
          titulo={t("Mapa de Posicionamento")}
          descricao={t("Acompanhamento")}
        />
        <Atalho
          href="/app/marketing/estrategia/analise-de-concorrencia"
          titulo={t("Análise da concorrência")}
          descricao={t("Quem disputa a atenção do seu cliente")}
        />
      </section>

      {(["diagnostico", "produto-e-oferta"] as const).map((fase) => (
        <section key={fase} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{nomeDaFase(t, fase)}</h2>
          <div className={classeDaGaleria(modulosDaFase(fase).length)}>
            {modulosDaFase(fase).map((modulo) => {
              const textos = textosDoModulo(t, modulo.chave);
              if (!textos) return null;
              return (
                <CartaoDeModulo
                  key={modulo.chave}
                  href={`/app/marketing/estrategia/${modulo.chave}`}
                  tom={modulo.tom}
                  icone={iconeDoModulo(modulo.icone)}
                  titulo={textos.titulo}
                  fase={nomeDaFase(t, fase)}
                  estado={publicados.has(modulo.chave) ? null : emBreve}
                />
              );
            })}
          </div>
        </section>
      ))}

      <OQueVem
        titulo={t("O que vem aqui")}
        itens={[
          t(
            "Cada etapa vira uma página de apresentação, bonita, com os resultados do seu negócio.",
          ),
          t("Você vê em tela cheia, slide a slide, ou rolando a página como num site."),
          t("A agência cria e atualiza; você acompanha tudo por aqui."),
        ]}
      />
    </PaginaDeMarketing>
  );
}
