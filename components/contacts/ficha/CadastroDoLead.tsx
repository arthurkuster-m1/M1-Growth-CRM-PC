"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { BlocoDaFicha, CampoLido } from "@/components/contacts/ficha/BlocoDaFicha";
import { useDadosDosNegocios, useQualificacaoDoContato } from "@/components/contacts/ficha/dados-da-ficha";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { telefoneE164 } from "@/components/leads/FichaDoLead";
import { QualificacaoDoLead } from "@/components/leads/QualificacaoDoLead";
import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  PREFIXO_DA_CHAVE,
  TIPOS_DE_LINK,
  aplicarLinks,
  lerLinks,
  normalizarLink,
  type LinksDoContato,
  type TipoDeLink,
} from "@/lib/leads/links-de-contato";
import { normalizarTags } from "@/lib/contacts/tag-normalizada";
import type { CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import type { Contact } from "@/lib/types/contacts";
import { X } from "@/lib/ui/icons";

interface OrigemLida {
  origem: string;
  campanha: string | null;
  conjunto: string | null;
  anuncio: string | null;
  posicionamento: string | null;
}

const rotuloDaChave = (k: string) =>
  k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const texto = (v: unknown): string =>
  Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v ?? "");

/**
 * O CADASTRO DO LEAD: tudo o que é da PESSOA, num lugar só. Quem edita aqui vale para todos os
 * funis — nada disto é copiado por funil.
 */
export function CadastroDoLead({
  contact,
  origem,
  podeEditar,
  camposDefinidos,
}: {
  contact: Contact;
  origem: OrigemLida;
  podeEditar: boolean;
  camposDefinidos: CustomFieldDef[];
}) {
  const t = useT();
  const locale = useLocaleDeData();
  const queryClient = useQueryClient();
  const atualizar = useUpdateContact(contact.id);
  const qual = useQualificacaoDoContato(contact.id);
  const negocios = useDadosDosNegocios((qual.data?.funis ?? []).map((f) => f.lead_id));

  // ── Contato ──
  const [nome, setNome] = useState(contact.name ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [telefone, setTelefone] = useState(contact.phone_number ?? "");
  const [nascimento, setNascimento] = useState(contact.birthdate ?? "");
  const mudou =
    nome.trim() !== (contact.name ?? "") ||
    email.trim() !== (contact.email ?? "") ||
    (telefone.trim() !== "" && telefoneE164(telefone) !== (contact.phone_number ?? "")) ||
    nascimento !== (contact.birthdate ?? "");

  async function salvarContato() {
    const corpo: Record<string, unknown> = {};
    if (nome.trim() && nome.trim() !== (contact.name ?? "")) corpo.name = nome.trim();
    if (email.trim() && email.trim() !== (contact.email ?? "")) corpo.email = email.trim();
    const fone = telefoneE164(telefone);
    if (fone && fone !== (contact.phone_number ?? "")) corpo.phone_number = fone;
    if (nascimento && nascimento !== (contact.birthdate ?? "")) corpo.birthdate = nascimento;
    if (Object.keys(corpo).length === 0) return;
    try {
      await atualizar.mutateAsync(corpo);
      toast.success(t("Cadastro atualizado"));
    } catch {
      /* o hook já avisou */
    }
  }

  // ── Links ──
  const [links, setLinks] = useState<LinksDoContato>(() => lerLinks(contact.custom_fields));
  async function salvarLinks() {
    const invalidos = TIPOS_DE_LINK.filter((l) => links[l.id]?.trim() && !normalizarLink(links[l.id]));
    if (invalidos.length > 0) {
      toast.error(t("Confira os links marcados: só endereços http(s) valem."));
      return;
    }
    try {
      await atualizar.mutateAsync({ custom_fields: aplicarLinks(contact.custom_fields, links) });
      toast.success(t("Links salvos."));
    } catch {
      /* o hook já avisou */
    }
  }

  // ── Campos do formulário (do contato + de cada funil, juntos) ──
  const camposDoContato = Object.entries(contact.custom_fields ?? {}).filter(
    ([k, v]) => !k.startsWith(PREFIXO_DA_CHAVE) && v !== null && v !== "" && typeof v !== "object",
  );
  const juntos = new Map<string, unknown>();
  for (const [k, v] of camposDoContato) juntos.set(k, v);
  for (const n of negocios.dados) {
    for (const [k, v] of Object.entries(n.custom_fields ?? {})) {
      if (v === null || v === "" || (typeof v === "object" && !Array.isArray(v))) continue;
      if (!juntos.has(k)) juntos.set(k, v);
    }
  }
  const [edicao, setEdicao] = useState<Record<string, string>>({});
  const rotuloDoCampo = (k: string) =>
    camposDefinidos.find((d) => d.key === k)?.label ??
    negocios.dados.flatMap((n) => n.negocio.field_defs).find((d) => d.key === k)?.label ??
    rotuloDaChave(k);

  async function salvarCampos() {
    const novos: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(edicao)) novos[k] = v;
    try {
      // O contato guarda o valor; cada funil que já tinha o campo recebe o mesmo, para nada divergir.
      await atualizar.mutateAsync({ custom_fields: { ...(contact.custom_fields ?? {}), ...novos } });
      for (const n of negocios.dados) {
        const dele = Object.keys(novos).filter((k) => k in (n.custom_fields ?? {}));
        if (dele.length === 0) continue;
        await apiClient.patch(`/api/v1/leads/${n.lead_id}`, {
          custom_fields: Object.fromEntries(dele.map((k) => [k, novos[k]])),
        });
      }
      setEdicao({});
      await queryClient.invalidateQueries({ queryKey: ["ficha-do-lead"] });
      toast.success(t("Campos atualizados em todos os funis"));
    } catch (e) {
      showApiError(e);
    }
  }

  // ── Rastreamento ──
  const rastros = new Map<string, string>();
  const juntarRastro = (o: Record<string, unknown> | null | undefined) => {
    for (const [k, v] of Object.entries(o ?? {})) {
      if (v === null || v === "" || typeof v === "object") continue;
      if (!rastros.has(k)) rastros.set(k, String(v));
    }
  };
  juntarRastro(contact.source_metadata as Record<string, unknown> | null);
  for (const n of negocios.dados) juntarRastro(n.rastreamento);

  // ── Tags ──
  const [novaTag, setNovaTag] = useState("");
  async function gravarTags(tags: string[]) {
    try {
      await atualizar.mutateAsync({ tags });
    } catch {
      /* o hook já avisou */
    }
  }
  const dia = (iso: string | null | undefined, comHora = false) =>
    iso ? format(new Date(iso), comHora ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale }) : "—";

  return (
    <div className="grid gap-4">
      <BlocoDaFicha
        titulo={t("Contato")}
        cor="blue"
        acao={
          podeEditar && mudou ? (
            <Button size="sm" disabled={atualizar.isPending} onClick={() => void salvarContato()}>
              {atualizar.isPending ? t("Salvando…") : t("Salvar")}
            </Button>
          ) : null
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label className="text-xs">{t("Nome")}</Label>
            <Input value={nome} disabled={!podeEditar} onChange={(e) => setNome(e.target.value)} />
          </div>
          <dl className="self-end">
            <CampoLido rotulo={`${t("Nome")} · WhatsApp`} valor={contact.display_name} />
          </dl>
          <div className="grid gap-1">
            <Label className="text-xs">{t("Telefone")}</Label>
            <Input
              value={telefone}
              disabled={!podeEditar}
              inputMode="tel"
              onChange={(e) => setTelefone(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t("E-mail")}</Label>
            <Input
              type="email"
              value={email}
              disabled={!podeEditar}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t("Data de nascimento")}</Label>
            <CampoDeData
              valor={nascimento}
              aoMudar={setNascimento}
              rotulo={t("Data de nascimento")}
              desabilitado={!podeEditar}
              className="w-full"
            />
          </div>
        </div>
      </BlocoDaFicha>

      <BlocoDaFicha
        titulo={t("Links")}
        cor="purple"
        acao={
          podeEditar ? (
            <Button size="sm" variant="outline" disabled={atualizar.isPending} onClick={() => void salvarLinks()}>
              {t("Salvar links")}
            </Button>
          ) : null
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {TIPOS_DE_LINK.map((l) => (
            <div key={l.id} className="grid gap-1">
              <Label className="text-xs">{l.rotulo}</Label>
              <Input
                value={links[l.id as TipoDeLink] ?? ""}
                disabled={!podeEditar}
                placeholder="https://…"
                onChange={(e) => setLinks((a) => ({ ...a, [l.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </BlocoDaFicha>

      <BlocoDaFicha titulo={t("Qualificação")} cor="green">
        <QualificacaoDoLead contactId={contact.id} semTitulo />
      </BlocoDaFicha>

      <BlocoDaFicha titulo={t("Origem")} cor="orange">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CampoLido rotulo={t("Origem")} valor={origem.origem} />
          <CampoLido rotulo={t("Campanha")} valor={origem.campanha} />
          <CampoLido rotulo={t("Conjunto")} valor={origem.conjunto} />
          <CampoLido rotulo={t("Anúncio")} valor={origem.anuncio} />
          <CampoLido rotulo={t("Posicionamento")} valor={origem.posicionamento} />
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("A origem de cada funil (campanha, criativo e página) está na aba Funis.")}
        </p>
      </BlocoDaFicha>

      <BlocoDaFicha
        titulo={t("Respostas e campos do formulário")}
        cor="pink"
        acao={
          podeEditar && Object.keys(edicao).length > 0 ? (
            <Button size="sm" disabled={atualizar.isPending} onClick={() => void salvarCampos()}>
              {t("Salvar campos")}
            </Button>
          ) : null
        }
      >
        {juntos.size === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Sem respostas de formulário.")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...juntos.entries()].map(([k, v]) => (
              <div key={k} className="grid gap-1">
                <Label className="text-xs">{rotuloDoCampo(k)}</Label>
                <Input
                  value={edicao[k] ?? texto(v)}
                  disabled={!podeEditar || Array.isArray(v)}
                  onChange={(e) => setEdicao((a) => ({ ...a, [k]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}
      </BlocoDaFicha>

      <BlocoDaFicha titulo={t("Rastreamento (UTMs, anúncio, página)")} cor="gray">
        {rastros.size === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Sem dados de rastreamento.")}</p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...rastros.entries()].map(([k, v]) => (
              <CampoLido key={k} rotulo={rotuloDaChave(k)} valor={v} />
            ))}
          </dl>
        )}
      </BlocoDaFicha>

      <BlocoDaFicha titulo={t("Datas")} cor="yellow">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CampoLido rotulo={t("Criado em")} valor={dia(contact.created_at)} />
          <CampoLido rotulo={t("Última atividade")} valor={dia(contact.last_activity_at, true)} />
          <CampoLido rotulo={t("Primeira abordagem")} valor={dia(qual.data?.primeira_abordagem, true)} />
          <CampoLido rotulo={t("Cliente desde")} valor={dia(contact.first_service_at)} />
        </dl>
      </BlocoDaFicha>

      <BlocoDaFicha titulo={t("Tags")} cor="red">
        <div className="flex flex-wrap items-center gap-2">
          {contact.tags.length === 0 ? (
            <span className="text-sm text-muted-foreground">{t("Sem tags.")}</span>
          ) : null}
          {contact.tags.map((tag) => (
            <ChipDeEtiqueta key={tag} tag={tag} contorno>
              {podeEditar ? (
                <button
                  type="button"
                  aria-label={`${t("Remover")} ${tag}`}
                  className="ml-1.5 rounded-full hover:bg-black/10"
                  onClick={() => void gravarTags(contact.tags.filter((x) => x !== tag))}
                >
                  <X size={12} weight="bold" aria-hidden />
                </button>
              ) : null}
            </ChipDeEtiqueta>
          ))}
          {podeEditar ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const novas = normalizarTags([novaTag]);
                if (novas.length === 0) return;
                void gravarTags([...new Set([...contact.tags, ...novas])]);
                setNovaTag("");
              }}
            >
              <Input
                value={novaTag}
                onChange={(e) => setNovaTag(e.target.value)}
                placeholder={t("Nova tag…")}
                className="h-8 w-36"
              />
              <Button size="sm" type="submit" variant="outline" disabled={!novaTag.trim()}>
                {t("Adicionar")}
              </Button>
            </form>
          ) : null}
        </div>
      </BlocoDaFicha>
    </div>
  );
}
