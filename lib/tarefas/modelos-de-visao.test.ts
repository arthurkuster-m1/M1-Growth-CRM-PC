import { describe, expect, it } from "vitest";

import { aplicarConsulta, resolverData, type CampoConsultavel } from "@/lib/motor/consulta";

import { modelosDeVisaoDeTarefas } from "./modelos-de-visao";

interface T {
  id: string;
  status: string;
  prazo: string | null;
  resp: string | null;
  lado?: string;
}

const OPCOES = [
  { id: "o-pend", grupo: "pending" as const },
  { id: "o-and", grupo: "in_progress" as const },
  { id: "o-ok", grupo: "done" as const },
  { id: "o-canc", grupo: "cancelled" as const },
];
const CAMPOS: CampoConsultavel<T>[] = [
  { id: "status", tipo: "opcao", valorDe: (x) => x.status },
  { id: "prazo", tipo: "data", valorDe: (x) => x.prazo },
  { id: "responsavel", tipo: "pessoa", valorDe: (x) => x.resp },
  { id: "cronograma", tipo: "opcao", valorDe: (x) => x.lado },
];
const HOJE = "2026-10-30"; // sexta-feira
const ctx = { opcoes: OPCOES, usuarioId: "eu", comCronograma: true };
const modelo = (id: string) => modelosDeVisaoDeTarefas(ctx).find((m) => m.id === id)!;
const ids = (config: ReturnType<typeof modelo>["config"], linhas: T[]) =>
  aplicarConsulta(linhas, CAMPOS, config, { hoje: HOJE }).linhas.map((l) => l.id);

const LINHAS: T[] = [
  { id: "atrasada", status: "o-pend", prazo: "2026-10-27", resp: "eu" },
  { id: "hoje", status: "o-and", prazo: "2026-10-30", resp: "outro" },
  { id: "fds", status: "o-pend", prazo: "2026-11-01", resp: null }, // domingo = hoje + 2
  { id: "longe", status: "o-pend", prazo: "2026-11-10", resp: "eu" },
  { id: "feita-atrasada", status: "o-ok", prazo: "2026-10-20", resp: "eu" },
  { id: "sem-prazo", status: "o-pend", prazo: null, resp: "eu" },
  { id: "cliente", status: "o-pend", prazo: "2026-11-02", resp: null, lado: "cliente" },
];

describe("visões prontas de tarefas", () => {
  it("'depois de amanhã' é hoje + 2 (cobre o fim de semana de uma sexta)", () => {
    expect(resolverData("depois_de_amanha", HOJE)).toBe("2026-11-01");
  });
  it("Pendentes: em aberto e vencida, de hoje ou dos próximos 2 dias — ordenada por prazo", () => {
    expect(ids(modelo("pendentes").config, LINHAS)).toEqual(["atrasada", "hoje", "fds"]);
  });
  it("Minhas tarefas: só as designadas a mim e em aberto", () => {
    expect(ids(modelo("minhas-tarefas").config, LINHAS).sort()).toEqual(
      ["atrasada", "longe", "sem-prazo"].sort(),
    );
  });
  it("Atrasadas: em aberto e com prazo antes de hoje", () => {
    expect(ids(modelo("atrasadas").config, LINHAS)).toEqual(["atrasada"]);
  });
  it("Sem responsável e Aguardando o cliente", () => {
    expect(ids(modelo("sem-responsavel").config, LINHAS).sort()).toEqual(["cliente", "fds"].sort());
    expect(ids(modelo("aguardando-o-cliente").config, LINHAS)).toEqual(["cliente"]);
  });
  it("Concluídas: só as do grupo concluído", () => {
    expect(ids(modelo("concluidas").config, LINHAS)).toEqual(["feita-atrasada"]);
  });
  it("sem cronograma, as visões do cronograma não existem", () => {
    const m = modelosDeVisaoDeTarefas({ ...ctx, comCronograma: false }).map((x) => x.id);
    expect(m).not.toContain("da-agencia");
    expect(m).not.toContain("aguardando-o-cliente");
    expect(m).toContain("pendentes");
  });
});
