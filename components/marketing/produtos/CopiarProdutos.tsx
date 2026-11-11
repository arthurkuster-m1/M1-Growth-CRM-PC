"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

interface Cliente {
  id: string;
  name: string;
  cor: string;
}
interface ResultadoDoDestino {
  cliente_id: string;
  cliente: string;
  criados: number;
  pulados: string[];
  erro: string | null;
}

/**
 * COPIAR PRODUTOS PARA OUTROS CLIENTES: a agência escolhe um ou vários clientes e leva os produtos
 * selecionados de uma vez (muitos são iguais de um cliente para o outro). Chega como rascunho,
 * a não ser que se marque “Publicar”. Quem já tem um produto com o mesmo nome o mantém: o
 * repetido é pulado e listado.
 */
export function CopiarProdutos({
  aberto,
  aoFechar,
  keys,
  modulo,
}: {
  aberto: boolean;
  aoFechar: () => void;
  keys: string[];
  modulo: string;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [escolhidos, setEscolhidos] = useState<Set<string>>(() => new Set());
  const [publicar, setPublicar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoDoDestino[] | null>(null);

  const clientes = useQuery({
    queryKey: ["marketing-ofertas-clientes"],
    enabled: aberto,
    staleTime: 60_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { clientes: Cliente[] } }>("/api/v1/marketing/ofertas/clientes"))
        .data.clientes,
  });
  const lista = clientes.data ?? [];

  const alternar = (id: string) =>
    setEscolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  async function copiar() {
    setEnviando(true);
    try {
      const r = await apiClient.post<{ data: { resultados: ResultadoDoDestino[] } }>(
        "/api/v1/marketing/ofertas/copiar",
        { keys, destinos: [...escolhidos], publicar },
      );
      setResultados(r.data.resultados);
      await queryClient.invalidateQueries({ queryKey: ["marketing-subpaginas", modulo] });
    } catch (e) {
      showApiError(e);
    } finally {
      setEnviando(false);
    }
  }

  function fechar() {
    setEscolhidos(new Set());
    setResultados(null);
    setPublicar(false);
    aoFechar();
  }

  const n = keys.length;
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && fechar()}>
      <DialogContent className="max-h-[88dvh] max-w-lg gap-4 overflow-y-auto p-5 sm:rounded-2xl">
        <DialogTitle className="text-base font-semibold">
          {t("Copiar para outros clientes")}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {n} {n === 1 ? t("produto selecionado") : t("produtos selecionados")}.{" "}
          {t(
            "Quem já tem um produto com o mesmo nome fica como está: o repetido é pulado, então copiar de novo não duplica.",
          )}
        </DialogDescription>

        {resultados ? (
          <div className="grid gap-2 text-sm" data-testid="resultado-da-copia">
            {resultados.map((r) => (
              <div
                key={r.cliente_id}
                className={
                  r.erro
                    ? "rounded-xl bg-error-bg px-3 py-2 text-error-fg"
                    : "rounded-xl bg-secondary/60 px-3 py-2"
                }
              >
                <p className="font-medium">{r.cliente}</p>
                <p className="text-xs">
                  {r.erro ??
                    `${r.criados} ${t("copiados")}${
                      r.pulados.length > 0
                        ? ` · ${r.pulados.length} ${t("já existiam e foram pulados")}`
                        : ""
                    }`}
                </p>
                {r.pulados.length > 0 ? (
                  <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                    {r.pulados.slice(0, 5).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                    {r.pulados.length > 5 ? <li>…</li> : null}
                  </ul>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={fechar}
              className="h-10 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
            >
              {t("Concluir")}
            </button>
          </div>
        ) : (
          <>
            {clientes.isLoading ? (
              <div className="h-24 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />
            ) : lista.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                {t("Você não gerencia outros clientes além deste.")}
              </p>
            ) : (
              <div className="grid gap-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {escolhidos.size} {t("de")} {lista.length} {t("clientes")}
                  </span>
                  <button
                    type="button"
                    className="underline"
                    onClick={() =>
                      setEscolhidos(
                        escolhidos.size === lista.length
                          ? new Set()
                          : new Set(lista.map((c) => c.id)),
                      )
                    }
                  >
                    {escolhidos.size === lista.length ? t("Limpar") : t("Selecionar todos")}
                  </button>
                </div>
                <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-2xl border p-1.5">
                  {lista.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm hover:bg-secondary">
                        <input
                          type="checkbox"
                          checked={escolhidos.has(c.id)}
                          onChange={() => alternar(c.id)}
                        />
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: c.cor }}
                        />
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={publicar}
                onChange={(e) => setPublicar(e.target.checked)}
                className="mt-1"
              />
              <span>
                {t("Publicar ao copiar")}
                <span className="block text-xs text-muted-foreground">
                  {t(
                    "A IA do cliente passa a enxergar estes produtos e preços na hora. Desmarcado, eles chegam em rascunho para revisar.",
                  )}
                </span>
              </span>
            </label>
            <button
              type="button"
              disabled={enviando || escolhidos.size === 0}
              onClick={() => void copiar()}
              className="h-10 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {enviando
                ? t("Copiando…")
                : `${t("Copiar para")} ${escolhidos.size} ${escolhidos.size === 1 ? t("cliente") : t("clientes")}`}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
