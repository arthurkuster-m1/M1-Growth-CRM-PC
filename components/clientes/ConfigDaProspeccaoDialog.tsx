"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  propriedadesDoTipo,
  PROPRIEDADES_DA_PROSPECCAO,
  TIPOS_DE_PROSPECCAO,
  resultadosPadraoDoTipo,
  type ConfigDaProspeccao,
  type ResultadoDaProspeccao,
  type PropriedadeDaProspeccao,
  type TipoDeProspeccao,
} from "@/lib/leads/config-de-prospeccao";

export interface AbordagemDaLista {
  id: string;
  name: string;
  medium: string;
  hook: string;
  script: string;
  follow_up: string;
  status: string;
  campaign_id: string;
}

/** As abordagens ativas das campanhas citadas (para escolher e para mostrar no modo prospecção). */
export function useAbordagensDasCampanhas(campanhaIds: readonly string[]) {
  const chave = [...new Set(campanhaIds)].sort().slice(0, 12);
  return useQuery({
    queryKey: ["abordagens-da-prospeccao", chave],
    enabled: chave.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const listas = await Promise.all(
        chave.map(async (id) => {
          try {
            const r = await apiClient.get<{ data: { abordagens: AbordagemDaLista[] } }>(
              `/api/v1/demand-campaigns/${id}/approaches`,
            );
            return r.data.abordagens.filter((a) => a.status === "ativo");
          } catch {
            return [] as AbordagemDaLista[];
          }
        }),
      );
      return listas.flat();
    },
  });
}

const sel =
  "h-9 w-24 rounded-lg border bg-background px-2 text-right text-sm tabular-nums outline-hidden focus:border-primary/60";

/**
 * A ENGRENAGEM da prospecção: monta a fila "Ligar hoje" do seu jeito e define como o modo
 * prospecção funciona (quantos leads, qual abordagem, o tipo, as propriedades e os atalhos).
 */
export function ConfigDaProspeccaoDialog({
  config,
  campanhaIds,
  nomeDaCampanha,
  aoSalvar,
  aoFechar,
}: {
  config: ConfigDaProspeccao;
  campanhaIds: readonly string[];
  nomeDaCampanha: (id: string) => string;
  aoSalvar: (c: ConfigDaProspeccao) => void;
  aoFechar: () => void;
}) {
  const t = useT();
  const [c, setC] = useState<ConfigDaProspeccao>(config);
  const abordagens = useAbordagensDasCampanhas(campanhaIds);

  const rotuloDoTipo: Record<TipoDeProspeccao, string> = {
    ligacao: t("Ligação"),
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    outro: t("Outro (tudo)"),
  };
  const rotuloDaPropriedade: Record<PropriedadeDaProspeccao, string> = {
    telefone: t("Telefone"),
    ligar: t("Botão de ligação"),
    whatsapp: t("Botão do WhatsApp"),
    instagram: t("Botão do Instagram"),
    inbox: t("Botão do Inbox"),
    ficha: t("Botão da ficha do lead"),
    tentativas: t("Tentativas"),
    melhorHorario: t("Melhor horário para ligar"),
    proximaAcao: t("Próxima ação"),
    comentarios: t("Comentários"),
  };

  const lista = c.resultadosPorTipo[c.tipo] ?? [];
  const setLista = (nova: ResultadoDaProspeccao[]) =>
    setC({ ...c, resultadosPorTipo: { ...c.resultadosPorTipo, [c.tipo]: nova } });
  const mudar = (i: number, parte: Partial<ResultadoDaProspeccao>) =>
    setLista(lista.map((r, k) => (k === i ? { ...r, ...parte } : r)));
  const remover = (i: number) => setLista(lista.filter((_, k) => k !== i));
  const mover = (i: number, d: -1 | 1) => {
    const nova = lista.slice();
    const [item] = nova.splice(i, 1);
    nova.splice(i + d, 0, item!);
    setLista(nova);
  };

  const caixa = (rotulo: string, valor: boolean, aoMudar: (v: boolean) => void) => (
    <label key={rotulo} className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={valor} onChange={(e) => aoMudar(e.target.checked)} />
      {rotulo}
    </label>
  );

  return (
    <Dialog open onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl gap-4 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Configurar a prospecção")}</DialogTitle>
          <DialogDescription>
            {t("Vale só para você, neste navegador. O modo prospecção sempre abre a lista que está filtrada na tela.")}
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-2 rounded-xl border p-3">
          <h3 className="text-sm font-semibold">{t("Ligar hoje — quem entra na fila")}</h3>
          {caixa(t("Próxima ação vencida ou marcada para hoje"), c.fila.vencidas, (v) =>
            setC({ ...c, fila: { ...c.fila, vencidas: v } }),
          )}
          <div className="flex flex-wrap items-center gap-2">
            {caixa(t("Sem data marcada e sem resposta há mais de"), c.fila.semResposta, (v) =>
              setC({ ...c, fila: { ...c.fila, semResposta: v } }),
            )}
            <input
              type="number"
              min={1}
              max={720}
              value={c.fila.horasSemResposta}
              onChange={(e) =>
                setC({
                  ...c,
                  fila: { ...c.fila, horasSemResposta: Math.max(1, Number(e.target.value) || 24) },
                })
              }
              className={sel}
              aria-label={t("Horas sem resposta")}
            />
            <span className="text-sm text-muted-foreground">{t("horas")}</span>
          </div>
          {caixa(t("Oportunidade aberta sem nenhuma próxima ação escrita"), c.fila.semProximaAcao, (v) =>
            setC({ ...c, fila: { ...c.fila, semProximaAcao: v } }),
          )}
        </section>

        <section className="grid gap-3 rounded-xl border p-3">
          <h3 className="text-sm font-semibold">{t("Modo prospecção")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("Quantos leads nesta sessão (0 = a lista toda)")}
              <input
                type="number"
                min={0}
                max={500}
                value={c.quantidade}
                onChange={(e) => setC({ ...c, quantidade: Math.max(0, Number(e.target.value) || 0) })}
                className={sel + " w-full text-left"}
              />
            </label>
            <div className="grid gap-1 text-xs text-muted-foreground">
              {t("Tipo de prospecção")}
              <SeletorEmPopup
                rotulo={t("Tipo de prospecção")}
                valor={c.tipo}
                opcoes={TIPOS_DE_PROSPECCAO.map((x) => ({ id: x, rotulo: rotuloDoTipo[x] }))}
                // Trocar o tipo já ajusta as propriedades; depois dá para refinar uma a uma.
                aoEscolher={(v) =>
                  setC({ ...c, tipo: v as TipoDeProspeccao, propriedades: propriedadesDoTipo(v as TipoDeProspeccao) })
                }
                className="min-h-9 rounded-lg"
              />
            </div>
          </div>
          <div className="grid gap-1 text-xs text-muted-foreground">
            {t("Abordagem")}
            <SeletorEmPopup
              rotulo={t("Abordagem")}
              valor={c.abordagemId}
              opcoes={[
                { id: "auto", rotulo: t("Automática (a da campanha do lead)") },
                { id: "nenhuma", rotulo: t("Nenhuma") },
                ...(abordagens.data ?? []).map((a) => ({
                  id: a.id,
                  rotulo: `${a.name} · ${nomeDaCampanha(a.campaign_id)}`,
                })),
              ]}
              aoEscolher={(v) => setC({ ...c, abordagemId: v })}
              className="min-h-9 rounded-lg"
            />
            <span>{t("Aparece num bloco que abre e fecha dentro do modo prospecção.")}</span>
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">{t("O que aparece na tela do lead")}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {PROPRIEDADES_DA_PROSPECCAO.map((p) =>
                caixa(rotuloDaPropriedade[p], c.propriedades[p], (v) =>
                  setC({ ...c, propriedades: { ...c.propriedades, [p]: v } }),
                ),
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <p className="text-xs text-muted-foreground">
              {t("Botões de resultado deste tipo de prospecção (atalhos 1, 2, 3… na ordem dos ativos)")}
            </p>
            {lista.map((r, i) => {
              const posicao = lista.slice(0, i + 1).filter((x) => x.ativo).length;
              return (
                <div key={r.id} className="grid gap-2 rounded-xl border p-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={r.ativo}
                      onChange={(e) => mudar(i, { ativo: e.target.checked })}
                      aria-label={t("Ativo")}
                    />
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[11px] text-muted-foreground">
                      {r.ativo ? posicao : "–"}
                    </span>
                    <input
                      value={r.rotulo}
                      maxLength={40}
                      onChange={(e) => mudar(i, { rotulo: e.target.value })}
                      placeholder={t("Nome do botão")}
                      className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm outline-hidden focus:border-primary/60"
                    />
                    <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={t("Subir")} className="h-8 w-8 rounded-lg border text-sm disabled:opacity-40">↑</button>
                    <button type="button" disabled={i === lista.length - 1} onClick={() => mover(i, 1)} aria-label={t("Descer")} className="h-8 w-8 rounded-lg border text-sm disabled:opacity-40">↓</button>
                    <button type="button" onClick={() => remover(i)} aria-label={t("Remover")} className="h-8 w-8 rounded-lg border text-sm text-error-fg">×</button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      value={r.proximo ?? ""}
                      maxLength={120}
                      onChange={(e) => mudar(i, { proximo: e.target.value })}
                      placeholder={t("Próxima ação marcada ao clicar (opcional)")}
                      className="h-9 min-w-0 rounded-lg border bg-background px-2 text-sm outline-hidden focus:border-primary/60"
                    />
                    {r.proximo?.trim() && !r.pedeData ? (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {t("em")}
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={r.diasUteis ?? 1}
                          onChange={(e) => mudar(i, { diasUteis: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-9 w-16 rounded-lg border bg-background px-2 text-right text-sm"
                        />
                        {t("dias úteis")}
                      </label>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {caixa(t("Perguntar a data do retorno"), Boolean(r.pedeData), (v) => mudar(i, { pedeData: v }))}
                    {caixa(t("Pedir o que foi conversado"), Boolean(r.exigeComentario), (v) => mudar(i, { exigeComentario: v }))}
                    {caixa(t("Encerra como perdido"), Boolean(r.perde), (v) => mudar(i, { perde: v }))}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setLista([...lista, { id: `p-${Date.now().toString(36)}`, rotulo: "", ativo: true, diasUteis: 1 }])
                }
                className="h-9 rounded-xl border px-3 text-sm font-medium hover:bg-secondary"
              >
                + {t("Novo resultado")}
              </button>
              <button
                type="button"
                onClick={() => setLista(resultadosPadraoDoTipo(c.tipo))}
                className="h-9 rounded-xl border px-3 text-sm text-muted-foreground hover:bg-secondary"
              >
                {t("Restaurar os padrões deste tipo")}
              </button>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={aoFechar} className="h-9 rounded-xl border px-4 text-sm font-medium hover:bg-secondary">
            {t("Cancelar")}
          </button>
          <button
            type="button"
            onClick={() => {
              aoSalvar(c);
              aoFechar();
            }}
            className="h-9 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            {t("Salvar")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
