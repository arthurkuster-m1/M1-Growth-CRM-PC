import { createLeadHandler } from "@/app/api/v1/leads/_handler";
import { ApiError } from "@/lib/api/types";
import { phoneLookupVariants } from "@/lib/channels/phone-variants";
import type { ErroDaLinha, LinhaDeLead } from "@/lib/leads/planilha";
import { logger } from "@/lib/logger";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ResumoDaImportacao {
  total_linhas: number;
  criados: number;
  contatos_criados: number;
  erros: ErroDaLinha[];
  colunas_ignoradas: string[];
}

/** De onde vêm os leads: a campanha dona e o arquivo, gravados na origem de cada negócio. */
export interface OrigemDaImportacao {
  demandCampaignId: string;
  importacaoId: string;
  arquivo: string;
}

const semAcento = (x: string) =>
  x
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

/**
 * O laço da importação: contato + negócio por linha, com o desfecho POR LINHA (uma linha ruim não
 * derruba o lote). Era o corpo de `POST /api/v1/leads/import`; mora aqui para a importação feita
 * DENTRO de uma campanha usar a MESMA regra — duas cópias divergiriam no primeiro ajuste.
 *
 * Lança `ApiError` (404/422) quando a etapa/funil é recusada: aí o contato órfão criado nesta
 * chamada já foi devolvido ao banco.
 */
export async function importarLinhasDeLeads(
  supabase: Supabase,
  p: {
    orgId: string;
    userId: string;
    requestId: string;
    pipelineId: string;
    stageId: string;
    etapasAbertas: Array<{ id: string; name: string }>;
    lido: { leads: LinhaDeLead[]; erros: ErroDaLinha[]; colunasIgnoradas: string[] };
    t: (texto: string) => string;
    origem?: OrigemDaImportacao;
  },
): Promise<ResumoDaImportacao> {
  const { orgId, requestId, pipelineId, stageId, etapasAbertas, lido, t, origem } = p;
  const authz = { user: { id: p.userId } };
  const resumo: ResumoDaImportacao = {
    total_linhas: lido.leads.length + lido.erros.length,
    criados: 0,
    contatos_criados: 0,
    erros: [...lido.erros],
    colunas_ignoradas: lido.colunasIgnoradas,
  };

  // O mesmo telefone repetido na planilha vira UM contato, não N. Sem isto, uma
  // lista com três negócios do mesmo cliente criaria três contatos idênticos —
  // e o produto passaria a ter duplicata que ele mesmo fabricou.
  const contatoPorTelefone = new Map<string, string>();

  // Só os contatos que ESTA requisição criou, na ordem em que criou — é esta
  // lista que `desfazContatosCriados` devolve ao banco quando a importação cai
  // no meio (#2297, caminho 3). Os contatos que JÁ existiam não entram aqui:
  // apagá-los seria destruir dado de quem veio antes de nós.
  const contatosCriados: string[] = [];

  for (const linha of lido.leads) {
    try {
      let contactId: string | null = null;
      if (linha.telefone) {
        contactId = contatoPorTelefone.get(linha.telefone) ?? null;
        if (!contactId) {
          const { data: existente } = await supabase
            .from("contacts")
            .select("id")
            .eq("organization_id", orgId)
            .in("phone_number", phoneLookupVariants(linha.telefone))
            .limit(1)
            .maybeSingle();

          if (existente) {
            contactId = (existente as { id: string }).id;
          } else {
            const { data: criado, error: erroContato } = await supabase
              .from("contacts")
              .insert({
                organization_id: orgId,
                display_name: linha.nome_do_contato ?? linha.title,
                phone_number: linha.telefone,
                email: linha.email,
                source: linha.source,
              })
              .select("id")
              .single();
            if (erroContato) {
              // Contato que não entra NÃO derruba o negócio: o card entra sem
              // contato e a pessoa liga o telefone depois, corrigindo um card em
              // vez de reimportar a planilha inteira.
              resumo.erros.push({
                linha: linha.linha,
                motivo: t("o contato não pôde ser criado — o negócio entrou sem ele"),
              });
            } else {
              contactId = (criado as { id: string }).id;
              resumo.contatos_criados += 1;
              contatosCriados.push(contactId);
            }
          }
          if (contactId) contatoPorTelefone.set(linha.telefone, contactId);
        }
      }
      // Sem telefone, mas com e-mail: a pessoa é achada (ou criada) pelo e-mail.
      if (!contactId && !linha.telefone && linha.email) {
        const chave = `email:${linha.email.toLowerCase()}`;
        contactId = contatoPorTelefone.get(chave) ?? null;
        if (!contactId) {
          const { data: existente } = await supabase
            .from("contacts")
            .select("id")
            .eq("organization_id", orgId)
            .eq("email_normalized", linha.email.trim().toLowerCase())
            .is("is_merged_into", null)
            .limit(1)
            .maybeSingle();
          if (existente) {
            contactId = (existente as { id: string }).id;
          } else {
            const { data: criado, error: erroContato } = await supabase
              .from("contacts")
              .insert({
                organization_id: orgId,
                display_name: linha.nome_do_contato ?? linha.title,
                email: linha.email,
                source: linha.source,
              })
              .select("id")
              .single();
            if (erroContato) {
              resumo.erros.push({
                linha: linha.linha,
                motivo: t("o contato não pôde ser criado — o negócio entrou sem ele"),
              });
            } else {
              contactId = (criado as { id: string }).id;
              resumo.contatos_criados += 1;
              contatosCriados.push(contactId);
            }
          }
          if (contactId) contatoPorTelefone.set(chave, contactId);
        }
      }

      // A etapa da linha (coluna "Etapa", pelo nome); sem ela, ou se não existir, a padrão.
      let etapaDaLinha = stageId;
      if (linha.etapa) {
        const achada = etapasAbertas.find((e) => semAcento(e.name) === semAcento(linha.etapa!));
        if (achada) etapaDaLinha = achada.id;
        else {
          resumo.erros.push({
            linha: linha.linha,
            motivo: `${t("etapa")} "${linha.etapa}" ${t("não existe neste funil — entrou na etapa inicial")}`,
          });
        }
      }

      await createLeadHandler(
        supabase,
        { organization_id: orgId, actor: { type: "user", id: authz.user.id }, requestId },
        {
          pipeline_id: pipelineId,
          stage_id: etapaDaLinha,
          title: linha.title,
          description: linha.description,
          contact_id: contactId,
          value_cents: linha.value_cents,
          tags: linha.tags,
          source: linha.source,
          ...(linha.previsao ? { expected_close_date: linha.previsao } : {}),
          ...(Object.keys(linha.campos).length > 0 ? { custom_fields: linha.campos } : {}),
          via_planilha: true,
          ...(origem
            ? {
                demand_campaign_id: origem.demandCampaignId,
                source_metadata: {
                  importacao: { id: origem.importacaoId, arquivo: origem.arquivo },
                },
              }
            : {}),
        },
        // A mesma pessoa na planilha e no funil: junta as informações no negócio que já existe.
        { quandoJaExiste: "reaproveitar" },
      );
      resumo.criados += 1;
    } catch (err) {
      // A ETAPA ERRADA DERRUBA A IMPORTAÇÃO INTEIRA, e de propósito: se a etapa
      // não é desta organização, ela não será na linha 2 nem na 300. Seguir
      // gastaria 300 tentativas para dar o mesmo erro 300 vezes.
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        // O QUE JÁ TINHA SIDO FEITO NÃO PODE SOBRAR (#2297, caminho 3): o
        // contato da linha 1 é criado ANTES do `createLeadHandler` da linha 1 —
        // e a recusa da régua (422) morre a importação inteira logo em seguida.
        // Sem este desfazimento o cadastro ficava com um contato órfão que
        // ninguém pediu e que nenhum negócio aponta. Só os contatos DESTA
        // requisição, e só os que ficaram sem negócio: o de linha que já virou
        // card é do cliente e fica.
        await desfazContatosCriados(supabase, orgId, contatosCriados);
        throw err;
      }
      resumo.erros.push({
        linha: linha.linha,
        motivo: err instanceof Error ? err.message : t("linha recusada pelo banco"),
      });
    }
  }

  return resumo;
}

/**
 * Devolve ao banco os contatos que ESTA importação criou e que ficaram sem
 * negócio (#2297, caminho 3).
 *
 * A ordem da rota é a defeituosa: o contato nasce antes do `createLeadHandler`
 * da mesma linha, e um 404 (etapa de outra organização) ou um 422 (a régua de
 * campos obrigatórios) derruba a importação INTEIRA logo depois — a linha 1 já
 * tinha gravado o contato, e ele ficava órfão no cadastro.
 *
 * O corte é deliberado em DUAS pontas:
 *
 *   - só contatos DESTA requisição (a lista `contatosCriados`), nunca os que a
 *     busca por telefone já encontrava: apagar um contato pré-existente seria
 *     destruir dado do cliente para consertar o nosso erro;
 *   - só os que NENHUM negócio aponta (`crm_leads.contact_id`): uma linha que
 *     passou antes daquela que derrubou já nasceu com card, e o contato dela é
 *     dado de verdade.
 *
 * Nunca lança e nunca mascara o erro original: falhou, loga com os ids e a rota
 * devolve o 404/422 que a pessoa precisa ver. Um desfazimento que virasse 500
 * trocaria um resto rastreável por uma importação sem diagnóstico.
 */
async function desfazContatosCriados(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  try {
    const { data: usados, error: erroDaLeitura } = await supabase
      .from("crm_leads")
      .select("contact_id")
      .eq("organization_id", orgId)
      .in("contact_id", ids);
    if (erroDaLeitura) throw new Error(erroDaLeitura.message);

    const comNegocio = new Set(
      (usados ?? []).map((linha) => (linha as { contact_id: string | null }).contact_id),
    );
    const orfaos = ids.filter((id) => !comNegocio.has(id));
    if (orfaos.length === 0) return;

    const { error: erroDoDelete } = await supabase
      .from("contacts")
      .delete()
      .eq("organization_id", orgId)
      .in("id", orfaos);
    if (erroDoDelete) throw new Error(erroDoDelete.message);
  } catch (err) {
    logger.warn("[leads.import] não devolvi os contatos criados após a recusa", {
      organizationId: orgId,
      contatos: ids,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 200),
    });
  }
}
