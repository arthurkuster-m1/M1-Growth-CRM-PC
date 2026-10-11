import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { iconeDoModulo } from "@/components/marketing/icones";
import { PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { SubpaginasDoModulo } from "@/components/marketing/SubpaginasDoModulo";
import { PaginaDoModulo } from "@/components/marketing/PaginaDoModulo";
import { nomeDaFase, textosDoModulo } from "@/components/marketing/textos";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { modulosPublicados } from "@/lib/marketing/publicadas";
import { moduloPorChave } from "@/lib/marketing/modulos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estratégia" };

/** A página de UM módulo da estratégia: o cliente lê o publicado; a agência edita, publica e apresenta. */
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
  const org = await resolveActiveOrg(user);
  const publicado = org ? (await modulosPublicados(org.orgId)).has(modulo.chave) : false;

  return (
    <PaginaDeMarketing
      tom={modulo.tom}
      icone={iconeDoModulo(modulo.icone, 64)}
      superior={nomeDaFase(t, modulo.fase)}
      titulo={textos.titulo}
      descricao={textos.descricao}
      estado={publicado ? undefined : t("Em breve")}
      voltar={{ href: "/app/marketing/estrategia", rotulo: t("Estratégia") }}
    >
      <PaginaDoModulo
        chave={modulo.chave}
        titulo={textos.titulo}
        descricao={textos.descricao}
        superior={nomeDaFase(t, modulo.fase)}
        tom={modulo.tom}
        icone={iconeDoModulo(modulo.icone, 64)}
        rotulos={{ antes: t("Antes"), depois: t("Depois"), abrirLink: t("Abrir link") }}
      />
      <SubpaginasDoModulo
        modulo={modulo.chave}
        base={`/app/marketing/estrategia/${modulo.chave}`}
      />
    </PaginaDeMarketing>
  );
}
