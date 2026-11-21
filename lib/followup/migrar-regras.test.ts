import { describe, expect, it } from "vitest";

import type { FlowGraph } from "./graph-schema";
import {
  desfazerMigracao,
  migrarRegras,
  simularMigracao,
  type MigracaoDb,
  type NovoFluxo,
  type RegraGravada,
} from "./migrar-regras";

const ORG = "11111111-1111-4111-8111-111111111111";
const USUARIO = "22222222-2222-4222-8222-222222222222";

const regra = (id: string, extra: Partial<RegraGravada> = {}): RegraGravada => ({
  id,
  name: `Regra ${id}`,
  is_active: true,
  trigger_event: "lead.tag_added",
  trigger_config: null,
  conditions: [],
  actions: [{ type: "add_tag", config: { tags: ["Novo"] } }],
  migrated_to_pointer_id: null,
  migrated_was_active: null,
  ...extra,
});

type Fluxo = {
  id: string;
  nome: string;
  status: string;
  active_version_id: string | null;
  draft_graph: FlowGraph | null;
};

/**
 * Banco em memória. A GARANTIA da migração é conferida depois de CADA gravação: nenhuma regra vinculada pode
 * estar ligada enquanto o fluxo dela está ligado — nem no meio de uma queda.
 */
function bancoEmMemoria(
  regras: RegraGravada[],
  opcoes: { publicaFalha?: "retorna" | "lanca" | "lanca-uma-vez" } = {},
) {
  const fluxos = new Map<string, Fluxo>();
  const escritas: string[] = [];
  let publicacoes = 0;
  let sequencia = 0;

  const confere = () => {
    for (const r of regras) {
      if (!r.migrated_to_pointer_id) continue;
      const f = fluxos.get(r.migrated_to_pointer_id);
      expect(
        r.is_active && f?.status === "active",
        `regra ${r.id} e o fluxo dela ligados ao mesmo tempo (disparo em dobro)`,
      ).toBe(false);
    }
  };

  const db: MigracaoDb = {
    async listaRegras() {
      return regras.map((r) => ({ ...r }));
    },
    async criaFluxo(_org, f: NovoFluxo) {
      if ([...fluxos.values()].some((x) => x.nome === f.nome)) return "conflito";
      const id = `fluxo-${++sequencia}`;
      fluxos.set(id, {
        id,
        nome: f.nome,
        status: "draft",
        active_version_id: null,
        draft_graph: f.graph,
      });
      escritas.push(`cria:${id}`);
      confere();
      return { id };
    },
    async vinculaRegra(_org, ruleId, v) {
      const r = regras.find((x) => x.id === ruleId)!;
      r.is_active = false;
      r.migrated_to_pointer_id = v.pointerId;
      r.migrated_was_active = v.eraAtiva;
      escritas.push(`vincula:${ruleId}`);
      confere();
    },
    async publica(_org, pointerId) {
      publicacoes++;
      if (opcoes.publicaFalha === "retorna") return { ok: false, motivo: "rpc_falhou" };
      if (
        opcoes.publicaFalha === "lanca" ||
        (opcoes.publicaFalha === "lanca-uma-vez" && publicacoes === 1)
      ) {
        throw new Error("queda");
      }
      const f = fluxos.get(pointerId)!;
      f.status = "active";
      f.active_version_id = `v-${pointerId}`;
      escritas.push(`publica:${pointerId}`);
      confere();
      return { ok: true };
    },
    async estadoDoFluxo(_org, pointerId) {
      const f = fluxos.get(pointerId);
      return f
        ? { status: f.status, active_version_id: f.active_version_id, draft_graph: f.draft_graph }
        : null;
    },
    async desativaFluxo(_org, pointerId) {
      fluxos.get(pointerId)!.status = "disabled";
      escritas.push(`desativa:${pointerId}`);
      confere();
    },
    async soltaRegra(_org, ruleId, ativa) {
      const r = regras.find((x) => x.id === ruleId)!;
      r.is_active = ativa;
      r.migrated_to_pointer_id = null;
      r.migrated_was_active = null;
      escritas.push(`solta:${ruleId}`);
      confere();
    },
  };
  return { db, fluxos, escritas, regras };
}

describe("simularMigracao — o ensaio não grava nada", () => {
  it("diz, regra a regra, se converte, se não converte (e por quê) e se já foi migrada", async () => {
    const b = bancoEmMemoria([
      regra("a"),
      regra("b", { trigger_event: "lead.inventado" }),
      regra("c", { migrated_to_pointer_id: "fluxo-x" }),
    ]);

    const r = await simularMigracao(b.db, ORG);

    expect(r.map((l) => [l.rule_id, l.resultado])).toEqual([
      ["a", "converte"],
      ["b", "nao_converte"],
      ["c", "ja_migrada"],
    ]);
    expect(r[1]!.motivo).toMatch(/^gatilho_invalido/);
    expect(b.escritas).toEqual([]);
    expect(b.fluxos.size).toBe(0);
  });
});

describe("migrarRegras", () => {
  it("regra ligada: o fluxo nasce em rascunho, a regra desliga, e só então o fluxo publica (nunca os dois ligados)", async () => {
    const b = bancoEmMemoria([regra("a")]);

    const r = await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });

    expect(r).toEqual([
      expect.objectContaining({ rule_id: "a", resultado: "migrada", fluxo_id: "fluxo-1" }),
    ]);
    expect(b.escritas).toEqual(["cria:fluxo-1", "vincula:a", "publica:fluxo-1"]);
    expect(b.regras[0]).toMatchObject({
      is_active: false,
      migrated_to_pointer_id: "fluxo-1",
      migrated_was_active: true,
    });
    expect(b.fluxos.get("fluxo-1")).toMatchObject({ status: "active", nome: "Regra a" });
  });

  it("regra pausada: o fluxo fica em rascunho — pausado como ela estava — e a regra continua desligada", async () => {
    const b = bancoEmMemoria([regra("a", { is_active: false })]);

    const r = await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });

    expect(r[0]).toMatchObject({ resultado: "migrada_pausada" });
    expect(b.fluxos.get("fluxo-1")).toMatchObject({ status: "draft", active_version_id: null });
    expect(b.regras[0]).toMatchObject({ is_active: false, migrated_was_active: false });
  });

  it("regra que não converte fica EXATAMENTE como está", async () => {
    const original = regra("b", { trigger_event: "lead.inventado" });
    const b = bancoEmMemoria([original]);

    const r = await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });

    expect(r[0]).toMatchObject({ resultado: "nao_converte" });
    expect(b.escritas).toEqual([]);
    expect(b.regras[0]).toEqual(original);
  });

  it("nome já em uso: acrescenta um sufixo em vez de falhar", async () => {
    const b = bancoEmMemoria([regra("a", { name: "Igual" }), regra("b", { name: "Igual" })]);

    await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });

    expect([...b.fluxos.values()].map((f) => f.nome)).toEqual(["Igual", "Igual (automação)"]);
  });

  it("publicação que falha DESFAZ a migração dessa regra: a regra antiga volta a ficar ligada", async () => {
    const b = bancoEmMemoria([regra("a")], { publicaFalha: "retorna" });

    const r = await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });

    expect(r[0]).toMatchObject({ resultado: "desfeita_publicacao_falhou", motivo: "rpc_falhou" });
    expect(b.regras[0]).toMatchObject({
      is_active: true,
      migrated_to_pointer_id: null,
      migrated_was_active: null,
    });
    expect(b.fluxos.get("fluxo-1")!.status).toBe("disabled");
  });

  it("queda entre desligar a regra e publicar: nunca dispara em dobro, e a rodada seguinte RETOMA", async () => {
    const b = bancoEmMemoria([regra("a")], { publicaFalha: "lanca-uma-vez" });

    await expect(migrarRegras(b.db, { orgId: ORG, userId: USUARIO })).rejects.toThrow("queda");
    // estado do meio: os dois desligados (um buraco de eventos, nunca um disparo duplo)
    expect(b.regras[0]).toMatchObject({
      is_active: false,
      migrated_to_pointer_id: "fluxo-1",
      migrated_was_active: true,
    });
    expect(b.fluxos.get("fluxo-1")).toMatchObject({ status: "draft" });

    const r = await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });

    expect(r[0]).toMatchObject({ resultado: "retomada", fluxo_id: "fluxo-1" });
    expect(b.fluxos.get("fluxo-1")!.status).toBe("active");
    expect(b.fluxos.size).toBe(1);
  });

  it("é idempotente: a segunda rodada não cria nem publica nada", async () => {
    const b = bancoEmMemoria([regra("a"), regra("p", { is_active: false })]);
    await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });
    const antes = [...b.escritas];

    const r = await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });

    expect(r.map((l) => l.resultado)).toEqual(["ja_migrada", "ja_migrada"]);
    expect(b.escritas).toEqual(antes);
  });

  it("uma regra pausada migrada NUNCA é publicada por uma segunda rodada (pausar é decisão da pessoa)", async () => {
    const b = bancoEmMemoria([regra("p", { is_active: false })]);
    await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });
    await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });
    expect(b.fluxos.get("fluxo-1")).toMatchObject({ status: "draft", active_version_id: null });
  });
});

describe("desfazerMigracao", () => {
  it("pausa o fluxo e religa a regra como estava (ligada)", async () => {
    const b = bancoEmMemoria([regra("a")]);
    await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });

    const r = await desfazerMigracao(b.db, { orgId: ORG, ruleId: "a" });

    expect(r).toEqual({ ok: true, religada: true });
    expect(b.regras[0]).toMatchObject({ is_active: true, migrated_to_pointer_id: null });
    expect(b.fluxos.get("fluxo-1")!.status).toBe("disabled");
  });

  it("uma regra que estava PAUSADA continua pausada depois do desfazer", async () => {
    const b = bancoEmMemoria([regra("p", { is_active: false })]);
    await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });

    const r = await desfazerMigracao(b.db, { orgId: ORG, ruleId: "p" });

    expect(r).toEqual({ ok: true, religada: false });
    expect(b.regras[0]!.is_active).toBe(false);
  });

  it("recusa regra que não existe ou que nunca foi migrada, sem gravar nada", async () => {
    const b = bancoEmMemoria([regra("a")]);
    expect(await desfazerMigracao(b.db, { orgId: ORG, ruleId: "zzz" })).toEqual({
      ok: false,
      motivo: "regra_nao_encontrada",
    });
    expect(await desfazerMigracao(b.db, { orgId: ORG, ruleId: "a" })).toEqual({
      ok: false,
      motivo: "regra_nao_foi_migrada",
    });
    expect(b.escritas).toEqual([]);
  });

  it("a regra pode ser migrada de novo depois de desfeita", async () => {
    const b = bancoEmMemoria([regra("a")]);
    await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });
    await desfazerMigracao(b.db, { orgId: ORG, ruleId: "a" });

    const r = await migrarRegras(b.db, { orgId: ORG, userId: USUARIO });

    expect(r[0]).toMatchObject({ resultado: "migrada", fluxo_id: "fluxo-2" });
    expect(b.fluxos.get("fluxo-2")!.status).toBe("active");
  });
});
