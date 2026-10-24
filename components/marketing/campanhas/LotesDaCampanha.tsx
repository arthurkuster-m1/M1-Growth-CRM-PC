"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Etiqueta } from "@/components/motor/Etiqueta";
import { useConfirmar } from "@/components/marketing/campanhas/useConfirmar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ROLE_RANK } from "@/lib/auth/types";
import { randomId } from "@/lib/random-id";
import { rendimentoDaBusca } from "@/lib/prospecting/repetir";
import type { LoteDaCampanha } from "@/lib/marketing/lotes";
import { ArrowsClockwise, FileText, MagnifyingGlass } from "@/lib/ui/icons";

export const chaveDosLotes = (campanhaId: string) => ["campanha-lotes", campanhaId] as const;

const usd = { format: (n: number) => `US$ ${n.toFixed(2).replace(".", ",")}` };

/**
 * O REGISTRO da campanha: toda extração de leads e toda importação de planilha, do mais novo ao
 * mais antigo, com a data, os termos e a cidade (ou o arquivo) e o que cada uma trouxe.
 */
export function LotesDaCampanha({ campanhaId }: { campanhaId: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const { activeOrg } = useAuth();
  // Rodar a busca de novo gasta dinheiro do provedor: é da administração, como a extração.
  const podeRepetir = activeOrg ? ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin : false;
  const { confirmar, dialogo } = useConfirmar();
  const [repetindo, setRepetindo] = useState<string | null>(null);

  async function repetir(l: LoteDaCampanha) {
    const r = rendimentoDaBusca(l.novos, l.repetidos);
    const aviso =
      r.percentualNovo === null
        ? ""
        : ` ${t("Da última vez")}: ${l.novos + l.repetidos} ${t("encontradas")}, ${r.percentualNovo}% ${t("eram novas")}.${
            r.esgotada
              ? ` ${t("Quase tudo já estava na lista — repetir tende a pagar por pouco. Tente outro bairro ou termo.")}`
              : ""
          }`;
    const teto = l.teto_usd === null ? "" : ` ${t("Gasto máximo")}: ${usd.format(l.teto_usd)}.`;
    const ok = await confirmar(
      `${t("Rodar de novo")} “${l.termos}”${l.cidade ? ` ${t("em")} ${l.cidade}` : ""}? ${t("As empresas que já estão na lista entram como repetidas; só as novas vão para a fila, mas o provedor cobra por tudo o que devolve.")}${aviso}${teto}`,
      t("Repetir extração"),
    );
    if (!ok) return;
    setRepetindo(l.id);
    try {
      await apiClient.post("/api/v1/prospecting", {
        action: "repeat_search",
        id: l.id,
        request_id: randomId(),
      });
      toast.success(t("Extração repetida. Acompanhe o resultado aqui."));
      await qc.invalidateQueries({ queryKey: chaveDosLotes(campanhaId) });
      await qc.invalidateQueries({ queryKey: ["prospecting"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Não foi possível repetir a extração."));
    } finally {
      setRepetindo(null);
    }
  }
  const q = useQuery({
    queryKey: chaveDosLotes(campanhaId),
    staleTime: 15_000,
    // Uma busca em andamento muda sozinha: reconsulta enquanto houver alguma rodando.
    refetchInterval: (consulta) =>
      (consulta.state.data ?? []).some((l) => l.estado === "starting" || l.estado === "running")
        ? 8000
        : false,
    queryFn: async () =>
      (
        await apiClient.get<{ data: LoteDaCampanha[] }>(
          `/api/v1/demand-campaigns/${campanhaId}/lotes`,
        )
      ).data,
  });
  const lotes = q.data ?? [];
  const quando = (iso: string) =>
    new Date(iso).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" });

  return (
    <Card className="grid gap-3 rounded-2xl p-5">
      {dialogo}
      <header>
        <h2 className="text-base font-semibold">{t("Extrações e importações")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("Tudo o que entrou nesta campanha: quando, com quais termos e o que trouxe.")}
        </p>
      </header>

      {q.isLoading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : lotes.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {t("Nada por aqui ainda. Faça uma extração ou importe uma planilha.")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">{t("Quando")}</th>
                <th className="px-3 py-2 font-medium">{t("Tipo")}</th>
                <th className="px-3 py-2 font-medium">{t("Termos / arquivo")}</th>
                <th className="px-3 py-2 font-medium">{t("Cidade")}</th>
                <th className="px-3 py-2 font-medium">{t("Resultado")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("Custo")}</th>
                <th className="py-2 pl-3" aria-label={t("Ações")} />
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={`${l.tipo}-${l.id}`} className="border-b last:border-0">
                  <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums">{quando(l.em)}</td>
                  <td className="px-3 py-2.5">
                    {l.tipo === "extracao" ? (
                      <Etiqueta cor={l.modo === "volume" ? "orange" : "blue"}>
                        <MagnifyingGlass size={12} aria-hidden />
                        {l.modo === "volume" ? t("Extração · volume") : t("Extração · Apify")}
                      </Etiqueta>
                    ) : (
                      <Etiqueta cor="green">
                        <FileText size={12} aria-hidden />
                        {t("Importação")}
                      </Etiqueta>
                    )}
                  </td>
                  <td className="max-w-56 truncate px-3 py-2.5 font-medium" title={l.termos}>
                    {l.termos || "—"}
                  </td>
                  <td className="px-3 py-2.5">{l.cidade ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{resultado(l, t)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {l.custo_usd === null ? "—" : usd.format(l.custo_usd)}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    {l.tipo === "extracao" &&
                    podeRepetir &&
                    l.estado !== "starting" &&
                    l.estado !== "running" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={repetindo === l.id}
                        onClick={() => void repetir(l)}
                      >
                        <ArrowsClockwise size={12} aria-hidden />
                        {repetindo === l.id ? t("Repetindo…") : t("Repetir")}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {q.isFetching && !q.isLoading ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowsClockwise size={12} aria-hidden /> {t("Atualizando…")}
        </p>
      ) : null}
    </Card>
  );
}

function resultado(l: LoteDaCampanha, t: (s: string) => string): string {
  if (l.tipo === "importacao") {
    return [
      `${l.linhas ?? 0} ${t("linhas")}`,
      `${l.novos} ${t("negócios criados")}`,
      l.repetidos > 0 ? `${l.repetidos} ${t("já no CRM")}` : null,
      l.invalidos > 0 ? `${l.invalidos} ${t("recusadas")}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (l.estado === "failed") return t("A busca falhou");
  if (l.estado !== "succeeded") return t("Buscando…");
  return `${l.novos + l.repetidos} ${t("encontradas")} · ${l.novos} ${t("novas")}${
    l.repetidos > 0 ? ` · ${l.repetidos} ${t("repetidas ou descartadas")}` : ""
  }`;
}
