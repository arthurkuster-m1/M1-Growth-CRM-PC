-- manifest: **Ícone da notificação.** `platform_branding.notification_icon_path` guarda o arquivo de onde sai a silhueta do ícone da barra de status das notificações (subido em Marca); sem ele, usa-se o logo de fundo branco. Aditiva e fora do `select` da marca, para código novo sobre schema velho não derrubar a marca.
alter table public.platform_branding add column if not exists notification_icon_path text;
update public.platform_branding set notification_icon_path = null
 where notification_icon_path is not null
   and notification_icon_path !~ '^platform/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)$';
alter table public.platform_branding drop constraint if exists platform_branding_notification_icon_path;
alter table public.platform_branding add constraint platform_branding_notification_icon_path check (
  notification_icon_path is null or
  notification_icon_path ~ '^platform/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)$'
);
comment on column public.platform_branding.notification_icon_path is
  'Imagem de onde sai a silhueta do ícone das notificações (barra de status). Caminho em brand-logos; null usa o logo de fundo branco.';
