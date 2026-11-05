"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { InterfaceEditor } from "@/components/team/InterfaceEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type CreateTenantResponse, useCreateTenant } from "@/hooks/useCreateTenant";
import { useIdioma } from "@/lib/i18n/IdiomaProvider";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { copyToClipboard } from "@/lib/clipboard";
import {
  INTERFACE_COMPLETA,
  interfaceSettingsSchema,
  interfaceTemDestino,
} from "@/lib/navigation/interface";
import { X } from "@/lib/ui/icons";

interface LeadDaAgencia {
  id: string;
  title: string;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * "Nova empresa" em popup, no desenho do "Novo lead" do CRM. Pede o essencial — nome, slug, e-mail
 * do dono, lead da agência e interface — e o resto (fuso, idioma, marca, equipe…) se ajusta depois
 * na ficha da empresa. O lead da agência "espelha": ao escolhê-lo, o nome e o e-mail da pessoa
 * preenchem os campos que ainda estão vazios, e é dele que saem a entrada e a mensalidade.
 */
export function NovaEmpresaDialog({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const t = useT();
  const idioma = useIdioma();
  const criar = useCreateTenant();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTravado, setSlugTravado] = useState(false);
  const [email, setEmail] = useState("");
  const [lead, setLead] = useState<LeadDaAgencia | null>(null);
  const [busca, setBusca] = useState("");
  const [interfaceDoDono, setInterfaceDoDono] = useState(INTERFACE_COMPLETA);
  const [erroDoSlug, setErroDoSlug] = useState<string | null>(null);
  const [criada, setCriada] = useState<CreateTenantResponse["data"] | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);

  // Fechou: limpa tudo para a próxima vez abrir em branco.
  useEffect(() => {
    if (aberto) return;
    setNome("");
    setSlug("");
    setSlugTravado(false);
    setEmail("");
    setLead(null);
    setBusca("");
    setInterfaceDoDono(INTERFACE_COMPLETA);
    setErroDoSlug(null);
    setCriada(null);
  }, [aberto]);

  const leads = useQuery({
    queryKey: ["admin", "agencia-leads", busca] as const,
    enabled: aberto && !lead,
    staleTime: 15_000,
    queryFn: () =>
      apiClient.get<{
        data: { agencia: { id: string; name: string } | null; leads: LeadDaAgencia[] };
      }>(`/api/v1/admin/agencia-leads?q=${encodeURIComponent(busca)}`),
  });

  function escolherLead(l: LeadDaAgencia) {
    setLead(l);
    // Espelha: só preenche o que ainda está vazio, nunca sobrescreve o que a pessoa digitou.
    if (!nome.trim()) {
      setNome(l.title);
      if (!slugTravado) setSlug(slugify(l.title));
    }
    if (!email.trim() && l.contact_email) setEmail(l.contact_email);
  }

  const interfaceValida =
    interfaceSettingsSchema.safeParse(interfaceDoDono).success &&
    interfaceTemDestino(interfaceDoDono, "admin");
  const pronto =
    nome.trim().length >= 2 && slug.length >= 2 && /\S+@\S+\.\S+/.test(email) && interfaceValida;

  function enviar() {
    if (!pronto) return;
    setErroDoSlug(null);
    criar.mutate(
      {
        display_name: nome.trim(),
        slug,
        owner_email: email.trim(),
        owner_interface_settings: interfaceDoDono,
        ...(lead ? { agencia_lead_id: lead.id } : {}),
      },
      {
        onSuccess: (r) => {
          toast.success(t("Empresa criada com sucesso!"));
          setCriada(r.data);
          // A empresa nova entra na hora em tudo que veio do servidor: o seletor de empresas, o
          // trocador de organização e a lista (esta também é invalidada pelo hook).
          router.refresh();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === "conflict") {
            setErroDoSlug(t("Este identificador já está em uso"));
            return;
          }
          showApiError(err);
        },
      },
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => (!v ? aoFechar() : undefined)}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          nomeRef.current?.focus();
        }}
      >
        {criada ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("Empresa criada")}</DialogTitle>
              <DialogDescription>
                {criada.owner_invitation
                  ? `${criada.display_name}: ${t("falta o responsável aceitar o convite.")}`
                  : `${t("Você é o dono de")} ${criada.display_name}.`}
              </DialogDescription>
            </DialogHeader>
            {criada.owner_invitation ? (
              <div className="space-y-2">
                <p className="text-sm">
                  {criada.owner_invitation.email_dispatched
                    ? t("Convite enviado por e-mail.")
                    : t(
                        "O envio por e-mail não foi confirmado. Copie o link e compartilhe com o responsável.",
                      )}
                </p>
                <Label htmlFor="convite-do-dono">{t("Link do convite")}</Label>
                <Input id="convite-do-dono" readOnly value={criada.owner_invitation.accept_url} />
                <p className="text-xs text-text-muted">
                  {t("Válido até")}{" "}
                  {new Date(criada.owner_invitation.expires_at).toLocaleString(idioma)}.{" "}
                  {t("Se vencer, abra a aba Equipe da empresa para gerar outro.")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (await copyToClipboard(criada.owner_invitation!.accept_url))
                      toast.success(t("Link copiado"));
                    else toast.error(t("Selecione e copie o link acima."));
                  }}
                >
                  {t("Copiar convite")}
                </Button>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={aoFechar}>
                {t("Fechar")}
              </Button>
              <Button asChild>
                <Link href={`/admin/tenants/${criada.id}`}>{t("Abrir a ficha da empresa")}</Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("Nova empresa")}</DialogTitle>
              <DialogDescription>
                {t(
                  "Preencha o básico. O resto (fuso, idioma, marca, equipe) você ajusta na ficha da empresa.",
                )}
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                enviar();
              }}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="nova-empresa-nome">
                  {t("Nome da empresa")} <span className="text-error-fg">*</span>
                </Label>
                <Input
                  id="nova-empresa-nome"
                  ref={nomeRef}
                  value={nome}
                  placeholder={t("Loja da Maria")}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (!slugTravado) setSlug(slugify(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nova-empresa-slug">
                  {t("Identificador (slug)")} <span className="text-error-fg">*</span>
                </Label>
                <Input
                  id="nova-empresa-slug"
                  value={slug}
                  placeholder="loja-da-maria"
                  className="font-mono"
                  aria-invalid={!!erroDoSlug}
                  onChange={(e) => {
                    const limpo = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                    setSlug(limpo);
                    setSlugTravado(limpo.length > 0);
                    setErroDoSlug(null);
                  }}
                />
                <p className="text-xs text-text-muted">
                  {t(
                    "Letras minúsculas, números e hífens. Gerado do nome e não pode ser trocado depois.",
                  )}
                </p>
                {erroDoSlug ? <p className="text-xs text-error-fg">{erroDoSlug}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nova-empresa-email">
                  {t("E-mail do dono da empresa")} <span className="text-error-fg">*</span>
                </Label>
                <Input
                  id="nova-empresa-email"
                  type="email"
                  value={email}
                  placeholder="dono@empresa.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nova-empresa-lead">{t("Lead no CRM da agência")}</Label>
                {lead ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{lead.title}</span>
                      {lead.contact_name ? (
                        <span className="text-text-muted"> · {lead.contact_name}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      aria-label={t("Desvincular o lead")}
                      onClick={() => setLead(null)}
                      className="shrink-0 rounded-md p-1 text-text-muted hover:bg-secondary hover:text-foreground"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="nova-empresa-lead"
                      value={busca}
                      placeholder={t("Buscar o lead da agência pelo nome")}
                      onChange={(e) => setBusca(e.target.value)}
                    />
                    <ul className="max-h-36 overflow-y-auto rounded-lg border">
                      {(leads.data?.data.leads ?? []).length === 0 ? (
                        <li className="px-3 py-2 text-xs text-text-muted">
                          {leads.isLoading
                            ? t("Carregando...")
                            : leads.data?.data.agencia
                              ? t("Nenhum lead encontrado.")
                              : t("Entre em uma organização da agência para ligar um lead.")}
                        </li>
                      ) : (
                        (leads.data?.data.leads ?? []).map((l) => (
                          <li key={l.id}>
                            <button
                              type="button"
                              onClick={() => escolherLead(l)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary"
                            >
                              <span className="truncate">{l.title}</span>
                              <span className="shrink-0 text-xs text-text-muted">
                                {l.contact_name ?? ""}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </>
                )}
                <p className="text-xs text-text-muted">
                  {t(
                    "Opcional. Ligado, o nome e o e-mail do lead preenchem o que estiver vazio, e dele saem a entrada e a mensalidade da empresa.",
                  )}
                </p>
              </div>
              <InterfaceEditor
                value={interfaceDoDono}
                onChange={setInterfaceDoDono}
                role="admin"
                disabled={criar.isPending}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={aoFechar}
                  disabled={criar.isPending}
                >
                  {t("Cancelar")}
                </Button>
                <Button type="submit" disabled={!pronto || criar.isPending}>
                  {criar.isPending ? t("Criando...") : t("Criar empresa")}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
