"use client";

import { useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectDoApp } from "@/components/ui/SelectDoApp";
import { Skeleton } from "@/components/ui/skeleton";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import {
  useTenantTeam,
  useTenantTeamActions,
  type ConviteEmitido,
  type MembroDaEmpresa,
  type PapelDaEquipe,
} from "@/hooks/useTenantTeam";
import { copyToClipboard } from "@/lib/clipboard";
import { Copy } from "@/lib/ui/icons";

const PAPEIS: PapelDaEquipe[] = ["admin", "manager", "agent", "viewer"];

function useRotuloDoPapel() {
  const t = useT();
  const nomes: Record<PapelDaEquipe, string> = {
    admin: t("Administrador"),
    manager: t("Gerente"),
    agent: t("Atendente"),
    viewer: t("Leitor"),
  };
  return (p: PapelDaEquipe) => nomes[p];
}

function LinhaDoMembro({
  m,
  onPapel,
  onRevogar,
}: {
  m: MembroDaEmpresa;
  onPapel: (p: PapelDaEquipe) => void;
  onRevogar: (revogar: boolean) => void;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const rotulo = useRotuloDoPapel();
  const [confirmando, setConfirmando] = useState(false);
  const revogado = m.revoked_at !== null;
  const nome = m.full_name ?? m.email ?? m.user_id;
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{nome}</span>
          {revogado ? <Badge variant="warning">{t("Revogado")}</Badge> : null}
        </div>
        <div className="truncate text-xs text-text-muted">
          {m.full_name && m.email ? `${m.email} · ` : ""}
          {m.last_sign_in_at
            ? `${t("Último acesso")}: ${new Date(m.last_sign_in_at).toLocaleDateString(tag)}`
            : t("Nunca acessou")}
        </div>
      </div>
      <div className="w-full sm:w-44">
        <SelectDoApp
          value={m.role}
          disabled={revogado}
          aria-label={`${t("Papel")}: ${nome}`}
          onChange={(e) => e.target.value !== m.role && onPapel(e.target.value as PapelDaEquipe)}
        >
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {rotulo(p)}
            </option>
          ))}
        </SelectDoApp>
      </div>
      <div className="flex gap-2">
        {revogado ? (
          <Button size="sm" variant="secondary" onClick={() => onRevogar(false)}>
            {t("Reativar")}
          </Button>
        ) : confirmando ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setConfirmando(false);
                onRevogar(true);
              }}
            >
              {t("Confirmar")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmando(false)}>
              {t("Cancelar")}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmando(true)}>
            {t("Revogar acesso")}
          </Button>
        )}
      </div>
    </li>
  );
}

export function EquipeDaEmpresa({ id }: { id: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const rotulo = useRotuloDoPapel();
  const { data, isLoading, isError } = useTenantTeam(id);
  const { alterar, convidar } = useTenantTeamActions(id);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<PapelDaEquipe>("agent");
  const [emitido, setEmitido] = useState<ConviteEmitido | null>(null);

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (isError || !data?.data) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center text-sm text-text-muted">
        {t("Não foi possível carregar a equipe. Tente recarregar a página.")}
      </div>
    );
  }
  const { members, invites } = data.data;

  function enviarConvite() {
    const limpo = email.trim();
    if (!limpo) return;
    convidar.mutate(
      { email: limpo, role: papel },
      {
        onSuccess: (r) => {
          setEmitido(r.data);
          setEmail("");
        },
        onError: (err) => showApiError(err),
      },
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-1 text-xs font-medium tracking-wide text-text-muted uppercase">
          {t("Pessoas")} ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="py-4 text-sm text-text-muted">{t("Ninguém na equipe ainda.")}</p>
        ) : (
          <ul>
            {members.map((m) => (
              <LinhaDoMembro
                key={m.user_id}
                m={m}
                onPapel={(p) =>
                  alterar.mutate(
                    { userId: m.user_id, corpo: { role: p } },
                    { onError: (err) => showApiError(err) },
                  )
                }
                onRevogar={(revogar) =>
                  alterar.mutate(
                    { userId: m.user_id, corpo: { revoked: revogar } },
                    {
                      onSuccess: () =>
                        toast.success(revogar ? t("Acesso revogado") : t("Acesso reativado")),
                      onError: (err) => showApiError(err),
                    },
                  )
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="mb-3 text-xs font-medium tracking-wide text-text-muted uppercase">
          {t("Convidar")}
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={email}
            placeholder="pessoa@empresa.com"
            aria-label={t("E-mail")}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviarConvite()}
          />
          <div className="sm:w-44">
            <SelectDoApp
              value={papel}
              aria-label={t("Papel")}
              onChange={(e) => setPapel(e.target.value as PapelDaEquipe)}
            >
              {PAPEIS.map((p) => (
                <option key={p} value={p}>
                  {rotulo(p)}
                </option>
              ))}
            </SelectDoApp>
          </div>
          <Button onClick={enviarConvite} disabled={convidar.isPending || !email.trim()}>
            {t("Convidar")}
          </Button>
        </div>
        {emitido ? (
          <div className="mt-3 rounded-xl bg-secondary p-3 text-xs">
            <p className="mb-1.5 font-medium">
              {emitido.email_dispatched
                ? t("Convite enviado por e-mail. O link também vale:")
                : t("O e-mail não saiu. Envie este link à pessoa:")}
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono">{emitido.accept_url}</code>
              <Button
                size="sm"
                variant="ghost"
                aria-label={t("Copiar")}
                onClick={async () =>
                  (await copyToClipboard(emitido.accept_url))
                    ? toast.success(t("Copiado"))
                    : undefined
                }
              >
                <Copy size={14} aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
        {invites.length > 0 ? (
          <div className="mt-4">
            <p className="mb-1 text-xs text-text-muted">{t("Convites pendentes")}</p>
            <ul className="text-sm">
              {invites.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-1">
                  <span className="truncate">{c.email}</span>
                  <span className="shrink-0 text-xs text-text-muted">
                    {rotulo(c.role)} · {t("vence em")}{" "}
                    {new Date(c.expires_at).toLocaleDateString(tag)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
