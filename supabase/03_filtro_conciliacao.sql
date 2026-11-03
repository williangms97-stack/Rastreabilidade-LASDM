-- =====================================================================
-- LASDM · Filtro da conciliação (o que entra na conta) — rodar UMA vez no SQL Editor do Supabase.
-- Só ACRESCENTA uma função nova (api_filtro). Não altera tabelas nem apaga dados.
-- O filtro fica guardado na tabela config (chaves FILTRO_CONC e FILTRO_CONC_HIST).
-- Ler: qualquer usuário do painel. Salvar: só Administrador (confere usuário e senha).
-- =====================================================================
create or replace function api_filtro(d jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare adm usuarios; f jsonb; h jsonb; quando text;
begin
  if coalesce(d->>'op', 'ler') = 'ler' then
    return jsonb_build_object('ok', true,
      'filtro', coalesce(nullif(_cfg('FILTRO_CONC'), '')::jsonb, 'null'::jsonb),
      'historico', coalesce(nullif(_cfg('FILTRO_CONC_HIST'), '')::jsonb, '[]'::jsonb));
  end if;
  if d->>'op' = 'salvar' then
    adm := _conferir(d->'admin'->>'usuario', d->'admin'->>'senha');
    if adm.usuario is null then return jsonb_build_object('ok', false, 'erro', 'Usuário ou senha incorretos.'); end if;
    if adm.perfil <> 'Administrador' then return jsonb_build_object('ok', false, 'erro', 'Só administradores alteram o filtro da conciliação.'); end if;
    if jsonb_typeof(d->'filtro') <> 'object' then return jsonb_build_object('ok', false, 'erro', 'Filtro inválido.'); end if;
    quando := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
    f := (d->'filtro') || jsonb_build_object('por', coalesce(nullif(adm.nome, ''), adm.usuario), 'em', quando);
    h := jsonb_build_array(jsonb_build_object('em', quando, 'por', coalesce(nullif(adm.nome, ''), adm.usuario), 'resumo', left(coalesce(d->>'resumo', ''), 600)))
         || coalesce(nullif(_cfg('FILTRO_CONC_HIST'), '')::jsonb, '[]'::jsonb);
    h := (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(h) with ordinality t(x, i) where i <= 50 order by i) s);
    perform _set_cfg('FILTRO_CONC', f::text);
    perform _set_cfg('FILTRO_CONC_HIST', h::text);
    perform _log('Filtro da conciliação alterado: ' || left(coalesce(d->>'resumo', ''), 200), '-', adm.usuario);
    return jsonb_build_object('ok', true, 'filtro', f, 'historico', h);
  end if;
  return jsonb_build_object('ok', false, 'erro', 'Operação desconhecida.');
exception when others then
  return jsonb_build_object('ok', false, 'erro', SQLERRM);
end $$;

revoke all on function api_filtro(jsonb) from public;
grant execute on function api_filtro(jsonb) to anon, authenticated;

select 'Pronto: filtro da conciliação instalado.' as resultado;
