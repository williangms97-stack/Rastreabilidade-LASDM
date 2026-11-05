-- =====================================================================
-- LASDM · Correção da importação das planilhas e do tempo limite — rodar UMA vez no SQL Editor do Supabase.
-- 1) O Supabase bloqueia "delete" sem condição vindo do app/painel (proteção pg_safeupdate):
--    a importação (que limpa a referência antiga antes de gravar a nova) e a limpeza do histórico passam a usar "where true".
-- 2) Aumenta o tempo máximo de cada consulta do painel/app de 3 s (padrão) para 30 s (a referência do ano inteiro é grande).
-- Não apaga dados.
-- =====================================================================
create or replace function _referencia(d jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare adm usuarios; ini int; base int; tot int; r jsonb; i int := 0;
begin
  adm := _conferir(d->'admin'->>'usuario', d->'admin'->>'senha');
  if adm.usuario is null or adm.perfil <> 'Administrador' then
    return jsonb_build_object('ok', false, 'erro', 'Acesso negado: só administradores atualizam as planilhas de referência.'); end if;
  if d->>'op' = 'inicio' then delete from referencia where true; return jsonb_build_object('ok', true); end if;
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

create or replace function _usuarios(d jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare
  qtd int; tem_admin boolean; u usuarios; adm usuarios; alvo text; s text; nova text; v_sal text;
  apagadas jsonb := '{}'::jsonb; c int;
begin
  select count(*), bool_or(perfil = 'Administrador' and situacao = 'Ativo') into qtd, tem_admin from usuarios;
  if d->>'acao' = 'statusUsuarios' then return jsonb_build_object('ok', true, 'temAdmin', coalesce(tem_admin, false)); end if;

  if d->>'acao' = 'criarAdmin' then
    if qtd > 0 then return jsonb_build_object('ok', false, 'erro', 'O administrador já foi criado. Entre com usuário e senha.'); end if;
    alvo := lower(trim(coalesce(d->>'usuario', ''))); s := coalesce(d->>'senha', '');
    if alvo = '' or length(s) < 4 then return jsonb_build_object('ok', false, 'erro', 'Informe usuário e uma senha com pelo menos 4 caracteres.'); end if;
    v_sal := gen_random_uuid()::text;
    insert into usuarios values (alvo, coalesce(nullif(d->>'nome', ''), alvo), 'Administrador', 'Ativo', v_sal, _hash(v_sal, s), now(), '(primeiro acesso)', now());
    perform _log('Administrador criado', alvo, '(primeiro acesso)');
    return jsonb_build_object('ok', true);
  end if;

  if d->>'acao' = 'login' then
    u := _conferir(d->>'usuario', d->>'senha');
    if u.usuario is null then return jsonb_build_object('ok', false, 'erro', 'Usuário ou senha inválidos.'); end if;
    perform _log('Login', u.usuario, coalesce(d->>'aparelho', ''));
    return jsonb_build_object('ok', true, 'usuario', jsonb_build_object('usuario', u.usuario, 'nome', u.nome, 'perfil', u.perfil), 'sal', u.sal, 'hash', u.hash);
  end if;

  if d->>'acao' = 'usuarios' then
    adm := _conferir(d->'admin'->>'usuario', d->'admin'->>'senha');
    if adm.usuario is null or adm.perfil <> 'Administrador' then
      return jsonb_build_object('ok', false, 'erro', 'Acesso negado: usuário ou senha de administrador inválidos.'); end if;
    alvo := lower(trim(coalesce(d->>'usuario', '')));
    select * into u from usuarios where usuario = alvo;

    if d->>'op' = 'zerar' then   -- apaga movimentos (e, se pedido, prateleiras). Usuários e referência ficam.
      select count(*) into c from movimentos; apagadas := apagadas || jsonb_build_object('Movimentos', c); delete from movimentos where true;
      if coalesce((d->>'prateleiras')::boolean, false) then
        select count(*) into c from prateleiras; apagadas := apagadas || jsonb_build_object('Prateleiras', c); delete from prateleiras where true; end if;
      perform _set_cfg('RESET_TS', (extract(epoch from now()) * 1000)::bigint::text);
      perform _set_cfg('RESET_PRAT', case when coalesce((d->>'prateleiras')::boolean, false) then '1' else '0' end);
      perform _log('Dados zerados (' || (select string_agg(key || ': ' || value, ', ') from jsonb_each_text(apagadas)) || ')', '-', adm.usuario);
      return jsonb_build_object('ok', true, 'apagadas', apagadas);
    end if;

    if d->>'op' = 'salvar' then
      s := coalesce(d->>'senha', '');
      if alvo = '' or alvo !~ '^[a-z0-9._-]{2,30}$' then
        return jsonb_build_object('ok', false, 'erro', 'Usuário inválido: use letras, números, ponto, hífen ou sublinhado (sem espaços).'); end if;
      if u.usuario is not null then return jsonb_build_object('ok', false, 'erro', 'Este usuário já existe.'); end if;
      if length(s) < 4 then return jsonb_build_object('ok', false, 'erro', 'A senha precisa ter pelo menos 4 caracteres.'); end if;
      nova := case when d->>'perfil' = 'Administrador' then 'Administrador' else 'Operador' end;
      v_sal := gen_random_uuid()::text;
      insert into usuarios values (alvo, coalesce(nullif(d->>'nome', ''), alvo), nova, 'Ativo', v_sal, _hash(v_sal, s), now(), adm.usuario, now());
      perform _log('Usuário cadastrado (' || nova || ')', alvo, adm.usuario);
    elsif d->>'op' = 'senha' then
      if u.usuario is null then return jsonb_build_object('ok', false, 'erro', 'Usuário não encontrado.'); end if;
      if length(coalesce(d->>'senha', '')) < 4 then return jsonb_build_object('ok', false, 'erro', 'A senha precisa ter pelo menos 4 caracteres.'); end if;
      v_sal := gen_random_uuid()::text;
      update usuarios set sal = v_sal, hash = _hash(v_sal, d->>'senha'), atualizado_em = now() where usuario = u.usuario;
      perform _log('Senha alterada', u.usuario, adm.usuario);
    elsif d->>'op' = 'situacao' then
      if u.usuario is null then return jsonb_build_object('ok', false, 'erro', 'Usuário não encontrado.'); end if;
      if u.usuario = adm.usuario then return jsonb_build_object('ok', false, 'erro', 'Você não pode desativar o próprio usuário.'); end if;
      nova := case when u.situacao = 'Ativo' then 'Inativo' else 'Ativo' end;
      update usuarios set situacao = nova, atualizado_em = now() where usuario = u.usuario;
      perform _log(case when nova = 'Ativo' then 'Usuário reativado' else 'Usuário desativado' end, u.usuario, adm.usuario);
    end if;

    return jsonb_build_object('ok', true, 'usuarios', coalesce((select jsonb_agg(jsonb_build_object(
      'usuario', x.usuario, 'nome', x.nome, 'perfil', x.perfil, 'situacao', x.situacao, 'criadoPor', x.criado_por,
      'criadoEm', to_char(x.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')) order by x.criado_em) from usuarios x), '[]'::jsonb));
  end if;
  return null;
end $$;

revoke all on function _referencia(jsonb) from public, anon, authenticated;
revoke all on function _usuarios(jsonb) from public, anon, authenticated;

alter role anon set statement_timeout = '30s';
alter role authenticated set statement_timeout = '30s';
notify pgrst, 'reload config';

select 'Pronto: importação corrigida.' as resultado;
