/**
 * GERAR E MEDIR AS IDEIAS (server-only): lê os números das campanhas, roda o motor de regras
 * (`ideias.ts`), grava as ideias novas respeitando o teto e a janela, e mede de novo as que foram
 * aceitas e chegaram na data. Quem chama passa o client e a org JÁ validados (sessão com
 * `requireRole`, ou o cron com service role): toda leitura e escrita filtra `organization_id`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { somarDias } from "@/lib/inicio/datas";
import { coorteDaCampanha, diaNoFusoDaEmpresa } from "@/lib/marketing/crm-por-dia";
import type { CampanhaDoFunil } from "@/lib/marketing/atribuicao";

import { coletarSinais, dados } from "./coletar-sinais";
import { diagnosticar } from "./diagnostico";
import { lerGuardado } from "./guardado";
import {
  LIMIARES,
  avaliarRegras,
  chaveDaIdeia,
  compararFotos,
  escolherNovas,
  fotoDaCampanha,
  type CampanhaParaIdeias,
  type FotoDaCampanha,
} from "./ideias";
import { perfilParaDiagnostico } from "./perfil";

type Cliente = SupabaseClient;

const FUSO_PADRAO = "America/Sao_Paulo";

interface LinhaDeDia {
  campaign_id: string;
  day: string;
  leads: number;
  spend: number;
  impressions: number;
  reach: number;
  link_clicks: number;
}

/** Os números de cada campanha (últimos 7 e 14 dias, vendas, funil de 30 dias) para o motor e a medição. */
export async function coletarCampanhasParaIdeias(
  supabase: Cliente,
  orgId: string,
  agora: Date,
): Promise<{ campanhas: CampanhaParaIdeias[]; hoje: string }> {
  const org = await supabase.from("organizations").select("timezone").eq("id", orgId).maybeSingle();
  const fuso = (org.data?.timezone as string | null) || FUSO_PADRAO;
  const hoje = diaNoFusoDaEmpresa(agora.toISOString(), fuso);

  const cs = dados<
    {
      id: string;
      name: string;
      status: string;
      end_date: string | null;
      goal_cpl: number | null;
      pipeline_id: string | null;
    }[]
  >(
    await supabase
      .from("demand_campaigns")
      .select("id,name,status,end_date,goal_cpl,pipeline_id")
      .eq("organization_id", orgId)
      .limit(300),
  );
  if (cs.length === 0) return { campanhas: [], hoje };
  const ids = cs.map((c) => c.id);

  const dias = dados<LinhaDeDia[]>(
    await supabase
      .from("demand_campaign_days")
      .select("campaign_id,day,leads,spend,impressions,reach,link_clicks")
      .eq("organization_id", orgId)
      .in("campaign_id", ids)
      .gte("day", somarDias(hoje, -13))
      .limit(20000),
  );
  const vendas14 = dados<{ demand_campaign_id: string }[]>(
    await supabase
      .from("crm_sales")
      .select("demand_campaign_id")
      .eq("organization_id", orgId)
      .in("demand_campaign_id", ids)
      .in("status", ["comprometida", "concluida"])
      .gte("created_at", new Date(agora.getTime() - 14 * 86_400_000).toISOString())
      .limit(20000),
  );
  const comAprendizado = new Set(
    dados<{ campanha_id: string | null }[]>(
      await supabase
        .from("guia_aprendizados")
        .select("campanha_id")
        .eq("organization_id", orgId)
        .limit(2000),
    )
      .map((a) => a.campanha_id)
      .filter((x): x is string => !!x),
  );
  const doFunil: CampanhaDoFunil[] = cs.map((c) => ({ id: c.id, pipeline_id: c.pipeline_id }));

  const inicioDaSemana = somarDias(hoje, -6);
  const resultado: CampanhaParaIdeias[] = [];
  for (const c of cs) {
    const meus = dias.filter((d) => d.campaign_id === c.id);
    const semana = meus.filter((d) => d.day >= inicioDaSemana);
    const soma = (xs: LinhaDeDia[], k: keyof Omit<LinhaDeDia, "campaign_id" | "day">) =>
      xs.reduce((a, d) => a + Number(d[k] ?? 0), 0);

    // O funil de 30 dias custa uma leitura de leads: só para campanha ativa.
    let coorte30: CampanhaParaIdeias["coorte30"] = null;
    if (c.status === "ativa") {
      try {
        const f = await coorteDaCampanha(supabase, orgId, c.id, c.pipeline_id, doFunil, fuso, {
          de: somarDias(hoje, -29),
          ate: hoje,
        });
        coorte30 = { leads: f.leads, agendados: f.agendados, feitas: f.feitas, vendas: f.vendas };
      } catch {
        coorte30 = null; // sem o funil, só as regras que não dependem dele valem
      }
    }

    const diasDesdeOFim =
      c.status === "encerrada" && c.end_date
        ? Math.floor(
            (Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${c.end_date}T12:00:00Z`)) / 86_400_000,
          )
        : null;
    resultado.push({
      id: c.id,
      nome: c.name,
      status: c.status,
      fim: c.end_date,
      metaCpl: c.goal_cpl === null ? null : Number(c.goal_cpl),
      semana: {
        gasto: soma(semana, "spend"),
        leads: soma(semana, "leads"),
        impressoes: soma(semana, "impressions"),
        alcance: soma(semana, "reach"),
        cliques: soma(semana, "link_clicks"),
      },
      gasto14: soma(meus, "spend"),
      vendas14: vendas14.filter((v) => v.demand_campaign_id === c.id).length,
      coorte30,
      diasDesdeOFim,
      temAprendizado: comAprendizado.has(c.id),
    });
  }
  return { campanhas: resultado, hoje };
}

export interface ResultadoDaGeracao {
  criadas: number;
  medidas: number;
  /** Sem perfil o Guia não sabe o que é essencial: não gera nada. */
  semPerfil: boolean;
}

export async function gerarEMedirIdeias(
  supabase: Cliente,
  orgId: string,
  agora: Date = new Date(),
): Promise<ResultadoDaGeracao> {
  const guardado = await lerGuardado(supabase, orgId);
  if (!guardado.perfil) return { criadas: 0, medidas: 0, semPerfil: true };

  const [sinais, { campanhas, hoje }] = await Promise.all([
    coletarSinais(supabase, orgId),
    coletarCampanhasParaIdeias(supabase, orgId, agora),
  ]);
  const diagnostico = diagnosticar({
    perfil: perfilParaDiagnostico(guardado.perfil),
    sinais,
    manuais: guardado.manuais,
    tarefas: guardado.tarefas,
    agora,
  });

  // ── 1. ideias novas ──────────────────────────────────────────────────────────────────────
  const existentes = dados<{ regra: string; alvo_id: string; janela: string; status: string }[]>(
    await supabase
      .from("guia_ideias")
      .select("regra,alvo_id,janela,status")
      .eq("organization_id", orgId)
      .limit(5000),
  );
  const jaExistem = new Set(
    existentes.map((x) => chaveDaIdeia({ regra: x.regra, alvoId: x.alvo_id, janela: x.janela })),
  );
  const abertas = existentes.filter((x) => x.status === "nova" || x.status === "aceita").length;
  const novas = escolherNovas(avaliarRegras({ campanhas, diagnostico, agora }), jaExistem, abertas);
  if (novas.length > 0) {
    const { error } = await supabase.from("guia_ideias").upsert(
      novas.map((n) => ({
        organization_id: orgId,
        regra: n.regra,
        origem: "regra",
        alvo_tipo: n.alvoTipo,
        alvo_id: n.alvoId,
        janela: n.janela,
        titulo: n.titulo,
        evidencia: n.evidencia,
        passo_relacionado: n.passoRelacionado,
        acao_href: n.acaoHref,
        prioridade: n.prioridade,
      })),
      { onConflict: "organization_id,regra,alvo_id,janela", ignoreDuplicates: true },
    );
    if (error) throw error;
  }

  // ── 2. medir de novo o que foi aceito e chegou na data ───────────────────────────────────
  const paraMedir = dados<
    { id: string; regra: string; alvo_id: string; linha_de_base: FotoDaCampanha | null }[]
  >(
    await supabase
      .from("guia_ideias")
      .select("id,regra,alvo_id,linha_de_base")
      .eq("organization_id", orgId)
      .eq("status", "aceita")
      .eq("alvo_tipo", "campanha")
      .lte("medir_em", hoje)
      .limit(200),
  );
  let medidas = 0;
  for (const ideia of paraMedir) {
    const campanha = campanhas.find((c) => c.id === ideia.alvo_id);
    if (!campanha || !ideia.linha_de_base) continue;
    const depois = fotoDaCampanha(campanha);
    const comparacao = compararFotos(ideia.regra, ideia.linha_de_base, depois);
    const { error } = await supabase
      .from("guia_ideias")
      .update({
        status: "medida",
        resultado: {
          depois,
          linhas: comparacao.linhas,
          sugestao: comparacao.sugestao,
          medidoEm: hoje,
        },
        updated_at: agora.toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("id", ideia.id)
      .eq("status", "aceita");
    if (!error) medidas += 1;
  }
  return { criadas: novas.length, medidas, semPerfil: false };
}

/** A foto atual de uma campanha, para guardar como linha de base ao aceitar a ideia. */
export async function fotoAtualDaCampanha(
  supabase: Cliente,
  orgId: string,
  campanhaId: string,
  agora: Date = new Date(),
): Promise<FotoDaCampanha | null> {
  const { campanhas } = await coletarCampanhasParaIdeias(supabase, orgId, agora);
  const c = campanhas.find((x) => x.id === campanhaId);
  return c ? fotoDaCampanha(c) : null;
}

export const DIAS_PARA_MEDIR = LIMIARES.diasParaMedir;
