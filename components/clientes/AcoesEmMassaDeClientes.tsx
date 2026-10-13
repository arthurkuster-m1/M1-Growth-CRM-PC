"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
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
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

type Dialogo = "tag" | "origem" | "reativacao" | "campanha" | null;

const classeDoSelect = "h-9 w-full rounded-lg border bg-background px-2 text-sm";

/**
 * A barra de AÇÕES EM MASSA da página Clientes: aparece quando há leads selecionados.
 * Editar tags e origem de todos de uma vez e, o principal, transformar a seleção numa campanha
 * de Prospecção com objetivo de Reativação de Base — a campanha já nasce com o funil e os
 * leads dentro dele.
 */
export function AcoesEmMassaDeClientes({
  contatoIds,
  podeGerir,
  aoLimpar,
}: {
  contatoIds: string[];
  /** Criar campanha e mexer em campanha é manager+. */
  podeGerir: boolean;
  aoLimpar: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [tags, setTags] = useState("");
  const [campanhaId, setCampanhaId] = useState("");
  const [origemTexto, setOrigemTexto] = useState("");
  const [nome, setNome] = useState(
    () => `Reativação de base - ${new Date().toLocaleDateString("pt-BR")}`,
  );
  const [modelo, setModelo] = useState("");

  const campanhas = useQuery({
    queryKey: ["demand-campaigns"],
    enabled: dialogo !== null,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: { campanhas: Array<{ id: string; name: string; pipeline_id: string | null }> };
        }>("/api/v1/demand-campaigns")
      ).data.campanhas,
  });
  const modelos = useQuery({
    queryKey: ["demand-funnel-templates"],
    enabled: dialogo === "reativacao" && podeGerir,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { modelos: Array<{ id: string; name: string }> } }>(
          "/api/v1/demand-funnel-templates",
        )
      ).data.modelos,
  });

  if (contatoIds.length === 0) return null;
  const n = contatoIds.length;

  async function executar(fn: () => Promise<void>) {
    setTrabalhando(true);
    try {
      await fn();
    } catch (e) {
      showApiError(e);
    } finally {
      setTrabalhando(false);
    }
  }

  async function aplicarTags() {
    const add = tags
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (add.length === 0) return;
    await executar(async () => {
      await apiClient.post("/api/v1/clientes/lote", {
        action: "tags",
        contact_ids: contatoIds,
        add,
      });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(t("Tags aplicadas"));
      setDialogo(null);
      setTags("");
      aoLimpar();
    });
  }

  async function aplicarOrigem() {
    const corpo: Record<string, unknown> = { action: "origem", contact_ids: contatoIds };
    if (campanhaId) corpo.campaign_id = campanhaId === "__nenhuma" ? null : campanhaId;
    if (origemTexto.trim()) corpo.source = origemTexto.trim();
    if (Object.keys(corpo).length === 2) return;
    await executar(async () => {
      await apiClient.post("/api/v1/clientes/lote", corpo);
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(t("Origem atualizada"));
      setDialogo(null);
      aoLimpar();
    });
  }

  async function criarReativacao() {
    if (!nome.trim()) return;
    await executar(async () => {
      const campanha = (
        await apiClient.post<{ data: { campanha: { id: string } } }>("/api/v1/demand-campaigns", {
          name: nome.trim(),
          channel: "prospeccao",
          objective: "Reativação de base",
          status: "ativa",
        })
      ).data.campanha;
      await apiClient.post(`/api/v1/demand-campaigns/${campanha.id}/funnel`, {
        ...(modelo ? { template_id: modelo } : {}),
      });
      const r = await apiClient.post<{ data: { adicionados: number } }>(
        `/api/v1/demand-campaigns/${campanha.id}/leads-em-lote`,
        { contact_ids: contatoIds },
      );
      await queryClient.invalidateQueries();
      toast.success(`${r.data.adicionados} ${t("leads entraram no funil da nova campanha")}`);
      setDialogo(null);
      aoLimpar();
      router.push(`/app/marketing/geracao-de-demanda/campanhas/${campanha.id}`);
    });
  }

  async function colocarEmCampanha() {
    if (!campanhaId) return;
    await executar(async () => {
      const r = await apiClient.post<{ data: { adicionados: number; pulados: number } }>(
        `/api/v1/demand-campaigns/${campanhaId}/leads-em-lote`,
        { contact_ids: contatoIds },
      );
      await queryClient.invalidateQueries();
      toast.success(
        `${r.data.adicionados} ${t("leads adicionados")}${
          r.data.pulados > 0 ? ` · ${r.data.pulados} ${t("já estavam no funil")}` : ""
        }`,
      );
      setDialogo(null);
      aoLimpar();
    });
  }

  const lista = campanhas.data ?? [];
  return (
    <>
      <div
        data-lote-selecionados={n}
        className="sticky bottom-4 z-30 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-md"
      >
        <span className="text-sm font-medium">
          {n} {n === 1 ? t("selecionado") : t("selecionados")}
        </span>
        <Button size="sm" variant="outline" onClick={() => setDialogo("tag")}>
          {t("Adicionar tag")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDialogo("origem")}>
          {t("Editar origem")}
        </Button>
        {podeGerir ? (
          <>
            <Button size="sm" onClick={() => setDialogo("reativacao")}>
              {t("Criar campanha de reativação")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialogo("campanha")}>
              {t("Colocar em campanha")}
            </Button>
          </>
        ) : null}
        <Button size="sm" variant="ghost" onClick={aoLimpar}>
          {t("Limpar")}
        </Button>
      </div>

      <Dialog open={dialogo !== null} onOpenChange={(v) => (v ? null : setDialogo(null))}>
        <DialogContent>
          {dialogo === "tag" ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("Adicionar tag")}</DialogTitle>
                <DialogDescription>
                  {t("As tags entram nos")} {n}{" "}
                  {t("contatos selecionados, sem tirar as que já têm.")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-1">
                <Label>{t("Tags (separadas por vírgula)")}</Label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="reativacao, vip"
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogo(null)}>
                  {t("Cancelar")}
                </Button>
                <Button disabled={trabalhando || !tags.trim()} onClick={() => void aplicarTags()}>
                  {t("Aplicar")}
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialogo === "origem" ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("Editar origem")}</DialogTitle>
                <DialogDescription>
                  {t("Vale para o funil mais recente de cada um dos")} {n} {t("selecionados.")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <Label>{t("Campanha")}</Label>
                  <select
                    className={classeDoSelect}
                    value={campanhaId}
                    onChange={(e) => setCampanhaId(e.target.value)}
                  >
                    <option value="">{t("Não mexer")}</option>
                    <option value="__nenhuma">{t("Sem campanha")}</option>
                    {lista.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label>{t("Origem em texto")}</Label>
                  <Input
                    value={origemTexto}
                    onChange={(e) => setOrigemTexto(e.target.value)}
                    placeholder={t("deixe vazio para não mexer")}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogo(null)}>
                  {t("Cancelar")}
                </Button>
                <Button
                  disabled={trabalhando || (!campanhaId && !origemTexto.trim())}
                  onClick={() => void aplicarOrigem()}
                >
                  {t("Aplicar")}
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialogo === "reativacao" ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("Criar campanha de reativação")}</DialogTitle>
                <DialogDescription>
                  {t(
                    "Nasce uma campanha de Prospecção com objetivo Reativação de base, com o funil e os",
                  )}{" "}
                  {n} {t("leads selecionados já dentro dele.")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <Label>{t("Nome da campanha")}</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label>{t("Modelo de funil")}</Label>
                  <select
                    className={classeDoSelect}
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                  >
                    <option value="">{t("Etapas iniciais padrão")}</option>
                    {(modelos.data ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogo(null)}>
                  {t("Cancelar")}
                </Button>
                <Button
                  disabled={trabalhando || !nome.trim()}
                  onClick={() => void criarReativacao()}
                >
                  {trabalhando ? t("Criando…") : t("Criar campanha")}
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialogo === "campanha" ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("Colocar em campanha")}</DialogTitle>
                <DialogDescription>
                  {t("Os")} {n} {t("selecionados entram na primeira etapa do funil da campanha.")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-1">
                <Label>{t("Campanha")}</Label>
                <select
                  className={classeDoSelect}
                  value={campanhaId}
                  onChange={(e) => setCampanhaId(e.target.value)}
                >
                  <option value="">{t("Escolha…")}</option>
                  {lista
                    .filter((c) => c.pipeline_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogo(null)}>
                  {t("Cancelar")}
                </Button>
                <Button
                  disabled={trabalhando || !campanhaId}
                  onClick={() => void colocarEmCampanha()}
                >
                  {t("Colocar")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
