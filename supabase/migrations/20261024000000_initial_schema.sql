-- Pitalica — initial schema
--
-- Security model
--   * Hosts authenticate with Supabase Auth. They can read/write only their own quizzes
--     (Row Level Security on every table).
--   * Players are anonymous. They never talk to the database directly: every game read and
--     write goes through Next.js route handlers that use the service role and validate the
--     player's secret token. Game tables therefore grant nothing to `anon`, and hosts can
--     only SELECT their own sessions (for history/results pages).
--   * Correct answers live in `quiz_questions.data` (owner-only) and in the frozen
--     `game_sessions.quiz_snapshot` (host-only). Neither is reachable by players.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), ''), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Quizzes
-- ---------------------------------------------------------------------------

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 500),
  cover_image jsonb check (cover_image is null or jsonb_typeof(cover_image) = 'object'),
  category text check (category is null or char_length(category) <= 40),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  -- Derived on save by the server-side validator; re-checked before every game start.
  is_playable boolean not null default false,
  issue_count integer not null default 0 check (issue_count >= 0),
  question_count integer not null default 0 check (question_count >= 0),
  practice_shared boolean not null default false,
  schema_version integer not null default 1,
  last_played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quizzes_owner_updated_idx on public.quizzes (owner_id, updated_at desc);

create trigger quizzes_updated_at before update on public.quizzes
  for each row execute function public.set_updated_at();

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  -- Stable identifier from the quiz document (questions[].id).
  question_key text not null check (question_key ~ '^[A-Za-z0-9_-]{6,40}$'),
  position integer not null check (position >= 0 and position < 100),
  type text not null check (type in (
    'single_choice', 'multi_select', 'true_false', 'slider', 'short_answer', 'numeric',
    'pin_image', 'ordering', 'matching', 'image_choice', 'poll', 'ranking'
  )),
  title text not null default '' check (char_length(title) <= 300),
  -- Full question document (validated with Zod, see src/lib/domain/schema.ts).
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ->> 'type' = type),
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_questions_key_unique unique (quiz_id, question_key),
  constraint quiz_questions_position_unique unique (quiz_id, position) deferrable initially deferred
);

create trigger quiz_questions_updated_at before update on public.quiz_questions
  for each row execute function public.set_updated_at();

create table public.quiz_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  path text not null unique check (path ~ '^[A-Za-z0-9/_.-]+$'),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now()
);

create index quiz_media_owner_idx on public.quiz_media (owner_id, created_at);

-- ---------------------------------------------------------------------------
-- Game sessions
-- ---------------------------------------------------------------------------

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes (id) on delete set null,
  host_id uuid references public.profiles (id) on delete cascade,
  pin text check (pin ~ '^[0-9]{6}$'),
  pin_expires_at timestamptz,
  mode text not null check (mode in ('classic', 'team', 'host_controlled', 'practice')),
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  quiz_title text not null default '',
  -- Frozen copy of the quiz at game creation (includes correct answers — never exposed).
  quiz_snapshot jsonb not null,
  -- Indexes into quiz_snapshot.questions, in play order.
  question_order integer[] not null,
  -- Secret seed for public ID derivation and shuffles.
  seed text not null,
  state text not null default 'lobby' check (state in (
    'lobby', 'question_active', 'question_revealing', 'leaderboard', 'finished', 'cancelled'
  )),
  state_version integer not null default 0,
  current_index integer not null default -1,
  question_started_at timestamptz,
  question_deadline timestamptz,
  paused_remaining_ms integer check (paused_remaining_ms is null or paused_remaining_ms >= 0),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint game_sessions_pin_required check (mode = 'practice' or (pin is not null and pin_expires_at is not null)),
  constraint game_sessions_host_required check (mode = 'practice' or host_id is not null)
);

-- A PIN is unique among games that are still running.
create unique index game_sessions_active_pin_idx on public.game_sessions (pin)
  where pin is not null and state not in ('finished', 'cancelled');
create index game_sessions_host_idx on public.game_sessions (host_id, created_at desc);
create index game_sessions_quiz_idx on public.game_sessions (quiz_id);
create index game_sessions_state_updated_idx on public.game_sessions (state, updated_at);

create trigger game_sessions_updated_at before update on public.game_sessions
  for each row execute function public.set_updated_at();

create table public.game_teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  color text not null,
  position integer not null,
  unique (session_id, position)
);

create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  nickname_key text not null,
  -- SHA-256 of the player's secret token. The token itself is only known to the player.
  token_hash text not null,
  -- One team per player; a separate membership table is unnecessary for this model.
  team_id uuid references public.game_teams (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  score integer not null default 0 check (score >= 0),
  correct_count integer not null default 0,
  answered_count integer not null default 0,
  total_response_ms bigint not null default 0,
  previous_rank integer,
  kicked boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index game_players_nickname_idx on public.game_players (session_id, nickname_key) where not kicked;
create index game_players_session_idx on public.game_players (session_id);
create index game_players_token_idx on public.game_players (session_id, token_hash);

create table public.game_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  player_id uuid not null references public.game_players (id) on delete cascade,
  question_index integer not null check (question_index >= 0),
  question_key text not null,
  answer jsonb not null,
  status text not null check (status in ('correct', 'partial', 'incorrect', 'pending_review', 'ungraded')),
  fraction real not null default 0 check (fraction >= 0 and fraction <= 1),
  points integer not null default 0 check (points >= 0),
  response_ms integer not null check (response_ms >= 0),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One answer per player per question: duplicates can never award duplicate points.
  constraint game_answers_one_per_question unique (player_id, question_index)
);

create index game_answers_session_question_idx on public.game_answers (session_id, question_index);

create trigger game_answers_updated_at before update on public.game_answers
  for each row execute function public.set_updated_at();

create table public.game_question_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  question_index integer not null,
  question_key text not null,
  stats jsonb not null,
  closed_at timestamptz not null default now(),
  unique (session_id, question_index)
);

create table public.game_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  type text not null,
  state_version integer not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index game_events_session_idx on public.game_events (session_id, id);
create index game_events_created_idx on public.game_events (created_at);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_media enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_teams enable row level security;
alter table public.game_players enable row level security;
alter table public.game_answers enable row level security;
alter table public.game_question_results enable row level security;
alter table public.game_events enable row level security;
alter table public.rate_limits enable row level security;

-- Explicit grants (do not rely on project defaults).
revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.quizzes, public.quiz_questions to authenticated;
grant select, insert, delete on public.quiz_media to authenticated;
grant select on public.game_sessions, public.game_teams, public.game_players,
  public.game_answers, public.game_question_results to authenticated;
grant all on all tables in schema public to service_role;

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "quizzes: owner read" on public.quizzes
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "quizzes: owner insert" on public.quizzes
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "quizzes: owner update" on public.quizzes
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "quizzes: owner delete" on public.quizzes
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "questions: owner all" on public.quiz_questions
  for all to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = (select auth.uid())));

create policy "media: owner read" on public.quiz_media
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "media: owner insert" on public.quiz_media
  for insert to authenticated with check (
    (select auth.uid()) = owner_id and split_part(path, '/', 1) = (select auth.uid())::text
  );
create policy "media: owner delete" on public.quiz_media
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "sessions: host read" on public.game_sessions
  for select to authenticated using ((select auth.uid()) = host_id);

create policy "teams: host read" on public.game_teams
  for select to authenticated
  using (exists (select 1 from public.game_sessions s where s.id = session_id and s.host_id = (select auth.uid())));
create policy "players: host read" on public.game_players
  for select to authenticated
  using (exists (select 1 from public.game_sessions s where s.id = session_id and s.host_id = (select auth.uid())));
create policy "answers: host read" on public.game_answers
  for select to authenticated
  using (exists (select 1 from public.game_sessions s where s.id = session_id and s.host_id = (select auth.uid())));
create policy "results: host read" on public.game_question_results
  for select to authenticated
  using (exists (select 1 from public.game_sessions s where s.id = session_id and s.host_id = (select auth.uid())));

-- game_events and rate_limits: no client policies at all (service role only).

-- ---------------------------------------------------------------------------
-- Quiz functions (run as the calling user — RLS applies)
-- ---------------------------------------------------------------------------

-- Atomically replaces a quiz's metadata and question list. The route handler validates the
-- document with Zod first; the database keeps its own type/shape checks as a backstop.
create or replace function public.save_quiz(
  p_quiz_id uuid,
  p_meta jsonb,
  p_questions jsonb,
  p_is_playable boolean,
  p_issue_count integer
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated timestamptz;
  v_count integer := coalesce(jsonb_array_length(p_questions), 0);
begin
  if jsonb_typeof(p_questions) <> 'array' then
    raise exception 'questions must be an array' using errcode = '22023';
  end if;

  update public.quizzes set
    title = coalesce(p_meta ->> 'title', ''),
    description = coalesce(p_meta ->> 'description', ''),
    cover_image = case when jsonb_typeof(p_meta -> 'coverImage') = 'object' then p_meta -> 'coverImage' else null end,
    category = nullif(p_meta ->> 'category', ''),
    tags = coalesce(array(select jsonb_array_elements_text(coalesce(p_meta -> 'tags', '[]'::jsonb))), '{}'),
    is_playable = p_is_playable,
    issue_count = greatest(p_issue_count, 0),
    question_count = v_count,
    schema_version = 1
  where id = p_quiz_id and owner_id = (select auth.uid())
  returning updated_at into v_updated;

  if not found then
    raise exception 'quiz not found' using errcode = 'P0002';
  end if;

  delete from public.quiz_questions
  where quiz_id = p_quiz_id
    and question_key not in (select q ->> 'id' from jsonb_array_elements(p_questions) q);

  insert into public.quiz_questions (quiz_id, question_key, position, type, title, data)
  select p_quiz_id, q.value ->> 'id', (q.ordinality - 1)::integer, q.value ->> 'type',
         coalesce(q.value ->> 'title', ''), q.value
  from jsonb_array_elements(p_questions) with ordinality as q(value, ordinality)
  on conflict (quiz_id, question_key) do update set
    position = excluded.position,
    type = excluded.type,
    title = excluded.title,
    data = excluded.data;

  return v_updated;
end;
$$;

create or replace function public.duplicate_quiz(p_quiz_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new uuid;
begin
  insert into public.quizzes (owner_id, title, description, cover_image, category, tags, is_playable,
                              issue_count, question_count)
  select owner_id, left(title || ' (kopija)', 120), description, cover_image, category, tags, is_playable,
         issue_count, question_count
  from public.quizzes
  where id = p_quiz_id and owner_id = (select auth.uid())
  returning id into v_new;

  if v_new is null then
    raise exception 'quiz not found' using errcode = 'P0002';
  end if;

  insert into public.quiz_questions (quiz_id, question_key, position, type, title, data)
  select v_new, question_key, position, type, title, data
  from public.quiz_questions where quiz_id = p_quiz_id;

  return v_new;
end;
$$;

grant execute on function public.save_quiz(uuid, jsonb, jsonb, boolean, integer) to authenticated;
grant execute on function public.duplicate_quiz(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Game functions (service role only)
-- ---------------------------------------------------------------------------

-- Inserts (or, when allowed, replaces) one answer while holding a share lock on the session,
-- so it cannot interleave with the transition that closes the question.
create or replace function public.submit_answer(
  p_session_id uuid,
  p_player_id uuid,
  p_question_index integer,
  p_question_key text,
  p_answer jsonb,
  p_status text,
  p_fraction real,
  p_points integer,
  p_response_ms integer,
  p_allow_change boolean
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.game_sessions%rowtype;
  v_existing uuid;
begin
  select * into v_session from public.game_sessions where id = p_session_id for share;
  if not found then return 'not_found'; end if;
  if v_session.state <> 'question_active' or v_session.current_index <> p_question_index then
    return 'closed';
  end if;
  if v_session.paused_remaining_ms is not null then return 'paused'; end if;

  select id into v_existing from public.game_answers
  where player_id = p_player_id and question_index = p_question_index;

  if v_existing is not null then
    if not p_allow_change then return 'duplicate'; end if;
    update public.game_answers set
      answer = p_answer, status = p_status, fraction = p_fraction, points = p_points,
      response_ms = p_response_ms, submitted_at = now()
    where id = v_existing;
    return 'updated';
  end if;

  insert into public.game_answers (session_id, player_id, question_index, question_key, answer, status,
                                   fraction, points, response_ms)
  values (p_session_id, p_player_id, p_question_index, p_question_key, p_answer, p_status,
          p_fraction, p_points, p_response_ms)
  on conflict on constraint game_answers_one_per_question do nothing;
  if not found then return 'duplicate'; end if;
  return 'accepted';
end;
$$;

-- Recomputes every player's totals from their answers. Idempotent, so it is safe to call
-- after each question and after a host review decision.
create or replace function public.recalculate_scores(p_session_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.game_players p set
    score = coalesce(a.points, 0),
    correct_count = coalesce(a.correct, 0),
    answered_count = coalesce(a.answered, 0),
    total_response_ms = coalesce(a.ms, 0)
  from public.game_players p2
  left join (
    select player_id,
           sum(points)::integer as points,
           count(*) filter (where status = 'correct')::integer as correct,
           count(*)::integer as answered,
           sum(response_ms)::bigint as ms
    from public.game_answers
    where session_id = p_session_id
    group by player_id
  ) a on a.player_id = p2.id
  where p.id = p2.id and p2.session_id = p_session_id;
$$;

-- Stores the per-question statistics once, remembers each player's rank before the question
-- (for "position change" on the leaderboard) and recalculates totals.
create or replace function public.finalize_question(
  p_session_id uuid,
  p_question_index integer,
  p_question_key text,
  p_stats jsonb,
  p_previous_ranks jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted boolean;
begin
  insert into public.game_question_results (session_id, question_index, question_key, stats)
  values (p_session_id, p_question_index, p_question_key, p_stats)
  on conflict (session_id, question_index) do nothing;
  v_inserted := found;

  if v_inserted then
    update public.game_players p set previous_rank = (r ->> 'rank')::integer
    from jsonb_array_elements(p_previous_ranks) r
    where p.session_id = p_session_id and p.id = (r ->> 'id')::uuid;
  end if;

  perform public.recalculate_scores(p_session_id);
  return v_inserted;
end;
$$;

-- Fixed-window rate limiter. Returns true when the call is allowed.
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

-- Retention: closes abandoned games and removes temporary data.
create or replace function public.cleanup_stale_games()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cancelled integer;
  v_finished integer;
  v_deleted integer;
begin
  update public.game_sessions set state = 'cancelled', state_version = state_version + 1, finished_at = now()
  where state = 'lobby' and updated_at < now() - interval '6 hours';
  get diagnostics v_cancelled = row_count;

  update public.game_sessions set state = 'finished', state_version = state_version + 1, finished_at = now(),
    question_deadline = null, paused_remaining_ms = null
  where state in ('question_active', 'question_revealing', 'leaderboard') and updated_at < now() - interval '6 hours';
  get diagnostics v_finished = row_count;

  delete from public.game_sessions where state = 'cancelled' and updated_at < now() - interval '7 days';
  get diagnostics v_deleted = row_count;

  -- Player tokens are only needed while a game can still be viewed.
  update public.game_players p set token_hash = 'expired'
  from public.game_sessions s
  where s.id = p.session_id and s.state = 'finished' and s.finished_at < now() - interval '2 days'
    and p.token_hash <> 'expired';

  delete from public.game_events where created_at < now() - interval '30 days';
  delete from public.rate_limits where window_start < now() - interval '1 day';

  return jsonb_build_object('cancelled', v_cancelled, 'finished', v_finished, 'deleted', v_deleted);
end;
$$;

revoke execute on function public.submit_answer(uuid, uuid, integer, text, jsonb, text, real, integer, integer, boolean) from public, anon, authenticated;
revoke execute on function public.recalculate_scores(uuid) from public, anon, authenticated;
revoke execute on function public.finalize_question(uuid, integer, text, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.cleanup_stale_games() from public, anon, authenticated;
grant execute on function public.submit_answer(uuid, uuid, integer, text, jsonb, text, real, integer, integer, boolean) to service_role;
grant execute on function public.recalculate_scores(uuid) to service_role;
grant execute on function public.finalize_question(uuid, integer, text, jsonb, jsonb) to service_role;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
grant execute on function public.cleanup_stale_games() to service_role;

-- ---------------------------------------------------------------------------
-- Storage: public-read bucket for quiz images, uploads only into the owner's folder
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-media', 'quiz-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "quiz-media: owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'quiz-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "quiz-media: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'quiz-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "quiz-media: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'quiz-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
