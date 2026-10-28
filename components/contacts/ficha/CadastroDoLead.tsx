"use client";

import { CicloDeVidaDoLead } from "@/components/contacts/ficha/CicloDeVidaDoLead";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { BlocoDaFicha, CampoLido } from "@/components/contacts/ficha/BlocoDaFicha";
import { useAvisarSeNaoSalvo } from "@/components/contacts/ficha/AvisoDeNaoSalvo";
import { TagsDoLead } from "@/components/contacts/ficha/TagsDoLead";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDadosDosNegocios, useQualificacaoDoContato } from "@/components/contacts/ficha/dados-da-ficha";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { telefoneE164 } from "@/components/leads/FichaDoLead";
import { QualificacaoDoLead } from "@/components/leads/QualificacaoDoLead";
import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
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
import type { CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import type { Contact } from "@/lib/types/contacts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OrigemEmCascata } from "@/components/contacts/ficha/OrigemEmCascata";
import type { CampanhaOpcao } from "@/lib/marketing/origem-opcoes";
import { Plus, Trash, X } from "@/lib/ui/icons";

interface OrigemLida {
  origem: string;
  campanha: string | null;
  conjunto: string | null;
  anuncio: string | null;
  posicionamento: string | null;
}

export const rotuloDaChave = (k: string) =>
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
  clientesLigado,
  podeGerirCategorias = false,
}: {
  contact: Contact;
  origem: OrigemLida & { semPosicionamentoDeAnuncio?: boolean };
  podeEditar: boolean;
  camposDefinidos: CustomFieldDef[];
  /** "Clientes pela agenda" ligado: mostra "Cliente desde". */
  clientesLigado: boolean;
  /** Gerente em diante: muda a categoria das tags e as cores das categorias. */
  podeGerirCategorias?: boolean;
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

  // ── Campos personalizados (do contato + de cada funil, juntos; dá para criar e apagar) ──
  const rotulosGuardados =
    contact.custom_fields && typeof contact.custom_fields._rotulos === "object"
      ? (contact.custom_fields._rotulos as Record<string, string>)
      : {};
  const camposDoContato = Object.entries(contact.custom_fields ?? {}).filter(
    ([k, v]) =>
      !k.startsWith(PREFIXO_DA_CHAVE) &&
      !k.startsWith("_") &&
      v !== null &&
      v !== "" &&
      typeof v !== "object",
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
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [novoNome, setNovoNome] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [novos, setNovos] = useState<Array<{ chave: string; rotulo: string; valor: string }>>([]);
  const rotuloDoCampo = (k: string) =>
    rotulosGuardados[k] ??
    camposDefinidos.find((d) => d.key === k)?.label ??
    negocios.dados.flatMap((n) => n.negocio.field_defs).find((d) => d.key === k)?.label ??
    rotuloDaChave(k);
  const sujoCampos = Object.keys(edicao).length > 0 || removidos.size > 0 || novos.length > 0;
  const linksMudaram = JSON.stringify(links) !== JSON.stringify(lerLinks(contact.custom_fields));
  useAvisarSeNaoSalvo("cadastro-campos", sujoCampos);
  useAvisarSeNaoSalvo("cadastro-contato", mudou);
  useAvisarSeNaoSalvo("cadastro-links", linksMudaram);

  function chaveDoNome(nome: string): string {
    const base = nome
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36);
    return /^[a-z]/.test(base) ? base : `campo_${base}`;
  }
  function juntarNovo() {
    const nome = novoNome.trim();
    if (!nome) return;
    const chave = chaveDoNome(nome);
    if (juntos.has(chave) || novos.some((n) => n.chave === chave)) {
      toast.error(t("Já existe um campo com esse nome."));
      return;
    }
    // Salva na hora: o campo novo não fica esperando um botão lá em cima.
    const novo = { chave, rotulo: nome, valor: novoValor.trim() };
    setNovoNome("");
    setNovoValor("");
    void salvarCampos([...novos, novo]);
  }
  async function salvarCampos(novosParaSalvar: typeof novos = novos) {
    try {
      const atuais: Record<string, unknown> = { ...(contact.custom_fields ?? {}) };
      const rotulos: Record<string, string> = { ...rotulosGuardados };
      for (const k of removidos) {
        delete atuais[k];
        delete rotulos[k];
      }
      for (const [k, v] of Object.entries(edicao)) if (!removidos.has(k)) atuais[k] = v;
      for (const n of novosParaSalvar) {
        atuais[n.chave] = n.valor;
        rotulos[n.chave] = n.rotulo;
      }
      if (Object.keys(rotulos).length > 0) atuais._rotulos = rotulos;
      else delete atuais._rotulos;
      await atualizar.mutateAsync({ custom_fields: atuais });
      // Cada funil que já tinha o campo recebe o mesmo valor (ou perde o campo), para nada divergir.
      for (const n of negocios.dados) {
        const dele: Record<string, unknown> = {};
        for (const k of Object.keys(n.custom_fields ?? {})) {
          if (removidos.has(k)) dele[k] = null;
          else if (k in edicao) dele[k] = edicao[k];
        }
        if (Object.keys(dele).length === 0) continue;
        await apiClient.patch(`/api/v1/leads/${n.lead_id}`, { custom_fields: dele });
      }
      setEdicao({});
      setRemovidos(new Set());
      setNovos([]);
      await queryClient.invalidateQueries({ queryKey: ["ficha-do-lead"] });
      toast.success(t("Campos personalizados atualizados"));
    } catch (e) {
      showApiError(e);
    }
  }

  // ── Origem (editável, com confirmação) ──
  const manualAtual =
    contact.source_metadata && typeof (contact.source_metadata as Record<string, unknown>).origem_manual === "object"
      ? ((contact.source_metadata as Record<string, unknown>).origem_manual as Record<string, string>)
      : {};
  const paginaDosFunis =
    negocios.dados
      .map((n) => n.campanhas.flatMap((c) => c.landing_pages).find((p) => p.id === n.landing_page_id))
      .find(Boolean)?.nome ?? null;
  const origemAtual = {
    origem: origem.origem,
    campanha: origem.campanha ?? "",
    conjunto: origem.conjunto ?? "",
    anuncio: origem.anuncio ?? "",
    lp: manualAtual.lp?.trim() || paginaDosFunis || "",
    posicionamento: origem.posicionamento ?? "",
  };
  const opcoesDeOrigem = useQuery({
    queryKey: ["origem-opcoes"],
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: { campanhas: CampanhaOpcao[]; posicionamentos: string[]; fontes: string[] };
        }>("/api/v1/marketing/origem-opcoes")
      ).data,
  });
  const [editandoOrigem, setEditandoOrigem] = useState(false);
  const [origemEdit, setOrigemEdit] = useState(origemAtual);
  const [confirmarOrigem, setConfirmarOrigem] = useState(false);
  async function salvarOrigem() {
    try {
      const manual: Record<string, string> = { ...manualAtual };
      const tagsNovas: string[] = [];
      // Os nomes aparecem na tela; os ids ficam por trás para o sistema cruzar com campanha,
      // conjunto, anúncio e página.
      const arvore = opcoesDeOrigem.data?.campanhas ?? [];
      const camp = arvore.find((c) => c.nome === origemEdit.campanha.trim());
      const conj = camp?.conjuntos.find((c) => c.nome === origemEdit.conjunto.trim());
      const todosAnuncios = camp ? [...camp.conjuntos.flatMap((c) => c.anuncios), ...camp.anuncios_soltos] : [];
      const anun = todosAnuncios.find((a) => a.nome === origemEdit.anuncio.trim());
      const pag = camp?.paginas.find((p) => p.nome === origemEdit.lp.trim());
      manual.campanha_id = camp?.id ?? "";
      manual.conjunto_id = conj?.id ?? "";
      manual.anuncio_id = anun?.id ?? "";
      manual.anuncio_ad_id = anun?.ad_id ?? "";
      manual.lp_id = pag?.id ?? "";
      (Object.keys(origemEdit) as Array<keyof typeof origemEdit>).forEach((k) => {
        const novo = origemEdit[k].trim();
        if (novo === origemAtual[k]) return;
        manual[k] = novo;
        if (!novo) return;
        if (k === "campanha") tagsNovas.push(`Campanha: ${novo}`);
        if (k === "anuncio") tagsNovas.push(`Ad: ${novo}`);
        if (k === "lp") tagsNovas.push(`LP: ${novo}`);
      });
      const jaTem = new Set(contact.tags.map((x) => x.toLowerCase()));
      const tags = [
        ...contact.tags,
        ...tagsNovas.filter((x) => !jaTem.has(x.toLowerCase().slice(0, 40))),
      ];
      await atualizar.mutateAsync({
        source_metadata: { ...(contact.source_metadata ?? {}), origem_manual: manual },
        ...(tagsNovas.length > 0 ? { tags } : {}),
      });
      setEditandoOrigem(false);
      setConfirmarOrigem(false);
      toast.success(t("Origem do lead atualizada"));
    } catch {
      setConfirmarOrigem(false);
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

  const dia = (iso: string | null | undefined, comHora = false) =>
    iso ? format(new Date(iso), comHora ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale }) : "—";

  return (
    <div className="grid gap-4">
      <BlocoDaFicha
        titulo={t("Cadastro")}
        cor="blue"
        acao={
          podeEditar && mudou ? (
            <Button size="sm" disabled={atualizar.isPending} onClick={() => void salvarContato()}>
              {atualizar.isPending ? t("Salvando…") : t("Salvar")}
            </Button>
          ) : null
        }
      >
        {/* Nome, telefone e e-mail se editam no topo da página. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <dl className="self-end">
            <CampoLido rotulo={`${t("Nome")} · WhatsApp`} valor={contact.display_name} />
          </dl>
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

      <BlocoDaFicha
        titulo={t("Qualificação")}
        cor="green"
      >
        <QualificacaoDoLead contactId={contact.id} semTitulo semDatas />

        <div className="mt-4 border-t pt-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Campos personalizados")}
          </h3>
          {juntos.size === 0 && novos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("Nenhum campo ainda. Adicione abaixo o que ajuda a qualificar este lead.")}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {[...juntos.entries()]
                .filter(([k]) => !removidos.has(k))
                .map(([k, v]) => (
                  <div key={k} className="grid gap-1">
                    <Label className="text-xs">{rotuloDoCampo(k)}</Label>
                    <div className="flex gap-1">
                      <Input
                        value={edicao[k] ?? texto(v)}
                        disabled={!podeEditar || Array.isArray(v)}
                        onChange={(e) => setEdicao((a) => ({ ...a, [k]: e.target.value }))}
                      />
                      {podeEditar ? (
                        <button
                          type="button"
                          aria-label={`${t("Apagar campo")} ${rotuloDoCampo(k)}`}
                          onClick={() => setRemovidos((a) => new Set(a).add(k))}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                        >
                          <Trash size={14} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              {novos.map((n) => (
                <div key={n.chave} className="grid gap-1">
                  <Label className="text-xs">
                    {n.rotulo} <span className="text-primary">· {t("novo")}</span>
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      value={n.valor}
                      onChange={(e) =>
                        setNovos((a) =>
                          a.map((x) => (x.chave === n.chave ? { ...x, valor: e.target.value } : x)),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label={`${t("Remover")} ${n.rotulo}`}
                      onClick={() => setNovos((a) => a.filter((x) => x.chave !== n.chave))}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {podeEditar ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={novoNome}
                maxLength={60}
                placeholder={t("Nome do campo (ex.: Renda mensal)")}
                onChange={(e) => setNovoNome(e.target.value)}
              />
              <Input
                value={novoValor}
                maxLength={500}
                placeholder={t("Valor")}
                onChange={(e) => setNovoValor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && juntarNovo()}
              />
              <Button type="button" variant="outline" disabled={!novoNome.trim()} onClick={juntarNovo}>
                <Plus size={14} weight="bold" aria-hidden className="mr-1" />
                {t("Adicionar campo")}
              </Button>
            </div>
          ) : null}
          {podeEditar && sujoCampos ? (
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="mr-auto text-xs text-muted-foreground">
                {t("Você alterou campos e ainda não salvou.")}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={atualizar.isPending}
                onClick={() => {
                  setEdicao({});
                  setRemovidos(new Set());
                  setNovos([]);
                }}
              >
                {t("Descartar")}
              </Button>
              <Button size="sm" disabled={atualizar.isPending} onClick={() => void salvarCampos()}>
                {t("Salvar campos")}
              </Button>
            </div>
          ) : null}
        </div>
      </BlocoDaFicha>

      <BlocoDaFicha
        titulo={t("Origem")}
        cor="orange"
        acao={
          podeEditar ? (
            editandoOrigem ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditandoOrigem(false);
                    setOrigemEdit(origemAtual);
                  }}
                >
                  {t("Cancelar")}
                </Button>
                <Button size="sm" onClick={() => setConfirmarOrigem(true)}>
                  {t("Salvar origem")}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOrigemEdit(origemAtual);
                  setEditandoOrigem(true);
                }}
              >
                {t("Alterar origem")}
              </Button>
            )
          ) : null
        }
      >
        {editandoOrigem ? (
          <OrigemEmCascata
            valor={origemEdit}
            aoMudar={setOrigemEdit}
            campanhas={opcoesDeOrigem.data?.campanhas ?? []}
            posicionamentos={opcoesDeOrigem.data?.posicionamentos ?? []}
            fontes={opcoesDeOrigem.data?.fontes ?? []}
            carregando={opcoesDeOrigem.isLoading}
          />
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CampoLido rotulo={t("Origem")} valor={origem.origem} />
            <CampoLido rotulo={t("Campanha")} valor={origem.campanha} />
            <CampoLido rotulo={t("Conjunto")} valor={origem.conjunto} />
            <CampoLido rotulo={t("Anúncio")} valor={origem.anuncio} />
            <CampoLido rotulo={t("Landing page")} valor={origemAtual.lp} />
            <CampoLido rotulo={t("Posicionamento")} valor={origem.posicionamento} />
          </dl>
        )}
        {origem.semPosicionamentoDeAnuncio && !editandoOrigem ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("A plataforma não informa o posicionamento de cada clique em anúncio.")}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          {t("A origem de cada funil (campanha, criativo e página) está na aba Funis.")}
        </p>

        <div className="mt-4 border-t pt-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Rastreamento (UTMs, anúncio, página)")}
          </h3>
          {rastros.size === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Sem dados de rastreamento.")}</p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...rastros.entries()]
                .filter(([k]) => k !== "origem_manual")
                .map(([k, v]) => (
                  <CampoLido
                    key={k}
                    rotulo={k === "origem" ? t("Origem (rastreamento)") : rotuloDaChave(k)}
                    valor={v}
                  />
                ))}
            </dl>
          )}
        </div>
      </BlocoDaFicha>

      <AlertDialog open={confirmarOrigem} onOpenChange={setConfirmarOrigem}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Alterar a origem deste lead?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Isso muda a fonte do lead (origem, campanha, conjunto e anúncio) onde quer que ele apareça. O rastreamento original (UTMs) continua guardado.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void salvarOrigem()}>
              {t("Confirmar alteração")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CicloDeVidaDoLead contactId={contact.id} podeEditar={podeEditar} />

      <BlocoDaFicha titulo={t("Datas")} cor="yellow">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CampoLido rotulo={t("Criado em")} valor={dia(contact.created_at)} />
          <CampoLido rotulo={t("Entrou no CRM em")} valor={dia(qual.data?.entrou_em, true)} />
          <CampoLido rotulo={t("Primeira abordagem")} valor={dia(qual.data?.primeira_abordagem, true)} />
          <CampoLido
            rotulo={t("Primeira compra")}
            valor={
              qual.data?.primeira_compra
                ? qual.data.primeira_compra.slice(0, 10).split("-").reverse().join("/")
                : t("Sem compra paga ainda")
            }
          />
          <CampoLido rotulo={t("Última atividade")} valor={dia(contact.last_activity_at, true)} />
          {clientesLigado && contact.first_service_at ? (
            <CampoLido rotulo={t("Cliente desde")} valor={dia(contact.first_service_at)} />
          ) : null}
        </dl>
      </BlocoDaFicha>

      <TagsDoLead
        contact={contact}
        podeEditar={podeEditar}
        podeGerirCategorias={podeGerirCategorias}
      />
    </div>
  );
}
