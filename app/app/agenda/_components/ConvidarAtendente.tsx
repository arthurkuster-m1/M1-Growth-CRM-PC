"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { useInviteMembers } from "@/hooks/team/useInviteMembers";
import { useT } from "@/hooks/i18n/useT";
import { UserPlus } from "@/lib/ui/icons";

import { descreverMotivoDaFalha } from "@/app/app/team/invite/_components/motivo-da-falha";

/**
 * "Adicionar atendente": convida a pessoa para a equipe sem sair da Agenda. Ela recebe o e-mail de
 * convite; ao aceitar, entra na equipe e aparece na tabela de atendentes para marcar os tipos.
 */
export function ConvidarAtendente() {
  const t = useT();
  const qc = useQueryClient();
  const [aberto, setAberto] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [papel, setPapel] = React.useState<"agent" | "manager">("agent");
  const convidar = useInviteMembers();

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpo)) {
      toast.error(t("Escreva um e-mail válido."));
      return;
    }
    try {
      const r = await convidar.mutateAsync({ invitations: [{ email: limpo, role: papel }] });
      const falha = r.data.failed[0];
      if (falha) {
        toast.error(descreverMotivoDaFalha(falha.reason));
        return;
      }
      const enviado = r.data.sent[0];
      toast.success(
        enviado?.email_dispatched
          ? t("Convite enviado. Quando a pessoa aceitar, ela aparece na tabela de atendentes.")
          : t("Convite criado, mas o e-mail não saiu. Peça para a pessoa entrar pelo link em Equipe › Convites."),
      );
      setEmail("");
      setAberto(false);
      void qc.invalidateQueries({ queryKey: ["agenda"] });
    } catch {
      // `useInviteMembers` já mostra o erro
    }
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => setAberto(true)} data-testid="adicionar-atendente">
        <UserPlus size={16} weight="bold" aria-hidden />
        {t("Adicionar atendente")}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:rounded-3xl">
          <DialogTitle>{t("Adicionar atendente")}</DialogTitle>
          <DialogDescription>
            {t("Entra na equipe e recebe o convite por e-mail. Depois de aceitar, marque os tipos de atendimento dela na tabela.")}
          </DialogDescription>
          <form onSubmit={enviar} className="grid gap-4">
            <label className="grid gap-1 text-sm font-medium">
              {t("E-mail")}
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
                className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-normal"
              />
            </label>
            <div className="grid gap-1">
              <p className="text-sm font-medium">{t("Papel na equipe")}</p>
              <SeletorEmPopup
                rotulo={t("Papel na equipe")}
                valor={papel}
                opcoes={[
                  { id: "agent", rotulo: t("Atendente") },
                  { id: "manager", rotulo: t("Gerente") },
                ]}
                aoEscolher={(id) => setPapel(id === "manager" ? "manager" : "agent")}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setAberto(false)}>
                {t("Cancelar")}
              </Button>
              <Button type="submit" className="rounded-xl" disabled={convidar.isPending}>
                {convidar.isPending ? t("Enviando…") : t("Enviar convite")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
