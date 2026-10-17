import type { Metadata } from "next";

import { CartaoDeModulo, CartaoLargo, classeDaGaleria } from "@/components/marketing/Cartoes";
import { EstrategiasDeMarketing } from "@/components/marketing/EstrategiasDeMarketing";
import { iconeDoModulo } from "@/components/marketing/icones";
import { PublicacaoEmMassa } from "@/components/marketing/PublicacaoEmMassa";
import { AtalhoEmDestaque, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { nomeDaFase, textosDoModulo } from "@/components/marketing/textos";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { produtosCadastrados } from "@/lib/marketing/produtos-cadastrados";
import { modulosPublicados } from "@/lib/marketing/publicadas";
import { modulosDaFase } from "@/lib/marketing/modulos";
import { Binoculars, Compass, MapTrifold, Package, UsersThree } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estratégia" };

/** Estratégia: as três fases do método (Diagnóstico, Mercado e Oferta e Geração de Demanda). */
export default async function EstrategiaPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const org = await resolveActiveOrg(user);
  const publicados = org ? await modulosPublicados(org.orgId) : new Set<string>();
  const totalDeProdutos = org ? await produtosCadastrados(org.orgId) : 0;
  const emBreve = t("Em breve");

  return (
    <PaginaDeMarketing
      tom="orange"
      icone={<Compass weight="duotone" aria-hidden />}
      superior={t("Marketing")}
      titulo={t("Estratégia")}
      descricao={t(
        "O diagnóstico do negócio, a construção do produto e da oferta e a geração de demanda, etapa por etapa.",
      )}
      estado={publicados.size > 0 ? undefined : emBreve}
      voltar={{ href: "/app/marketing", rotulo: t("Marketing") }}
    >
      <PublicacaoEmMassa />

      <section aria-label={t("Atalhos da estratégia")} className="grid gap-3 sm:grid-cols-3">
        <AtalhoEmDestaque
          href="/app/marketing/estrategia/estudo-de-persona"
          titulo={t("Público-alvo")}
          descricao={t("Estudo de persona")}
          icone={<UsersThree weight="duotone" aria-hidden />}
          tom="orange"
        />
        <AtalhoEmDestaque
          href="/app/marketing/estrategia/posicionamento-zmot"
          titulo={t("Mapa de Posicionamento")}
          descricao={t("Acompanhamento")}
          icone={<MapTrifold weight="duotone" aria-hidden />}
          tom="blue"
        />
        <AtalhoEmDestaque
          href="/app/marketing/estrategia/analise-de-concorrencia"
          titulo={t("Análise da concorrência")}
          descricao={t("Quem disputa a atenção do seu cliente")}
          icone={<Binoculars weight="duotone" aria-hidden />}
          tom="purple"
        />
      </section>

      {(["diagnostico", "produto-e-oferta", "geracao-de-demanda"] as const).map((fase) =>
        fase === "geracao-de-demanda" ? (
          // Sem páginas fixas: cada estratégia é criada sob medida, no botão "Nova estratégia".
          <EstrategiasDeMarketing
            key={fase}
            titulo={nomeDaFase(t, fase)}
            fase={nomeDaFase(t, fase)}
          />
        ) : (
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
            {fase === "produto-e-oferta" ? (
              <CartaoLargo
                href="/app/marketing/estrategia/produtos-e-ofertas"
                tom="purple"
                icone={<Package weight="duotone" aria-hidden />}
                titulo={t("Produtos e ofertas")}
                descricao={t(
                  "A central de tudo o que a empresa vende: da ficha simples à oferta completa.",
                )}
                destaque={
                  totalDeProdutos > 0
                    ? t("{n} ofertas publicadas").replace("{n}", String(totalDeProdutos))
                    : t("Nenhuma oferta publicada ainda")
                }
                abrir={t("Abrir o cadastro")}
              />
            ) : null}
          </section>
        ),
      )}
    </PaginaDeMarketing>
  );
}
