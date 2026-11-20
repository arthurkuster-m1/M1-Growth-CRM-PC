import type { EstadoDoPasso, FaseDoGuia, ModeloDeVenda, Nicho, Objetivo } from "@/lib/guia/tipos";

export type Traduzir = (texto: string) => string;

export function rotuloDaFase(t: Traduzir, fase: FaseDoGuia): string {
  switch (fase) {
    case "cadastros":
      return t("0 · Cadastros essenciais");
    case "diagnostico":
      return t("1 · Diagnóstico");
    case "produto-e-oferta":
      return t("2 · Produto e oferta");
    case "captacao":
      return t("3 · Captação");
    case "venda":
      return t("4 · Venda e atendimento");
    case "demanda":
      return t("5 · Geração de demanda");
    case "operacao":
      return t("6 · Operação semanal");
    case "otimizacao":
      return t("7 · Otimização contínua");
  }
}

export function rotuloDoNicho(t: Traduzir, n: Nicho): string {
  switch (n) {
    case "clinica":
      return t("Clínica");
    case "servico":
      return t("Serviço / agência / B2B");
    case "imobiliaria":
      return t("Imobiliária");
    case "loja":
      return t("Loja");
    case "infoproduto":
      return t("Infoproduto");
  }
}

export function rotuloDoModelo(t: Traduzir, m: ModeloDeVenda): string {
  switch (m) {
    case "agendamento":
      return t("Agendamento / reunião");
    case "whatsapp":
      return t("Venda direta no WhatsApp");
    case "checkout":
      return t("Checkout / e-commerce");
    case "lancamento":
      return t("Lançamento ou perpétuo");
  }
}

export function rotuloDoObjetivo(t: Traduzir, o: Objetivo): string {
  switch (o) {
    case "mais_leads":
      return t("Mais leads");
    case "leads_melhores":
      return t("Leads melhores");
    case "mais_vendas":
      return t("Mais vendas");
    case "reativar_base":
      return t("Reativar a base");
  }
}

export function rotuloDoEstado(t: Traduzir, e: EstadoDoPasso): string {
  switch (e) {
    case "feito":
      return t("Feito");
    case "em_andamento":
      return t("Em andamento");
    case "falta":
      return t("Falta");
    case "bloqueado":
      return t("Bloqueado");
    case "desatualizado":
      return t("Desatualizado");
    case "nao_se_aplica":
      return t("Não se aplica");
    case "dispensado":
      return t("Dispensado");
    case "nao_verificado":
      return t("Não consegui verificar");
  }
}

export const COR_DO_ESTADO: Record<EstadoDoPasso, string> = {
  feito: "bg-success-bg text-success-fg",
  em_andamento: "bg-secondary text-foreground",
  falta: "bg-warning-bg text-warning-fg",
  bloqueado: "bg-secondary text-muted-foreground",
  desatualizado: "bg-warning-bg text-warning-fg",
  nao_se_aplica: "bg-secondary text-muted-foreground",
  dispensado: "bg-secondary text-muted-foreground",
  nao_verificado: "bg-secondary text-muted-foreground",
};
