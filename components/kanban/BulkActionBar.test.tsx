import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BulkActionBar } from "./BulkActionBar";

const get = vi.hoisted(() => vi.fn());
const bulkMutate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", () => ({ apiClient: { get, post: vi.fn(), patch: vi.fn() } }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (chave: string) => chave }));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  useUser: () => ({ id: "u1", is_platform_admin: false }),
  useActiveOrg: () => ({ role: "manager" }),
}));
vi.mock("@/hooks/inbox/useAssignableMembers", () => ({ useAssignableMembers: () => ({ data: [] }) }));
vi.mock("@/hooks/kanban/useBulkAction", () => ({
  useBulkAction: () => ({ mutate: bulkMutate, isPending: false }),
}));

const STAGES = [{ id: "s1", name: "Novo" }] as never;

describe("BulkActionBar — excluir em lote", () => {
  beforeEach(() => {
    get.mockReset();
    bulkMutate.mockReset();
  });

  it("a confirmação de excluir fala só do que será removido", async () => {
    const user = userEvent.setup();
    render(
      <BulkActionBar
        selectedIds={["lead-1", "lead-2"]}
        stages={STAGES}
        pipelineId="p-1"
        tagsExistentes={[]}
        onClear={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await screen.findByText("Esta ação remove o que está selecionado. Não pode ser desfeita.");
    expect(get).not.toHaveBeenCalled();
  });
});
