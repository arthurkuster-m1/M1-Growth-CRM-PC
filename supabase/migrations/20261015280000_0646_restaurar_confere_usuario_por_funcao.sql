-- manifest: **Restaurar da lixeira volta a funcionar para usuário comum (erro interno).** Ao recolocar o cliente, a restauração confere se os usuários citados nele (dono, quem qualificou) ainda existem, lendo a tabela de usuários do login — que o usuário comum não pode ler (permission denied for table users). A conferência passa por uma função fechada que só responde "existe ou não". Testado em rollback com os 6 itens reais da lixeira.

create or replace function public.fn_lixeira_usuario_existe(p_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $f$
  select exists (select 1 from auth.users where id = p_id);
$f$;
revoke execute on function public.fn_lixeira_usuario_existe(uuid) from public, anon;
grant execute on function public.fn_lixeira_usuario_existe(uuid) to authenticated, service_role;

create or replace function public.fn_inserir_da_lixeira(p_tabela regclass, p_linha jsonb)
returns void language plpgsql set search_path = public as $f$
declare
  v_cols text;
  v_linha jsonb := p_linha;
  r record;
  v_existe boolean;
begin
  -- Referência opcional a algo que já não existe (ex.: a demanda da conversa, que saiu junto com o
  -- cliente) volta vazia, em vez de impedir a restauração.
  for r in
    select att.attname as coluna,
           ref.oid::regclass as tabela_ref,
           (select a2.attname from pg_attribute a2
             where a2.attrelid = c.confrelid and a2.attnum = c.confkey[1]) as coluna_ref,
           not att.attnotnull as opcional
      from pg_constraint c
      join pg_attribute att on att.attrelid = c.conrelid and att.attnum = c.conkey[1]
      join pg_class ref on ref.oid = c.confrelid
     where c.conrelid = p_tabela and c.contype = 'f' and array_length(c.conkey, 1) = 1
  loop
    continue when not r.opcional;
    continue when (v_linha ->> r.coluna) is null;
    if r.tabela_ref::text = 'auth.users' then
      -- A tabela de usuários não é legível para quem restaura: pergunta por uma função fechada.
      v_existe := public.fn_lixeira_usuario_existe((v_linha ->> r.coluna)::uuid);
    else
      execute format('select exists (select 1 from %s where %I = ($1 ->> %L)::%s)',
                     r.tabela_ref, r.coluna_ref, r.coluna,
                     (select format_type(a3.atttypid, a3.atttypmod) from pg_attribute a3
                       where a3.attrelid = p_tabela and a3.attname = r.coluna))
        into v_existe using v_linha;
    end if;
    if not v_existe then
      v_linha := jsonb_set(v_linha, array[r.coluna], 'null'::jsonb);
    end if;
  end loop;

  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    into v_cols
    from pg_attribute a
   where a.attrelid = p_tabela and a.attnum > 0 and not a.attisdropped
     and a.attgenerated = '' and a.attidentity = ''
     and v_linha ? a.attname;
  if v_cols is null then return; end if;
  execute format(
    'insert into %s (%s) select %s from jsonb_populate_record(null::%s, $1)',
    p_tabela, v_cols, v_cols, p_tabela
  ) using v_linha;
end
$f$;
