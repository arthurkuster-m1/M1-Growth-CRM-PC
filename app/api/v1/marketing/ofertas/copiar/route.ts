/**
 * POST /api/v1/marketing/ofertas/copiar — DUPLICA produtos neste cliente ou COPIA para outros
 * clientes da agência, em lote (`{ keys, destinos?, publicar? }`). Manager+.
 *
 *  - Sem `destinos` (ou só a própria empresa): cada produto ganha uma cópia no mesmo cliente,
 *    chamada "Nome (cópia)", "Nome (cópia 2)"…
 *  - Com `destinos`: cada produto vai, com o mesmo nome, para cada cliente escolhido. O destino
 *    NUNCA vale sozinho: é reconferido contra `clientesDaAgencia` (membro manager/admin ou
 *    super-admin pleno). Quem já tem um produto com o mesmo nome (sem distinguir caixa e acento)
 *    não recebe outro: ele é PULADO e listado — repetir a cópia não duplica nada.
 *
 * A cópia leva o RASCUNHO (o que a agência vê; sem rascunho, o publicado) e entra como rascunho,
 * a não ser que `publicar` — aí a IA do cliente passa a enxergá-la. As imagens do produto são
 * copiadas junto quando o destino é outro cliente (o arquivo mora na pasta de cada empresa).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { clientesDaAgencia } from "@/lib/agencia/acesso";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { roleAtLeast } from "@/lib/auth/types";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { lerBlocos, type Bloco } from "@/lib/marketing/blocos";
import { BUCKET_DE_IMAGENS, caminhoDaImagem } from "@/lib/marketing/imagens";
import { chaveDeSubpagina, lerChaveDePagina } from "@/lib/marketing/modulos";
import { ofertaDosBlocos } from "@/lib/marketing/oferta";
import { nomeDaCopia } from "@/lib/marketing/produtos-colagem";
import { semAcento } from "@/lib/marketing/produtos-csv";
import { sincronizarOfertas } from "@/lib/marketing/sincronizar-ofertas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MODULO = "produtos-e-ofertas";
const MAXIMO_DE_PAGINAS = 500;
const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789";
const novoId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALFABETO[b % ALFABETO.length]).join(
    "",
  );

const chaveDeOferta = z.string().refine((k) => {
  const lida = lerChaveDePagina(k);
  return lida?.modulo === MODULO && lida.tipo === "oferta";
}, "Produto inválido.");

const corpoSchema = z.object({
  keys: z.array(chaveDeOferta).min(1).max(150),
  /** Ids dos clientes de destino; vazio = duplicar neste mesmo cliente. */
  destinos: z.array(z.string().uuid()).max(20).default([]),
  publicar: z.boolean().default(false),
});

type Db = Awaited<ReturnType<typeof createClient>>;

interface Item {
  titulo: string;
  blocos: Bloco[];
  janela: number | null;
}

interface ResultadoDoDestino {
  cliente_id: string;
  cliente: string;
  criados: number;
  /** As chaves das páginas criadas (para desfazer uma duplicação). */
  chaves: string[];
  pulados: string[];
  erro: string | null;
}

/** Copia os arquivos de imagem do produto para a pasta do cliente de destino; devolve os que existem lá. */
async function levarImagens(blocos: Bloco[], deOrg: string, paraOrg: string): Promise<Bloco[]> {
  const storage = createAdminClient().storage.from(BUCKET_DE_IMAGENS);
  return Promise.all(
    blocos.map(async (b) => {
      if (b.tipo !== "oferta" || !b.imagens?.length) return b;
      const levadas: string[] = [];
      for (const nome of b.imagens) {
        const { error } = await storage.copy(
          caminhoDaImagem(deOrg, nome),
          caminhoDaImagem(paraOrg, nome),
        );
        // "Já existe" também serve: o mesmo arquivo já foi levado numa cópia anterior.
        if (!error || /exist|duplicate/i.test(error.message)) levadas.push(nome);
      }
      return { ...b, imagens: levadas };
    }),
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const { publicar } = corpo.data;
  const keys = [...new Set(corpo.data.keys)];
  const orgId = authz.org.orgId;
  const supabase = await createClient();

  // ── Os produtos de origem (rascunho; sem rascunho, o publicado) ───────────────────────────
  const { data: paginas, error } = await supabase
    .from("marketing_pages")
    .select("id, module_key, title, published_blocks, janela_ativo_meses")
    .eq("organization_id", orgId)
    .in("module_key", keys);
  if (error) return fail("internal_error", t("Erro ao ler os produtos."), 500, { requestId });
  const linhas = (paginas ?? []) as Array<{
    id: string;
    module_key: string;
    title: string;
    published_blocks: unknown;
    janela_ativo_meses: number | null;
  }>;
  const { data: rascunhos } = await supabase
    .from("marketing_page_drafts")
    .select("page_id, blocks")
    .in(
      "page_id",
      linhas.map((l) => l.id),
    );
  const doRascunho = new Map(
    ((rascunhos ?? []) as Array<{ page_id: string; blocks: unknown }>).map((r) => [
      r.page_id,
      r.blocks,
    ]),
  );
  const porChave = new Map(linhas.map((l) => [l.module_key, l]));
  const itens: Item[] = keys.flatMap((k) => {
    const l = porChave.get(k);
    if (!l) return [];
    const blocos = lerBlocos(doRascunho.get(l.id) ?? l.published_blocks);
    if (!ofertaDosBlocos(blocos)) return [];
    return [{ titulo: l.title, blocos, janela: l.janela_ativo_meses }];
  });
  if (itens.length === 0) {
    return fail("not_found", t("Nenhum dos produtos foi encontrado."), 404, { requestId });
  }

  // ── Os destinos, reconferidos ─────────────────────────────────────────────────────────────
  const pedidos = [...new Set(corpo.data.destinos)];
  const alvos: Array<{ id: string; nome: string; db: Db; mesmo: boolean }> = [];
  if (pedidos.length === 0 || (pedidos.length === 1 && pedidos[0] === orgId)) {
    alvos.push({ id: orgId, nome: authz.org.name, db: supabase, mesmo: true });
  } else {
    if (authz.user.support) {
      return fail("forbidden", t("Você não tem acesso a este cliente."), 403, { requestId });
    }
    const meus = await clientesDaAgencia(authz.user);
    for (const id of pedidos) {
      if (id === orgId) {
        alvos.push({ id: orgId, nome: authz.org.name, db: supabase, mesmo: true });
        continue;
      }
      const c = meus.find((x) => x.id === id);
      const pode = c && (c.role === "plataforma" || roleAtLeast(c.role, "manager"));
      if (!c || !pode) {
        return fail("forbidden", t("Você não tem acesso a este cliente."), 403, { requestId });
      }
      alvos.push({
        id: c.id,
        nome: c.name,
        db: c.role === "plataforma" ? (createAdminClient() as never) : supabase,
        mesmo: false,
      });
    }
  }

  // ── Copiar para cada destino ─────────────────────────────────────────────────────────────
  const resultados: ResultadoDoDestino[] = [];
  for (const alvo of alvos) {
    const r: ResultadoDoDestino = {
      cliente_id: alvo.id,
      cliente: alvo.nome,
      criados: 0,
      chaves: [],
      pulados: [],
      erro: null,
    };
    resultados.push(r);

    const { data: existentes, error: erroDeLeitura } = await alvo.db
      .from("marketing_pages")
      .select("title, sort_order")
      .eq("organization_id", alvo.id)
      .like("module_key", `${MODULO}--%`)
      .limit(1000);
    if (erroDeLeitura) {
      r.erro = t("Erro ao ler os produtos do cliente.");
      continue;
    }
    const lista = (existentes ?? []) as Array<{ title: string; sort_order: number }>;
    const emUso = new Set(lista.map((p) => semAcento(p.title)));
    let posicao = lista.reduce((m, p) => Math.max(m, p.sort_order), -1) + 1;

    const novas: Array<{ chave: string; titulo: string; blocos: Bloco[]; janela: number | null }> =
      [];
    for (const item of itens) {
      const titulo = alvo.mesmo ? nomeDaCopia(item.titulo, emUso) : item.titulo;
      if (emUso.has(semAcento(titulo))) {
        r.pulados.push(item.titulo);
        continue;
      }
      emUso.add(semAcento(titulo));
      novas.push({
        chave: chaveDeSubpagina(MODULO, "oferta", novoId()),
        titulo,
        blocos: alvo.mesmo ? item.blocos : await levarImagens(item.blocos, orgId, alvo.id),
        janela: item.janela,
      });
    }
    if (novas.length === 0) continue;
    if (lista.length + novas.length > MAXIMO_DE_PAGINAS) {
      r.erro = t("O limite é de 500 produtos por cliente. Apague os que não usa mais.");
      continue;
    }

    const agora = new Date().toISOString();
    const { data: criadas, error: erroAoCriar } = await alvo.db
      .from("marketing_pages")
      .insert(
        novas.map((n) => ({
          organization_id: alvo.id,
          module_key: n.chave,
          title: n.titulo,
          sort_order: posicao++,
          janela_ativo_meses: n.janela,
          ...(publicar
            ? { published_blocks: n.blocos, published_at: agora, published_by: authz.user.id }
            : {}),
        })),
      )
      .select("id, module_key");
    if (erroAoCriar || !criadas) {
      r.erro = t("Erro ao criar os produtos.");
      continue;
    }
    const idDaChave = new Map(
      (criadas as Array<{ id: string; module_key: string }>).map((p) => [p.module_key, p.id]),
    );
    const { error: erroDosRascunhos } = await alvo.db.from("marketing_page_drafts").insert(
      novas.map((n) => ({
        page_id: idDaChave.get(n.chave)!,
        organization_id: alvo.id,
        blocks: n.blocos,
        updated_by: authz.user.id,
      })),
    );
    if (erroDosRascunhos) {
      await alvo.db
        .from("marketing_pages")
        .delete()
        .eq("organization_id", alvo.id)
        .in("id", [...idDaChave.values()]);
      r.erro = t("Erro ao criar os produtos.");
      continue;
    }
    r.criados = novas.length;
    r.chaves = novas.map((n) => n.chave);

    await audit({
      organizationId: alvo.id,
      actorUserId: authz.user.id,
      action: "marketing_page.offers_copied",
      resourceType: "marketing_pages",
      resourceId: null,
      requestId,
      metadata: {
        criados: novas.length,
        pulados: r.pulados.length,
        origem: orgId,
        publicados: publicar,
      },
    });
    if (publicar) await sincronizarOfertas(alvo.id);
  }

  const criados = resultados.reduce((n, r) => n + r.criados, 0);
  return ok({ resultados, publicados: publicar }, { requestId, status: criados > 0 ? 201 : 200 });
}
