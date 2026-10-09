import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { iconeDoModulo } from "@/components/marketing/icones";
import { OQueVem, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { nomeDaFase, textosDoModulo } from "@/components/marketing/textos";
import { requireAuth } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { moduloPorChave } from "@/lib/marketing/modulos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estratégia" };

/** A página de UM módulo da estratégia. Em construção: o motor de páginas vem na Fase 1. */
export default async function ModuloDaEstrategiaPage({
  params,
}: {
  params: Promise<{ modulo: string }>;
}) {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const modulo = moduloPorChave((await params).modulo);
  const textos = modulo ? textosDoModulo(t, modulo.chave) : null;
  if (!modulo || !textos) notFound();

  return (
    <PaginaDeMarketing
      tom={modulo.tom}
      icone={iconeDoModulo(modulo.icone, 64)}
      superior={nomeDaFase(t, modulo.fase)}
      titulo={textos.titulo}
      descricao={textos.descricao}
      estado={t("Em breve")}
      voltar={{ href: "/app/marketing/estrategia", rotulo: t("Estratégia") }}
    >
      <OQueVem
        titulo={t("O que vem aqui")}
        itens={[
          t("Uma página de apresentação, bonita, com os resultados desta etapa."),
          t("Você vê em tela cheia, slide a slide, ou rolando a página como num site."),
          t("A agência cria e atualiza; você acompanha tudo por aqui."),
        ]}
      />
    </PaginaDeMarketing>
  );
}
