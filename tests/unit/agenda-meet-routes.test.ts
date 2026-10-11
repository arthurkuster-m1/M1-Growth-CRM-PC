import { logger } from "@/lib/logger";
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { beforeEach, expect, it, vi } from "vitest";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { googleRpc } from "@/lib/agenda/google/sync-store";
import { audit } from "@/lib/audit";
import { fail } from "@/lib/api/wrappers";
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/agenda/google/sync-store", () => ({ googleRpc: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
import { POST as retry } from "@/app/api/v1/agenda/agendamentos/[id]/google/meet/retry/route";
import { POST as deliver } from "@/app/api/v1/agenda/agendamentos/[id]/google/meet/deliver/route";
const org = "aaaaaaaa-0000-4000-8000-000000000001",
  user = "aaaaaaaa-0000-4000-8000-000000000002",
  id = "aaaaaaaa-0000-4000-8000-000000000003";
const ctx = { params: Promise.resolve({ id }) },
  body = { revision: "9007199254740993", request_id: id, conversation_id: id };
const request = (payload: unknown = body) =>
  new Request("http://local/meet", { method: "POST", body: JSON.stringify(payload) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireSupportWrite).mockResolvedValue(null);
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user: { id: user },
    org: { orgId: org },
  } as never);
  vi.mocked(createClient).mockResolvedValue({ session: true } as never);
  vi.mocked(googleRpc).mockResolvedValue(true);
});
it.each([retry, deliver])(
  "nega suporte antes de ler body ou realizar qualquer efeito",
  async (route) => {
    const req = request(),
      read = vi.spyOn(req, "json");
    vi.mocked(requireSupportWrite).mockResolvedValue(fail("forbidden", "Somente leitura.", 403));
    expect((await route(req, ctx)).status).toBe(403);
    expect(read).not.toHaveBeenCalled();
    expect(requireRole).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(googleRpc).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  },
);
it("entrega usa sessão, org confiável e CAS textual; no-op não audita", async () => {
  expect((await deliver(request(), ctx)).status).toBe(200);
  expect(googleRpc).toHaveBeenCalledWith({ session: true }, "fn_meet_action", {
    p_org: org,
    p_id: id,
    p_revision: body.revision,
    p_request: id,
    p_action: "deliver",
    p_conversation: id,
  });
  expect(audit).toHaveBeenCalledWith(
    expect.objectContaining({ organizationId: org, actorUserId: user }),
  );
  vi.mocked(audit).mockClear();
  vi.mocked(googleRpc).mockResolvedValue(false);
  await deliver(request(), ctx);
  expect(audit).not.toHaveBeenCalled();
});
it("body não forja autorização e CAS vencido não escreve audit", async () => {
  expect(
    (await deliver(request({ ...body, organization_id: org, authorized: true }), ctx)).status,
  ).toBe(422);
  expect(googleRpc).not.toHaveBeenCalled();
  vi.mocked(googleRpc).mockRejectedValue(Object.assign(Error("meet_stale"), { code: "40001" }));
  expect((await retry(request(), ctx)).status).toBe(409);
  expect(audit).not.toHaveBeenCalled();
});
it.each(["42501", "XX000", "network"])(
  "erro %s conserva status e registro sanitizado",
  async (code) => {
    vi.mocked(googleRpc).mockRejectedValue(
      Object.assign(Error("https://meet.google.com/secret?token=private"), { code }),
    );
    const response = await deliver(request(), ctx);
    expect(response.status).toBe(code === "42501" ? 403 : 500);
    const payload = await response.json();
    expect(payload.error.code).toBe(code === "42501" ? "forbidden" : "internal_error");
    expect(JSON.stringify(payload)).not.toContain("secret");
    expect(audit).not.toHaveBeenCalled();
    if (code !== "42501") {
      expect(logger.error).toHaveBeenCalledWith(
        "agenda.meet_action_failed",
        expect.objectContaining({ code: "internal_error" }),
      );
      expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("secret");
    }
  },
);

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
