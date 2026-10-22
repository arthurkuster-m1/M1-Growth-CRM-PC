"use client";

import { useT } from "@/hooks/i18n/useT";
import type { useCronograma } from "@/hooks/marketing/useCronograma";
import { registrarDesfazer, valoresAntes } from "@/lib/motor/desfazer";
import type { DadosDaMeta, ItemDoCronograma, MetaDoCronograma } from "@/lib/marketing/cronograma";

type Cronograma = ReturnType<typeof useCronograma>;
type DadosDoItem = Omit<ItemDoCronograma, "id" | "ordem">;

const CAMPOS_DA_META: ReadonlyArray<keyof DadosDaMeta> = [
  "titulo",
  "tipo",
  "unidade",
  "valor_alvo",
  "valor_atual",
  "descricao",
  "fonte",
  "periodo",
  "periodo_de",
  "periodo_ate",
  "calculo",
];

const dadosDoItem = ({ id: _id, ordem: _ordem, ...resto }: ItemDoCronograma): DadosDoItem => {
  void _id;
  void _ordem;
  return resto;
};
const dadosDaMeta = (m: MetaDoCronograma): DadosDaMeta =>
  Object.fromEntries(CAMPOS_DA_META.map((k) => [k, m[k]])) as unknown as DadosDaMeta;

/**
 * As escritas do cronograma que a edição no próprio painel usa, cada uma já registrando o seu
 * Ctrl+Z (a pilha de desfazer do app): editar volta o valor de antes, criar apaga, apagar recria.
 * Quem chama recebe o item/meta criado, para poder abri-lo na hora.
 */
export function useEdicaoDoCronograma(
  c: Cronograma,
  itens: readonly ItemDoCronograma[],
  metas: readonly MetaDoCronograma[],
) {
  const t = useT();

  return {
    criarItem: async (dados: DadosDoItem): Promise<ItemDoCronograma | null> => {
      const r = (await c.criarItem(dados)) as { data?: { item?: ItemDoCronograma } } | null;
      const item = r?.data?.item ?? null;
      if (item) {
        registrarDesfazer({
          rotulo: t("Nova ação"),
          desfazer: () => c.apagarItem(item.id),
        });
      }
      return item;
    },
    editarItem: async (id: string, patch: Partial<Omit<ItemDoCronograma, "id">>) => {
      const atual = itens.find((i) => i.id === id);
      const antes = atual ? valoresAntes(atual, patch) : null;
      const r = await c.editarItem(id, patch);
      if (r && antes) {
        registrarDesfazer({
          rotulo: t("Edição da ação"),
          desfazer: () => c.editarItem(id, antes as Partial<Omit<ItemDoCronograma, "id">>),
        });
      }
      return r;
    },
    apagarItem: async (id: string) => {
      const atual = itens.find((i) => i.id === id);
      const r = await c.apagarItem(id);
      if (r && atual) {
        registrarDesfazer({
          rotulo: t("Ação apagada"),
          desfazer: () => c.criarItem(dadosDoItem(atual)),
        });
      }
      return r;
    },
    /** Reescreve a ordem de várias ações de uma vez (subir/descer), com um só Ctrl+Z. */
    gravarOrdem: async (mudancas: Array<{ id: string; ordem: number }>) => {
      if (!mudancas.length) return;
      const antes = mudancas.map((m) => ({
        id: m.id,
        ordem: itens.find((i) => i.id === m.id)?.ordem ?? m.ordem,
      }));
      await Promise.all(mudancas.map((m) => c.editarItem(m.id, { ordem: m.ordem })));
      registrarDesfazer({
        rotulo: t("Mudança de ordem"),
        desfazer: () => Promise.all(antes.map((m) => c.editarItem(m.id, { ordem: m.ordem }))),
      });
    },
    renomearFase: async (de: string, para: string) => {
      const ids = itens.filter((i) => !i.arquivado && i.fase.trim() === de).map((i) => i.id);
      await Promise.all(ids.map((id) => c.editarItem(id, { fase: para })));
      registrarDesfazer({
        rotulo: t("Nome da fase"),
        desfazer: () => Promise.all(ids.map((id) => c.editarItem(id, { fase: de }))),
      });
    },
    criarMeta: async (dados: DadosDaMeta): Promise<MetaDoCronograma | null> => {
      const r = (await c.criarMeta(dados)) as { data?: { meta?: MetaDoCronograma } } | null;
      const meta = r?.data?.meta ?? null;
      if (meta) {
        registrarDesfazer({ rotulo: t("Nova meta"), desfazer: () => c.apagarMeta(meta.id) });
      }
      return meta;
    },
    editarMeta: async (id: string, patch: Partial<DadosDaMeta>) => {
      const atual = metas.find((m) => m.id === id);
      const antes = atual ? valoresAntes(atual, patch) : null;
      const r = await c.editarMeta(id, patch);
      if (r && antes) {
        registrarDesfazer({
          rotulo: t("Edição da meta"),
          desfazer: () => c.editarMeta(id, antes as Partial<DadosDaMeta>),
        });
      }
      return r;
    },
    apagarMeta: async (id: string) => {
      const atual = metas.find((m) => m.id === id);
      const r = await c.apagarMeta(id);
      if (r && atual) {
        registrarDesfazer({
          rotulo: t("Meta apagada"),
          desfazer: () => c.criarMeta(dadosDaMeta(atual)),
        });
      }
      return r;
    },
  };
}
