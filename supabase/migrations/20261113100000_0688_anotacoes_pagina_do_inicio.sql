-- manifest: **Anotações: a página fixada no Início.** `notes_user_state.home_selected_at` (aditiva, nula): a página que a pessoa escolheu por último no cartão "Notas" do Início é a de maior valor. Sem índice único nem backfill.

-- ============================================================================
-- 0688 — ANOTAÇÕES: a página fixada no Início
--
-- O cartão "Notas" do Início mostra uma página de anotações. A escolhida por último é a que fica
-- lá: `home_selected_at` marca o instante da escolha, e a página fixada de cada pessoa é a de
-- maior `home_selected_at` (sem índice único: escolher outra não precisa desmarcar a anterior).
-- ============================================================================

alter table public.notes_user_state add column if not exists home_selected_at timestamptz;
