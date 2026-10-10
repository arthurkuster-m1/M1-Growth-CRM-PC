import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { EstiloDaMarcaDaOrganizacao } from "@/app/app/_components/EstiloDaMarcaDaOrganizacao";
import { HistoricoPublico } from "@/components/marketing/HistoricoPublico";
import { ApresentarPublico } from "@/components/marketing/ApresentarPublico";
import { BlocosRender } from "@/components/marketing/BlocosRender";
import { CabecalhoPublico } from "@/components/marketing/CabecalhoPublico";
import { NavegacaoPublica, type PassoDaTrilha } from "@/components/marketing/NavegacaoPublica";
import { Capa } from "@/components/marketing/Capa";
import { iconeDoModulo } from "@/components/marketing/icones";
import { nomeDaFase, textosDoModulo, textosDoTipoDeSubpagina } from "@/components/marketing/textos";
import { traduzir } from "@/lib/i18n/dicionario";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { baseDasImagensDoLink } from "@/lib/marketing/imagens";
import { ArrowRight } from "@/lib/ui/icons";
import { lerChaveDePagina, moduloPorChave } from "@/lib/marketing/modulos";
import {
  acessoPermitido,
  empresaDoLink,
  paginasPublicadas,
  resolverLink,
  retratosDaPagina,
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
  const lida = lerChaveDePagina(chave);
  const modulo = lida ? moduloPorChave(lida.modulo) : undefined;
  if (!link || !lida || !modulo) notFound();
  // Link de um módulo abre o módulo e as subpáginas dele, e nada além.
  if (link.moduloDoEscopo && link.moduloDoEscopo !== lida.modulo) notFound();

  const [empresa, paginas] = await Promise.all([empresaDoLink(link), paginasPublicadas(link)]);
  const pagina = paginas.find((p) => p.module_key === chave);
  if (!pagina || pagina.blocos.length === 0) notFound();
  const retratos = await retratosDaPagina(link, chave);

  const t = (texto: string) => traduzir(texto, empresa.idioma);
  const textosDoPai = textosDoModulo(t, lida.modulo);
  const textosDoTipo = lida.tipo ? textosDoTipoDeSubpagina(t, lida.tipo) : null;
  if (!textosDoPai || (lida.tipo && !textosDoTipo)) notFound();
  const textos =
    lida.tipo && textosDoTipo
      ? { titulo: pagina.title || textosDoTipo.titulo, descricao: textosDoTipo.descricao }
      : textosDoPai;
  // As subpáginas publicadas deste módulo (só na página do módulo).
  const filhas = lida.tipo
    ? []
    : paginas.filter((p) => p.module_key.startsWith(`${chave}--`) && p.blocos.length > 0);
  const rotulos = {
    antes: t("Antes"),
    depois: t("Depois"),
    abrirLink: t("Abrir link"),
    baseDasImagens: baseDasImagensDoLink(token),
  };
  const icone = iconeDoModulo(modulo.icone, 64);

  // Para onde a marca e o "Voltar" levam, e a trilha de onde a pessoa está. Link de um módulo só
  // alcança o módulo e as subpáginas dele; o painel (Marketing) só existe no link do painel.
  const moduloHref = `/p/${token}/${lida.modulo}`;
  const painelHref = link.moduloDoEscopo ? null : `/p/${token}`;
  const inicio = painelHref ?? moduloHref;
  const voltar = lida.tipo
    ? { href: moduloHref, rotulo: textosDoPai.titulo }
    : painelHref
      ? { href: painelHref, rotulo: t("Todas as páginas") }
      : undefined;
  const trilha: PassoDaTrilha[] = [
    ...(painelHref ? [{ rotulo: t("Marketing"), href: painelHref }] : []),
    lida.tipo ? { rotulo: textosDoPai.titulo, href: moduloHref } : { rotulo: textosDoPai.titulo },
    ...(lida.tipo ? [{ rotulo: textos.titulo }] : []),
  ];

  return (
    <IdiomaProvider locale={empresa.idioma}>
      <div data-marca-org="" className="contents">
        <EstiloDaMarcaDaOrganizacao css={empresa.cssDaMarca} />
        <div className="min-h-dvh bg-background">
          <CabecalhoPublico
            nome={empresa.nome}
            logoUrl={empresa.logoUrl}
            somenteLeitura={t("Somente leitura")}
            inicio={inicio}
          />
          <main className="mx-auto flex max-w-[1200px] flex-col gap-6 p-4 sm:p-6">
            <NavegacaoPublica voltar={voltar} trilha={trilha} rotulo={t("Navegação")} />
            <Capa tom={modulo.tom} icone={icone} className="rounded-3xl">
              <div className="relative z-10 flex flex-col gap-3 p-6 sm:p-9">
                <span className="text-xs font-semibold tracking-wider uppercase opacity-80">
                  {lida.tipo ? textosDoPai.titulo : nomeDaFase(t, modulo.fase)}
                </span>
                <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{textos.titulo}</h1>
                <p className="max-w-2xl text-sm opacity-90 sm:text-base">{textos.descricao}</p>
              </div>
            </Capa>
            <div className="flex flex-wrap justify-end gap-2">
              <HistoricoPublico versoes={retratos} atual={pagina.blocos} rotulos={rotulos} />
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
            {filhas.length > 0 ? (
              <section aria-label={t("Subpáginas")} className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold tracking-tight">{t("Aprofundamento")}</h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filhas.map((f) => {
                    const tipo = lerChaveDePagina(f.module_key)?.tipo;
                    const base = tipo ? textosDoTipoDeSubpagina(t, tipo) : null;
                    return (
                      <li key={f.module_key}>
                        <Link
                          href={`/p/${token}/${f.module_key}`}
                          className="group flex h-full flex-col gap-1 rounded-2xl border-[1.5px] border-primary bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/5 hover:shadow-md"
                        >
                          <h3 className="font-semibold">{f.title || base?.titulo}</h3>
                          <p className="text-xs text-muted-foreground">{base?.descricao}</p>
                          <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary">
                            {t("Abrir")}
                            <ArrowRight
                              size={14}
                              weight="bold"
                              className="transition-transform group-hover:translate-x-1"
                              aria-hidden
                            />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </main>
        </div>
      </div>
    </IdiomaProvider>
  );
}
