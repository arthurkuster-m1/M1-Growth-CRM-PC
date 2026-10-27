import type { SupabaseClient } from "@supabase/supabase-js";

import { ROLE_RANK, type Role } from "@/lib/auth/types";

/**
 * DE QUEM É A AGENDA QUE ESTA PESSOA PODE VER — para o SERVIDOR.
 *
 * Devolve o `user_id` a que a leitura deve ser recortada, ou `null` quando a pessoa vê todas.
 * Gerente e administrador veem todas sempre. Abaixo disso, a opção "Atendentes podem ver a agenda
 * dos colegas" (`fn_colegas_podem_ver_agenda`, migration 0671) decide: ligada (padrão) vê todas,
 * desligada vê só a própria.
 *
 * ⚠️ FALHA FECHA: se a leitura da opção não vier, recorta para a própria agenda. Mostrar a agenda
 * alheia por engano é o erro que não se desfaz; esconder por um instante, sim.
 */
export async function recorteDeVisibilidadeDaAgenda(
  supabase: SupabaseClient,
  organizationId: string,
  papel: Role,
  userId: string,
): Promise<string | null> {
  if (ROLE_RANK[papel] >= ROLE_RANK.manager) return null;
  const { data, error } = await supabase.rpc("fn_colegas_podem_ver_agenda", {
    p_org: organizationId,
  });
  if (error) return userId;
  return data === false ? userId : null;
}
