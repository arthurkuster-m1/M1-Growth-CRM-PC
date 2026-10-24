"use client";

import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { LeadFieldsForm } from "@/components/kanban/LeadFieldsForm";
import { QualificacaoDoLead } from "@/components/leads/QualificacaoDoLead";
import { SecaoDaFicha } from "@/components/leads/SecaoDaFicha";
import { FormularioDeLinks, PessoasRelacionadas } from "@/components/kanban/ContatoDoNegocio";
import { LeadTimeline } from "@/components/kanban/LeadTimeline";
import { useLeadTimeline } from "@/hooks/leads/useLeadTimeline";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { VendasDoCliente } from "@/components/vendas/VendasDoCliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useContact } from "@/hooks/contacts/useContact";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { Plus, Trash } from "@/lib/ui/icons";
import type { CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import type { Lead } from "@/lib/types/leads";

export interface DadosDoLead {
  lead_id: string;
  sistema: {
    criado_em: string;
    atualizado_em: string;
    entrou_na_etapa_em: string | null;
    ultima_atividade_em: string | null;
    atribuido_em: string | null;
    fechado_em: string | null;
    motivo_da_perda: string | null;
    responsavel: string | null;
    dono_id?: string | null;
    responsavel_tipo: string | null;
    id_externo: string | null;
  };
  rastreamento: Record<string, unknown>;
  contact_id: string | null;
  source: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  campaign_id: string | null;
  creative_id: string | null;
  landing_page_id: string | null;
  /** O conjunto de anúncios e o posicionamento da origem do card (texto). */
  conjunto?: string | null;
  posicionamento?: string | null;
  negocio: {
    id: string;
    title: string;
    description: string | null;
    value_cents: number | null;
    currency: string | null;
    expected_close_date: string | null;
    status: string;
    pipeline_id: string;
    funil_nome: string | null;
    etapa_nome: string | null;
    etapa_id?: string | null;
    etapas?: Array<{
      id: string;
      nome: string;
      ganho: boolean;
      perdido: boolean;
      position?: number | null;
    }>;
    field_defs: CustomFieldDef[];
  };
  campanhas: Array<{
    id: string;
    nome: string;
    criativos: Array<{ id: string; nome: string }>;
    landing_pages: Array<{ id: string; nome: string }>;
  }>;
}

export const chaveDaFicha = (leadId: string) => ["ficha-do-lead", leadId] as const;

const classeDoSelect =
  "h-9 w-full rounded-lg border bg-card px-2 text-sm disabled:opacity-60";

/** Telefone digitado solto vira E.164: 10–11 dígitos são do Brasil. */
export function telefoneE164(bruto: string): string {
  const digitos = bruto.replace(/\D/g, "");
  if (!digitos) return "";
  if (bruto.trim().startsWith("+")) return `+${digitos}`;
  return digitos.length <= 11 ? `+55${digitos}` : `+${digitos}`;
}

const rotuloDaChave = (k: string) =>
  k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/**
 * A FICHA ÚNICA DO LEAD. É a mesma em qualquer lugar do produto (dossiê do CRM, painel do
 * Inbox, ficha do contato): quem a abre só diz QUAL lead. Cada tópico é um toggle.
 */
export function FichaDoLead({
  leadId,
  linhaDoTempo,
}: {
  leadId: string;
  /** Quem já tem a linha do tempo ao vivo (o dossiê) passa; os demais deixam a ficha buscar. */
  linhaDoTempo?: LinhaDoTempo;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const consulta = useQuery({
    queryKey: chaveDaFicha(leadId),
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: DadosDoLead }>(`/api/v1/leads/${leadId}/origem`)).data,
  });
  const d = consulta.data;
  if (consulta.isLoading) {
    return <div className="h-24 animate-pulse rounded-lg bg-secondary" aria-busy="true" />;
  }
  if (consulta.isError || !d || !d.negocio || !d.campanhas) {
    return <p className="text-xs text-text-muted">{t("Não consegui carregar a ficha do lead.")}</p>;
  }
  const dia = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(tag, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const rastros = Object.entries(d.rastreamento).filter(
    ([, v]) => v !== null && v !== "" && typeof v !== "object",
  );
  const nomeDaCampanha = d.campanhas.find((c) => c.id === d.campaign_id)?.nome;
  const camposSoltos = Object.entries(d.custom_fields).filter(
    ([k, v]) =>
      !d.negocio.field_defs.some((f) => f.key === k) &&
      v !== null &&
      v !== "" &&
      typeof v !== "object",
  );

  return (
    <div data-testid="ficha-do-lead">
      <SecaoDaFicha
        id="contato"
        titulo={t("Contato")}
        resumo={
          d.negocio.funil_nome
            ? `${d.negocio.funil_nome} · ${d.negocio.etapa_nome ?? ""}`
            : undefined
        }
      >
        {d.contact_id ? (
          <ContatoEditavel
            contactId={d.contact_id}
            leadId={leadId}
            pipelineId={d.negocio.pipeline_id}
          />
        ) : (
          <p className="text-xs text-text-muted">{t("Este lead não tem contato vinculado.")}</p>
        )}
      </SecaoDaFicha>

      <SecaoDaFicha
        id="origem"
        titulo={t("Origem")}
        resumo={nomeDaCampanha ?? d.source ?? undefined}
      >
        <OrigemEditavel leadId={leadId} dados={d} />
      </SecaoDaFicha>

      <SecaoDaFicha
        id="negocio"
        titulo={t("Dados no funil")}
        resumo={(d.tags ?? []).length > 0 ? d.tags.join(", ") : undefined}
      >
        <LeadFieldsForm
          lead={
            {
              id: d.negocio.id,
              title: d.negocio.title,
              description: d.negocio.description,
              value_cents: d.negocio.value_cents,
              currency: d.negocio.currency,
              expected_close_date: d.negocio.expected_close_date,
              status: d.negocio.status,
              pipeline_id: d.negocio.pipeline_id,
              contact_id: d.contact_id,
              tags: d.tags,
              custom_fields: d.custom_fields,
            } as unknown as Lead
          }
          pipelineId={d.negocio.pipeline_id}
          fieldDefs={d.negocio.field_defs}
          onSaved={() => void consulta.refetch()}
        />
      </SecaoDaFicha>

      <SecaoDaFicha
        id="campos"
        titulo={t("Respostas e campos do formulário")}
        resumo={camposSoltos.length > 0 ? String(camposSoltos.length) : undefined}
      >
        <CamposSoltos leadId={leadId} campos={camposSoltos} />
      </SecaoDaFicha>

      <SecaoDaFicha
        id="rastreamento"
        titulo={t("Rastreamento (anúncio, UTM, página)")}
        padraoAberta={false}
        resumo={rastros.length > 0 ? String(rastros.length) : undefined}
      >
        {rastros.length === 0 ? (
          <p className="text-xs text-text-muted">{t("Sem dados de rastreamento neste lead.")}</p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
            {rastros.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-text-muted">{rotuloDaChave(k)}</dt>
                <dd className="font-medium break-words">{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </SecaoDaFicha>

      <SecaoDaFicha id="sistema" titulo={t("Atendimento e datas")} padraoAberta={false}>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
          {[
            [
              t("Responsável"),
              d.sistema.responsavel ??
                (d.sistema.responsavel_tipo === "agent" ? t("Agente de IA") : "—"),
            ],
            [t("Entrou em"), dia(d.sistema.criado_em)],
            [t("Entrou na etapa em"), dia(d.sistema.entrou_na_etapa_em)],
            [t("Última atividade"), dia(d.sistema.ultima_atividade_em)],
            [t("Atribuído em"), dia(d.sistema.atribuido_em)],
            [t("Atualizado em"), dia(d.sistema.atualizado_em)],
            [t("Fechado em"), dia(d.sistema.fechado_em)],
            [t("Motivo da perda"), d.sistema.motivo_da_perda ?? "—"],
            [t("Origem (técnica)"), d.source ?? "—"],
            [t("ID externo"), d.sistema.id_externo ?? "—"],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="min-w-0">
              <dt className="text-text-muted">{rotulo}</dt>
              <dd className="font-medium break-words">{valor}</dd>
            </div>
          ))}
        </dl>
      </SecaoDaFicha>

      {d.contact_id ? (
        <SecaoDaFicha id="qualificacao" titulo={t("Qualificação")}>
          <QualificacaoDoLead contactId={d.contact_id} semTitulo />
        </SecaoDaFicha>
      ) : null}

      {d.contact_id ? (
        <SecaoDaFicha id="vendas" titulo={t("Vendas")}>
          <VendasDoCliente contactId={d.contact_id} semTitulo />
        </SecaoDaFicha>
      ) : null}

      <SecaoDaFicha id="linha-do-tempo" titulo={t("Linha do tempo")}>
        {linhaDoTempo ? (
          <LeadTimeline
            itens={linhaDoTempo.itens}
            chegouAoVivo={linhaDoTempo.chegouAoVivo}
            isLoading={linhaDoTempo.isLoading}
            isError={linhaDoTempo.isError}
          />
        ) : (
          <LinhaDoTempoPropria leadId={leadId} contactId={d.contact_id} />
        )}
      </SecaoDaFicha>
    </div>
  );
}

type LinhaDoTempo = Pick<
  ReturnType<typeof useLeadTimeline>,
  "itens" | "chegouAoVivo" | "isLoading" | "isError"
>;

function LinhaDoTempoPropria({ leadId, contactId }: { leadId: string; contactId: string | null }) {
  const tl = useLeadTimeline(leadId, contactId);
  return (
    <LeadTimeline
      itens={tl.itens}
      chegouAoVivo={tl.chegouAoVivo}
      isLoading={tl.isLoading}
      isError={tl.isError}
    />
  );
}

function ContatoEditavel({
  contactId,
  leadId,
  pipelineId,
}: {
  contactId: string;
  leadId: string;
  pipelineId: string;
}) {
  const t = useT();
  const { data } = useContact(contactId);
  const contato = data?.data;
  const tag = useTagDeIdioma();
  if (!contato) return <div className="h-16 animate-pulse rounded-lg bg-secondary" />;
  const extras = Object.entries(contato.custom_fields ?? {}).filter(
    ([k, v]) => v !== null && v !== "" && typeof v !== "object" && !/^link_|^links?$/i.test(k),
  );
  const consentimento = Object.entries(contato.consent ?? {}).filter(
    ([, v]) => v !== null && v !== "" && typeof v !== "object",
  );
  return (
    <div className="grid grid-cols-1 gap-3">
      {/* key = updated_at: o formulário reinicia com o valor do servidor depois de salvar. */}
      <FormularioDoContato key={contato.updated_at} contactId={contactId} contato={contato} t={t} />
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 border-t pt-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-text-muted">{t("Cadastrado em")}</dt>
          <dd className="font-medium">{new Date(contato.created_at).toLocaleDateString(tag)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">{t("Origem do contato")}</dt>
          <dd className="font-medium">{contato.source}</dd>
        </div>
        <div>
          <dt className="text-text-muted">{t("Primeiro atendimento")}</dt>
          <dd className="font-medium">
            {contato.first_service_at
              ? new Date(contato.first_service_at).toLocaleDateString(tag)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">{t("Última atividade")}</dt>
          <dd className="font-medium">
            {contato.last_activity_at
              ? new Date(contato.last_activity_at).toLocaleDateString(tag)
              : "—"}
          </dd>
        </div>
        {contato.is_blocked ? (
          <div className="sm:col-span-2">
            <dt className="text-text-muted">{t("Bloqueado")}</dt>
            <dd className="font-medium">{contato.blocked_reason ?? t("Sim")}</dd>
          </div>
        ) : null}
        {consentimento.map(([k, v]) => (
          <div key={`c-${k}`}>
            <dt className="text-text-muted">
              {t("Consentimento")}: {rotuloDaChave(k)}
            </dt>
            <dd className="font-medium break-words">{String(v)}</dd>
          </div>
        ))}
        {extras.map(([k, v]) => (
          <div key={`x-${k}`}>
            <dt className="text-text-muted">{rotuloDaChave(k)}</dt>
            <dd className="font-medium break-words">{String(v)}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t pt-2">
        <p className="mb-1 text-xs font-medium text-text-muted">{t("Links")}</p>
        <FormularioDeLinks
          key={`l-${contato.updated_at}`}
          contato={contato}
          pipelineId={pipelineId}
        />
      </div>
      <PessoasRelacionadas leadId={leadId} />
    </div>
  );
}

function FormularioDoContato({
  contactId,
  contato,
  t,
}: {
  contactId: string;
  contato: {
    name: string | null;
    display_name: string | null;
    email: string | null;
    phone_number: string | null;
    birthdate: string | null;
    tags: string[];
  };
  t: (s: string) => string;
}) {
  const atualizar = useUpdateContact(contactId);
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(nomeDoContato(contato) ?? "");
  const [telefone, setTelefone] = useState(contato.phone_number ?? "");
  const [email, setEmail] = useState(contato.email ?? "");
  const [nascimento, setNascimento] = useState(contato.birthdate ?? "");
  const [tags, setTags] = useState((contato.tags ?? []).join(", "));
  const tagsDigitadas = tags
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const tagsMudaram = tagsDigitadas.join("|") !== (contato.tags ?? []).join("|");
  const sujo =
    tagsMudaram ||
    nascimento !== (contato.birthdate ?? "") ||
    nome.trim() !== (nomeDoContato(contato) ?? "") ||
    telefoneE164(telefone) !== (contato.phone_number ?? "") ||
    email.trim() !== (contato.email ?? "");

  async function salvar() {
    const patch: Record<string, string> = {};
    if (nome.trim() && nome.trim() !== (contato.name ?? "")) patch.name = nome.trim();
    const fone = telefoneE164(telefone);
    if (fone && fone !== (contato.phone_number ?? "")) patch.phone_number = fone;
    if (email.trim() && email.trim() !== (contato.email ?? "")) patch.email = email.trim();
    const corpo: Record<string, unknown> = { ...patch };
    if (nascimento && nascimento !== (contato.birthdate ?? "")) corpo.birthdate = nascimento;
    if (tagsMudaram) corpo.tags = tagsDigitadas;
    if (Object.keys(corpo).length === 0) return;
    try {
      await atualizar.mutateAsync(corpo);
      await queryClient.invalidateQueries();
      toast.success(t("Contato atualizado"));
    } catch {
      // showApiError já avisou
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="grid gap-1">
        <Label className="text-xs">{t("Nome")}</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Telefone")}</Label>
        <Input
          value={telefone}
          inputMode="tel"
          placeholder="+5511999998888"
          onChange={(e) => setTelefone(e.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("E-mail")}</Label>
        <Input value={email} type="email" onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Aniversário")}</Label>
        <CampoDeData
          valor={nascimento}
          aoMudar={setNascimento}
          rotulo={t("Aniversário")}
          className="w-full"
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Tags do contato (separadas por vírgula)")}</Label>
        <Input value={tags} placeholder="vip, recompra" onChange={(e) => setTags(e.target.value)} />
      </div>
      <Button size="sm" disabled={!sujo || atualizar.isPending} onClick={() => void salvar()}>
        {atualizar.isPending ? t("Salvando…") : t("Salvar contato")}
      </Button>
    </div>
  );
}

export function OrigemEditavel({ leadId, dados }: { leadId: string; dados: DadosDoLead }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [origemEmTexto, setOrigemEmTexto] = useState(dados.source ?? "");
  const campanha = dados.campanhas.find((c) => c.id === dados.campaign_id) ?? null;

  async function gravar(corpo: Record<string, unknown>) {
    setSalvando(true);
    try {
      await apiClient.put(`/api/v1/leads/${leadId}/origem`, corpo);
      await queryClient.invalidateQueries();
      toast.success(t("Origem atualizada"));
    } catch (e) {
      showApiError(e);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="grid gap-1">
        <Label className="text-xs">{t("Campanha")}</Label>
        <select
          className={classeDoSelect}
          disabled={salvando}
          value={dados.campaign_id ?? ""}
          onChange={(e) => void gravar({ campaign_id: e.target.value || null })}
        >
          <option value="">{t("Sem campanha")}</option>
          {dados.campanhas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      {campanha ? (
        <>
          <div className="grid gap-1">
            <Label className="text-xs">{t("Criativo")}</Label>
            <select
              className={classeDoSelect}
              disabled={salvando}
              value={dados.creative_id ?? ""}
              onChange={(e) => void gravar({ creative_id: e.target.value || null })}
            >
              <option value="">{t("Sem criativo")}</option>
              {campanha.criativos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t("Landing page")}</Label>
            <select
              className={classeDoSelect}
              disabled={salvando}
              value={dados.landing_page_id ?? ""}
              onChange={(e) => void gravar({ landing_page_id: e.target.value || null })}
            >
              <option value="">{t("Sem landing page")}</option>
              {campanha.landing_pages.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      <div className="grid gap-1">
        <Label className="text-xs">{t("Origem em texto (de onde chegou)")}</Label>
        <div className="flex gap-2">
          <Input
            value={origemEmTexto}
            placeholder="manual, whatsapp, formulário…"
            onChange={(e) => setOrigemEmTexto(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={
              salvando || !origemEmTexto.trim() || origemEmTexto.trim() === (dados.source ?? "")
            }
            onClick={() => void gravar({ source: origemEmTexto.trim() })}
          >
            {t("Salvar")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Respostas que chegaram do formulário sem campo cadastrado no funil (idade, faturamento…). */
function CamposSoltos({ leadId, campos }: { leadId: string; campos: Array<[string, unknown]> }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [editados, setEditados] = useState<Record<string, string>>({});
  const [novoNome, setNovoNome] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function gravar(patch: Record<string, string | null>) {
    setSalvando(true);
    try {
      await apiClient.patch(`/api/v1/leads/${leadId}`, { custom_fields: patch });
      await queryClient.invalidateQueries();
      setEditados({});
      setNovoNome("");
      setNovoValor("");
      toast.success(t("Campos atualizados"));
    } catch (e) {
      showApiError(e);
    } finally {
      setSalvando(false);
    }
  }

  const alterados = Object.fromEntries(
    Object.entries(editados).filter(([k, v]) => {
      const original = campos.find(([c]) => c === k)?.[1];
      return v !== String(original ?? "");
    }),
  );

  return (
    <div className="grid grid-cols-1 gap-2">
      {campos.length === 0 ? (
        <p className="text-xs text-text-muted">{t("Nenhuma resposta extra neste lead.")}</p>
      ) : null}
      {campos.map(([chave, valor]) => (
        <div key={chave} className="grid gap-1">
          <Label className="text-xs">{rotuloDaChave(chave)}</Label>
          <div className="flex gap-2">
            <Input
              value={editados[chave] ?? String(valor)}
              onChange={(e) => setEditados((s) => ({ ...s, [chave]: e.target.value }))}
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("Remover campo")}
              disabled={salvando}
              onClick={() => void gravar({ [chave]: null })}
            >
              <Trash size={14} aria-hidden />
            </Button>
          </div>
        </div>
      ))}
      {Object.keys(alterados).length > 0 ? (
        <Button size="sm" disabled={salvando} onClick={() => void gravar(alterados)}>
          {t("Salvar respostas")}
        </Button>
      ) : null}
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 border-t pt-2">
        <div className="grid gap-1">
          <Label className="text-xs">{t("Novo campo")}</Label>
          <Input
            value={novoNome}
            placeholder={t("ex.: idade")}
            onChange={(e) => setNovoNome(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">{t("Valor")}</Label>
          <Input value={novoValor} onChange={(e) => setNovoValor(e.target.value)} />
        </div>
        <Button
          size="icon"
          variant="outline"
          aria-label={t("Adicionar campo")}
          disabled={salvando || !novoNome.trim() || !novoValor.trim()}
          onClick={() =>
            void gravar({
              [novoNome
                .trim()
                .toLowerCase()
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .replace(/[^a-z0-9]+/g, "_")
                .replace(/^_+|_+$/g, "")]: novoValor.trim(),
            })
          }
        >
          <Plus size={14} aria-hidden />
        </Button>
      </div>
    </div>
  );
}
