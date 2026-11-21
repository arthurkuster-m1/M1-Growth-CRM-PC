/**
 * OS PROMPTS DO GUIA — o "modo na minha conta": o app monta o texto, a pessoa cola numa IA dela e
 * traz o resultado de volta (Estratégia › Importar de texto). Função PURA.
 *
 * Cada prompt = a instrução + o Dossiê do projeto + (quando a resposta vira página) o formato do
 * texto estruturado. Os prompts de persona, situações, premissa e concorrente são os do método do
 * Arthur (`prompts-do-metodo.ts`); os demais são genéricos e dizem à IA para usar SÓ o dossiê.
 */
import { passoPorId } from "./catalogo";
import {
  FORMATO_DO_TEXTO_ESTRUTURADO,
  PROMPT_ARVORE_DE_SITUACOES,
  PROMPT_CONCORRENTE,
  PROMPT_PERSONA,
  PROMPT_PREMISSA_PERSUASIVA,
} from "./prompts-do-metodo";

export interface PromptDoGuia {
  id: string;
  titulo: string;
  /** Os passos do mapa onde este prompt aparece. */
  passos: readonly string[];
  /** A instrução (sem o dossiê). */
  instrucao: string;
  /** A resposta vai virar uma página da Estratégia: pedir no formato de texto estruturado. */
  viraPagina: boolean;
}

const CONSULTOR = [
  "Analise o dossiê abaixo como consultor do projeto e entregue:",
  "1. Um diagnóstico em até 5 linhas: onde o marketing deste cliente está forte e onde está travado (cite a seção do dossiê).",
  "2. As 3 a 5 próximas ações, em ordem de impacto. Para cada uma: o que fazer, por quê, o resultado esperado e como saber se funcionou.",
  "3. O que você precisaria saber e que não consta no dossiê para decidir melhor.",
  "Se houver campanha com dados, avalie custo por lead contra a meta, retorno e criativos. Se não houver dado suficiente, diga isso em vez de supor.",
].join("\n");

function rascunhoDe(titulo: string): string {
  return [
    `Escreva a página «${titulo}» deste projeto, em rascunho, usando as informações do dossiê abaixo.`,
    "Onde o dossiê não trouxer o dado, escreva **[PREENCHER: o que falta]** em vez de inventar.",
    "Seja específico ao negócio (nada genérico) e use frases curtas.",
  ].join("\n");
}

/** Passos do mapa que têm uma página de Estratégia para rascunhar. */
const PASSOS_COM_PAGINA = ["P10", "P11", "P12", "P20", "P23", "P24", "P50"] as const;

export const PROMPTS: readonly PromptDoGuia[] = [
  {
    id: "consultor",
    titulo: "Consultor: o que fazer agora",
    passos: [],
    instrucao: CONSULTOR,
    viraPagina: false,
  },
  {
    id: "persona",
    titulo: "Persona",
    passos: ["P21"],
    instrucao: PROMPT_PERSONA,
    viraPagina: true,
  },
  {
    id: "arvore-de-situacoes",
    titulo: "Árvore de situações incômodas",
    passos: ["P21"],
    instrucao: PROMPT_ARVORE_DE_SITUACOES,
    viraPagina: true,
  },
  {
    id: "premissa-persuasiva",
    titulo: "Premissa persuasiva",
    passos: ["P25"],
    instrucao: PROMPT_PREMISSA_PERSUASIVA,
    viraPagina: true,
  },
  {
    id: "concorrente",
    titulo: "Análise de um concorrente",
    passos: ["P22"],
    instrucao: PROMPT_CONCORRENTE,
    viraPagina: true,
  },
  ...PASSOS_COM_PAGINA.map((id): PromptDoGuia => {
    const titulo = passoPorId(id)?.titulo ?? id;
    return {
      id: `rascunho-${id.toLowerCase()}`,
      titulo: `Rascunho: ${titulo}`,
      passos: [id],
      instrucao: rascunhoDe(titulo),
      viraPagina: true,
    };
  }),
];

export const promptPorId = (id: string): PromptDoGuia | undefined =>
  PROMPTS.find((p) => p.id === id);

export const promptsDoPasso = (passoId: string): PromptDoGuia[] =>
  PROMPTS.filter((p) => p.passos.includes(passoId));

/** O texto final para colar na IA: instrução + dossiê + (se vira página) o formato da resposta. */
export function montarPrompt(prompt: PromptDoGuia, dossieMarkdown: string): string {
  const partes = [
    prompt.instrucao.trim(),
    "---",
    "DOSSIÊ DO PROJETO (use como contexto):",
    dossieMarkdown.trim(),
  ];
  if (prompt.viraPagina) {
    partes.push(
      "---",
      [
        "FORMATO DA RESPOSTA: entregue **somente** o texto da página, sem explicação antes ou depois, neste formato (será importado no sistema):",
        "```",
        FORMATO_DO_TEXTO_ESTRUTURADO,
        "```",
      ].join("\n"),
    );
  }
  return partes.join("\n\n");
}
