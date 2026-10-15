import { describe, expect, it } from "vitest";

import { emailsDoEvento, eventoImportavel, telefonesDoTexto } from "./importar";

const agora = Date.parse("2026-10-15T12:00:00Z");
const base = {
  id: "abc123",
  status: "confirmed",
  start: { dateTime: "2026-10-16T14:00:00-03:00" },
  end: { dateTime: "2026-10-16T15:00:00-03:00" },
};

describe("importação de evento do Google", () => {
  it("importa o compromisso futuro com hora marcada", () => {
    expect(eventoImportavel(base as never, agora)).toBe(true);
  });
  it("não importa cancelado, dia inteiro, série, livre, nosso nem passado", () => {
    expect(eventoImportavel({ ...base, status: "cancelled" } as never, agora)).toBe(false);
    expect(eventoImportavel({ ...base, start: { date: "2026-10-16" }, end: { date: "2026-10-17" } } as never, agora)).toBe(false);
    expect(eventoImportavel({ ...base, recurringEventId: "x" } as never, agora)).toBe(false);
    expect(eventoImportavel({ ...base, transparency: "transparent" } as never, agora)).toBe(false);
    expect(eventoImportavel({ ...base, id: "deskcommapp0123456789abcdef" } as never, agora)).toBe(false);
    expect(
      eventoImportavel(
        { ...base, start: { dateTime: "2026-10-10T10:00:00-03:00" }, end: { dateTime: "2026-10-10T11:00:00-03:00" } } as never,
        agora,
      ),
    ).toBe(false);
  });
  it("tira os e-mails de fora (sem o dono nem organizador)", () => {
    const e = {
      attendees: [
        { email: "Ana@cliente.com" },
        { email: "dono@m1.com" },
        { email: "org@m1.com", organizer: true },
        { email: "sala@resource.calendar.google.com", resource: true },
      ],
    };
    expect(emailsDoEvento(e as never, "dono@m1.com")).toEqual(["ana@cliente.com"]);
  });
  it("acha telefones escritos em qualquer formato", () => {
    expect(telefonesDoTexto("Reunião com Ana (31) 98896-6398 e +55 11 91234-5678")).toEqual([
      "31988966398",
      "5511912345678",
    ]);
    expect(telefonesDoTexto("sem número aqui 2026")).toEqual([]);
  });
});

import { checkpoint, compare, localProjection, remoteProjection } from "./sync-model";

describe("o compromisso importado já nasce convergido", () => {
  const evento = {
    id: "g123",
    status: "confirmed",
    summary: "Reunião com Ana",
    description: "Pauta: proposta",
    location: "Rua A, 10",
    etag: '"1"',
    start: { dateTime: "2026-10-16T14:00:00-03:00", timeZone: "America/Sao_Paulo" },
    end: { dateTime: "2026-10-16T15:00:00-03:00", timeZone: "America/Sao_Paulo" },
    attendees: [{ email: "ana@cliente.com" }],
  };
  const linha = {
    id: "00000000-0000-4000-8000-000000000001",
    organization_id: "00000000-0000-4000-8000-000000000002",
    title: "Reunião com Ana",
    description: "Pauta: proposta",
    starts_at: new Date(evento.start.dateTime).toISOString(),
    ends_at: new Date(evento.end.dateTime).toISOString(),
    time_zone: "America/Sao_Paulo",
    status: "confirmed" as const,
    location_kind: "in_person" as const,
    location_details: "Rua A, 10",
    meeting_url: null,
    guest_email: "ana@cliente.com",
    google_ical_uid: null,
  };
  it("sem divergência, a próxima rodada não publica nem dá conflito", () => {
    const local = localProjection(linha as never);
    const remoto = remoteProjection(evento as never, local, null);
    const base = checkpoint(null, local, remoto, [], true);
    const decisao = compare(base, localProjection(linha as never), remoteProjection(evento as never, local, base));
    expect(decisao.kind).toBe("converged");
  });
  it("mudou o horário no Google: aceita o remoto, sem conflito", () => {
    const local = localProjection(linha as never);
    const base = checkpoint(null, local, remoteProjection(evento as never, local, null), [], true);
    const remotoNovo = {
      ...evento,
      start: { dateTime: "2026-10-16T16:00:00-03:00", timeZone: "America/Sao_Paulo" },
      end: { dateTime: "2026-10-16T17:00:00-03:00", timeZone: "America/Sao_Paulo" },
    };
    const decisao = compare(base, local, remoteProjection(remotoNovo as never, local, base));
    expect(decisao.kind).toBe("accept_remote");
  });
});
