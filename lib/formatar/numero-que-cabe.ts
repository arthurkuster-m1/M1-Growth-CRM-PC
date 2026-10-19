/**
 * A partir de 1 milhão, o número de um cartão de painel vira abreviação ("R$ 3,5 mi"); abaixo
 * disso a fonte é que encolhe (ver `NumeroQueCabe`). Lê o número do TEXTO já formatado em pt-BR
 * ("R$ 3.456.789,00", "1.250.000"), então vale para qualquer formatador que o painel já use.
 * Texto sem número, ou com mais de um (intervalos, "3 de 10"), volta como veio.
 */
const NUMERO_PT_BR = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;

export function abreviarNumeroGrande(texto: string): string {
  const achados = texto.match(NUMERO_PT_BR);
  if (!achados || achados.length !== 1) return texto;
  const bruto = achados[0];
  const n = Number(bruto.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || Math.abs(n) < 1_000_000) return texto;
  const [divisor, sufixo] = Math.abs(n) >= 1_000_000_000 ? [1_000_000_000, "bi"] : [1_000_000, "mi"];
  const reduzido = (n / divisor).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return texto.replace(bruto, `${reduzido} ${sufixo}`);
}
