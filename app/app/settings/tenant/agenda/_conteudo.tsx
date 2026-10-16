import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { clientePelaAgendaLigado, colegasPodemMexerNaAgendaLigado } from "@/lib/schemas/settings";
import { nomesDosAtendentes } from "@/lib/users/nome-do-atendente";

import { TiposDeAgendamentoClient, type TipoRow } from "./_client";

/**
 * O miolo da configuração dos tipos de agendamento (tipos, lembretes, prazos, dias bloqueados e
 * agendas do Google). Usado na página de Configurações e no fim da própria Agenda.
 */
export async function ConteudoDaConfiguracaoDaAgenda({
  user,
  activeOrg,
}: {
  user: { id: string; is_platform_admin?: boolean; support?: unknown };
  activeOrg: { orgId: string; role: keyof typeof ROLE_RANK };
}) {
  const podeEditar = (user.is_platform_admin && !user.support) || ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;

  const supabase = await createClient();
  // ⚠️ O `error` NÃO é descartável, e descartá-lo já mentiu para quem opera.
  //
  // Medido em 2026-09-16: esta consulta pedia `reminder_extra_offsets_minutes`,
  // coluna que o banco daquela instalação não tinha (migration 0254 nunca
  // aplicada). O PostgREST recusava a consulta INTEIRA, `data` vinha `null`, e
  // a tela dizia "Nenhum tipo de agendamento ainda" — com QUATRO tipos ativos
  // no banco, um deles o "Retirada de pedido" que a API recusava recriar por
  // duplicidade. Erro de leitura virou afirmação sobre os dados, e as duas
  // telas passaram a discordar sem que nenhuma estivesse "quebrada" aos olhos
  // de quem olhava.
  //
  // Lista vazia e falha de leitura são fatos diferentes, e a tela tem de
  // dizer qual dos dois aconteceu.
  const [{ data: tipos, error: erroTipos }, { data: pessoas }, { data: org }] = await Promise.all([
    supabase
      .from("calendar_event_types")
      .select(
        "id, name, slug, description, category, duration_minutes, location_kind, location_details, default_owner_user_id, requires_confirmation, is_active, reminder_enabled, reminder_minutes_before, reminder_extra_offsets_minutes, reminder_body, reminder_bodies, default_price_cents",
      )
      .eq("organization_id", activeOrg.orgId)
      .order("is_active", { ascending: false })
      .order("name"),
    supabase
      .from("user_organizations")
      .select("user_id, role")
      .eq("organization_id", activeOrg.orgId)
      .is("revoked_at", null),
    // A regra "Clientes pela agenda" mora em `organizations.settings.crm`. LER
    // pela sessão funciona (a policy de leitura é de membro); gravar é só pela
    // RPC, que a action chama.
    supabase.from("organizations").select("settings").eq("id", activeOrg.orgId).maybeSingle(),
  ]);

  // O NOME DE GENTE, e não o fragmento de UUID.
  //
  // O seletor de "quem atende" oferecia `0c4f9a1e · admin` — a página lia só
  // `user_id, role` e nunca resolvia nome. Escolher responsável entre pedaços de
  // identificador não é escolha: é adivinhação, e o dono do produto tinha de
  // acertar qual dos fragmentos era ele.
  //
  // `nomesDosAtendentes` expõe SÓ `full_name`, de propósito. Não trocar por
  // `/api/v1/team`, que devolve e-mail e último acesso — PII a mais numa tela de
  // configuração que não precisa dela.
  //
  // Numa VPS sem `SUPABASE_SERVICE_ROLE_KEY` ele devolve Map vazio por decisão
  // declarada, e o fallback abaixo volta ao rótulo de hoje. Degrada, não some.
  const nomes = await nomesDosAtendentes((pessoas ?? []).map((p) => String(p.user_id)));

  return (
    <TiposDeAgendamentoClient
        tiposIniciais={(tipos ?? []) as TipoRow[]}
        erroDeLeitura={erroTipos ? erroTipos.message : null}
        pessoas={(pessoas ?? []).map((p) => ({
          id: String(p.user_id),
          papel: String(p.role),
          nome:
            nomes.get(String(p.user_id)) ?? `${String(p.user_id).slice(0, 8)} · ${String(p.role)}`,
        }))}
        usuarioAtualId={user.id}
        podeConfigurarGoogle={ROLE_RANK[activeOrg.role] >= ROLE_RANK.agent}
        podeEditar={podeEditar}
        clientePelaAgendaLigado={clientePelaAgendaLigado(org?.settings)}
        // A OPÇÃO DA AGENDA (migration 0343, issue #978): LIGADA por padrão, e a
        // régua de "ligado" é a ausência da chave — quem já instalou está no
        // padrão sem ter nada gravado. Mesma leitura do banco.
        colegasPodemMexerNaAgendaLigado={colegasPodemMexerNaAgendaLigado(org?.settings)}
        // `manager` aqui, e não o `admin` de clientes: esta é regra da AGENDA, a
        // mesma tela dos prazos, e não reescreve dado nenhum. A RPC cobra de novo.
        podeMudarAgendaDosColegas={ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager}
        // `admin`, e não `manager` como os prazos ao lado: ligar reescreve as
        // etiquetas de todo contato com histórico. A RPC cobra de novo.
        podeLigarClientePelaAgenda={ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin}
      />
  );
}
