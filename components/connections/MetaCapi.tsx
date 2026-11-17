"use client";

import { FormularioDeConversoes } from "@/app/app/settings/conversoes/_form";
import { IdentidadeDaConversao } from "@/app/app/settings/conversoes/_identidadeDaMeta";
import { RegrasDeConversaoMeta } from "@/app/app/settings/conversoes/_regrasMeta";
import { Card } from "@/components/ui/card";
import { useT } from "@/hooks/i18n/useT";
import type { EstadoDaConexao } from "@/lib/conversoes/estado-da-conexao";
import type { RegraDeConversaoMeta } from "@/lib/conversoes/regras-meta";
import type { EtapaAbertaDoFunil } from "@/lib/conversoes/etapas-abertas";
import type { Idioma } from "@/lib/i18n/idiomas";

export interface DadosDaMetaCapi {
  estado: EstadoDaConexao;
  etapas: EtapaAbertaDoFunil[] | null;
  regras: RegraDeConversaoMeta[] | null;
  pageId: string | null;
  whatsappBusinessAccountId: string | null;
}

/**
 * META CAPI (API de Conversões) dentro da aba Meta Ads de Conexões: ligar/desligar o envio, os dados
 * da conexão (conjunto de dados, token, código de teste), a Página/WABA, e — a parte que decide
 * QUANDO cada evento sai — o evento de cada etapa do funil (padrão da Meta ou personalizado). A
 * venda sai sozinha como compra quando o negócio é ganho, com valor.
 */
export function MetaCapi({ dados, idioma }: { dados: DadosDaMetaCapi; idioma: Idioma }) {
  const t = useT();
  const { estado } = dados;
  return (
    <section aria-label={t("Meta CAPI")} className="flex flex-col gap-4 border-t pt-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {t("Meta CAPI (API de Conversões)")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "Devolve à Meta o que aconteceu com os leads que vieram dos seus anúncios: a venda (compra, com valor), o lead qualificado e os eventos de cada etapa do funil. É isso que ensina o anúncio a achar mais gente parecida com quem compra.",
          )}
        </p>
      </div>

      <div
        className={
          estado.conectada && estado.habilitada
            ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm"
            : "rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        }
        role="status"
      >
        {!estado.conectada
          ? t("Meta CAPI ainda não conectada: preencha o conjunto de dados e o token abaixo.")
          : estado.habilitada
            ? t("Meta CAPI ATIVA: as conversões estão sendo enviadas.")
            : t(
                "Meta CAPI PAUSADA: as vendas continuam registradas no histórico, mas não vão para a Meta.",
              )}
      </div>

      <FormularioDeConversoes estado={estado} idioma={idioma} />

      {estado.conectada && (
        <IdentidadeDaConversao
          pageId={dados.pageId}
          whatsappBusinessAccountId={dados.whatsappBusinessAccountId}
          idioma={idioma}
        />
      )}

      {estado.conectada &&
        (dados.etapas && dados.regras ? (
          <RegrasDeConversaoMeta etapas={dados.etapas} regras={dados.regras} idioma={idioma} />
        ) : (
          <Card className="p-4 text-sm text-muted-foreground">
            {t("Não consegui ler as etapas do funil agora. Atualize a página em instantes.")}
          </Card>
        ))}

      <p className="text-sm text-muted-foreground">
        {t("O histórico de envios, o diagnóstico e os links rastreáveis ficam em")}{" "}
        <a className="underline" href="/app/settings/conversoes?aba=historico">
          {t("Configurações → Conversões")}
        </a>
        .
      </p>
    </section>
  );
}
