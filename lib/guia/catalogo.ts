/**
 * O MAPA DO PROCESSO DE MARKETING, em código — `docs/MAPA-DO-PROCESSO-M1.md` (aprovado pelo Arthur
 * em 20/11/2026) é a fonte; este arquivo é a mesma lista, que o diagnóstico lê.
 *
 * Mora em CÓDIGO (versionado e testado), não no banco, para ninguém quebrar o mapa sem querer.
 * Mudou o mapa? Mude o documento e este arquivo juntos; `catalogo.test.ts` barra id repetido,
 * dependência que não existe, ciclo e tela que não tem porta.
 *
 * Os passos P70–P73 do documento (renovar criativos, refazer concorrência, revisar oferta e
 * persona) NÃO são passos separados: são o prazo de validade (`venceDias`) de P51, P22, P24 e
 * P21 — quando vence, o passo volta como "desatualizado".
 *
 * Sem `detectar` o passo é manual (o documento marca com 🔴). Alguns que o documento marcou 🟡
 * começam manuais na G1 porque ainda não têm um sinal confiável:
 *   P00.3 marca · P26 lead magnet · P46 1ª resposta (G6 mede) · P48 checkout.
 * (P00.6 passou a ler os links do perfil na G2.)
 */
import {
  NICHOS,
  type Classificacao,
  type Deteccao,
  type Leitura,
  type PassoDoMapa,
  type Perfil,
  type Sinais,
} from "./tipos";

// ─── ferramentas de quem escreve os detectores ────────────────────────────────────────────────

/** `"EEEEE"` → as 5 classes na ordem CL SV IM LJ IN (o documento escreve a matriz assim). */
function m(linha: string): PassoDoMapa["classes"] {
  if (!/^[ERO-]{5}$/.test(linha)) throw new Error(`matriz inválida: ${linha}`);
  return linha.split("") as unknown as PassoDoMapa["classes"];
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/** Lê um grupo de sinais; se a leitura falhou, o passo vira "não consegui verificar" (nunca "feito"). */
function lendo<T>(l: Leitura<T>, f: (valor: T) => Deteccao): Deteccao {
  if (!l.ok) return { estado: "nao_verificado", evidencia: `Não consegui verificar: ${l.motivo}` };
  return f(l.valor);
}

/** Uma página da Estratégia: publicada = feito; só rascunho = em andamento; nada = falta. */
function paginaDa(chave: string) {
  return (s: Sinais): Deteccao =>
    lendo(s.paginas, (p) => {
      if (!(chave in p)) return { estado: "falta", evidencia: "Página ainda não criada" };
      const publicadaEm = p[chave];
      return publicadaEm
        ? { estado: "feito", evidencia: "Página publicada", quando: publicadaEm }
        : { estado: "em_andamento", evidencia: "Página criada, ainda em rascunho" };
    });
}

/** Subpáginas de um tipo (`<módulo>--<tipo>-<id>`): precisa de `minimo` publicadas. */
function subpaginasDe(modulo: string, tipo: string, minimo: number, rotulo: [string, string]) {
  const prefixo = `${modulo}--${tipo}-`;
  return (s: Sinais): Deteccao =>
    lendo(s.paginas, (p) => {
      const todas = Object.keys(p).filter((k) => k.startsWith(prefixo));
      const publicadas = todas.filter((k) => p[k]);
      const quando =
        publicadas
          .map((k) => p[k] as string)
          .sort()
          .at(-1) ?? null;
      const dizer = `${plural(publicadas.length, rotulo[0], rotulo[1])} publicada${publicadas.length === 1 ? "" : "s"}`;
      if (publicadas.length >= minimo) return { estado: "feito", evidencia: dizer, quando };
      if (todas.length > 0) {
        return {
          estado: "em_andamento",
          evidencia: `${dizer} (precisa de ${minimo}); ${plural(todas.length - publicadas.length, "em rascunho", "em rascunho")}`,
          quando,
        };
      }
      return { estado: "falta", evidencia: `Nenhum ${rotulo[0]} criado (precisa de ${minimo})` };
    });
}

const estrategia = (modulo: string, rotulo: string) => ({
  href: `/app/marketing/estrategia/${modulo}`,
  rotulo,
});

// ─── o catálogo ───────────────────────────────────────────────────────────────────────────────

export const PASSOS: readonly PassoDoMapa[] = [
  // ── Fase 0 — Cadastros essenciais ──────────────────────────────────────────────────────────
  {
    id: "P00.1",
    fase: "cadastros",
    titulo: "Perfil do negócio",
    porque: "Sem saber o nicho e como a empresa vende, o Guia não sabe o que é essencial.",
    classes: m("EEEEE"),
    depende: [],
    confianca: "automatica",
    detectar: (_s, perfil) =>
      perfil
        ? { estado: "feito", evidencia: "Perfil preenchido" }
        : { estado: "falta", evidencia: "Perfil ainda não preenchido" },
    onde: { href: "/app/guia", rotulo: "Guia" },
    venceDias: 365,
  },
  {
    id: "P00.2",
    fase: "cadastros",
    titulo: "Dados da empresa",
    porque: "Nome e fuso horário certos fazem datas, relatórios e avisos saírem corretos.",
    classes: m("EEEEE"),
    depende: [],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.empresa, (e) =>
        e.temNome && e.temFuso
          ? { estado: "feito", evidencia: "Nome e fuso horário preenchidos" }
          : { estado: "falta", evidencia: "Falta nome ou fuso horário" },
      ),
    onde: { href: "/app/settings/tenant", rotulo: "Sua empresa e marca" },
  },
  {
    id: "P00.3",
    fase: "cadastros",
    titulo: "Marca no sistema (logo e cor)",
    porque: "O cliente vê o sistema com a cara dele.",
    classes: m("RRRRR"),
    depende: [],
    confianca: "manual",
    onde: { href: "/app/settings/tenant", rotulo: "Sua empresa e marca" },
  },
  {
    id: "P00.4",
    lado: "cliente",
    fase: "cadastros",
    titulo: "Equipe e papéis",
    porque: "Cada tarefa e cada lead precisa de uma pessoa responsável.",
    classes: m("EEEEE"),
    depende: [],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.equipe, (e) =>
        e.membrosAtivos >= 2
          ? { estado: "feito", evidencia: `${e.membrosAtivos} pessoas ativas na equipe` }
          : { estado: "falta", evidencia: "Só há uma pessoa na equipe" },
      ),
    onde: { href: "/app/team", rotulo: "Equipe" },
  },
  {
    id: "P00.5",
    lado: "cliente",
    fase: "cadastros",
    titulo: "Acessos de anúncio (Business Manager, conta, Página, Pixel)",
    porque: "É por aqui que os anúncios e as vendas se encontram.",
    classes: m("EEEEE"),
    depende: ["P00.1"],
    confianca: "parcial",
    detectar: (s) =>
      lendo(s.metaCapi, (c) => {
        if (c.existe && c.ativo && c.temDataset) {
          return { estado: "feito", evidencia: "Meta Ads conectado, com dataset e ligado" };
        }
        if (c.existe)
          return {
            estado: "em_andamento",
            evidencia: "Meta Ads começou a ser conectado, falta ligar ou informar o dataset",
          };
        return { estado: "falta", evidencia: "Meta Ads ainda não conectado" };
      }),
    onde: { href: "/app/connections", rotulo: "Conexões › Meta Ads" },
  },
  {
    id: "P00.6",
    fase: "cadastros",
    titulo: "Canais online listados (site, Instagram, Google)",
    porque: "É o ponto de partida do Posicionamento.",
    classes: m("RRRRR"),
    depende: ["P00.1"],
    confianca: "parcial",
    detectar: (_s, perfil) =>
      (perfil?.canaisOnline ?? 0) > 0
        ? {
            estado: "feito",
            evidencia: `${plural(perfil?.canaisOnline ?? 0, "canal informado", "canais informados")} no perfil`,
          }
        : { estado: "falta", evidencia: "Nenhum canal online informado no perfil" },
    onde: estrategia("posicionamento-zmot", "Estratégia › Posicionamento"),
    venceDias: 365,
  },

  // ── Fase 1 — Diagnóstico ───────────────────────────────────────────────────────────────────
  {
    id: "P10",
    fase: "diagnostico",
    titulo: "Kick-off e mapeamento do funil atual",
    porque: "Entende de onde vêm os clientes hoje, onde trava e o que já foi tentado.",
    classes: m("EEEEE"),
    depende: ["P00.1"],
    confianca: "automatica",
    detectar: paginaDa("mapeamento-do-funil"),
    onde: estrategia("mapeamento-do-funil", "Estratégia › Mapeamento do funil"),
    venceDias: 365,
  },
  {
    id: "P11",
    fase: "diagnostico",
    titulo: "Posicionamento e canais",
    porque: "Reúne tudo que o público vê da empresa, para achar o que melhorar.",
    classes: m("RRRRR"),
    depende: ["P00.6"],
    confianca: "automatica",
    detectar: paginaDa("posicionamento-zmot"),
    onde: estrategia("posicionamento-zmot", "Estratégia › Posicionamento"),
    venceDias: 365,
  },
  {
    id: "P12",
    fase: "diagnostico",
    titulo: "Identidade da marca",
    porque: "Cores, tom de voz e propósito deixam toda comunicação coerente.",
    classes: m("RRRRE"),
    depende: ["P10"],
    confianca: "automatica",
    detectar: paginaDa("identidade-da-marca"),
    onde: estrategia("identidade-da-marca", "Estratégia › Identidade da marca"),
  },

  // ── Fase 2 — Produto e oferta ──────────────────────────────────────────────────────────────
  {
    id: "P20",
    fase: "produto-e-oferta",
    titulo: "Análise de mercado",
    porque: "Mostra o tamanho do mercado, as tendências e a época certa de vender.",
    classes: m("RRRRE"),
    depende: ["P10"],
    confianca: "automatica",
    detectar: (s) => {
      const a = paginaDa("estudo-de-persona--pesquisa-de-mercado")(s);
      const b = paginaDa("analise-de-concorrencia--pesquisa-de-mercado")(s);
      return a.estado === "feito"
        ? a
        : b.estado === "feito"
          ? b
          : a.estado === "em_andamento"
            ? a
            : b;
    },
    onde: estrategia("estudo-de-persona", "Estratégia › Estudo de persona"),
    venceDias: 365,
  },
  {
    id: "P21",
    fase: "produto-e-oferta",
    titulo: "Estudo de persona",
    porque: "Quem é o cliente ideal, o que ele sente e o que o faz comprar.",
    classes: m("EEEEE"),
    depende: ["P10"],
    confianca: "automatica",
    detectar: subpaginasDe("estudo-de-persona", "persona", 1, ["persona", "personas"]),
    onde: estrategia("estudo-de-persona", "Estratégia › Estudo de persona"),
    venceDias: 365,
  },
  {
    id: "P22",
    fase: "produto-e-oferta",
    titulo: "Análise de concorrência (pelo menos 3)",
    porque: "Mostra onde a empresa pode ser diferente e o que o mercado já oferece.",
    classes: m("EEEEE"),
    depende: ["P10"],
    confianca: "automatica",
    detectar: subpaginasDe("analise-de-concorrencia", "concorrente", 3, [
      "concorrente",
      "concorrentes",
    ]),
    onde: estrategia("analise-de-concorrencia", "Estratégia › Análise de concorrência"),
    venceDias: 183,
  },
  {
    id: "P23",
    fase: "produto-e-oferta",
    titulo: "Planejamento empresarial",
    porque: "Metas, números e capacidade: quanto dá para vender e crescer.",
    classes: m("EERRE"),
    depende: ["P10", "P21"],
    confianca: "automatica",
    detectar: paginaDa("planejamento-empresarial"),
    onde: estrategia("planejamento-empresarial", "Estratégia › Planejamento empresarial"),
    venceDias: 183,
  },
  {
    id: "P24",
    fase: "produto-e-oferta",
    titulo: "Produtos e ofertas",
    porque: "A oferta clara (o que, por quanto, com qual garantia) é o que a campanha vende.",
    classes: m("EEEEE"),
    depende: ["P21", "P22"],
    confianca: "automatica",
    detectar: subpaginasDe("produtos-e-ofertas", "oferta", 1, ["oferta", "ofertas"]),
    onde: estrategia("produtos-e-ofertas", "Estratégia › Produtos e ofertas"),
    venceDias: 183,
  },
  {
    id: "P25",
    fase: "produto-e-oferta",
    titulo: "Arquitetura de premissas (posicionamento persuasivo)",
    porque: "Define o argumento que convence a persona a escolher a oferta.",
    classes: m("RRRRE"),
    depende: ["P21", "P24"],
    confianca: "automatica",
    detectar: paginaDa("estudo-de-persona--arquitetura-de-premissas"),
    onde: estrategia("estudo-de-persona", "Estratégia › Estudo de persona"),
    venceDias: 365,
  },
  {
    id: "P26",
    fase: "produto-e-oferta",
    titulo: "Lead magnet (a isca)",
    porque: "Uma isca útil traz contatos mesmo de quem ainda não quer comprar.",
    classes: m("ORRRE"),
    depende: ["P24"],
    confianca: "manual",
    onde: estrategia("produtos-e-ofertas", "Estratégia › Produtos e ofertas"),
  },

  // ── Fase 3 — Captação ──────────────────────────────────────────────────────────────────────
  {
    id: "P30",
    fase: "captacao",
    titulo: "Landing page da oferta",
    porque: "É a página que transforma o clique do anúncio em contato.",
    classes: m("EEERE"),
    depende: ["P24"],
    confianca: "parcial",
    detectar: (s) =>
      lendo(s.landingPages, (l) =>
        l.comUrl > 0
          ? {
              estado: "feito",
              evidencia: `${plural(l.comUrl, "página cadastrada", "páginas cadastradas")} com endereço`,
            }
          : l.total > 0
            ? { estado: "em_andamento", evidencia: "Página cadastrada, mas sem o endereço (URL)" }
            : { estado: "falta", evidencia: "Nenhuma landing page cadastrada em campanha" },
      ),
    onde: { href: "/app/marketing/geracao-de-demanda", rotulo: "Campanhas › Cadastro" },
    venceDias: 183,
  },
  {
    id: "P31",
    fase: "captacao",
    titulo: "Site institucional",
    porque: "É onde o cliente confere se a empresa é séria antes de comprar.",
    classes: m("RRREO"),
    depende: ["P12"],
    confianca: "manual",
    onde: { href: "/app/guia", rotulo: "Guia" },
    venceDias: 365,
  },
  {
    id: "P32",
    fase: "captacao",
    titulo: "Pixel e CAPI da Meta funcionando",
    porque: "Faz a Meta aprender quais leads viram venda e entregar anúncio melhor.",
    classes: m("EEEEE"),
    depende: ["P00.5"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.metaCapi, (c) =>
        c.existe && c.ativo && c.temDataset
          ? { estado: "feito", evidencia: "Meta CAPI ligado, com dataset" }
          : c.existe
            ? {
                estado: "em_andamento",
                evidencia: "Meta CAPI configurado, mas desligado ou sem dataset",
              }
            : { estado: "falta", evidencia: "Meta CAPI ainda não configurado" },
      ),
    onde: { href: "/app/connections", rotulo: "Conexões › Meta Ads" },
  },
  {
    id: "P33",
    fase: "captacao",
    titulo: "Leads chegando no CRM",
    porque: "Se o lead não chega, nada do resto funciona.",
    classes: m("EEEEE"),
    depende: ["P30"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.leads, (l) =>
        l.deCampanhaEm30Dias > 0
          ? {
              estado: "feito",
              evidencia: `${plural(l.deCampanhaEm30Dias, "lead de campanha", "leads de campanha")} nos últimos 30 dias`,
            }
          : { estado: "falta", evidencia: "Nenhum lead de campanha nos últimos 30 dias" },
      ),
    onde: { href: "/app/connections", rotulo: "Conexões › Webhooks" },
  },
  {
    id: "P34",
    fase: "captacao",
    titulo: "WhatsApp conectado",
    porque: "É por onde a maioria dos leads conversa.",
    classes: m("EEEEE"),
    depende: [],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.whatsapp, (w) =>
        w.conectados > 0
          ? {
              estado: "feito",
              evidencia: `${plural(w.conectados, "número conectado", "números conectados")}`,
            }
          : { estado: "falta", evidencia: "Nenhum número de WhatsApp conectado" },
      ),
    onde: { href: "/app/connections", rotulo: "Conexões" },
  },
  {
    id: "P35",
    lado: "cliente",
    fase: "captacao",
    titulo: "Google Meu Negócio e presença local",
    porque: "Quem procura perto de casa acha a empresa sem pagar anúncio.",
    classes: m("RORR-"),
    depende: ["P11"],
    confianca: "manual",
    onde: { href: "/app/guia", rotulo: "Guia" },
    venceDias: 365,
  },

  // ── Fase 4 — Venda e atendimento ───────────────────────────────────────────────────────────
  {
    id: "P40",
    fase: "venda",
    titulo: "Funil do CRM com etapas de ganhou e perdeu",
    porque: "Mostra em que etapa cada lead está e onde ele trava.",
    classes: m("EEEEE"),
    depende: ["P10"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.funil, (f) =>
        f.comGanhouEPerdeu > 0
          ? {
              estado: "feito",
              evidencia: `${plural(f.comGanhouEPerdeu, "funil ativo", "funis ativos")} com etapas de ganhou e perdeu`,
            }
          : { estado: "falta", evidencia: "Nenhum funil ativo com etapa de ganhou e de perdeu" },
      ),
    onde: { href: "/app/clientes", rotulo: "CRM › Funis" },
  },
  {
    id: "P41",
    fase: "venda",
    titulo: "Próximo passo padrão por etapa",
    porque: "Nenhum lead fica parado: cada etapa já diz o que fazer em seguida.",
    classes: m("RRRRR"),
    depende: ["P40"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.proximaAcaoPorEtapa, (e) =>
        e.etapasComPasso > 0
          ? {
              estado: "feito",
              evidencia: `${plural(e.etapasComPasso, "etapa com próximo passo", "etapas com próximo passo")}`,
            }
          : { estado: "falta", evidencia: "Nenhuma etapa com próximo passo padrão" },
      ),
    onde: { href: "/app/clientes", rotulo: "CRM › etapas do funil" },
  },
  {
    id: "P42",
    fase: "venda",
    titulo: "Tipos de agendamento e horários de atendimento",
    porque: "Sem horários livres, ninguém consegue marcar com a equipe.",
    classes: m("EEE-O"),
    soModelos: ["agendamento"],
    depende: ["P40"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.agenda, (a) =>
        a.tipos > 0 && a.atendentesComHorario > 0
          ? {
              estado: "feito",
              evidencia: `${plural(a.tipos, "tipo de agendamento", "tipos de agendamento")} e ${plural(a.atendentesComHorario, "pessoa com horário definido", "pessoas com horário definido")}`,
            }
          : a.tipos > 0 || a.atendentesComHorario > 0
            ? {
                estado: "em_andamento",
                evidencia:
                  a.tipos > 0
                    ? "Há tipos de agendamento, mas ninguém tem horário de atendimento definido"
                    : "Há horários, mas nenhum tipo de agendamento",
              }
            : { estado: "falta", evidencia: "Sem tipos de agendamento e sem horários definidos" },
      ),
    onde: { href: "/app/settings/tenant/agenda", rotulo: "Configurações › Agenda" },
  },
  {
    id: "P43",
    fase: "venda",
    titulo: "Google Agenda conectado",
    porque: "Os compromissos aparecem na agenda que a equipe já usa.",
    classes: m("RRR-O"),
    soModelos: ["agendamento"],
    depende: ["P42"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.googleAgenda, (g) =>
        g.conectados > 0
          ? {
              estado: "feito",
              evidencia: `${plural(g.conectados, "pessoa conectada", "pessoas conectadas")} ao Google Agenda`,
            }
          : { estado: "falta", evidencia: "Ninguém conectou o Google Agenda" },
      ),
    onde: { href: "/app/agenda", rotulo: "Agenda" },
  },
  {
    id: "P44",
    fase: "venda",
    titulo: "Anti no-show (confirmação e lembrete)",
    porque: "Cliente que confirma e é lembrado falta bem menos.",
    classes: m("ERR--"),
    soModelos: ["agendamento"],
    depende: ["P42"],
    confianca: "parcial",
    detectar: (s) =>
      lendo(s.antiNoShow, (n) =>
        n.fluxos > 0
          ? {
              estado: "feito",
              evidencia: `${plural(n.fluxos, "fluxo de confirmação", "fluxos de confirmação")} configurado${n.fluxos === 1 ? "" : "s"}`,
            }
          : { estado: "falta", evidencia: "Nenhum fluxo de confirmação e lembrete" },
      ),
    onde: { href: "/app/automacoes", rotulo: "Automações" },
  },
  {
    id: "P45",
    fase: "venda",
    titulo: "Respostas rápidas do atendimento",
    porque: "A equipe responde igual e mais depressa.",
    classes: m("RRRRR"),
    depende: ["P34"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.respostasRapidas, (r) =>
        r.total >= 5
          ? { estado: "feito", evidencia: `${r.total} respostas rápidas` }
          : r.total > 0
            ? {
                estado: "em_andamento",
                evidencia: `${plural(r.total, "resposta rápida", "respostas rápidas")} (o ideal é pelo menos 5)`,
              }
            : { estado: "falta", evidencia: "Nenhuma resposta rápida" },
      ),
    onde: { href: "/app/templates", rotulo: "Respostas rápidas" },
  },
  {
    id: "P46",
    fase: "venda",
    titulo: "Resposta rápida ao lead (primeira resposta em minutos)",
    porque: "Lead respondido na hora converte muito mais que o respondido horas depois.",
    classes: m("EEEER"),
    depende: ["P33", "P34"],
    confianca: "manual",
    onde: { href: "/app/automacoes", rotulo: "Automações" },
  },
  {
    id: "P47",
    lado: "cliente",
    fase: "venda",
    titulo: "Registro de vendas no CRM",
    porque: "É o que fecha o ciclo: sem venda registrada, não dá para saber o que deu resultado.",
    classes: m("EEEEE"),
    depende: ["P40"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.vendas, (v) =>
        v.em90Dias > 0
          ? {
              estado: "feito",
              evidencia: `${plural(v.em90Dias, "venda registrada", "vendas registradas")} nos últimos 90 dias`,
            }
          : { estado: "falta", evidencia: "Nenhuma venda registrada nos últimos 90 dias" },
      ),
    onde: { href: "/app/clientes", rotulo: "CRM › Vendas" },
  },
  {
    id: "P48",
    fase: "venda",
    titulo: "Checkout ou link de pagamento",
    porque: "Vender online exige um jeito fácil de pagar.",
    classes: m("-O-EE"),
    soModelos: ["checkout", "lancamento"],
    depende: ["P24"],
    confianca: "manual",
    onde: { href: "/app/connections", rotulo: "Conexões" },
  },

  // ── Fase 5 — Geração de demanda ────────────────────────────────────────────────────────────
  {
    id: "P50",
    fase: "demanda",
    titulo: "Estratégia de marketing",
    porque: "Define qual canal, qual mensagem e qual meta, antes de gastar com anúncio.",
    classes: m("EEEEE"),
    depende: ["P22", "P24"],
    confianca: "automatica",
    detectar: subpaginasDe("estrategia-de-marketing", "estrategia", 1, [
      "estratégia",
      "estratégias",
    ]),
    onde: estrategia("estrategia-de-marketing", "Estratégia › Estratégias de marketing"),
    venceDias: 183,
  },
  {
    id: "P51",
    fase: "demanda",
    titulo: "Criativos (pelo menos 3 variações)",
    porque: "Testar variações descobre qual gancho funciona; criativo velho cansa o público.",
    classes: m("EEEEE"),
    depende: ["P50"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.criativos, (c) =>
        c.total >= 3
          ? {
              estado: "feito",
              evidencia: `${c.total} criativos cadastrados`,
              quando: c.ultimoCriadoEm,
            }
          : c.total > 0
            ? {
                estado: "em_andamento",
                evidencia: `${plural(c.total, "criativo cadastrado", "criativos cadastrados")} (o ideal é pelo menos 3)`,
                quando: c.ultimoCriadoEm,
              }
            : { estado: "falta", evidencia: "Nenhum criativo cadastrado" },
      ),
    onde: { href: "/app/marketing/geracao-de-demanda", rotulo: "Campanhas › Criativos" },
    venceDias: 30,
    // Criativo antigo só preocupa se há campanha rodando.
    venceSe: (s) => s.campanhas.ok && s.campanhas.valor.ativas > 0,
  },
  {
    id: "P52",
    fase: "demanda",
    titulo: "Primeira campanha cadastrada (orçamento, período e meta)",
    porque: "A campanha com meta é o que permite medir e comparar.",
    classes: m("EEEEE"),
    depende: ["P30", "P32", "P51"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.campanhas, (c) =>
        c.ativasComMeta > 0
          ? {
              estado: "feito",
              evidencia: `${plural(c.ativasComMeta, "campanha ativa com meta", "campanhas ativas com meta")}`,
            }
          : c.total > 0
            ? {
                estado: "em_andamento",
                evidencia:
                  "Há campanha cadastrada, mas nenhuma ativa com meta de leads e de custo por lead",
              }
            : { estado: "falta", evidencia: "Nenhuma campanha cadastrada" },
      ),
    onde: { href: "/app/marketing/geracao-de-demanda", rotulo: "Campanhas › Cadastro" },
  },
  {
    id: "P53",
    fase: "demanda",
    titulo: "Campanha sincronizada com a Meta",
    porque: "Os números entram sozinhos, sem digitar.",
    classes: m("EEEEE"),
    depende: ["P52", "P00.5"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.campanhas, (c) =>
        c.ultimoDiaDaMeta
          ? {
              estado: "feito",
              evidencia: `Último dado da Meta: ${c.ultimoDiaDaMeta}`,
              quando: c.ultimoDiaDaMeta,
            }
          : { estado: "falta", evidencia: "Nenhum dado vindo da Meta ainda" },
      ),
    onde: { href: "/app/marketing/geracao-de-demanda", rotulo: "Campanhas" },
    // Dado da Meta parado há mais de uma semana, com campanha ativa, é problema.
    venceDias: 7,
    venceSe: (s) => s.campanhas.ok && s.campanhas.valor.ativas > 0,
  },
  {
    id: "P54",
    fase: "demanda",
    titulo: "Abordagem do lead (a primeira mensagem)",
    porque: "A primeira mensagem decide se o lead responde.",
    classes: m("RRRRR"),
    depende: ["P52"],
    confianca: "parcial",
    detectar: (s) =>
      lendo(s.abordagens, (a) =>
        a.total > 0
          ? {
              estado: "feito",
              evidencia: `${plural(a.total, "abordagem cadastrada", "abordagens cadastradas")}`,
            }
          : { estado: "falta", evidencia: "Nenhuma abordagem cadastrada" },
      ),
    onde: { href: "/app/marketing/geracao-de-demanda", rotulo: "Campanhas › Abordagens" },
  },
  {
    id: "P55",
    fase: "demanda",
    titulo: "Prospecção ativa (outbound)",
    porque: "Procurar o cliente em vez de esperar o anúncio.",
    classes: m("ORO--"),
    depende: ["P21"],
    confianca: "manual",
    onde: estrategia("estrategia-de-marketing", "Estratégia › Estratégias de marketing"),
  },
  {
    id: "P56",
    fase: "demanda",
    titulo: "Programa de indicação e parcerias",
    porque: "Cliente satisfeito indica; parceiro leva a oferta a quem já confia nele.",
    classes: m("ROROO"),
    depende: ["P24"],
    confianca: "manual",
    onde: estrategia("estrategia-de-marketing", "Estratégia › Estratégias de marketing"),
  },
  {
    id: "P57",
    fase: "demanda",
    titulo: "Social media e conteúdo orgânico",
    porque: "Conteúdo constante mantém a marca lembrada e barateia o contato.",
    classes: m("RRRRE"),
    depende: ["P12"],
    confianca: "manual",
    onde: estrategia("estrategia-de-marketing", "Estratégia › Estratégias de marketing"),
  },

  // ── Fase 6 — Operação semanal ──────────────────────────────────────────────────────────────
  {
    id: "P60",
    fase: "operacao",
    titulo: "Cronograma da semana (agência e cliente)",
    porque: "Cada pessoa sabe o que é dela na semana.",
    classes: m("EEEEE"),
    depende: ["P50"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.cronograma, (c) =>
        c.itens > 0
          ? {
              estado: "feito",
              evidencia: `${plural(c.itens, "ação no cronograma", "ações no cronograma")}`,
              quando: c.ultimaAtividadeEm,
            }
          : { estado: "falta", evidencia: "Cronograma vazio" },
      ),
    onde: { href: "/app/marketing/cronograma", rotulo: "Marketing › Cronograma" },
    venceDias: 14,
  },
  {
    id: "P61",
    fase: "operacao",
    titulo: "Autoavaliação da semana",
    porque: "Olhar para trás toda semana é o que faz o próximo ciclo melhorar.",
    classes: m("RRRRR"),
    depende: ["P60"],
    confianca: "automatica",
    detectar: (s) =>
      lendo(s.autoavaliacao, (a) =>
        a.ultimaEm
          ? {
              estado: "feito",
              evidencia: `Última autoavaliação em ${a.ultimaEm.slice(0, 10)}`,
              quando: a.ultimaEm,
            }
          : { estado: "falta", evidencia: "Nenhuma autoavaliação feita" },
      ),
    onde: { href: "/app/marketing/cronograma", rotulo: "Cronograma" },
    venceDias: 10,
  },
  {
    id: "P62",
    fase: "operacao",
    titulo: "Dashboards conferidos",
    porque: "Os números só ajudam se alguém olha.",
    classes: m("RRRRR"),
    depende: ["P53", "P47"],
    confianca: "manual",
    onde: { href: "/app/marketing/dashboards", rotulo: "Marketing › Dashboards" },
    venceDias: 30,
  },
  {
    id: "P63",
    fase: "operacao",
    titulo: "Meta e realizado do mês",
    porque: "Dá para saber se o mês está no ritmo antes de ele acabar.",
    classes: m("RRRRR"),
    depende: ["P23", "P53"],
    confianca: "parcial",
    detectar: (s) =>
      lendo(s.campanhas, (c) =>
        c.ativasComMeta > 0
          ? {
              estado: "feito",
              evidencia: `${plural(c.ativasComMeta, "campanha ativa com meta", "campanhas ativas com meta")}`,
            }
          : { estado: "falta", evidencia: "Nenhuma campanha ativa com meta preenchida" },
      ),
    onde: { href: "/app/marketing/geracao-de-demanda", rotulo: "Campanhas › Visão geral" },
  },

  // ── Fase 7 — Otimização contínua (rotinas manuais; P70–P73 são os prazos acima) ────────────
  {
    id: "P74",
    fase: "otimizacao",
    titulo: "Reunião de resultados do mês e aprendizados",
    porque: "Registrar o que funcionou e o que não funcionou evita repetir erro.",
    classes: m("RRRRR"),
    depende: ["P52"],
    confianca: "manual",
    onde: { href: "/app/anotacoes", rotulo: "Anotações" },
    venceDias: 30,
    contaNaProntidao: false,
  },
  {
    id: "P75",
    fase: "otimizacao",
    titulo: "Reativar a base antiga",
    porque: "Leads que sumiram custam menos para reconquistar que um novo.",
    classes: m("OOOOO"),
    depende: ["P47"],
    confianca: "manual",
    onde: { href: "/app/clientes", rotulo: "CRM" },
    venceDias: 90,
    contaNaProntidao: false,
  },
];

export const passoPorId = (id: string): PassoDoMapa | undefined => PASSOS.find((p) => p.id === id);

/** A classe de um passo para um perfil — a matriz do mapa, mais as duas regras do perfil. */
export function classificar(passo: PassoDoMapa, perfil: Perfil): Classificacao {
  if (passo.soModelos && !passo.soModelos.some((md) => perfil.modelos.includes(md))) return "-";
  const c = passo.classes[NICHOS.indexOf(perfil.nicho)] as Classificacao;
  if (perfil.jaTemOferta && passo.fase === "produto-e-oferta" && c === "E") return "R";
  return c;
}
