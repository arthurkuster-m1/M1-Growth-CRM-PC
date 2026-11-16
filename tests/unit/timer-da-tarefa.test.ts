/** POST /api/v1/tasks/[id]/timer — iniciar e parar o cronômetro da tarefa. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/v1/tasks/[id]/timer/route";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

const ORG = "22222222-2222-4222-8222-222222222222";
const TASK = "33333333-3333-4333-8333-333333333333";

let erroDaRpc: { code: string } | null;
const chamadas: Array<{ fn: string; args: Record<string, unknown> }> = [];

beforeEach(() => {
  vi.clearAllMocks();
  chamadas.length = 0;
  erroDaRpc = null;
  vi.mocked(requireSupportWrite).mockResolvedValue(null);
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user: { id: "u1", idioma: "pt-BR" },
    org: { orgId: ORG, role: "agent" },
  } as never);
  vi.mocked(createClient).mockResolvedValue({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      chamadas.push({ fn, args });
      if (fn === "fn_tempos_das_tarefas") {
        return {
          data: [
            { task_id: TASK, total_seconds: 90, running: [{ user_id: "u1", started_at: "s" }] },
          ],
          error: null,
        };
      }
      return { data: null, error: erroDaRpc };
    },
  } as never);
});

const pedir = (corpo: unknown, id = TASK) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify(corpo) }) as never, {
    params: Promise.resolve({ id }),
  });

describe("timer da tarefa", () => {
  it("iniciar chama a função do banco com a empresa da sessão e devolve o tempo", async () => {
    const r = await pedir({ acao: "iniciar" });
    expect(r.status).toBe(200);
    expect((await r.json()).data).toMatchObject({
      task_id: TASK,
      tempo_gasto_seg: 90,
      cronometros: [{ user_id: "u1" }],
    });
    expect(chamadas[0]).toEqual({
      fn: "fn_tarefa_timer_iniciar",
      args: { p_task: TASK, p_organization_id: ORG },
    });
    expect(vi.mocked(audit).mock.calls[0]![0].action).toBe("crm_task.timer_started");
  });

  it("parar usa a outra função e audita", async () => {
    await pedir({ acao: "parar" });
    expect(chamadas[0]!.fn).toBe("fn_tarefa_timer_parar");
    expect(vi.mocked(audit).mock.calls[0]![0].action).toBe("crm_task.timer_stopped");
  });

  it("tarefa concluída = 409; inexistente = 404; clique duplo concorrente = 409", async () => {
    erroDaRpc = { code: "P0001" };
    expect((await pedir({ acao: "iniciar" })).status).toBe(409);
    erroDaRpc = { code: "P0002" };
    expect((await pedir({ acao: "iniciar" })).status).toBe(404);
    erroDaRpc = { code: "23505" };
    expect((await pedir({ acao: "iniciar" })).status).toBe(409);
    erroDaRpc = { code: "42501" };
    expect((await pedir({ acao: "iniciar" })).status).toBe(403);
    expect(audit).not.toHaveBeenCalled();
  });

  it("recusa corpo inválido, id que não é uuid, suporte somente leitura e quem não é atendente", async () => {
    expect((await pedir({ acao: "zerar" })).status).toBe(422);
    expect((await pedir({ acao: "iniciar" }, "x")).status).toBe(404);
    vi.mocked(requireSupportWrite).mockResolvedValueOnce(
      new Response("{}", { status: 403 }) as never,
    );
    expect((await pedir({ acao: "iniciar" })).status).toBe(403);
    vi.mocked(requireRole).mockResolvedValueOnce({
      ok: false,
      response: new Response("{}", { status: 403 }),
    } as never);
    expect((await pedir({ acao: "iniciar" })).status).toBe(403);
    expect(chamadas).toHaveLength(0);
  });
});
