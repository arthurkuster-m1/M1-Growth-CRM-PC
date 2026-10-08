import { z } from "zod";

import { PRIORIDADES_DA_TAREFA } from "./tipos";

/**
 * EDIÇÃO EM MASSA — o que se pode mudar em várias tarefas de uma vez, e o teto.
 *
 * Só o que faz sentido aplicar igual a todas: status (pela opção), prioridade,
 * responsável e prazo. Título e descrição ficam de fora de propósito — escrever o mesmo
 * texto em 30 tarefas nunca é o que a pessoa quer, e é um erro fácil de cometer.
 *
 * O teto de 200 acompanha o que a tela carrega (a lista traz no máximo 500) e mantém o
 * pedido pequeno: o `in (...)` do banco e o corpo da requisição crescem com ele.
 */
export const MAXIMO_EM_MASSA = 200;

const idsSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(MAXIMO_EM_MASSA)
  // Repetido não muda o resultado, mas inflaria a contagem que a auditoria registra.
  .transform((ids) => [...new Set(ids)]);

/** O que muda. `status_option_id` não aceita `null`: "sem status" não existe. */
export const mudancasEmMassaSchema = z
  .object({
    status_option_id: z.string().uuid().optional(),
    priority: z.enum(PRIORIDADES_DA_TAREFA).optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    due_date: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." });

export type MudancasEmMassa = z.infer<typeof mudancasEmMassaSchema>;

export const edicaoEmMassaSchema = z
  .object({ ids: idsSchema, changes: mudancasEmMassaSchema })
  .strict();

export const exclusaoEmMassaSchema = z.object({ ids: idsSchema }).strict();
