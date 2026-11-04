import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { GET as agendaAnalises } from "@/app/api/v1/agenda/analises/route";
import { GET as dashAtendimento } from "@/app/api/v1/dashboards/atendimento/route";
import { GET as dashBusiness } from "@/app/api/v1/dashboards/business/route";
import { GET as dashProspeccao } from "@/app/api/v1/dashboards/prospeccao/route";
import { GET as dashCustos } from "@/app/api/v1/dashboards/prospeccao/custos/route";
import { GET as dashTrafego } from "@/app/api/v1/dashboards/trafego/route";
import { GET as dashVisibilidade } from "@/app/api/v1/dashboards/visibilidade/route";
import { GET as relAtividades } from "@/app/api/v1/reports/activities/route";
import { GET as relEtiquetas } from "@/app/api/v1/reports/tags/route";
import { GET as teamAssignable } from "@/app/api/v1/team/assignable/route";
import {
  CHAVE_DOS_DASHBOARDS,
  emPainelPublico,
  ROTAS_PUBLICAS,
} from "@/lib/dashboards/painel-publico";
import { acessoPermitido, empresaDoLink, resolverLink } from "@/lib/marketing/publico";

export const dynamic = "force-dynamic";

/**
 * OS DADOS DO DASHBOARD PELO LINK SEM LOGIN — somente leitura.
 *
 * `GET /p/<token>/dados/<rota>` roda o MESMO handler de leitura da rota normal (`/api/v1/<rota>`),
 * então os números, os filtros e as abas são exatamente os do painel logado. A segurança mora aqui:
 *   1. token com a forma certa, dentro do limite de acessos por minuto;
 *   2. link vigente (não revogado, não vencido) e DESTE escopo (`dashboards`) — o link do painel
 *      de Marketing não abre dados financeiros;
 *   3. só as rotas de `ROTAS_PUBLICAS`, só GET; qualquer outra responde 404.
 * A empresa vem do link, nunca da requisição.
 */
type Handler = (req: NextRequest) => Promise<Response>;

const HANDLERS: Record<(typeof ROTAS_PUBLICAS)[number], Handler> = {
  "dashboards/trafego": dashTrafego,
  "dashboards/prospeccao": dashProspeccao,
  "dashboards/prospeccao/custos": dashCustos,
  "dashboards/business": dashBusiness,
  "dashboards/atendimento": dashAtendimento,
  "dashboards/visibilidade": () => dashVisibilidade(),
  "agenda/analises": agendaAnalises,
  "team/assignable": teamAssignable,
  "reports/activities": relAtividades,
  "reports/tags": relEtiquetas,
};

const nao = () =>
  NextResponse.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; caminho: string[] }> },
): Promise<Response> {
  const { token, caminho } = await params;
  const rota = caminho.join("/");
  if (!(ROTAS_PUBLICAS as readonly string[]).includes(rota)) return nao();

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await acessoPermitido(ip))) return nao();

  const link = await resolverLink(token);
  if (!link || link.moduloDoEscopo !== CHAVE_DOS_DASHBOARDS) return nao();

  const empresa = await empresaDoLink(link);
  const resposta = await emPainelPublico(
    { orgId: link.organizationId, nome: empresa.nome, idioma: empresa.idioma },
    () => HANDLERS[rota as keyof typeof HANDLERS](req),
  );
  const seguro = new Response(resposta.body, resposta);
  seguro.headers.set("Cache-Control", "private, no-store");
  return seguro;
}
