import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { iconeDoModulo } from "@/components/marketing/icones";
import { PaginaDoModulo } from "@/components/marketing/PaginaDoModulo";
import { nomeDaFase, textosDoModulo, textosDoTipoDeSubpagina } from "@/components/marketing/textos";
import { requireAuth } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { lerChaveDePagina, moduloPorChave } from "@/lib/marketing/modulos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estratégia" };

/** Uma SUBPÁGINA de um módulo (ex.: uma persona). Mesma página, com título próprio. */
export default async function SubpaginaDaEstrategiaPage({
  params,
}: {
  params: Promise<{ modulo: string; sub: string }>;
}) {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const { modulo: chaveDoModulo, sub } = await params;
  const lida = lerChaveDePagina(sub);
  const modulo = moduloPorChave(chaveDoModulo);
  if (!lida?.tipo || !modulo || lida.modulo !== chaveDoModulo) notFound();
  const textosDoTipo = textosDoTipoDeSubpagina(t, lida.tipo);
  const textosDoPai = textosDoModulo(t, modulo.chave);
  if (!textosDoTipo || !textosDoPai) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-4 sm:p-6">
      <PaginaDoModulo
        chave={sub}
        titulo={textosDoTipo.titulo}
        descricao={textosDoTipo.descricao}
        superior={textosDoPai.titulo}
        tom={modulo.tom}
        icone={iconeDoModulo(modulo.icone, 64)}
        rotulos={{ antes: t("Antes"), depois: t("Depois"), abrirLink: t("Abrir link") }}
        subpagina={{
          tipo: `${nomeDaFase(t, modulo.fase)} · ${textosDoTipo.titulo}`,
          voltar: {
            href: `/app/marketing/estrategia/${modulo.chave}`,
            rotulo: textosDoPai.titulo,
          },
        }}
        textosDeEspera={{
          titulo: t("O que vem aqui"),
          itens: [textosDoTipo.descricao],
        }}
      />
    </div>
  );
}
