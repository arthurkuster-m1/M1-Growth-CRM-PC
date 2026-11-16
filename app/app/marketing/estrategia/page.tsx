import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CartaoDeModulo, CartaoLargo, classeDaGaleria } from "@/components/marketing/Cartoes";
import { EstrategiasDeMarketing } from "@/components/marketing/EstrategiasDeMarketing";
import {
  AdicionarPagina,
  type ItemOculto,
} from "@/components/marketing/estrategia/AdicionarPagina";
import { MenuDeOcultar } from "@/components/marketing/estrategia/MenuDeOcultar";
import { iconeDoModulo } from "@/components/marketing/icones";
import { PublicacaoEmMassa } from "@/components/marketing/PublicacaoEmMassa";
import { AtalhoEmDestaque, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { nomeDaFase, textosDoModulo } from "@/components/marketing/textos";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { roleAtLeast } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import {
  ATALHOS_DA_ESTRATEGIA,
  OcultosDaEstrategia,
  chaveDaFase,
  chaveDoAtalho,
  type AtalhoDaEstrategia,
} from "@/lib/marketing/estrategia-oculta";
import { FASES_DA_ESTRATEGIA, modulosDaFase } from "@/lib/marketing/modulos";
import { ocultasDaEstrategia } from "@/lib/marketing/ocultas-da-estrategia";
import { produtosCadastrados } from "@/lib/marketing/produtos-cadastrados";
import { modulosPublicados } from "@/lib/marketing/publicadas";
import { Binoculars, Compass, MapTrifold, Package, UsersThree } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estratégia" };

/**
 * Estratégia: as três fases do método (Diagnóstico, Mercado e Oferta e Geração de Demanda).
 *
 * A agência pode ocultar (ou apagar o conteúdo de) fases, páginas e atalhos que não fazem sentido
 * para este cliente, e trazê-los de volta no botão "Adicionar página". A única coisa que fica
 * sempre é "Produtos e ofertas": é por ela que o CRM vende.
 */
export default async function EstrategiaPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const org = await resolveActiveOrg(user);
  const publicados = org ? await modulosPublicados(org.orgId) : new Set<string>();
  const totalDeProdutos = org ? await produtosCadastrados(org.orgId) : 0;
  const ocultos = org ? await ocultasDaEstrategia(org.orgId) : new OcultosDaEstrategia(new Set());
  // Quem gerencia vê os menus de ocultar/apagar; o cliente só vê o que sobrou.
  const podeGerir = !!org && roleAtLeast(org.role, "manager") && !user.support;
  const emBreve = t("Em breve");

  const ATALHOS: Record<
    AtalhoDaEstrategia,
    {
      href: string;
      titulo: string;
      descricao: string;
      icone: ReactNode;
      tom: "orange" | "blue" | "purple";
    }
  > = {
    "estudo-de-persona": {
      href: "/app/marketing/estrategia/estudo-de-persona",
      titulo: t("Público-alvo"),
      descricao: t("Estudo de persona"),
      icone: <UsersThree weight="duotone" aria-hidden />,
      tom: "orange",
    },
    "posicionamento-zmot": {
      href: "/app/marketing/estrategia/posicionamento-zmot",
      titulo: t("Mapa de Posicionamento"),
      descricao: t("Acompanhamento"),
      icone: <MapTrifold weight="duotone" aria-hidden />,
      tom: "blue",
    },
    "analise-de-concorrencia": {
      href: "/app/marketing/estrategia/analise-de-concorrencia",
      titulo: t("Análise da concorrência"),
      descricao: t("Quem disputa a atenção do seu cliente"),
      icone: <Binoculars weight="duotone" aria-hidden />,
      tom: "purple",
    },
  };
  const atalhosVisiveis = ATALHOS_DA_ESTRATEGIA.filter((a) => !ocultos.atalho(a));

  // O que está oculto, para o botão "Adicionar página" trazer de volta.
  const itensOcultos: ItemOculto[] = [
    ...FASES_DA_ESTRATEGIA.filter((f) => ocultos.fase(f)).map((f) => ({
      chave: chaveDaFase(f),
      rotulo: nomeDaFase(t, f),
      tipo: "fase" as const,
    })),
    ...FASES_DA_ESTRATEGIA.flatMap((f) =>
      modulosDaFase(f)
        .filter((m) => ocultos.pagina(m.chave))
        .map((m) => ({
          chave: m.chave,
          rotulo: textosDoModulo(t, m.chave)?.titulo ?? m.chave,
          tipo: "pagina" as const,
        })),
    ),
    ...ATALHOS_DA_ESTRATEGIA.filter((a) => ocultos.atalho(a)).map((a) => ({
      chave: chaveDoAtalho(a),
      rotulo: ATALHOS[a].titulo,
      tipo: "atalho" as const,
    })),
  ];

  // Se nenhuma página de módulo sobrou à vista, a publicação em massa não tem o que publicar.
  const haModulosVisiveis = FASES_DA_ESTRATEGIA.some(
    (f) =>
      f !== "geracao-de-demanda" &&
      !ocultos.fase(f) &&
      modulosDaFase(f).some((m) => !ocultos.pagina(m.chave)),
  );

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
    >
      {haModulosVisiveis ? <PublicacaoEmMassa /> : null}

      {atalhosVisiveis.length > 0 ? (
        <section aria-label={t("Atalhos da estratégia")} className="grid gap-3 sm:grid-cols-3">
          {atalhosVisiveis.map((a) => (
            <div key={a} className="group/ctl relative">
              <AtalhoEmDestaque
                href={ATALHOS[a].href}
                titulo={ATALHOS[a].titulo}
                descricao={ATALHOS[a].descricao}
                icone={ATALHOS[a].icone}
                tom={ATALHOS[a].tom}
              />
              {podeGerir ? (
                <MenuDeOcultar
                  chave={chaveDoAtalho(a)}
                  rotulo={ATALHOS[a].titulo}
                  tipo="atalho"
                  podeApagar={false}
                  flutuante
                />
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {FASES_DA_ESTRATEGIA.map((fase) => {
        const nomeFase = nomeDaFase(t, fase);
        const menuDaFase = podeGerir ? (
          <MenuDeOcultar chave={chaveDaFase(fase)} rotulo={nomeFase} tipo="fase" podeApagar />
        ) : null;

        if (fase === "geracao-de-demanda") {
          if (ocultos.fase(fase)) return null;
          // Sem páginas fixas: cada estratégia é criada sob medida, no botão "Nova estratégia".
          return (
            <EstrategiasDeMarketing
              key={fase}
              titulo={nomeFase}
              fase={nomeFase}
              extra={menuDaFase}
            />
          );
        }

        const faseOculta = ocultos.fase(fase);
        const modulos = faseOculta
          ? []
          : modulosDaFase(fase).filter((m) => !ocultos.pagina(m.chave));
        // Fase oculta: some o título e a galeria; o bloco de Produtos (essencial) continua.
        if (faseOculta && fase !== "produto-e-oferta") return null;

        return (
          <section key={fase} className="flex flex-col gap-3">
            {!faseOculta ? (
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground">{nomeFase}</h2>
                {menuDaFase}
              </div>
            ) : null}
            {modulos.length > 0 ? (
              <div className={classeDaGaleria(modulos.length)}>
                {modulos.map((modulo) => {
                  const textos = textosDoModulo(t, modulo.chave);
                  if (!textos) return null;
                  return (
                    <div key={modulo.chave} className="group/ctl relative">
                      <CartaoDeModulo
                        href={`/app/marketing/estrategia/${modulo.chave}`}
                        tom={modulo.tom}
                        icone={iconeDoModulo(modulo.icone)}
                        titulo={textos.titulo}
                        fase={nomeFase}
                        estado={publicados.has(modulo.chave) ? null : emBreve}
                      />
                      {podeGerir ? (
                        <MenuDeOcultar
                          chave={modulo.chave}
                          rotulo={textos.titulo}
                          tipo="pagina"
                          podeApagar
                          flutuante
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {fase === "produto-e-oferta" ? (
              <>
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
                {podeGerir ? <AdicionarPagina itens={itensOcultos} /> : null}
              </>
            ) : null}
          </section>
        );
      })}
    </PaginaDeMarketing>
  );
}
