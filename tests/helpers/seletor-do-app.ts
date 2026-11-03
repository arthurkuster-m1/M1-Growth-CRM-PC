import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** Os seletores do app são popups, não `<select>`: abre o campo e clica na opção pelo nome. */
export async function escolherNoSeletor(campo: HTMLElement, opcao: string | RegExp) {
  await userEvent.click(campo);
  const abertos = screen.getAllByRole("dialog");
  const lista = abertos[abertos.length - 1]!;
  await userEvent.click(within(lista).getByRole("button", { name: opcao }));
}
