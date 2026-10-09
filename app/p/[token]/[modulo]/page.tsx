import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { EstiloDaMarcaDaOrganizacao } from "@/app/app/_components/EstiloDaMarcaDaOrganizacao";
import { ApresentarPublico } from "@/components/marketing/ApresentarPublico";
import { BlocosRender } from "@/components/marketing/BlocosRender";
import { CabecalhoPublico } from "@/components/marketing/CabecalhoPublico";
import { Capa } from "@/components/marketing/Capa";
import { iconeDoModulo } from "@/components/marketing/icones";
import { nomeDaFase, textosDoModulo } from "@/components/marketing/textos";
import { traduzir } from "@/lib/i18n/dicionario";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { moduloPorChave } from "@/lib/marketing/modulos";
import {
  acessoPermitido,
  empresaDoLink,
  paginasPublicadas,
  resolverLink,
} from "@/lib/marketing/publico";

export const dynamic = "force-dynamic";

/** Uma página publicada, aberta pelo link sem login. Somente leitura. */
export default async function PaginaPublicaPage({
  params,
}: {
  params: Promise<{ token: string; modulo: string }>;
}) {
  const { token, modulo: chave } = await params;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await acessoPermitido(ip))) notFound();

  const link = await resolverLink(token);
  const modulo = moduloPorChave(chave);
  if (!link || !modulo) notFound();
  // Link de uma página só abre aquela página.
  if (link.moduloDoEscopo && link.moduloDoEscopo !== chave) notFound();

  const [empresa, paginas] = await Promise.all([empresaDoLink(link), paginasPublicadas(link)]);
  const pagina = paginas.find((p) => p.module_key === chave);
  if (!pagina || pagina.blocos.length === 0) notFound();

  const t = (texto: string) => traduzir(texto, empresa.idioma);
  const textos = textosDoModulo(t, chave);
  if (!textos) notFound();
  const rotulos = { antes: t("Antes"), depois: t("Depois"), abrirLink: t("Abrir link") };
  const icone = iconeDoModulo(modulo.icone, 64);

  return (
    <IdiomaProvider locale={empresa.idioma}>
      <div data-marca-org="" className="contents">
        <EstiloDaMarcaDaOrganizacao css={empresa.cssDaMarca} />
        <div className="min-h-dvh bg-background">
          <CabecalhoPublico
            nome={empresa.nome}
            logoUrl={empresa.logoUrl}
            somenteLeitura={t("Somente leitura")}
            voltar={
              link.moduloDoEscopo
                ? undefined
                : { href: `/p/${token}`, rotulo: t("Todas as páginas") }
            }
          />
          <main className="mx-auto flex max-w-[1200px] flex-col gap-6 p-4 sm:p-6">
            <Capa tom={modulo.tom} icone={icone} className="rounded-3xl">
              <div className="relative z-10 flex flex-col gap-3 p-6 sm:p-9">
                <span className="text-xs font-semibold tracking-wider uppercase opacity-80">
                  {nomeDaFase(t, modulo.fase)}
                </span>
                <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{textos.titulo}</h1>
                <p className="max-w-2xl text-sm opacity-90 sm:text-base">{textos.descricao}</p>
              </div>
            </Capa>
            <div className="flex justify-end">
              <ApresentarPublico
                titulo={textos.titulo}
                descricao={textos.descricao}
                superior={nomeDaFase(t, modulo.fase)}
                tom={modulo.tom}
                icone={icone}
                blocos={pagina.blocos}
                rotulos={rotulos}
              />
            </div>
            <article className="rounded-3xl border bg-card p-6 shadow-sm sm:p-10">
              <BlocosRender blocos={pagina.blocos} rotulos={rotulos} />
            </article>
          </main>
        </div>
      </div>
    </IdiomaProvider>
  );
}
