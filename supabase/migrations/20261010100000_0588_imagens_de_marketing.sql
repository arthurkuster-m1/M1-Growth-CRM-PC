-- manifest: **Bucket das imagens das páginas de Marketing.** `marketing-images` — privado, 5 MB, só PNG/JPEG, caminho `<empresa>/<uuid>.<png|jpg>`, escrito e lido só pelo servidor (service role) depois dos gates de papel/link.

-- ============================================================================
-- 0588 — IMAGENS DAS PÁGINAS DE MARKETING
--
-- Prints de antes/depois, fotos e logos do cliente nas páginas de estratégia. Bucket PRIVADO
-- (o repositório só admite um bucket público, o dos logos): ZERO policy em `storage.objects`,
-- então nem o cliente nem a internet alcançam o arquivo direto. Quem lê é uma rota do app —
-- `/api/v1/marketing/imagens/<arquivo>` para quem está logado na empresa e
-- `/p/<token>/img/<arquivo>` para o link sem login — e quem escreve é a rota de envio
-- (manager+). A página guarda só o nome do arquivo; a empresa vem da sessão ou do link.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-images', 'marketing-images', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
