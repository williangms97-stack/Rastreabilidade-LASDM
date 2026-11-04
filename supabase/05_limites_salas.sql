-- =====================================================================
-- LASDM · Limites de tempo fora do arquivo por sala — rodar UMA vez no SQL Editor do Supabase.
-- Só ACRESCENTA uma função nova (api_limites). Não altera tabelas nem apaga dados.
-- Os limites ficam na tabela config (chave LIMITES_SALAS). Ler: qualquer usuário do painel. Salvar: só Administrador.
-- =====================================================================
create or replace function api_limites(d jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare adm usuarios; f jsonb; quando text;
begin
  if coalesce(d->>'op', 'ler') = 'ler' then
    return jsonb_build_object('ok', true, 'limites', coalesce(nullif(_cfg('LIMITES_SALAS'), '')::jsonb, 'null'::jsonb));
  end if;
  if d->>'op' = 'salvar' then
    adm := _conferir(d->'admin'->>'usuario', d->'admin'->>'senha');
    if adm.usuario is null then return jsonb_build_object('ok', false, 'erro', 'Usuário ou senha incorretos.'); end if;
    if adm.perfil <> 'Administrador' then return jsonb_build_object('ok', false, 'erro', 'Só administradores alteram os limites das salas.'); end if;
    if jsonb_typeof(d->'limites') <> 'object' then return jsonb_build_object('ok', false, 'erro', 'Limites inválidos.'); end if;
    quando := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
    f := jsonb_build_object('salas', d->'limites', 'por', coalesce(nullif(adm.nome, ''), adm.usuario), 'em', quando);
    perform _set_cfg('LIMITES_SALAS', f::text);
    perform _log('Limites de tempo fora por sala alterados', '-', adm.usuario);
    return jsonb_build_object('ok', true, 'limites', f);
  end if;
  return jsonb_build_object('ok', false, 'erro', 'Operação desconhecida.');
exception when others then
  return jsonb_build_object('ok', false, 'erro', SQLERRM);
end $$;

revoke all on function api_limites(jsonb) from public;
grant execute on function api_limites(jsonb) to anon, authenticated;

select 'Pronto: limites por sala instalados.' as resultado;
