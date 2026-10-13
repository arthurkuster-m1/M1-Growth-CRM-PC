import type { ValorDaOrigem } from "@/components/contacts/ficha/OrigemEmCascata";
import type { DadosDoLead } from "@/components/leads/FichaDoLead";
import type { CampanhaOpcao } from "@/lib/marketing/origem-opcoes";

/** A origem de um card (funil/venda) no modelo único: fonte + campanha → conjunto → anúncio → página. */
export function valorDaOrigemDoCard(n: DadosDoLead): ValorDaOrigem {
  const campanha = n.campanhas.find((c) => c.id === n.campaign_id) ?? null;
  return {
    origem: n.source === "base_de_clientes" ? "Base de clientes" : (n.source ?? ""),
    campanha: campanha?.nome ?? "",
    conjunto: n.conjunto ?? "",
    anuncio: campanha?.criativos.find((c) => c.id === n.creative_id)?.nome ?? "",
    lp: campanha?.landing_pages.find((p) => p.id === n.landing_page_id)?.nome ?? "",
    posicionamento: n.posicionamento ?? "",
  };
}

/** O corpo do PUT /leads/[id]/origem a partir do que foi escolhido na cascata (nomes → ids). */
export function corpoDaOrigem(
  valor: ValorDaOrigem,
  arvore: CampanhaOpcao[],
): Record<string, unknown> {
  const camp = arvore.find((c) => c.nome === valor.campanha);
  const todos = camp ? [...camp.conjuntos.flatMap((c) => c.anuncios), ...camp.anuncios_soltos] : [];
  const anuncio = todos.find((a) => a.nome === valor.anuncio);
  const pagina = camp?.paginas.find((p) => p.nome === valor.lp);
  return {
    campaign_id: camp?.id ?? null,
    // O anúncio do cadastro de criativos pode não existir (nome digitado): só vale com id.
    ...(camp ? { creative_id: anuncio?.id ?? null, landing_page_id: pagina?.id ?? null } : {}),
    ...(valor.origem.trim() ? { source: valor.origem.trim() } : {}),
    conjunto: valor.conjunto || null,
    posicionamento: valor.posicionamento || null,
  };
}
