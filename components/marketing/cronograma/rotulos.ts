import type { RotulosDoCronograma } from "@/components/marketing/cronograma/PainelDoCronograma";

type Traduz = (texto: string) => string;

/** Os textos fixos do painel do cronograma, já traduzidos (app e link público usam os mesmos). */
export function rotulosDoCronograma(t: Traduz): RotulosDoCronograma {
  return {
    titulo: t("Cronograma de"),
    destaqueDoTitulo: t("Implementação"),
    metas: t("Onde queremos chegar"),
    caminho: t("O caminho: o que fizemos, o que estamos fazendo e o que vem"),
    semana: t("Tarefas da semana"),
    agencia: t("Responsabilidades da agência"),
    cliente: t("Responsabilidade do cliente"),
    feita: t("Concluída"),
    andamento: t("Em andamento"),
    aFazer: t("A fazer"),
    atrasada: t("Atrasada"),
    planejado: t("Planejado"),
    concluido: t("Concluído"),
    hoje: t("Hoje"),
    fase: t("Fases do projeto"),
    semanaCurta: t("S"),
    nenhumaMeta: t("As metas ainda não foram definidas."),
    nenhumaAcao: t("As ações ainda não foram cadastradas."),
    nenhumaTarefa: t("Nenhuma tarefa nesta semana."),
    adiada: t("adiada"),
    alvo: t("Alvo"),
    atual: t("Hoje"),
    resumo: (feitas, andando, aFazer) =>
      `${feitas} ${t("concluídas")} · ${andando} ${t("em andamento")} · ${aFazer} ${t("a fazer")}`,
  };
}
