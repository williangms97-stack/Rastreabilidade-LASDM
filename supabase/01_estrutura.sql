-- =====================================================================
-- LASDM · Rastreabilidade de amostras · banco de dados no Supabase (versão 8)
-- Cole TUDO no Supabase: SQL Editor → New query → Run.
-- Pode rodar de novo sem problema (não apaga dados).
--
-- Mesma lógica do script da planilha (Codigo.gs, versão 8):
--   api_get(p)  = antigo GET  (?acao=dados · ?acao=ref&desde= · &prot= · &prots=)
--   api_post(d) = antigo POST (movimentos, prateleiras, usuários, planilhas de referência)
-- As tabelas ficam FECHADAS (RLS sem políticas): só as duas funções acessam os dados.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- tabelas (mesmas colunas das abas da planilha) ----------
create table if not exists movimentos (
  n bigserial,
  id text primary key,
  data text, hora text, protocolo text, acao text, destino text,
  prateleira int, andar int, linha int, lado text, altura int, posicao text,
  embalagem text, classificacao text, especie text, cultivar text, lote text, produtor text,
  tipo_analise text, remessa text, tratamento text, categoria text,
  validacao text, lido text, usuario text, aparelho text, foto text,
  ts bigint, situacao text default 'Ativo', recebido_em timestamptz default now(), obs text
);
create index if not exists movimentos_prot on movimentos (protocolo, ts);
create index if not exists movimentos_ts on movimentos (ts);

create table if not exists prateleiras (
  n bigserial, id text primary key,
  numero int, embalagem text, situacao text default 'Ativa', obs text,
  atualizado_em timestamptz default now(), atualizado_por text, linhas int, mapa text, andares text
);

create table if not exists referencia (
  pos int primary key,           -- posição da linha (o painel envia em partes com posição fixa)
  prot text, data text, especie text, cultivar text, categoria text, peneira text, lote text, produtor text,
  tipo_analise text, remessa text, tratamento text, safra text, repres text, abertas text, obs text,
  procedencia text, origem text, data_key text
);
create index if not exists referencia_prot on referencia (prot);
create index if not exists referencia_data on referencia (data_key);

create table if not exists usuarios (
  usuario text primary key, nome text, perfil text, situacao text,
  sal text, hash text, criado_em timestamptz default now(), criado_por text, atualizado_em timestamptz default now()
);
create table if not exists log_usuarios (n bigserial primary key, em timestamptz default now(), acao text, usuario text, feito_por text);
create table if not exists config (chave text primary key, valor text);

-- ---------- segurança: ninguém acessa as tabelas direto ----------
do $$ declare t text; begin
  foreach t in array array['movimentos','prateleiras','referencia','usuarios','log_usuarios','config'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- auxiliares ----------
create or replace function _hash(sal text, senha text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(convert_to(sal || ':' || senha, 'UTF8'), 'sha256'), 'hex')
$$;
create or replace function _cfg(k text) returns text language sql stable set search_path = public as $$
  select valor from config where chave = k
$$;
create or replace function _set_cfg(k text, v text) returns void language sql set search_path = public as $$
  insert into config values (k, v) on conflict (chave) do update set valor = excluded.valor
$$;
create or replace function _log(acao text, usuario text, por text) returns void language sql set search_path = public as $$
  insert into log_usuarios (acao, usuario, feito_por) values (acao, usuario, coalesce(por, ''))
$$;
create or replace function _conferir(u text, s text) returns usuarios language sql stable set search_path = public as $$
  select * from usuarios where usuario = lower(trim(coalesce(u, ''))) and situacao = 'Ativo' and hash = _hash(sal, coalesce(s, ''))
$$;
-- dd/mm/aaaa → aaaa-mm-dd
create or replace function _data_key(s text) returns text language sql immutable as $$
  select case when s ~ '(\d{2})/(\d{2})/(\d{4})' then
    (regexp_match(s, '(\d{2})/(\d{2})/(\d{4})'))[3] || '-' || (regexp_match(s, '(\d{2})/(\d{2})/(\d{4})'))[2] || '-' || (regexp_match(s, '(\d{2})/(\d{2})/(\d{4})'))[1]
  else '' end
$$;
create or replace function _int(v jsonb) returns int language sql immutable as $$
  select case when v is null or jsonb_typeof(v) = 'null' or v #>> '{}' = '' then null else (v #>> '{}')::numeric::int end
$$;

-- ---------- estado do arquivo (mesma lógica do app): posição de cada amostra ----------
-- última ação que muda o estado (armazenar/remanejar/retorno/sala/baixa) define onde a amostra está;
-- a posição vem do último armazenar/remanejar/retorno com prateleira depois da última ida para sala ou baixa.
create or replace function _estado() returns table (protocolo text, status text, slot text, pos text)
language sql stable set search_path = public as $$
  with m as (
    select * from movimentos
     where acao in ('ARMAZENAR','REMANEJAR','RETORNO','SALA','BAIXA')
       and coalesce(situacao, '') !~ '^(Conflito|Excluíd)'
  ), ult as (
    select distinct on (protocolo) protocolo, acao, ts, n from m order by protocolo, ts desc, n desc
  ), corte as (
    select protocolo, max(ts) as ts from m where acao in ('SALA','BAIXA') group by protocolo
  ), pos as (
    select distinct on (m.protocolo) m.protocolo, m.prateleira, m.andar, m.linha, m.lado, m.altura, m.posicao
      from m left join corte c on c.protocolo = m.protocolo
     where m.acao in ('ARMAZENAR','REMANEJAR','RETORNO') and m.prateleira is not null and (c.ts is null or m.ts > c.ts)
     order by m.protocolo, m.ts desc, m.n desc
  )
  select u.protocolo,
         case when u.acao in ('ARMAZENAR','REMANEJAR','RETORNO') then 'ARQUIVO' else u.acao end,
         case when u.acao in ('ARMAZENAR','REMANEJAR','RETORNO') and p.prateleira is not null
              then concat_ws('-', p.prateleira, p.andar, p.linha, p.lado, p.altura) else '' end,
         case when u.acao in ('ARMAZENAR','REMANEJAR','RETORNO') then coalesce(p.posicao, '') else '' end
    from ult u left join pos p on p.protocolo = u.protocolo
$$;

-- ---------- usuários (login, primeiro acesso, área do administrador, zerar dados de teste) ----------
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
      select count(*) into c from movimentos; apagadas := apagadas || jsonb_build_object('Movimentos', c); delete from movimentos;
      if coalesce((d->>'prateleiras')::boolean, false) then
        select count(*) into c from prateleiras; apagadas := apagadas || jsonb_build_object('Prateleiras', c); delete from prateleiras; end if;
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

-- ---------- planilhas de referência (enviadas pelo painel, só administradores) ----------
-- op 'inicio' limpa · op 'parte' grava linhas (com "ini" na mesma posição: repetir não duplica) · op 'fim' remove sobras e registra a data
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
                              safra, repres, abertas, obs, procedencia, origem, data_key)
      values (base + i, coalesce(r->>'prot', ''), coalesce(r->>'data', ''), coalesce(r->>'especie', ''), coalesce(r->>'cultivar', ''), coalesce(r->>'categoria', ''),
              coalesce(r->>'peneira', ''), coalesce(r->>'lote', ''), coalesce(r->>'produtor', ''), coalesce(r->>'tipoAnalise', ''), coalesce(r->>'remessa', ''),
              coalesce(r->>'tratamento', ''), coalesce(r->>'safra', ''), coalesce(r->>'repres', ''), coalesce(r->>'abertas', ''), coalesce(r->>'obs', ''),
              coalesce(r->>'procedencia', ''), coalesce(r->>'origem', ''), _data_key(r->>'data'))
      on conflict (pos) do update set prot = excluded.prot, data = excluded.data, especie = excluded.especie, cultivar = excluded.cultivar,
        categoria = excluded.categoria, peneira = excluded.peneira, lote = excluded.lote, produtor = excluded.produtor, tipo_analise = excluded.tipo_analise,
        remessa = excluded.remessa, tratamento = excluded.tratamento, safra = excluded.safra, repres = excluded.repres, abertas = excluded.abertas,
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

-- =====================================================================
-- API pública (o app e o painel chamam só estas duas)
-- =====================================================================
create or replace function _mov_json(m movimentos) returns jsonb language sql immutable as $$
  select jsonb_build_object('id', m.id, 'data', coalesce(m.data, ''), 'hora', coalesce(m.hora, ''), 'protocolo', coalesce(m.protocolo, ''), 'acao', coalesce(m.acao, ''),
    'destino', coalesce(m.destino, ''),
    'prateleira', coalesce(to_jsonb(m.prateleira), '""'::jsonb), 'andar', coalesce(to_jsonb(m.andar), '""'::jsonb),
    'linha', coalesce(to_jsonb(m.linha), '""'::jsonb), 'lado', coalesce(m.lado, ''), 'altura', coalesce(to_jsonb(m.altura), '""'::jsonb),
    'posicao', coalesce(m.posicao, ''), 'embalagem', coalesce(m.embalagem, ''), 'classificacao', coalesce(m.classificacao, ''),
    'especie', coalesce(m.especie, ''), 'cultivar', coalesce(m.cultivar, ''), 'lote', coalesce(m.lote, ''), 'produtor', coalesce(m.produtor, ''),
    'tipoAnalise', coalesce(m.tipo_analise, ''), 'remessa', coalesce(m.remessa, ''), 'tratamento', coalesce(m.tratamento, ''), 'categoria', coalesce(m.categoria, ''),
    'validacao', coalesce(m.validacao, ''), 'lido', coalesce(m.lido, ''), 'usuario', coalesce(m.usuario, ''), 'aparelho', coalesce(m.aparelho, ''),
    'fotoUrl', coalesce(m.foto, ''), 'ts', coalesce(m.ts, 0), 'situacao', coalesce(m.situacao, ''), 'obs', coalesce(m.obs, ''))
$$;
create or replace function _ref_json(r referencia) returns jsonb language sql immutable as $$
  select jsonb_build_object('prot', r.prot, 'data', r.data, 'especie', r.especie, 'cultivar', r.cultivar, 'categoria', r.categoria, 'peneira', r.peneira,
    'lote', r.lote, 'produtor', r.produtor, 'tipoAnalise', r.tipo_analise, 'remessa', r.remessa, 'tratamento', r.tratamento, 'safra', r.safra,
    'repres', r.repres, 'abertas', r.abertas, 'obs', r.obs, 'procedencia', r.procedencia, 'origem', r.origem)
$$;

create or replace function api_get(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare desde bigint;
begin
  if p->>'acao' = 'dados' then
    desde := coalesce(nullif(p->>'desde', '')::numeric::bigint, 0);
    -- mantém sempre o último movimento de cada amostra e o último armazenamento válido (para o estado atual) + todos a partir de "desde"
    return jsonb_build_object('ok', true, 'versao', 8,
      'movimentos', coalesce((select jsonb_agg(_mov_json(m) order by m.n) from movimentos m
         where desde = 0 or m.ts >= desde
            or m.id in (select distinct on (protocolo) id from movimentos order by protocolo, ts desc, n desc)
            or m.id in (select distinct on (protocolo) id from movimentos
                         where acao in ('ARMAZENAR','REMANEJAR','RETORNO') and coalesce(situacao, '') !~ '^Conflito'
                         order by protocolo, ts desc, n desc)), '[]'::jsonb),
      'prateleiras', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'numero', x.numero, 'embalagem', coalesce(x.embalagem, ''),
          'situacao', coalesce(nullif(x.situacao, ''), 'Ativa'), 'obs', coalesce(x.obs, ''), 'linhas', coalesce(to_jsonb(x.linhas), '""'::jsonb),
          'mapa', coalesce(x.mapa, ''), 'andares', coalesce(x.andares, '')) order by x.n) from prateleiras x), '[]'::jsonb),
      'reset', coalesce(_cfg('RESET_TS')::bigint, 0),
      'resetPrat', coalesce(_cfg('RESET_PRAT'), '0') = '1',
      'refInfo', jsonb_build_object('linhas', (select count(*) from referencia), 'atualizada', coalesce(_cfg('REF_EM'), '')));
  end if;
  if p->>'acao' = 'ref' then
    if coalesce(p->>'prot', '') <> '' then
      return jsonb_build_object('ok', true, 'ref', coalesce((select jsonb_agg(_ref_json(r)) from (select * from referencia where prot = p->>'prot' order by pos limit 1) r), '[]'::jsonb));
    end if;
    if coalesce(p->>'prots', '') <> '' then
      return jsonb_build_object('ok', true, 'ref', coalesce((select jsonb_agg(_ref_json(r) order by r.pos) from referencia r
        where r.prot = any(string_to_array(p->>'prots', ','))), '[]'::jsonb));
    end if;
    return jsonb_build_object('ok', true, 'ref', coalesce((select jsonb_agg(_ref_json(r) order by r.pos) from referencia r
      where r.prot <> '' and (coalesce(p->>'desde', '') = '' or coalesce(nullif(r.data_key, ''), _data_key(r.data)) >= p->>'desde')), '[]'::jsonb));
  end if;
  return jsonb_build_object('ok', true, 'msg', 'Planilha LASDM conectada', 'versao', 8);
end $$;

create or replace function api_post(d jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  x jsonb; p jsonb; m jsonb; k text; ocup text; ja record; situacao_ text;
  reset_ts bigint := coalesce(_cfg('RESET_TS')::bigint, 0);
  recebidos text[] := '{}'; prat_ok text[] := '{}'; fotos jsonb := '{}'::jsonb; conflitos jsonb := '[]'::jsonb;
begin
  perform pg_advisory_xact_lock(4243);   -- um envio por vez (como o bloqueio do script da planilha)

  if d ? 'acao' and d->>'acao' <> 'ref' then x := _usuarios(d); if x is not null then return x; end if; end if;
  if d->>'acao' = 'ref' then return _referencia(d); end if;

  -- prateleiras (cadastro / alteração)
  for p in select * from jsonb_array_elements(coalesce(d->'prateleiras', '[]'::jsonb)) loop
    insert into prateleiras (id, numero, embalagem, situacao, obs, atualizado_em, atualizado_por, linhas, mapa, andares)
    values (p->>'id', _int(p->'numero'), coalesce(p->>'embalagem', ''), coalesce(nullif(p->>'situacao', ''), 'Ativa'), coalesce(p->>'obs', ''), now(),
            coalesce(d->>'usuario', ''), nullif(_int(p->'linhas'), 0), coalesce(p->>'mapa', ''),
            case when jsonb_typeof(p->'andares') = 'array' then (select string_agg(value, ',') from jsonb_array_elements_text(p->'andares')) else coalesce(p->>'andares', '') end)
    on conflict (id) do update set numero = excluded.numero, embalagem = excluded.embalagem, situacao = excluded.situacao, obs = excluded.obs,
      atualizado_em = now(), atualizado_por = excluded.atualizado_por, linhas = excluded.linhas, mapa = excluded.mapa, andares = excluded.andares;
    prat_ok := prat_ok || ((p->>'id') || '|' || coalesce(nullif(p->>'situacao', ''), 'Ativa') || '|' || coalesce(_int(p->'numero')::text, ''));
  end loop;

  -- movimentos (na ordem em que foram feitos)
  for m in select value from jsonb_array_elements(coalesce(d->'movimentos', '[]'::jsonb)) order by coalesce(nullif(value->>'ts', '')::numeric, 0) loop
    if exists (select 1 from movimentos where id = m->>'id') then recebidos := recebidos || (m->>'id'); continue; end if;
    if reset_ts > 0 and coalesce(nullif(m->>'ts', '')::numeric, 0) > 0 and (m->>'ts')::numeric < reset_ts then recebidos := recebidos || (m->>'id'); continue; end if;
    situacao_ := 'Ativo';
    if m->>'acao' in ('ARMAZENAR','REMANEJAR','RETORNO') and _int(m->'prateleira') is not null then
      k := concat_ws('-', _int(m->'prateleira'), _int(m->'andar'), _int(m->'linha'), m->>'lado', _int(m->'altura'));
      select e.protocolo into ocup from _estado() e where e.slot = k and e.status in ('ARQUIVO','SALA') limit 1;
      if ocup is not null and ocup <> m->>'protocolo' then
        situacao_ := 'Conflito: posição ocupada por ' || ocup;
        conflitos := conflitos || jsonb_build_object('id', m->>'id', 'protocolo', m->>'protocolo', 'ocupante', ocup);
      elsif m->>'acao' = 'ARMAZENAR' then
        select * into ja from _estado() e where e.protocolo = m->>'protocolo';
        if ja.protocolo is not null and ja.slot <> '' and ja.status in ('ARQUIVO','SALA') then
          situacao_ := 'Conflito: protocolo já emblocado em ' || coalesce(nullif(ja.pos, ''), 'outra posição');
          conflitos := conflitos || jsonb_build_object('id', m->>'id', 'protocolo', m->>'protocolo', 'ocupante', 'o mesmo protocolo (' || coalesce(ja.pos, '') || ')');
        end if;
      end if;
    end if;
    insert into movimentos (id, data, hora, protocolo, acao, destino, prateleira, andar, linha, lado, altura, posicao, embalagem, classificacao,
                            especie, cultivar, lote, produtor, tipo_analise, remessa, tratamento, categoria, validacao, lido, usuario, aparelho,
                            foto, ts, situacao, obs)
    values (m->>'id', m->>'data', m->>'hora', m->>'protocolo', m->>'acao', coalesce(m->>'destino', ''),
            _int(m->'prateleira'), _int(m->'andar'), _int(m->'linha'), coalesce(m->>'lado', ''), _int(m->'altura'), coalesce(m->>'posicao', ''),
            coalesce(m->>'embalagem', ''), coalesce(m->>'classificacao', ''), coalesce(m->>'especie', ''), coalesce(m->>'cultivar', ''),
            coalesce(m->>'lote', ''), coalesce(m->>'produtor', ''), coalesce(m->>'tipoAnalise', ''), coalesce(m->>'remessa', ''),
            coalesce(m->>'tratamento', ''), coalesce(m->>'categoria', ''), coalesce(m->>'validacao', ''), coalesce(m->>'lido', ''),
            coalesce(m->>'usuario', ''), coalesce(m->>'aparelho', ''), coalesce(m->>'fotoUrl', ''),
            nullif(m->>'ts', '')::numeric::bigint, situacao_, coalesce(m->>'obs', ''));
    if coalesce(m->>'fotoUrl', '') <> '' then fotos := fotos || jsonb_build_object(m->>'id', m->>'fotoUrl'); end if;
    recebidos := recebidos || (m->>'id');
  end loop;

  return jsonb_build_object('ok', true, 'recebidos', to_jsonb(recebidos), 'fotos', fotos, 'conflitos', conflitos, 'prateleiras', to_jsonb(prat_ok));
exception when others then
  return jsonb_build_object('ok', false, 'erro', SQLERRM);
end $$;

revoke all on function api_get(jsonb), api_post(jsonb) from public;
grant execute on function api_get(jsonb), api_post(jsonb) to anon, authenticated;
do $$ declare fn text; begin
  foreach fn in array array['_hash(text,text)','_cfg(text)','_set_cfg(text,text)','_log(text,text,text)','_conferir(text,text)','_data_key(text)','_int(jsonb)',
                            '_estado()','_usuarios(jsonb)','_referencia(jsonb)','_mov_json(movimentos)','_ref_json(referencia)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end $$;

-- ---------- fotos das etiquetas: pasta pública "fotos" (o app só consegue ENVIAR; não apaga nem lista) ----------
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true) on conflict (id) do nothing;
do $$ begin
  drop policy if exists "app envia fotos" on storage.objects;
  create policy "app envia fotos" on storage.objects for insert to anon, authenticated with check (bucket_id = 'fotos');
exception when others then raise notice 'Política das fotos não criada (%). Crie pelo painel: Storage → fotos → Policies.', SQLERRM;
end $$;

select 'Pronto: estrutura do LASDM criada (versão 8).' as resultado;
