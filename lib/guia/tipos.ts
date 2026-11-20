/**
 * GUIA M1 — os tipos. Veja `docs/PLANO-GUIA-M1.md` (desenho) e `docs/MAPA-DO-PROCESSO-M1.md` (o mapa).
 *
 * Tudo aqui é puro (sem banco, sem rede): o catálogo e o diagnóstico rodam em teste e no servidor
 * sem tocar em nada. Quem LÊ o banco é `coletar-sinais.ts`; quem decide é `diagnostico.ts`.
 */

/** Os 5 perfis de cliente da matriz do mapa, na ordem das colunas (CL SV IM LJ IN). */
export const NICHOS = ["clinica", "servico", "imobiliaria", "loja", "infoproduto"] as const;
export type Nicho = (typeof NICHOS)[number];

/** Como o cliente vende. Pode ser mais de um (ex.: agendamento + WhatsApp). */
export const MODELOS_DE_VENDA = ["agendamento", "whatsapp", "checkout", "lancamento"] as const;
export type ModeloDeVenda = (typeof MODELOS_DE_VENDA)[number];

export interface Perfil {
  nicho: Nicho;
  modelos: readonly ModeloDeVenda[];
  /**
   * O cliente JÁ tem oferta pronta e quer começar pela campanha: os passos de Produto e Oferta
   * passam de essenciais a recomendados e deixam de bloquear a captação e a campanha.
   */
  jaTemOferta: boolean;
}

/** E essencial · R recomendado · O opcional · `-` não se aplica a este perfil. */
export type Classificacao = "E" | "R" | "O" | "-";

export const FASES = [
  "cadastros",
  "diagnostico",
  "produto-e-oferta",
  "captacao",
  "venda",
  "demanda",
  "operacao",
  "otimizacao",
] as const;
export type FaseDoGuia = (typeof FASES)[number];

/** Confiança do detector: 🟢 automática · 🟡 parcial (mostra "como sei" e deixa corrigir) · 🔴 só manual. */
export type Confianca = "automatica" | "parcial" | "manual";

export type EstadoDoPasso =
  | "feito"
  | "em_andamento"
  | "falta"
  | "bloqueado"
  | "desatualizado"
  | "nao_se_aplica"
  | "dispensado"
  | "nao_verificado";

/** O que um detector responde sobre UM passo (o `bloqueado` e o `desatualizado` saem do diagnóstico). */
export interface Deteccao {
  estado: "feito" | "em_andamento" | "falta" | "nao_verificado";
  /** O "como sei disso", em português simples, com o número que decidiu. */
  evidencia: string;
  /** Quando o passo foi feito/atualizado (ISO), para o prazo de validade. */
  quando?: string | null;
}

/** Uma leitura do banco: deu certo, ou diz por que não foi possível (nunca finge que sabe). */
export type Leitura<T> = { ok: true; valor: T } | { ok: false; motivo: string };

/**
 * Tudo que o Guia sabe da empresa, em números e datas — SEM dado pessoal de lead.
 * Cada grupo é uma leitura independente: se uma falha (tabela ausente, migration não aplicada),
 * só os passos que dependem dela viram "não consegui verificar".
 */
export interface Sinais {
  empresa: Leitura<{ temNome: boolean; temFuso: boolean }>;
  equipe: Leitura<{ membrosAtivos: number }>;
  /** `module_key` → quando foi publicada (`null` = só rascunho). A chave é a da página, inclusive subpáginas. */
  paginas: Leitura<Record<string, string | null>>;
  metaCapi: Leitura<{ existe: boolean; ativo: boolean; temDataset: boolean }>;
  landingPages: Leitura<{ total: number; comUrl: number }>;
  campanhas: Leitura<{
    total: number;
    ativas: number;
    /** Ativas com meta de leads e de CPL preenchidas. */
    ativasComMeta: number;
    /** Último dia com dado vindo da Meta (YYYY-MM-DD). */
    ultimoDiaDaMeta: string | null;
  }>;
  criativos: Leitura<{ total: number; ultimoCriadoEm: string | null }>;
  abordagens: Leitura<{ total: number }>;
  leads: Leitura<{ deCampanhaEm30Dias: number }>;
  vendas: Leitura<{ em90Dias: number }>;
  whatsapp: Leitura<{ conectados: number }>;
  funil: Leitura<{ comGanhouEPerdeu: number }>;
  proximaAcaoPorEtapa: Leitura<{ etapasComPasso: number }>;
  agenda: Leitura<{ tipos: number; atendentesComHorario: number }>;
  googleAgenda: Leitura<{ conectados: number }>;
  antiNoShow: Leitura<{ fluxos: number }>;
  respostasRapidas: Leitura<{ total: number }>;
  cronograma: Leitura<{ itens: number; ultimaAtividadeEm: string | null }>;
  autoavaliacao: Leitura<{ ultimaEm: string | null }>;
}

export interface PassoDoMapa {
  /** "P21" — estável: é a chave do que a agência marca à mão e dos avisos. */
  id: string;
  fase: FaseDoGuia;
  titulo: string;
  /** Uma frase: por que importa (é o que o cliente lê). */
  porque: string;
  /** CL SV IM LJ IN, na ordem de `NICHOS`. */
  classes: readonly [Classificacao, Classificacao, Classificacao, Classificacao, Classificacao];
  /** Só vale se o cliente vende por PELO MENOS um destes modelos; fora disso, "não se aplica". */
  soModelos?: readonly ModeloDeVenda[];
  /** Passos que vêm antes. Só BLOQUEIA se o antecessor for essencial para o perfil. */
  depende: readonly string[];
  confianca: Confianca;
  /** Sem `detectar` o passo é só manual (alguém marca "feito" ou "dispensado"). */
  detectar?: (s: Sinais, perfil: Perfil | null) => Deteccao;
  /** Tela onde se faz (já existe). */
  onde: { href: string; rotulo: string };
  /** Dias até o passo ficar "desatualizado". */
  venceDias?: number;
  /** O prazo só conta se isto for verdade (ex.: criativo velho só importa com campanha ativa). */
  venceSe?: (s: Sinais) => boolean;
  /** `false` = não entra na porcentagem de prontidão (recorrentes e rotinas). */
  contaNaProntidao?: boolean;
}

/** O que alguém marcou à mão (G2 grava na tabela; a G1 só aceita o formato). */
export interface RegistroManual {
  estado: "feito" | "dispensado";
  motivo?: string;
  /** Quando foi marcado (ISO), para o prazo de validade dos passos que vencem. */
  em?: string;
}

export interface PassoDiagnosticado {
  id: string;
  fase: FaseDoGuia;
  titulo: string;
  porque: string;
  /** `-` quando o passo não se aplica a este perfil (estado `nao_se_aplica`). */
  classificacao: Classificacao;
  estado: EstadoDoPasso;
  /** O "como sei": a evidência, ou o motivo de não ter conseguido verificar. */
  evidencia: string;
  confianca: Confianca;
  /** O estado veio de uma marcação à mão. */
  manual: boolean;
  /** Passos essenciais que ainda seguram este (só quando `bloqueado`). */
  aguardando: string[];
  onde: { href: string; rotulo: string };
  /** Quando foi feito/atualizado (ISO), se se sabe. */
  quando: string | null;
  /** Posição no catálogo (desempate estável). */
  ordem: number;
}

export interface ProntidaoDaFase {
  /** 0–100, ou `null` quando nada conta nesta fase para este perfil. */
  pct: number | null;
  feitos: number;
  total: number;
}

export interface Diagnostico {
  /** Sem perfil só a fase de cadastros é avaliada, e o primeiro passo é preencher o perfil. */
  perfilPendente: boolean;
  passos: PassoDiagnosticado[];
  /** No máximo 5: o que fazer agora, na ordem. */
  proximos: PassoDiagnosticado[];
  prontidao: { geral: number | null; porFase: Record<FaseDoGuia, ProntidaoDaFase> };
  /** Passos que não deu para verificar (a tela avisa; nunca finge "feito"). */
  naoVerificados: string[];
}
