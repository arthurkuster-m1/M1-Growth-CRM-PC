/**
 * O formulário do nó `crm_action` (motor único): o fluxo só recebe ação VÁLIDA, e ação incompleta é avisada na
 * tela — nunca um valor pela metade rio acima, nunca em silêncio. O formulário de cada ação é o das regras
 * (`ActionConfigForm`), trocado aqui por um dublê para medir só o que ESTE arquivo decide.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ActionItem } from "@/app/app/webhooks/_components/ActionConfigForm";

vi.mock("@/app/app/webhooks/_components/ActionConfigForm", async (original) => {
  const real = await original<typeof import("@/app/app/webhooks/_components/ActionConfigForm")>();
  return {
    ...real,
    ActionConfigForm: ({
      action,
      onChange,
    }: {
      action: ActionItem;
      onChange: (a: ActionItem) => void;
    }) => (
      <div>
        <span data-testid="tipo-atual">{action.type}</span>
        <button
          type="button"
          onClick={() => onChange({ type: "add_tag", config: { tags: ["vip"] } })}
        >
          preencher
        </button>
        <button type="button" onClick={() => onChange({ type: "add_tag", config: { tags: [] } })}>
          esvaziar
        </button>
      </div>
    ),
  };
});

import { CrmActionForm } from "./CrmActionForm";
import type { ConfigOf } from "./shared";

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

const usuario = () => userEvent.setup({ delay: null });

const TAG: ConfigOf<"crm_action"> = { action: { type: "add_tag", config: { tags: ["novo"] } } };

describe("CrmActionForm", () => {
  it("ação válida desce para o fluxo e não mostra aviso", async () => {
    const onChange = vi.fn();
    render(<CrmActionForm config={TAG} onChange={onChange} />);

    await usuario().click(screen.getByText("preencher"));

    expect(onChange).toHaveBeenCalledWith({
      action: { type: "add_tag", config: { tags: ["vip"] } },
    });
    expect(screen.queryByTestId("crm-action-pendente")).toBeNull();
  });

  it("ação incompleta NÃO desce para o fluxo e a tela avisa que a anterior continua valendo", async () => {
    const onChange = vi.fn();
    render(<CrmActionForm config={TAG} onChange={onChange} />);

    await usuario().click(screen.getByText("esvaziar"));

    expect(onChange).not.toHaveBeenCalled();
    const aviso = screen.getByTestId("crm-action-pendente");
    expect(aviso.textContent).toContain("Falta preencher");
    expect(aviso.textContent).toContain("o fluxo continua com a ação anterior");
  });

  it("completar depois do aviso grava e o aviso some", async () => {
    const onChange = vi.fn();
    render(<CrmActionForm config={TAG} onChange={onChange} />);
    const u = usuario();

    await u.click(screen.getByText("esvaziar"));
    await u.click(screen.getByText("preencher"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("crm-action-pendente")).toBeNull();
  });

  it("'A IA decide' (vinda de uma regra migrada) não tem formulário e diz isso, sem editar nada", () => {
    const ia = {
      action: {
        type: "ai_decide",
        config: {
          custo_de_token: true,
          instrucao: "x",
          opcoes: [
            { id: "a", rotulo: "A", acao: { type: "add_tag", config: { tags: ["a"] } } },
            { id: "b", rotulo: "B", acao: { type: "add_tag", config: { tags: ["b"] } } },
          ],
        },
      },
    } as unknown as ConfigOf<"crm_action">;
    const onChange = vi.fn();
    render(<CrmActionForm config={ia} onChange={onChange} />);

    expect(screen.getByText(/ainda não tem formulário/)).toBeTruthy();
    expect(screen.queryByTestId("crm-action-type")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
