-- ============================================================================
-- Among Us 2 — Esquema completo de Base de Datos, RLS, RPCs y Realtime
-- Compatible con Supabase (PostgreSQL 15+, Auth, Realtime Broadcast & Changes)
-- Capacidad: Hasta 40 jugadores por sala, hasta 6 impostores, 3+ mapas
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PERFILES DE USUARIO (Personalización persistente y estadísticas)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(trim(username)) between 2 and 24),
  avatar_color text not null default 'red',
  avatar_hat text not null default 'none',
  avatar_visor text not null default 'classic',
  avatar_skin text not null default 'default',
  avatar_pet text not null default 'none',
  games_played integer not null default 0 check (games_played >= 0),
  crewmate_wins integer not null default 0 check (crewmate_wins >= 0),
  impostor_wins integer not null default 0 check (impostor_wins >= 0),
  tasks_completed integer not null default 0 check (tasks_completed >= 0),
  kills_total integer not null default 0 check (kills_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Creación automática del perfil al registrarse en Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Tripulante'
  );
  v_username := left(v_username, 24);
  if char_length(v_username) < 2 then
    v_username := 'Tripulante';
  end if;

  insert into public.profiles (id, username)
  values (new.id, v_username)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. SALAS DE JUEGO (Hasta 40 jugadores, hasta 6 impostores)
-- ----------------------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references public.profiles (id) on delete cascade,
  map_id text not null default 'aegis' check (map_id in ('aegis', 'borealis', 'solaris')),
  max_players integer not null default 40 check (max_players between 4 and 40),
  impostor_count integer not null default 2 check (impostor_count between 1 and 6),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'meeting', 'finished')),
  settings jsonb not null default '{
    "maxPlayers": 40,
    "impostorCount": 2,
    "mapId": "aegis",
    "killCooldown": 22,
    "killDistance": "medium",
    "discussionTime": 25,
    "votingTime": 45,
    "emergencyMeetings": 1,
    "emergencyCooldown": 15,
    "playerSpeed": 1.0,
    "crewVision": 1.0,
    "impostorVision": 1.5,
    "shortTasks": 2,
    "longTasks": 1,
    "commonTasks": 1,
    "confirmEjects": true,
    "anonymousVotes": false,
    "visualTasks": true,
    "enableAdvancedRoles": true
  }'::jsonb,
  game_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rooms_code on public.rooms (code);
create index if not exists idx_rooms_status on public.rooms (status);

drop trigger if exists rooms_updated_at on public.rooms;
create trigger rooms_updated_at
  before update on public.rooms
  for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 3. JUGADORES EN SALA (Usuarios reales y Bots IA opcionales)
-- ----------------------------------------------------------------------------
create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  bot_id text,
  display_name text not null check (char_length(trim(display_name)) between 1 and 24),
  is_bot boolean not null default false,
  is_host boolean not null default false,
  cosmetics jsonb not null default '{
    "color": "red",
    "hat": "none",
    "visor": "classic",
    "skin": "default",
    "pet": "none"
  }'::jsonb,
  role text check (role in ('crewmate', 'impostor')),
  sub_role text not null default 'none' check (sub_role in ('none', 'engineer', 'scientist', 'tracker', 'shapeshifter')),
  is_alive boolean not null default true,
  tasks jsonb not null default '[]'::jsonb,
  emergencies_left integer not null default 1 check (emergencies_left >= 0),
  joined_at timestamptz not null default now(),
  constraint room_players_identity_check check (
    (is_bot = false and user_id is not null and bot_id is null) or
    (is_bot = true and user_id is null and bot_id is not null)
  )
);

create unique index if not exists uq_room_players_user
  on public.room_players (room_id, user_id)
  where user_id is not null;

create unique index if not exists uq_room_players_bot
  on public.room_players (room_id, bot_id)
  where bot_id is not null;

create index if not exists idx_room_players_room on public.room_players (room_id);

-- ----------------------------------------------------------------------------
-- 4. VOTOS DE REUNIÓN (Integridad por reunión y jugador)
-- ----------------------------------------------------------------------------
create table if not exists public.match_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  meeting_number integer not null check (meeting_number >= 1),
  voter_player_id uuid not null references public.room_players (id) on delete cascade,
  target_player_id uuid references public.room_players (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (room_id, meeting_number, voter_player_id)
);

create index if not exists idx_match_votes_room_meeting
  on public.match_votes (room_id, meeting_number);

-- ----------------------------------------------------------------------------
-- 5. MENSAJES DE SALA, REUNIÓN Y CHAT DE FANTASMAS
-- ----------------------------------------------------------------------------
create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  sender_player_id uuid references public.room_players (id) on delete set null,
  sender_name text not null,
  sender_color text not null default 'cyan',
  content text not null check (char_length(trim(content)) between 1 and 400),
  channel text not null default 'lobby' check (channel in ('lobby', 'meeting', 'ghost', 'system')),
  created_at timestamptz not null default now()
);

create index if not exists idx_room_messages_room_created
  on public.room_messages (room_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 6. HISTORIAL DE PARTIDAS
-- ----------------------------------------------------------------------------
create table if not exists public.match_history (
  id uuid primary key default gen_random_uuid(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  room_code text not null,
  map_id text not null,
  winner text not null check (winner in ('crewmates', 'impostors')),
  reason text not null,
  player_count integer not null,
  impostor_count integer not null,
  duration_seconds integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) Y FUNCIONES AUXILIARES SIN RECURSIÓN
-- ----------------------------------------------------------------------------
create or replace function public.is_member_of_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_dead_in_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room_id
      and user_id = auth.uid()
      and is_alive = false
  );
$$;

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.match_votes enable row level security;
alter table public.room_messages enable row level security;
alter table public.match_history enable row level security;

-- Profiles: lectura pública para usuarios autenticados, escritura solo propia
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Rooms: lectura por autenticados, creación propia, actualización por miembros de sala
drop policy if exists "rooms_select_authenticated" on public.rooms;
create policy "rooms_select_authenticated"
  on public.rooms for select
  to authenticated
  using (true);

drop policy if exists "rooms_insert_authenticated" on public.rooms;
create policy "rooms_insert_authenticated"
  on public.rooms for insert
  to authenticated
  with check ((select auth.uid()) = host_id);

drop policy if exists "rooms_update_members" on public.rooms;
create policy "rooms_update_members"
  on public.rooms for update
  to authenticated
  using (
    (select auth.uid()) = host_id or public.is_member_of_room(id)
  );

drop policy if exists "rooms_delete_host" on public.rooms;
create policy "rooms_delete_host"
  on public.rooms for delete
  to authenticated
  using ((select auth.uid()) = host_id);

-- Room Players: lectura por autenticados; inserción propia o de bots por host
drop policy if exists "room_players_select_authenticated" on public.room_players;
create policy "room_players_select_authenticated"
  on public.room_players for select
  to authenticated
  using (true);

drop policy if exists "room_players_insert_self_or_host_bot" on public.room_players;
create policy "room_players_insert_self_or_host_bot"
  on public.room_players for insert
  to authenticated
  with check (
    (is_bot = false and user_id = (select auth.uid())) or
    (is_bot = true and exists (
      select 1 from public.rooms r
      where r.id = room_players.room_id and r.host_id = (select auth.uid())
    ))
  );

drop policy if exists "room_players_update_room_members" on public.room_players;
create policy "room_players_update_room_members"
  on public.room_players for update
  to authenticated
  using (
    user_id = (select auth.uid()) or
    exists (
      select 1 from public.rooms r
      where r.id = room_players.room_id and r.host_id = (select auth.uid())
    ) or
    public.is_member_of_room(room_id)
  );

drop policy if exists "room_players_delete_self_or_host" on public.room_players;
create policy "room_players_delete_self_or_host"
  on public.room_players for delete
  to authenticated
  using (
    user_id = (select auth.uid()) or
    exists (
      select 1 from public.rooms r
      where r.id = room_players.room_id and r.host_id = (select auth.uid())
    )
  );

-- Match Votes: miembros de la sala pueden leer y emitir/actualizar votos
drop policy if exists "match_votes_select_members" on public.match_votes;
create policy "match_votes_select_members"
  on public.match_votes for select
  to authenticated
  using (public.is_member_of_room(room_id));

drop policy if exists "match_votes_insert_members" on public.match_votes;
create policy "match_votes_insert_members"
  on public.match_votes for insert
  to authenticated
  with check (public.is_member_of_room(room_id));

drop policy if exists "match_votes_update_members" on public.match_votes;
create policy "match_votes_update_members"
  on public.match_votes for update
  to authenticated
  using (public.is_member_of_room(room_id));

-- Room Messages: chat de fantasmas aislado solo para jugadores muertos o partida finalizada
drop policy if exists "room_messages_select_visibility" on public.room_messages;
create policy "room_messages_select_visibility"
  on public.room_messages for select
  to authenticated
  using (
    channel <> 'ghost' or
    exists (
      select 1 from public.rooms r
      where r.id = room_messages.room_id and r.status in ('lobby', 'finished')
    ) or
    public.is_dead_in_room(room_id)
  );

drop policy if exists "room_messages_insert_members" on public.room_messages;
create policy "room_messages_insert_members"
  on public.room_messages for insert
  to authenticated
  with check (public.is_member_of_room(room_id));

-- Match History: lectura por autenticados y registro vinculado al autor
drop policy if exists "match_history_select_authenticated" on public.match_history;
create policy "match_history_select_authenticated"
  on public.match_history for select
  to authenticated
  using (true);

drop policy if exists "match_history_insert_authenticated" on public.match_history;
create policy "match_history_insert_authenticated"
  on public.match_history for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

-- ----------------------------------------------------------------------------
-- 8. FUNCIONES RPC ATÓMICAS
-- ----------------------------------------------------------------------------

-- Unirse a sala por código validando límite de 40 jugadores y estado de sala
create or replace function public.join_room_by_code(
  p_code text,
  p_display_name text,
  p_cosmetics jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_existing public.room_players;
  v_count integer;
  v_player public.room_players;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para unirte a una sala.';
  end if;

  select * into v_room
  from public.rooms
  where code = upper(trim(p_code))
  for update;

  if v_room.id is null then
    raise exception 'No existe ninguna sala con el código %.', upper(trim(p_code));
  end if;

  -- Si el jugador ya estaba en la sala, devolver su registro actualizado
  select * into v_existing
  from public.room_players
  where room_id = v_room.id and user_id = auth.uid();

  if v_existing.id is not null then
    update public.room_players
    set display_name = left(trim(p_display_name), 24),
        cosmetics = coalesce(p_cosmetics, cosmetics)
    where id = v_existing.id
    returning * into v_player;

    return jsonb_build_object('room', to_jsonb(v_room), 'player', to_jsonb(v_player));
  end if;

  if v_room.status <> 'lobby' then
    raise exception 'Esta partida ya ha comenzado. Espera a que regrese a la sala de espera.';
  end if;

  select count(*) into v_count
  from public.room_players
  where room_id = v_room.id;

  if v_count >= v_room.max_players then
    raise exception 'La sala está llena (% / % jugadores).', v_count, v_room.max_players;
  end if;

  insert into public.room_players (
    room_id, user_id, display_name, is_bot, is_host, cosmetics
  )
  values (
    v_room.id,
    auth.uid(),
    left(trim(p_display_name), 24),
    false,
    (v_room.host_id = auth.uid()),
    coalesce(p_cosmetics, '{}'::jsonb)
  )
  returning * into v_player;

  return jsonb_build_object('room', to_jsonb(v_room), 'player', to_jsonb(v_player));
end;
$$;

-- Actualizar estadísticas del perfil propio al terminar partida
create or replace function public.record_my_match_stats(
  p_won boolean,
  p_was_impostor boolean,
  p_tasks_completed integer default 0,
  p_kills integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.profiles
  set
    games_played = games_played + 1,
    crewmate_wins = crewmate_wins + case when p_won and not p_was_impostor then 1 else 0 end,
    impostor_wins = impostor_wins + case when p_won and p_was_impostor then 1 else 0 end,
    tasks_completed = tasks_completed + greatest(0, p_tasks_completed),
    kills_total = kills_total + greatest(0, p_kills)
  where id = auth.uid();
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. HABILITAR SUPABASE REALTIME EN TABLAS CLAVE
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_players'
  ) then
    alter publication supabase_realtime add table public.room_players;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_messages'
  ) then
    alter publication supabase_realtime add table public.room_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_votes'
  ) then
    alter publication supabase_realtime add table public.match_votes;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 10. PERMISOS EXPLÍCITOS PARA ROLES DE SUPABASE (Postgres 17+ / Publishable Keys)
-- ----------------------------------------------------------------------------
grant usage on schema public to authenticated, anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select, insert, update, delete on public.room_players to authenticated;
grant select, insert, update on public.match_votes to authenticated;
grant select, insert on public.room_messages to authenticated;
grant select, insert on public.match_history to authenticated;

grant execute on function public.is_member_of_room(uuid) to authenticated;
grant execute on function public.is_dead_in_room(uuid) to authenticated;
grant execute on function public.join_room_by_code(text, text, jsonb) to authenticated;
grant execute on function public.record_my_match_stats(boolean, boolean, integer, integer) to authenticated;
