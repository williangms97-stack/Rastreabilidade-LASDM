-- =====================================================================
-- LASDM · Reserva de andar por operador — rodar UMA vez no SQL Editor do Supabase.
-- Só ACRESCENTA uma tabela nova (reservas) e uma função (api_reserva). Não altera nem apaga dados existentes.
-- Cada operador reserva um andar; a reserva some ao liberar, ao sair do app ou após 30 min sem bipar.
-- =====================================================================
create table if not exists reservas (
  prateleira int not null, andar int not null, usuario text not null, nome text, aparelho text,
  desde timestamptz default now(), ultimo timestamptz default now(), primary key (prateleira, andar)
);
alter table reservas enable row level security;
revoke all on reservas from anon, authenticated;

create or replace function api_reserva(d jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(coalesce(d->>'usuario', ''))); p int := _int(d->'prateleira'); a int := _int(d->'andar');
        o reservas; adm usuarios; lista jsonb;
begin
  perform pg_advisory_xact_lock(4244);
  delete from reservas where ultimo < now() - interval '30 minutes';
  if d->>'op' = 'reservar' then
    if u = '' or p is null or a is null then return jsonb_build_object('ok', false, 'erro', 'Dados da reserva incompletos.'); end if;
    select * into o from reservas where prateleira = p and andar = a;
    if o.usuario is not null and o.usuario <> u then
      return jsonb_build_object('ok', false, 'erro', 'O andar A.' || lpad(a::text, 2, '0') || ' da prateleira ' || lpad(p::text, 2, '0') || ' está em uso por ' || coalesce(nullif(o.nome, ''), o.usuario) || '.');
    end if;
    delete from reservas where usuario = u and not (prateleira = p and andar = a);    -- um andar por operador
    insert into reservas (prateleira, andar, usuario, nome, aparelho) values (p, a, u, coalesce(d->>'nome', ''), coalesce(d->>'aparelho', ''))
    on conflict (prateleira, andar) do update set ultimo = now(), nome = excluded.nome, aparelho = excluded.aparelho;
  elsif d->>'op' = 'manter' then
    update reservas set ultimo = now() where usuario = u;
  elsif d->>'op' = 'liberar' then
    if d ? 'admin' then
      adm := _conferir(d->'admin'->>'usuario', d->'admin'->>'senha');
      if adm.usuario is null or adm.perfil <> 'Administrador' then return jsonb_build_object('ok', false, 'erro', 'Só administradores liberam a reserva de outro operador.'); end if;
      delete from reservas where prateleira = p and andar = a;
      perform _log('Reserva liberada pelo administrador: P.' || p || ' A.' || a, '-', adm.usuario);
    else
      delete from reservas where usuario = u;
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('prateleira', prateleira, 'andar', andar, 'usuario', usuario, 'nome', nome, 'aparelho', aparelho,
           'desde', (extract(epoch from desde) * 1000)::bigint, 'ultimo', (extract(epoch from ultimo) * 1000)::bigint) order by prateleira, andar), '[]'::jsonb)
    into lista from reservas;
  return jsonb_build_object('ok', true, 'reservas', lista, 'agora', (extract(epoch from now()) * 1000)::bigint);
exception when others then
  return jsonb_build_object('ok', false, 'erro', SQLERRM);
end $$;

revoke all on function api_reserva(jsonb) from public;
grant execute on function api_reserva(jsonb) to anon, authenticated;

select 'Pronto: reserva de andar instalada.' as resultado;
