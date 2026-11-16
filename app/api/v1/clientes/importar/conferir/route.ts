/**
 * POST /api/v1/clientes/importar/conferir — a SIMULAÇÃO da importação de leads: lê as mesmas
 * células que /importar receberia e diz, linha a linha, o que vai acontecer (contato novo ou
 * atualizado, funil e etapa onde entra, landing page que será cadastrada, data de entrada) ou
 * o que está errado. Não grava nada. Atendente em diante.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { phoneLookupVariants } from "@/lib/channels/phone-variants";
import { CSV_MAX_DATA_ROWS } from "@/lib/contacts/csv";
import { traduzir } from "@/lib/i18n/dicionario";
import {
  type ConferenciaDaImportacao,
  type SituacaoDaLinha,
} from "@/lib/leads/conferencia-da-importacao";
import { entradaPorExtenso } from "@/lib/leads/data-do-lead";
import { planejarOrigem, semAcento, type CatalogoDeOrigem } from "@/lib/leads/origem-da-importacao";
import { lerLinhasDeClientes } from "@/lib/leads/planilha-de-clientes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  celulas: z
    .array(z.array(z.string().max(4000)).max(80))
    .min(1)
    .max(CSV_MAX_DATA_ROWS + 1),
  pipeline_id: z.string().uuid().nullable().optional(),
  stage_id: z.string().uuid().nullable().optional(),
});

type Contato = { id: string; phone_number: string | null; email_normalized: string | null };

const em = <T>(lista: T[], n: number): T[][] => {
  const partes: T[][] = [];
  for (let i = 0; i < lista.length; i += n) partes.push(lista.slice(i, i + n));
  return partes;
};

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const orgId = authz.org.orgId;

  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  // Sem linhas de dados ainda: nada a conferir (a tela mostra a tabela vazia).
  if (corpo.data.celulas.length < 2) {
    return ok({ linhas: [] } satisfies ConferenciaDaImportacao, { requestId });
  }

  const lido = lerLinhasDeClientes(corpo.data.celulas, t);
  if ("erro" in lido) return fail("validation_failed", lido.erro, 422, { requestId });

  const supabase = await createClient();

  const [
    { data: funisRows },
    { data: etapasRows },
    { data: campanhasRows },
    { data: criativosRows },
    { data: paginasRows },
  ] = await Promise.all([
    supabase
      .from("crm_pipelines")
      .select("id, name")
      .eq("organization_id", orgId)
      .eq("is_archived", false),
    supabase
      .from("crm_stages")
      .select("id, pipeline_id, name, is_won, is_lost")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
    supabase.from("demand_campaigns").select("id, name").eq("organization_id", orgId).limit(500),
    supabase
      .from("demand_campaign_creatives")
      .select("id, name, campaign_id")
      .eq("organization_id", orgId)
      .limit(3000),
    supabase
      .from("demand_campaign_landing_pages")
      .select("id, name, url, campaign_id")
      .eq("organization_id", orgId)
      .limit(2000),
  ]);
  const funis = (funisRows ?? []) as Array<{ id: string; name: string }>;
  const etapas = (etapasRows ?? []) as Array<{
    id: string;
    pipeline_id: string;
    name: string;
    is_won: boolean;
    is_lost: boolean;
  }>;
  const catalogo: CatalogoDeOrigem = {
    campanhas: (campanhasRows ?? []) as CatalogoDeOrigem["campanhas"],
    criativos: (criativosRows ?? []) as CatalogoDeOrigem["criativos"],
    paginas: (paginasRows ?? []) as CatalogoDeOrigem["paginas"],
  };
  const funilPadrao = corpo.data.pipeline_id ?? null;
  const abertas = (funilId: string) =>
    etapas.filter((e) => e.pipeline_id === funilId && !e.is_won && !e.is_lost);

  // Quem já existe no CRM (telefone nas duas grafias do nono dígito, ou e-mail).
  const telefones = [
    ...new Set(lido.linhas.flatMap((l) => (l.telefone ? phoneLookupVariants(l.telefone) : []))),
  ];
  const emails = [
    ...new Set(lido.linhas.flatMap((l) => (l.email ? [l.email.trim().toLowerCase()] : []))),
  ];
  const contatos: Contato[] = [];
  for (const parte of em(telefones, 150)) {
    const { data } = await supabase
      .from("contacts")
      .select("id, phone_number, email_normalized")
      .eq("organization_id", orgId)
      .in("phone_number", parte)
      .is("is_merged_into", null);
    contatos.push(...((data ?? []) as Contato[]));
  }
  for (const parte of em(emails, 150)) {
    const { data } = await supabase
      .from("contacts")
      .select("id, phone_number, email_normalized")
      .eq("organization_id", orgId)
      .in("email_normalized", parte)
      .is("is_merged_into", null);
    contatos.push(...((data ?? []) as Contato[]));
  }
  const porTelefone = new Map<string, Contato>();
  const porEmail = new Map<string, Contato>();
  for (const c of contatos) {
    if (c.phone_number) porTelefone.set(c.phone_number, c);
    if (c.email_normalized) porEmail.set(c.email_normalized, c);
  }

  // Negócios abertos desses contatos (o importador reaproveita o aberto do mesmo funil).
  const abertosPorContato = new Set<string>();
  const idsDeContatos = [...new Set(contatos.map((c) => c.id))];
  for (const parte of em(idsDeContatos, 150)) {
    const { data } = await supabase
      .from("crm_leads")
      .select("contact_id, pipeline_id")
      .eq("organization_id", orgId)
      .eq("status", "open")
      .in("contact_id", parte);
    for (const r of (data ?? []) as Array<{ contact_id: string; pipeline_id: string }>) {
      abertosPorContato.add(`${r.contact_id}|${r.pipeline_id}`);
    }
  }

  // O parser pula a linha com problema (erro) e, para link ruim, deixa a linha entrar com aviso.
  const entram = new Set(lido.linhas.map((l) => l.linha));
  const final: SituacaoDaLinha[] = [];
  const avisosDaLinha = new Map<number, string[]>();
  for (const e of lido.erros) {
    if (e.linha < 2) continue;
    if (entram.has(e.linha)) {
      avisosDaLinha.set(e.linha, [...(avisosDaLinha.get(e.linha) ?? []), e.motivo]);
    } else {
      final.push({ linha: e.linha, tom: "erro", texto: e.motivo });
    }
  }

  const vistos = new Map<string, number>();
  for (const l of lido.linhas) {
    const partes: string[] = [];
    const avisos: string[] = [...(avisosDaLinha.get(l.linha) ?? [])];
    let tom: SituacaoDaLinha["tom"] = "ok";

    const chave = l.telefone ?? `email:${(l.email ?? "").toLowerCase()}`;
    const anterior = vistos.get(chave);
    const existente =
      (l.telefone
        ? phoneLookupVariants(l.telefone)
            .map((v) => porTelefone.get(v))
            .find(Boolean)
        : undefined) ?? (l.email ? porEmail.get(l.email.trim().toLowerCase()) : undefined);

    if (anterior) {
      partes.push(
        `${t("mesma pessoa da linha")} ${anterior - 1}: ${t("será unificada, sem duplicar")}`,
      );
      tom = "info";
    } else {
      vistos.set(chave, l.linha);
      partes.push(
        existente
          ? t("Já existe no CRM (mesmo telefone ou e-mail): será atualizado, sem apagar nada")
          : t("Contato novo: será criado"),
      );
      if (existente) tom = "info";
    }

    // Funil e etapa onde entra.
    let funilId: string | null = null;
    let nomeDoFunil: string | null = null;
    if (l.funil) {
      const f = funis.find((x) => semAcento(x.name) === semAcento(l.funil!));
      if (f) {
        funilId = f.id;
        nomeDoFunil = f.name;
      } else {
        avisos.push(
          `${t("funil")} "${l.funil}" ${t("não existe — o lead fica guardado sem funil")}`,
        );
      }
    } else if (funilPadrao) {
      const f = funis.find((x) => x.id === funilPadrao);
      funilId = f?.id ?? null;
      nomeDoFunil = f?.name ?? null;
    }
    let destino: string | null = null;
    if (!funilId) {
      partes.push(t("fica só guardado nos contatos, sem funil e sem venda"));
    } else {
      const lista = abertas(funilId);
      let etapa = l.etapa
        ? lista.find((e) => semAcento(e.name) === semAcento(l.etapa!))
        : undefined;
      if (l.etapa && !etapa) {
        avisos.push(
          `${t("etapa")} "${l.etapa}" ${t("não existe neste funil — entra na etapa inicial")}`,
        );
      }
      if (!etapa && corpo.data.stage_id) {
        etapa = lista.find((e) => e.id === corpo.data.stage_id);
      }
      etapa = etapa ?? lista[0];
      if (!etapa) {
        final.push({ linha: l.linha, tom: "erro", texto: t("o funil não tem etapa aberta") });
        continue;
      }
      destino = `${nomeDoFunil} › ${etapa.name}`;
      partes.push(
        existente && abertosPorContato.has(`${existente.id}|${funilId}`)
          ? `${t("já tem negócio aberto no funil")} «${nomeDoFunil}»: ${t("será reaproveitado, sem duplicar")}`
          : `${t("entra no funil")} «${nomeDoFunil}», ${t("etapa")} «${etapa.name}»`,
      );
    }
    // Origem: a landing page que não existe é cadastrada.
    const plano = planejarOrigem(l, catalogo);
    if (plano.paginaNova) {
      partes.push(
        `${t("LP")} «${plano.paginaNova.nome}» ${t("ainda não existe: será cadastrada na campanha")} «${plano.campanhaDaLp}»` +
          (plano.campanhaNova ? ` (${t("campanha nova")})` : ""),
      );
    } else if (plano.paginaId) {
      partes.push(`${t("LP")} «${l.landing_page}» ${t("já cadastrada: o lead será ligado a ela")}`);
    }

    if (l.entrada_data) {
      partes.push(`${t("entrada em")} ${entradaPorExtenso(l.entrada_data, l.entrada_hora)}`);
    }

    if (avisos.length > 0) tom = "aviso";
    final.push({
      linha: l.linha,
      tom,
      texto: [...partes, ...avisos].join(" · "),
      contato: anterior ? undefined : existente ? "existente" : "novo",
      destino,
      lpNova: plano.paginaNova?.nome ?? null,
      campanhaNova: plano.campanhaNova,
    });
  }

  final.sort((a, b) => a.linha - b.linha);
  return ok({ linhas: final } satisfies ConferenciaDaImportacao, { requestId });
}
