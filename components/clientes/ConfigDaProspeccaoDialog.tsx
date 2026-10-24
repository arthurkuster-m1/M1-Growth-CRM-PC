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
import { Switch } from "@/components/ui/switch";
import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Plus, Trash } from "@/lib/ui/icons";
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
  "h-9 w-24 rounded-lg border bg-card px-2 text-right text-sm tabular-nums outline-hidden focus:border-primary/60";

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

  /** Um interruptor com o texto ao lado, no padrão das telas de configuração do app. */
  const caixa = (rotulo: string, valor: boolean, aoMudar: (v: boolean) => void) => (
    <label key={rotulo} className="flex items-center justify-between gap-3 rounded-xl px-1 py-1 text-sm">
      <span className="min-w-0">{rotulo}</span>
      <Switch checked={valor} onCheckedChange={aoMudar} aria-label={rotulo} />
    </label>
  );

  /** O cartão de cada bloco: barra colorida à esquerda, como as fichas do CRM. */
  const bloco = (titulo: string, cor: string, dica: string | null, filhos: React.ReactNode) => (
    <section className={cn("grid gap-3 rounded-2xl border border-l-4 bg-card p-4 shadow-sm", cor)}>
      <div className="grid gap-0.5">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {dica ? <p className="text-xs text-muted-foreground">{dica}</p> : null}
      </div>
      {filhos}
    </section>
  );

  const entrada =
    "h-10 w-full rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20";
  const botaoIcone =
    "grid h-8 w-8 shrink-0 place-items-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40";

  return (
    <Dialog open onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="border-b bg-secondary/40 px-5 py-4 text-left">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {t("Configurar a prospecção")}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {t("Vale só para você, neste navegador. O modo prospecção sempre abre a lista que está filtrada na tela.")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overflow-x-hidden bg-background px-5 py-4">
          {bloco(
            t("Ligar hoje — quem entra na fila"),
            "border-l-blue-500",
            null,
            <div className="grid gap-1">
              {caixa(t("Próxima ação vencida ou marcada para hoje"), c.fila.vencidas, (v) =>
                setC({ ...c, fila: { ...c.fila, vencidas: v } }),
              )}
              {caixa(t("Sem data marcada e sem resposta há mais de"), c.fila.semResposta, (v) =>
                setC({ ...c, fila: { ...c.fila, semResposta: v } }),
              )}
              <label className="ml-1 flex items-center gap-2 text-sm text-muted-foreground">
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
                  className={cn(entrada, "w-24 text-right tabular-nums")}
                  aria-label={t("Horas sem resposta")}
                />
                {t("horas")}
              </label>
              {caixa(t("Oportunidade aberta sem nenhuma próxima ação escrita"), c.fila.semProximaAcao, (v) =>
                setC({ ...c, fila: { ...c.fila, semProximaAcao: v } }),
              )}
            </div>,
          )}

          {bloco(
            t("Modo prospecção"),
            "border-l-purple-500",
            t("Aparece num bloco que abre e fecha dentro do modo prospecção."),
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  {t("Quantos leads nesta sessão (0 = a lista toda)")}
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={c.quantidade}
                    onChange={(e) => setC({ ...c, quantidade: Math.max(0, Number(e.target.value) || 0) })}
                    className={cn(entrada, "tabular-nums")}
                  />
                </label>
                <div className="grid gap-1 text-xs font-medium text-muted-foreground">
                  {t("Tipo de prospecção")}
                  <SeletorEmPopup
                    rotulo={t("Tipo de prospecção")}
                    valor={c.tipo}
                    opcoes={TIPOS_DE_PROSPECCAO.map((x) => ({ id: x, rotulo: rotuloDoTipo[x] }))}
                    // Trocar o tipo já ajusta as propriedades; depois dá para refinar uma a uma.
                    aoEscolher={(v) =>
                      setC({ ...c, tipo: v as TipoDeProspeccao, propriedades: propriedadesDoTipo(v as TipoDeProspeccao) })
                    }
                    className="min-h-10 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid gap-1 text-xs font-medium text-muted-foreground">
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
                  className="min-h-10 rounded-xl"
                />
              </div>
            </div>,
          )}

          {bloco(
            t("O que aparece na tela do lead"),
            "border-l-green-500",
            null,
            <div className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
              {PROPRIEDADES_DA_PROSPECCAO.map((p) =>
                caixa(rotuloDaPropriedade[p], c.propriedades[p], (v) =>
                  setC({ ...c, propriedades: { ...c.propriedades, [p]: v } }),
                ),
              )}
            </div>,
          )}

          {bloco(
            t("Botões de resultado"),
            "border-l-orange-500",
            t("Os atalhos 1, 2, 3… seguem a ordem dos botões ativos deste tipo de prospecção."),
            <div className="grid gap-2.5">
              {lista.map((r, i) => {
                const posicao = lista.slice(0, i + 1).filter((x) => x.ativo).length;
                return (
                  <div
                    key={r.id}
                    className={cn("grid gap-2.5 rounded-xl border p-3", r.ativo ? "bg-card" : "bg-secondary/40")}
                  >
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.ativo}
                        onCheckedChange={(v) => mudar(i, { ativo: v })}
                        aria-label={t("Ativo")}
                      />
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border bg-background text-xs font-semibold text-muted-foreground tabular-nums">
                        {r.ativo ? posicao : "–"}
                      </span>
                      <input
                        value={r.rotulo}
                        maxLength={40}
                        onChange={(e) => mudar(i, { rotulo: e.target.value })}
                        placeholder={t("Nome do botão")}
                        className={cn(entrada, "h-9 min-w-0 flex-1 font-medium")}
                      />
                      <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={t("Subir")} className={botaoIcone}>
                        <ArrowUp size={14} aria-hidden />
                      </button>
                      <button type="button" disabled={i === lista.length - 1} onClick={() => mover(i, 1)} aria-label={t("Descer")} className={botaoIcone}>
                        <ArrowDown size={14} aria-hidden />
                      </button>
                      <button type="button" onClick={() => remover(i)} aria-label={t("Remover")} className={cn(botaoIcone, "hover:text-error-fg")}>
                        <Trash size={14} aria-hidden />
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input
                        value={r.proximo ?? ""}
                        maxLength={120}
                        onChange={(e) => mudar(i, { proximo: e.target.value })}
                        placeholder={t("Próxima ação marcada ao clicar (opcional)")}
                        className={cn(entrada, "h-9 min-w-0")}
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
                            className={cn(entrada, "h-9 w-16 text-right tabular-nums")}
                          />
                          {t("dias úteis")}
                        </label>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          ["pedeData", t("Perguntar a data do retorno")],
                          ["exigeComentario", t("Pedir o que foi conversado")],
                          ["perde", t("Encerra como perdido")],
                        ] as const
                      ).map(([campo, rotulo]) => {
                        const ligado = Boolean(r[campo]);
                        return (
                          <button
                            key={campo}
                            type="button"
                            aria-pressed={ligado}
                            onClick={() => mudar(i, { [campo]: !ligado })}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                              ligado
                                ? campo === "perde"
                                  ? "border-error/40 bg-error-bg text-error-fg"
                                  : "border-primary/40 bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-secondary",
                            )}
                          >
                            {rotulo}
                          </button>
                        );
                      })}
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
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/15"
                >
                  <Plus size={14} weight="bold" aria-hidden />
                  {t("Novo resultado")}
                </button>
                <button
                  type="button"
                  onClick={() => setLista(resultadosPadraoDoTipo(c.tipo))}
                  className="h-9 rounded-xl border px-3 text-sm text-muted-foreground hover:bg-secondary"
                >
                  {t("Restaurar os padrões deste tipo")}
                </button>
              </div>
            </div>,
          )}
        </div>

        <div className="flex justify-end gap-2 border-t bg-card px-5 py-3">
          <button
            type="button"
            onClick={aoFechar}
            className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-secondary"
          >
            {t("Cancelar")}
          </button>
          <button
            type="button"
            onClick={() => {
              aoSalvar(c);
              aoFechar();
            }}
            className="h-10 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {t("Salvar")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
