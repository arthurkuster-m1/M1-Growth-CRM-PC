/**
 * Máscara do telefone enquanto se digita: "(11) 99999-8888" (celular, 11 dígitos) ou
 * "(11) 3333-4444" (fixo, 10). Começando com "+" é número de fora do Brasil: fica como digitado,
 * só com os caracteres de telefone.
 */
export function mascararTelefone(texto: string): string {
  if (texto.trimStart().startsWith("+")) {
    return (
      "+" +
      texto
        .replace(/[^\d ()-]/g, "")
        .trimStart()
        .slice(0, 24)
    );
  }
  const d = texto.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (d.length <= 6) return `(${ddd}) ${resto}`;
  const corte = d.length === 11 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/**
 * O valor novo do campo depois de uma digitação. Apagar só um separador (o traço, o parêntese)
 * não muda os dígitos e a máscara o recolocaria: nesse caso apaga o último dígito, como se espera.
 */
export function proximoTelefone(anterior: string, digitado: string): string {
  const novo = mascararTelefone(digitado);
  if (digitado.length < anterior.length && novo === anterior) {
    return mascararTelefone(anterior.replace(/\D/g, "").slice(0, -1));
  }
  return novo;
}
