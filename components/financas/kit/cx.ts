export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

/** Centavos → "R$ 1.234,56". Dinheiro no app é sempre inteiro em centavos. */
export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
