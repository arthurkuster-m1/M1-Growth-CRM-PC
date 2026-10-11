import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { EstiloDaMarcaDaOrganizacao } from "@/app/app/_components/EstiloDaMarcaDaOrganizacao";
import { CabecalhoPublico } from "@/components/marketing/CabecalhoPublico";
import { CronogramaPublico } from "@/components/marketing/cronograma/CronogramaPublico";
import { rotulosDoCronograma } from "@/components/marketing/cronograma/rotulos";
import { NavegacaoPublica } from "@/components/marketing/NavegacaoPublica";
import { somarDias } from "@/lib/inicio/datas";
import { tagDeIdioma } from "@/lib/i18n/datas";
import { traduzir } from "@/lib/i18n/dicionario";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { CHAVE_DO_CRONOGRAMA } from "@/lib/marketing/links";
import { domingoDe, domingoDeHoje, numeroDaSemana } from "@/lib/marketing/cronograma";
import {
  acessoPermitido,
  cronogramaPublico,
  empresaDoLink,
  resolverLink,
} from "@/lib/marketing/publico";

export const dynamic = "force-dynamic";

/** O cronograma pelo LINK SEM LOGIN: metas, caminho e tarefas da semana, só leitura. */
export default async function CronogramaPublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ semana?: string }>;
}) {
  const { token } = await params;
  const { semana } = await searchParams;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await acessoPermitido(ip))) notFound();

  const link = await resolverLink(token);
  if (!link) notFound();
  // Só o link do painel inteiro ou o do próprio cronograma abrem esta página.
  if (link.moduloDoEscopo && link.moduloDoEscopo !== CHAVE_DO_CRONOGRAMA) notFound();

  const domingo =
    semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? domingoDe(semana) : domingoDeHoje();
  const [empresa, dados] = await Promise.all([
    empresaDoLink(link),
    cronogramaPublico(link, domingo),
  ]);
  const t = (texto: string) => traduzir(texto, empresa.idioma);
  const base = `/p/${token}/cronograma`;
  const hoje = domingoDeHoje();

  return (
    <IdiomaProvider locale={empresa.idioma}>
      <div data-marca-org="" className="contents">
        <EstiloDaMarcaDaOrganizacao css={empresa.cssDaMarca} />
        <div className="min-h-dvh bg-background">
          <CabecalhoPublico
            nome={empresa.nome}
            logoUrl={empresa.logoUrl}
            somenteLeitura={t("Somente leitura")}
            inicio={link.moduloDoEscopo ? base : `/p/${token}`}
          />
          <main className="mx-auto flex max-w-[1100px] flex-col gap-4 p-4 sm:p-6">
            <NavegacaoPublica
              rotulo={t("Navegação")}
              voltar={
                link.moduloDoEscopo
                  ? undefined
                  : { href: `/p/${token}`, rotulo: t("Todas as páginas") }
              }
              trilha={[
                ...(link.moduloDoEscopo ? [] : [{ rotulo: t("Marketing"), href: `/p/${token}` }]),
                { rotulo: t("Cronograma") },
              ]}
            />
            <CronogramaPublico
              config={dados.config}
              itens={dados.itens}
              metas={dados.metas}
              tarefas={dados.tarefas}
              inicioDaSemana={domingo}
              semanaDeHoje={numeroDaSemana(dados.config, domingoDeHoje())}
              tag={tagDeIdioma(empresa.idioma)}
              rotulos={rotulosDoCronograma(t)}
              textos={{
                geral: t("Cronograma geral"),
                semana: t("Tarefas da semana"),
                baixar: t("Baixar imagem"),
                gerando: t("Gerando…"),
                anterior: t("Semana anterior"),
                proxima: t("Próxima semana"),
                estaSemana: t("Esta semana"),
                aparencia: t("Aparência da imagem"),
                claro: t("Claro"),
                escuro: t("Escuro"),
              }}
              hrefAnterior={`${base}?semana=${somarDias(domingo, -7)}`}
              hrefProxima={`${base}?semana=${somarDias(domingo, 7)}`}
              hrefHoje={domingo !== hoje ? `${base}?semana=${hoje}` : null}
            />
          </main>
        </div>
      </div>
    </IdiomaProvider>
  );
}
