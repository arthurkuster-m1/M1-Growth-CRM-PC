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
import { RegistrarAcaoEmMassaDialog } from "@/components/clientes/RegistrarAcaoEmMassaDialog";
import { SeletorDeTagsEmMassa } from "@/components/clientes/SeletorDeTagsEmMassa";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

type Dialogo = "tag" | "campanha" | "excluir" | "acao" | null;

const classeDoSelect = "h-9 w-full rounded-lg border bg-background px-2 text-sm";
const NOVA = "__nova";

/**
 * A barra de AÇÕES EM MASSA da página CRM: aparece quando há leads selecionados.
 * Adicionar tags (no jeito da ficha do lead), colocar a seleção numa campanha (uma que já existe ou
 * uma nova de Reativação de base, que nasce com o funil e os leads dentro) e excluir.
 */
export function AcoesEmMassaDeClientes({
  contatoIds,
  podeGerir,
  aoLimpar,
  tagsExistentes = [],
}: {
  contatoIds: string[];
  /** As tags que já existem na base (para escolher em vez de digitar). */
  tagsExistentes?: readonly string[];
  /** Criar campanha e mexer em campanha é manager+. */
  podeGerir: boolean;
  aoLimpar: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [campanhaId, setCampanhaId] = useState("");
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
    enabled: dialogo === "campanha" && podeGerir && campanhaId === NOVA,
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
    const add = tags;
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
      setTags([]);
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

  async function excluirSelecionados() {
    await executar(async () => {
      const r = await apiClient.post<{
        data: { excluidos: number; falhas: Array<{ contact_id: string; motivo: string }> };
      }>("/api/v1/clientes/lote", { action: "excluir", contact_ids: contatoIds });
      await queryClient.invalidateQueries();
      const { excluidos, falhas } = r.data;
      if (excluidos > 0) toast.success(`${excluidos} ${t("leads excluídos")}`);
      if (falhas.length > 0) {
        toast.error(
          `${falhas.length} ${t("não puderam ser excluídos")}: ${falhas[0]!.motivo}`,
        );
      }
      setDialogo(null);
      aoLimpar();
    });
  }

  const lista = campanhas.data ?? [];
  return (
    <>
      <div
        data-lote-selecionados={n}
        className="fixed bottom-20 left-1/2 z-40 flex w-fit max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg md:bottom-6"
      >
        <span className="text-sm font-medium">
          {n} {n === 1 ? t("selecionado") : t("selecionados")}
        </span>
        <Button size="sm" variant="outline" onClick={() => setDialogo("tag")}>
          {t("Adicionar tag")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDialogo("acao")}>
          {t("Registrar ação")}
        </Button>
        {podeGerir ? (
          <Button size="sm" onClick={() => setDialogo("campanha")}>
            {t("Adicionar em uma nova campanha")}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          className="text-error-fg hover:text-error-fg"
          onClick={() => setDialogo("excluir")}
        >
          {t("Excluir")}
        </Button>
        <Button size="sm" variant="ghost" onClick={aoLimpar}>
          {t("Limpar")}
        </Button>
      </div>

      <RegistrarAcaoEmMassaDialog
        contatoIds={contatoIds}
        aberto={dialogo === "acao"}
        aoFechar={() => setDialogo(null)}
        aoConcluir={aoLimpar}
      />

      <Dialog
        open={dialogo !== null && dialogo !== "acao"}
        onOpenChange={(v) => (v ? null : setDialogo(null))}
      >
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
              <SeletorDeTagsEmMassa
                existentes={tagsExistentes}
                escolhidas={tags}
                aoMudar={setTags}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogo(null)}>
                  {t("Cancelar")}
                </Button>
                <Button disabled={trabalhando || tags.length === 0} onClick={() => void aplicarTags()}>
                  {t("Aplicar")}
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialogo === "campanha" ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("Adicionar em uma nova campanha")}</DialogTitle>
                <DialogDescription>
                  {t("Os")} {n} {t("selecionados entram na primeira etapa do funil da campanha.")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid max-h-80 gap-1.5 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setCampanhaId(NOVA)}
                  className={`rounded-xl border-[1.5px] px-3 py-2.5 text-left text-sm font-medium ${
                    campanhaId === NOVA ? "border-primary bg-primary/10" : "hover:bg-secondary"
                  }`}
                >
                  + {t("Criar uma nova campanha de reativação")}
                </button>
                {lista
                  .filter((c) => c.pipeline_id)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCampanhaId(c.id)}
                      className={`truncate rounded-xl border-[1.5px] px-3 py-2.5 text-left text-sm ${
                        campanhaId === c.id ? "border-primary bg-primary/10" : "hover:bg-secondary"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                {campanhas.isLoading ? (
                  <p className="px-1 text-sm text-muted-foreground">{t("Carregando campanhas…")}</p>
                ) : null}
              </div>
              {campanhaId === NOVA ? (
                <div className="grid gap-3 rounded-xl bg-secondary/50 p-3">
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
              ) : null}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogo(null)}>
                  {t("Cancelar")}
                </Button>
                <Button
                  disabled={
                    trabalhando || !campanhaId || (campanhaId === NOVA && !nome.trim())
                  }
                  onClick={() =>
                    void (campanhaId === NOVA ? criarReativacao() : colocarEmCampanha())
                  }
                >
                  {trabalhando
                    ? t("Adicionando…")
                    : campanhaId === NOVA
                      ? t("Criar campanha e adicionar")
                      : t("Adicionar")}
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialogo === "excluir" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t("Excluir")} {n} {n === 1 ? t("lead") : t("leads")}?
                </DialogTitle>
                <DialogDescription>
                  {t(
                    "Isso não pode ser desfeito. Leads com registros vinculados que impedem a exclusão ficam na lista e são avisados.",
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogo(null)}>
                  {t("Cancelar")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={trabalhando}
                  onClick={() => void excluirSelecionados()}
                >
                  {trabalhando ? t("Excluindo…") : t("Excluir")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
