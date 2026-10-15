import type { PipelineVocabulary } from "./types";

const DEFAULTS: Required<PipelineVocabulary> = {
  lead: "Lead",
  deal: "Negócio",
  won: "Comprou",
  lost: "Não comprou",
};

export function resolveVocabulary(
  v: PipelineVocabulary | null | undefined,
): Required<PipelineVocabulary> {
  return { ...DEFAULTS, ...(v ?? {}) };
}
