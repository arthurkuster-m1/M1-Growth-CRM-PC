"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useConfirmar } from "@/components/marketing/campanhas/useConfirmar";
import { Button } from "@/components/ui/button";
import { CaixaRedonda } from "@/components/ui/CaixaRedonda";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectDoApp } from "@/components/ui/SelectDoApp";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { FORMATOS_DO_CRIATIVO, type Criativo } from "@/lib/marketing/criativos";
import { rotuloDoFormato } from "@/components/marketing/campanhas/rotulos";
import { criativoDoModelo, type ModeloDeCriativo } from "@/lib/marketing/modelos-de-criativo";
import { Plus, Trash } from "@/lib/ui/icons";

const CHAVE = ["demand-creative-templates"] as const;
const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20";
const AREA =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

export function useModelosDeCriativo() {
  const q = useQuery({
    queryKey: CHAVE,
    staleTime: 30_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { modelos: ModeloDeCriativo[] } }>(
          "/api/v1/demand-creative-templates",
        )
      ).data.modelos,
  });
  return { modelos: q.data ?? [], carregando: q.isLoading };
}

/** Até 5 textos (como no anúncio dinâmico do Meta): um campo por variação, com "+" e lixeira. */
function ListaDeTextos({
  titulo,
  valores,
  aoMudar,
  longo,
  max,
}: {
  titulo: string;
  valores: string[];
  aoMudar: (v: string[]) => void;
  longo?: boolean;
  max: number;
}) {
  const t = useT();
  const itens = valores.length > 0 ? valores : [""];
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        {titulo} ({valores.filter((v) => v.trim()).length}/5)
      </p>
      {itens.map((v, i) => (
        <div key={i} className="flex items-start gap-1.5">
          {longo ? (
            <textarea
              rows={4}
              value={v}
              maxLength={max}
              aria-label={`${titulo} ${i + 1}`}
              onChange={(e) => aoMudar(itens.map((x, k) => (k === i ? e.target.value : x)))}
              className={AREA}
            />
          ) : (
            <Input
              value={v}
              maxLength={max}
              aria-label={`${titulo} ${i + 1}`}
              onChange={(e) => aoMudar(itens.map((x, k) => (k === i ? e.target.value : x)))}
            />
          )}
          {itens.length > 1 ? (
            <button
              type="button"
              aria-label={t("Tirar")}
              onClick={() => aoMudar(itens.filter((_, k) => k !== i))}
              className="grid h-10 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
            >
              <Trash size={14} aria-hidden />
            </button>
          ) : null}
        </div>
      ))}
      {itens.length < 5 ? (
        <button
          type="button"
          onClick={() => aoMudar([...itens, ""])}
          className="inline-flex h-8 w-fit items-center gap-1 rounded-lg border border-dashed px-2.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus size={12} weight="bold" aria-hidden />
          {t("Adicionar variação")}
        </button>
      ) : null}
    </div>
  );
}

const VAZIO: Omit<ModeloDeCriativo, "id" | "position"> = {
  name: "",
  tag: "TROCACITY",
  format: "imagem",
  headlines: [""],
  bodies: [""],
  descriptions: [""],
  link_url: "",
  design_url: "",
  notes: "",
};

/**
 * Os MODELOS de criativo: o criativo pronto (5 legendas, 5 títulos, 5 descrições, link e design)
 * com uma TAG que se troca pela cidade na hora de criar. Vale para a empresa toda.
 */
export function ModelosDeCriativoDialog({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const { modelos } = useModelosDeCriativo();
  const { confirmar, dialogo } = useConfirmar();
  const [escolhido, setEscolhido] = useState<string | "novo" | null>(null);
  const [form, setForm] = useState<Omit<ModeloDeCriativo, "id" | "position">>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    if (escolhido === null) setEscolhido(modelos[0]?.id ?? "novo");
  }, [aberto, escolhido, modelos]);
  useEffect(() => {
    if (escolhido === "novo" || escolhido === null) {
      setForm(VAZIO);
      return;
    }
    const m = modelos.find((x) => x.id === escolhido);
    if (m) {
      setForm({
        name: m.name,
        tag: m.tag,
        format: m.format,
        headlines: m.headlines.length ? m.headlines : [""],
        bodies: m.bodies.length ? m.bodies : [""],
        descriptions: m.descriptions.length ? m.descriptions : [""],
        link_url: m.link_url,
        design_url: m.design_url,
        notes: m.notes,
      });
    }
  }, [escolhido, modelos]);

  const limpar = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);
  async function salvar() {
    if (!form.name.trim() || form.tag.trim().length < 2) return;
    setSalvando(true);
    try {
      const corpo = {
        ...form,
        name: form.name.trim(),
        tag: form.tag.trim(),
        headlines: limpar(form.headlines),
        bodies: limpar(form.bodies),
        descriptions: limpar(form.descriptions),
      };
      if (escolhido === "novo" || escolhido === null) {
        const r = await apiClient.post<{ data: { modelo: ModeloDeCriativo } }>(
          "/api/v1/demand-creative-templates",
          corpo,
        );
        setEscolhido(r.data.modelo.id);
      } else {
        await apiClient.patch(`/api/v1/demand-creative-templates/${escolhido}`, corpo);
      }
      await qc.invalidateQueries({ queryKey: CHAVE });
    } catch (e) {
      showApiError(e);
    } finally {
      setSalvando(false);
    }
  }
  async function apagar() {
    if (escolhido === null || escolhido === "novo") return;
    if (
      !(await confirmar(
        t("Apagar este modelo? Os criativos já criados com ele não mudam."),
        t("Apagar"),
      ))
    )
      return;
    try {
      await apiClient.delete(`/api/v1/demand-creative-templates/${escolhido}`);
      setEscolhido(null);
      await qc.invalidateQueries({ queryKey: CHAVE });
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <>
      {dialogo}
      <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-4xl gap-3 overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogTitle className="text-base font-semibold">{t("Modelos de criativo")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t(
              "Monte o criativo uma vez, com a tag no lugar do que muda (a cidade, por exemplo). Ao criar a partir do modelo, a tag é trocada em todos os textos.",
            )}
          </DialogDescription>
          <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
            <div className="grid content-start gap-1.5">
              {modelos.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setEscolhido(m.id)}
                  className={`truncate rounded-xl border px-3 py-2 text-left text-sm ${
                    escolhido === m.id
                      ? "border-primary bg-primary/10 font-medium"
                      : "hover:bg-secondary"
                  }`}
                >
                  {m.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEscolhido("novo")}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-dashed px-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus size={14} weight="bold" aria-hidden />
                {t("Novo modelo")}
              </button>
            </div>
            <div className="grid min-w-0 gap-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_10rem_9rem]">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  {t("Nome (com a tag)")}
                  <input
                    className={CAMPO}
                    value={form.name}
                    maxLength={160}
                    placeholder="FEM01 - TROCACITY"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  {t("Tag a trocar")}
                  <input
                    className={CAMPO}
                    value={form.tag}
                    maxLength={40}
                    onChange={(e) => setForm({ ...form, tag: e.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  {t("Formato")}
                  <SelectDoApp
                    className={CAMPO}
                    value={form.format}
                    onChange={(e) =>
                      setForm({ ...form, format: e.target.value as Criativo["format"] })
                    }
                  >
                    {FORMATOS_DO_CRIATIVO.map((f) => (
                      <option key={f} value={f}>
                        {rotuloDoFormato(t, f)}
                      </option>
                    ))}
                  </SelectDoApp>
                </label>
              </div>
              <ListaDeTextos
                titulo={t("Textos principais (legendas)")}
                valores={form.bodies}
                aoMudar={(bodies) => setForm({ ...form, bodies })}
                longo
                max={4000}
              />
              <ListaDeTextos
                titulo={t("Títulos")}
                valores={form.headlines}
                aoMudar={(headlines) => setForm({ ...form, headlines })}
                max={300}
              />
              <ListaDeTextos
                titulo={t("Descrições")}
                valores={form.descriptions}
                aoMudar={(descriptions) => setForm({ ...form, descriptions })}
                max={1000}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  {t("Design pronto (link do Canva)")}
                  <input
                    className={CAMPO}
                    value={form.design_url}
                    maxLength={1000}
                    placeholder="https://www.canva.com/design/…"
                    onChange={(e) => setForm({ ...form, design_url: e.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  {t("Link de destino")}
                  <input
                    className={CAMPO}
                    value={form.link_url}
                    maxLength={1000}
                    placeholder="https://…"
                    onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={salvando || !form.name.trim() || form.tag.trim().length < 2}
                  onClick={() => void salvar()}
                >
                  {escolhido === "novo" || escolhido === null
                    ? t("Criar modelo")
                    : t("Salvar modelo")}
                </Button>
                {escolhido !== "novo" && escolhido !== null ? (
                  <button
                    type="button"
                    onClick={() => void apagar()}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-error-fg hover:bg-error-bg"
                  >
                    <Trash size={14} aria-hidden />
                    {t("Apagar modelo")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Escolher modelos e a cidade: cria os criativos PLANEJADOS com a tag já trocada. */
export function CriarDoModeloDialog({
  aberto,
  aoFechar,
  campanhaId,
  aoCriar,
  aoGerenciar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  campanhaId: string;
  aoCriar: () => void;
  aoGerenciar: () => void;
}) {
  const t = useT();
  const { modelos, carregando } = useModelosDeCriativo();
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [valor, setValor] = useState("");
  const [criando, setCriando] = useState(false);
  const exemplo = modelos.find((m) => marcados.has(m.id));

  async function criar() {
    if (marcados.size === 0 || !valor.trim()) return;
    setCriando(true);
    try {
      await apiClient.post(`/api/v1/demand-campaigns/${campanhaId}/creatives/from-template`, {
        template_ids: modelos.filter((m) => marcados.has(m.id)).map((m) => m.id),
        valor: valor.trim(),
      });
      setMarcados(new Set());
      setValor("");
      aoCriar();
      aoFechar();
    } catch (e) {
      showApiError(e);
    } finally {
      setCriando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-xl gap-3 overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogTitle className="text-base font-semibold">
          {t("Criar a partir de modelos")}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t(
            "Os criativos nascem como planejados, com o nome que vai para o Meta. Quando você importar do Meta, o anúncio de mesmo nome completa o mesmo card.",
          )}
        </DialogDescription>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          {t("Valor no lugar da tag (ex.: a cidade)")}
          <input
            className={CAMPO}
            value={valor}
            maxLength={80}
            autoFocus
            placeholder="Nova Iguaçu"
            onChange={(e) => setValor(e.target.value)}
          />
        </label>
        <div className="grid gap-1">
          <p className="text-xs font-medium text-muted-foreground">{t("Modelos")}</p>
          {carregando ? (
            <div className="h-16 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
          ) : modelos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Nenhum modelo ainda.")}</p>
          ) : (
            modelos.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-secondary"
              >
                <CaixaRedonda
                  checked={marcados.has(m.id)}
                  onChange={(e) =>
                    setMarcados((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(m.id);
                      else n.delete(m.id);
                      return n;
                    })
                  }
                />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
              </label>
            ))
          )}
        </div>
        {exemplo && valor.trim() ? (
          <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            {t("Vai criar")}:{" "}
            <strong className="text-foreground">
              {criativoDoModelo(exemplo, valor.trim()).name}
            </strong>
            {marcados.size > 1 ? ` + ${marcados.size - 1}` : ""}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={criando || marcados.size === 0 || !valor.trim()}
            onClick={() => void criar()}
          >
            {t("Criar criativos")}
          </Button>
          <button
            type="button"
            onClick={aoGerenciar}
            className="h-10 rounded-xl px-3 text-sm font-medium text-primary hover:bg-secondary"
          >
            {t("Gerenciar modelos")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
