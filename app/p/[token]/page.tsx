import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { EstiloDaMarcaDaOrganizacao } from "@/app/app/_components/EstiloDaMarcaDaOrganizacao";
import { CabecalhoPublico } from "@/components/marketing/CabecalhoPublico";
import { CartaoDeModulo, CartaoLargo, classeDaGaleria } from "@/components/marketing/Cartoes";
import { iconeDoModulo } from "@/components/marketing/icones";
import { nomeDaFase, textosDoModulo } from "@/components/marketing/textos";
import { traduzir } from "@/lib/i18n/dicionario";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { FASES_DA_ESTRATEGIA, moduloLargoDaFase, modulosDaFase } from "@/lib/marketing/modulos";
import {
  acessoPermitido,
  empresaDoLink,
  paginasPublicadas,
  resolverLink,
} from "@/lib/marketing/publico";

export const dynamic = "force-dynamic";

/**
 * O painel do LINK SEM LOGIN: as páginas publicadas da empresa, num visual de apresentação.
 * Somente leitura. Link inválido, revogado ou vencido responde 404 — igual a um que nunca existiu.
 */
export default async function PainelPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await acessoPermitido(ip))) notFound();

  const link = await resolverLink(token);
  if (!link) notFound();
  // Link de UMA página: vai direto para ela.
  if (link.moduloDoEscopo) redirect(`/p/${token}/${link.moduloDoEscopo}`);

  const [empresa, paginas] = await Promise.all([empresaDoLink(link), paginasPublicadas(link)]);
  const t = (texto: string) => traduzir(texto, empresa.idioma);
  const publicados = new Set(paginas.filter((p) => p.blocos.length > 0).map((p) => p.module_key));

  return (
    <IdiomaProvider locale={empresa.idioma}>
      <div data-marca-org="" className="contents">
        <EstiloDaMarcaDaOrganizacao css={empresa.cssDaMarca} />
        <div className="min-h-dvh bg-background">
          <CabecalhoPublico
            nome={empresa.nome}
            logoUrl={empresa.logoUrl}
            somenteLeitura={t("Somente leitura")}
            inicio={`/p/${token}`}
          />
          <main className="mx-auto flex max-w-[1200px] flex-col gap-8 p-4 sm:p-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Marketing")}</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {t("A estratégia do seu negócio, do diagnóstico aos resultados — num só lugar.")}
              </p>
            </div>

            {publicados.size === 0 ? (
              <p className="rounded-3xl border bg-card p-8 text-center text-sm text-muted-foreground">
                {t("Ainda não há nada publicado por aqui. Volte em breve.")}
              </p>
            ) : (
              FASES_DA_ESTRATEGIA.map((fase) => {
                const modulos = modulosDaFase(fase).filter((m) => publicados.has(m.chave));
                const largo = moduloLargoDaFase(fase);
                const largoPublicado = largo && publicados.has(largo.chave) ? largo : undefined;
                if (modulos.length === 0 && !largoPublicado) return null;
                return (
                  <section key={fase} className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold text-muted-foreground">
                      {nomeDaFase(t, fase)}
                    </h2>
                    <div className={classeDaGaleria(modulos.length)}>
                      {modulos.map((m) => {
                        const textos = textosDoModulo(t, m.chave);
                        if (!textos) return null;
                        return (
                          <CartaoDeModulo
                            key={m.chave}
                            href={`/p/${token}/${m.chave}`}
                            tom={m.tom}
                            icone={iconeDoModulo(m.icone)}
                            titulo={textos.titulo}
                            fase={nomeDaFase(t, fase)}
                            estado={t("Publicado")}
                          />
                        );
                      })}
                    </div>
                    {largoPublicado ? (
                      <CartaoLargo
                        href={`/p/${token}/${largoPublicado.chave}`}
                        tom={largoPublicado.tom}
                        icone={iconeDoModulo(largoPublicado.icone)}
                        titulo={textosDoModulo(t, largoPublicado.chave)?.titulo ?? ""}
                        descricao={textosDoModulo(t, largoPublicado.chave)?.descricao ?? ""}
                        abrir={t("Abrir")}
                      />
                    ) : null}
                  </section>
                );
              })
            )}
          </main>
        </div>
      </div>
    </IdiomaProvider>
  );
}
