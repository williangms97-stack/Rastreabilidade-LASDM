-- =====================================================================
-- LASDM · Testes pendentes — rodar UMA vez no SQL Editor do Supabase.
-- Acrescenta duas colunas na referência (testes pedidos = PROTOCOLO_ANALISES e finalizados = ANALISES_FINALIZADAS),
-- atualiza as funções que gravam/devolvem a referência e cria a função api_testes (testes considerados).
-- Não apaga dados. Depois de rodar, importe a planilha do sistema de novo no painel (Planilhas de referência).
-- =====================================================================
alter table referencia add column if not exists pedidas text default '';
alter table referencia add column if not exists finalizadas text default '';

create or replace function _referencia(d jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare adm usuarios; ini int; base int; tot int; r jsonb; i int := 0;
begin
  adm := _conferir(d->'admin'->>'usuario', d->'admin'->>'senha');
  if adm.usuario is null or adm.perfil <> 'Administrador' then
    return jsonb_build_object('ok', false, 'erro', 'Acesso negado: só administradores atualizam as planilhas de referência.'); end if;
  if d->>'op' = 'inicio' then delete from referencia; return jsonb_build_object('ok', true); end if;
  if d->>'op' = 'parte' then
    ini := _int(d->'ini');
    base := coalesce(ini, (select coalesce(max(pos) + 1, 0) from referencia));
    for r in select * from jsonb_array_elements(coalesce(d->'linhas', '[]'::jsonb)) loop
      insert into referencia (pos, prot, data, especie, cultivar, categoria, peneira, lote, produtor, tipo_analise, remessa, tratamento,
                              safra, repres, abertas, pedidas, finalizadas, obs, procedencia, origem, data_key)
      values (base + i, coalesce(r->>'prot', ''), coalesce(r->>'data', ''), coalesce(r->>'especie', ''), coalesce(r->>'cultivar', ''), coalesce(r->>'categoria', ''),
              coalesce(r->>'peneira', ''), coalesce(r->>'lote', ''), coalesce(r->>'produtor', ''), coalesce(r->>'tipoAnalise', ''), coalesce(r->>'remessa', ''),
              coalesce(r->>'tratamento', ''), coalesce(r->>'safra', ''), coalesce(r->>'repres', ''), coalesce(r->>'abertas', ''), coalesce(r->>'pedidas', ''), coalesce(r->>'finalizadas', ''), coalesce(r->>'obs', ''),
              coalesce(r->>'procedencia', ''), coalesce(r->>'origem', ''), _data_key(r->>'data'))
      on conflict (pos) do update set prot = excluded.prot, data = excluded.data, especie = excluded.especie, cultivar = excluded.cultivar,
        categoria = excluded.categoria, peneira = excluded.peneira, lote = excluded.lote, produtor = excluded.produtor, tipo_analise = excluded.tipo_analise,
        remessa = excluded.remessa, tratamento = excluded.tratamento, safra = excluded.safra, repres = excluded.repres, abertas = excluded.abertas, pedidas = excluded.pedidas, finalizadas = excluded.finalizadas,
        obs = excluded.obs, procedencia = excluded.procedencia, origem = excluded.origem, data_key = excluded.data_key;
      i := i + 1;
    end loop;
    return jsonb_build_object('ok', true, 'gravadas', i);
  end if;
  if d->>'op' = 'fim' then
    tot := _int(d->'total');
    if tot is not null then delete from referencia where pos >= tot; end if;
    perform _set_cfg('REF_EM', to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' por ' || adm.usuario
                     || case when coalesce(d->>'resumo', '') <> '' then ' (' || (d->>'resumo') || ')' else '' end);
    perform _log('Planilhas de referência atualizadas: ' || coalesce(d->>'resumo', ''), '-', adm.usuario);
    return jsonb_build_object('ok', true, 'linhas', coalesce(tot, (select count(*) from referencia)::int));
  end if;
  return jsonb_build_object('ok', false, 'erro', 'Operação inválida.');
end $$;

create or replace function _ref_json(r referencia) returns jsonb language sql immutable as $$
  select jsonb_build_object('prot', r.prot, 'data', r.data, 'especie', r.especie, 'cultivar', r.cultivar, 'categoria', r.categoria, 'peneira', r.peneira,
    'lote', r.lote, 'produtor', r.produtor, 'tipoAnalise', r.tipo_analise, 'remessa', r.remessa, 'tratamento', r.tratamento, 'safra', r.safra,
    'repres', r.repres, 'abertas', r.abertas, 'pedidas', coalesce(r.pedidas, ''), 'finalizadas', coalesce(r.finalizadas, ''), 'obs', r.obs, 'procedencia', r.procedencia, 'origem', r.origem)
$$;

create or replace function api_testes(d jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare adm usuarios; f jsonb; quando text;
begin
  if coalesce(d->>'op', 'ler') = 'ler' then
    return jsonb_build_object('ok', true, 'testes', coalesce(nullif(_cfg('TESTES_CONSIDERADOS'), '')::jsonb, 'null'::jsonb), 'refEm', coalesce(_cfg('REF_EM'), ''));
  end if;
  if d->>'op' = 'salvar' then
    adm := _conferir(d->'admin'->>'usuario', d->'admin'->>'senha');
    if adm.usuario is null then return jsonb_build_object('ok', false, 'erro', 'Usuário ou senha incorretos.'); end if;
    if adm.perfil <> 'Administrador' then return jsonb_build_object('ok', false, 'erro', 'Só administradores alteram os testes considerados.'); end if;
    if jsonb_typeof(d->'fora') <> 'array' then return jsonb_build_object('ok', false, 'erro', 'Lista inválida.'); end if;
    quando := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
    f := jsonb_build_object('fora', d->'fora', 'por', coalesce(nullif(adm.nome, ''), adm.usuario), 'em', quando);
    perform _set_cfg('TESTES_CONSIDERADOS', f::text);
    perform _log('Testes considerados alterados (fora da conta: ' || coalesce((select string_agg(x, ', ') from jsonb_array_elements_text(d->'fora') x), 'nenhum') || ')', '-', adm.usuario);
    return jsonb_build_object('ok', true, 'testes', f);
  end if;
  return jsonb_build_object('ok', false, 'erro', 'Operação desconhecida.');
exception when others then
  return jsonb_build_object('ok', false, 'erro', SQLERRM);
end $$;

revoke all on function _referencia(jsonb) from public, anon, authenticated;
revoke all on function _ref_json(referencia) from public, anon, authenticated;
revoke all on function api_testes(jsonb) from public;
grant execute on function api_testes(jsonb) to anon, authenticated;

select 'Pronto: testes pendentes instalados.' as resultado;
