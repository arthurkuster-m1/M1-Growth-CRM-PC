import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Capa } from "@/components/marketing/Capa";
import {
  CartaoDeArea,
  CartaoDeModulo,
  CartaoLargo,
  classeDaGaleria,
} from "@/components/marketing/Cartoes";
import { iconeDoModulo } from "@/components/marketing/icones";
import { nomeDaFase, textosDoModulo } from "@/components/marketing/textos";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { produtosCadastrados } from "@/lib/marketing/produtos-cadastrados";
import { modulosPublicados } from "@/lib/marketing/publicadas";
import { FASES_DA_ESTRATEGIA, modulosDaFase } from "@/lib/marketing/modulos";
import { CalendarBlank, ChartLineUp, Compass, Megaphone, Package, Rocket } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Marketing" };

/**
 * MARKETING — o painelzão: tudo o que a agência faz pela marca do cliente, num lugar só.
 *
 * É uma vitrine (conteúdo que a agência cria e o cliente acompanha), então não tem edição aqui:
 * cada cartão leva à página da área. Hoje as páginas estão em construção; o painel já mostra o
 * caminho inteiro — as cinco áreas e as três fases do método.
 */
export default async function MarketingPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const t = (texto: string) => traduzir(texto, user.idioma);
  const emBreve = t("Em breve");
  const publicados = await modulosPublicados(org.orgId);
  const totalDeProdutos = await produtosCadastrados(org.orgId);
  const abrir = t("Abrir");

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 p-4 sm:p-6">
      <Capa tom="purple" icone={<Rocket weight="duotone" aria-hidden />} className="rounded-3xl">
        <div className="relative z-10 flex flex-col gap-3 p-6 sm:p-10">
          <span className="text-xs font-semibold tracking-wider uppercase opacity-80">
            {org.name}
          </span>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{t("Marketing")}</h1>
          <p className="max-w-2xl text-sm opacity-90 sm:text-lg">
            {t("A estratégia do seu negócio, do diagnóstico aos resultados — num só lugar.")}
          </p>
        </div>
      </Capa>

      <section
        aria-label={t("Áreas de Marketing")}
        className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <CartaoDeArea
          href="/app/marketing/estrategia"
          tom="orange"
          icone={<Compass weight="duotone" aria-hidden />}
          titulo={t("Estratégia")}
          descricao={t(
            "Do diagnóstico à oferta: o mapa de tudo o que foi construído para a sua marca.",
          )}
          estado={publicados.size > 0 ? null : emBreve}
          abrir={abrir}
        />
        <CartaoDeArea
          href="/app/marketing/cronograma"
          tom="green"
          icone={<CalendarBlank weight="duotone" aria-hidden />}
          titulo={t("Cronograma")}
          descricao={t("As tarefas da semana: o que é da agência e o que é do cliente.")}
          estado={emBreve}
          abrir={abrir}
        />
        <CartaoDeArea
          href="/app/marketing/geracao-de-demanda"
          tom="blue"
          icone={<Megaphone weight="duotone" aria-hidden />}
          titulo={t("Geração de demanda")}
          descricao={t("Campanhas, criativos e textos que trazem clientes.")}
          estado={emBreve}
          abrir={abrir}
        />
        <CartaoDeArea
          href="/app/marketing/dashboards"
          tom="pink"
          icone={<ChartLineUp weight="duotone" aria-hidden />}
          titulo={t("Dashboards")}
          descricao={t("Tráfego, vendas e faturamento, em números.")}
          estado={emBreve}
          abrir={abrir}
        />
      </section>

      <section aria-labelledby="metodo" className="flex flex-col gap-6">
        <div>
          <h2 id="metodo" className="text-2xl font-bold tracking-tight">
            {t("O método, passo a passo")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("As etapas que a agência percorre com cada cliente.")}
          </p>
        </div>
        {FASES_DA_ESTRATEGIA.map((fase) => (
          <div key={fase} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground">{nomeDaFase(t, fase)}</h3>
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
                  "O cadastro de tudo o que a empresa oferece: produtos, preços e fotos.",
                )}
                destaque={
                  totalDeProdutos > 0
                    ? t("{n} produtos cadastrados").replace("{n}", String(totalDeProdutos))
                    : t("Nenhum produto cadastrado ainda")
                }
                abrir={t("Abrir o cadastro")}
              />
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
