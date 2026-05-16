create extension if not exists pgcrypto;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  level text,
  duration text,
  goal text,
  source_type text,
  source_label text,
  source_file text,
  estimated_time text,
  learning_outcomes jsonb not null default '[]'::jsonb,
  weak_topics jsonb not null default '[]'::jsonb,
  card_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  kind text not null default 'file',
  file_name text,
  storage_path text,
  text_excerpt text,
  created_at timestamptz not null default now()
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null,
  title text not null,
  summary text,
  explanation text,
  key_concepts jsonb not null default '[]'::jsonb,
  examples jsonb not null default '[]'::jsonb,
  practice_tasks jsonb not null default '[]'::jsonb,
  estimated_minutes integer,
  video_search_query text,
  video_keywords jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  content text,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  video_id text not null,
  title text not null,
  url text not null,
  thumbnail_url text,
  channel_title text,
  source text not null default 'youtube',
  search_query text,
  query_signature text,
  match_score numeric not null default 0,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position integer not null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option_index integer not null default 0,
  explanation text,
  topic text,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score integer not null,
  total_questions integer not null,
  correct_count integer not null,
  weak_topics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  completed_sections jsonb not null default '[]'::jsonb,
  percent integer not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, module_id)
);

create table if not exists public.study_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid references public.modules(id) on delete cascade,
  title text not null,
  meta text,
  kind text not null default 'lesson',
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  module_id uuid references public.modules(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists courses_user_created_idx on public.courses(user_id, created_at desc);
create index if not exists modules_course_position_idx on public.modules(course_id, position);
create index if not exists quizzes_module_idx on public.quizzes(module_id);
create index if not exists questions_quiz_position_idx on public.questions(quiz_id, position);
create index if not exists attempts_module_created_idx on public.attempts(module_id, created_at desc);
create index if not exists videos_module_signature_idx on public.videos(module_id, query_signature);
create index if not exists messages_scope_created_idx on public.messages(user_id, course_id, module_id, created_at);
create index if not exists study_plan_user_due_idx on public.study_plan(user_id, due_date);

alter table public.courses enable row level security;
alter table public.sources enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.videos enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.progress enable row level security;
alter table public.study_plan enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Users manage own courses" on public.courses;
drop policy if exists "Users manage own sources" on public.sources;
drop policy if exists "Users manage own modules" on public.modules;
drop policy if exists "Users manage own lessons" on public.lessons;
drop policy if exists "Users manage own videos" on public.videos;
drop policy if exists "Users manage own quizzes" on public.quizzes;
drop policy if exists "Users manage own questions" on public.questions;
drop policy if exists "Users manage own attempts" on public.attempts;
drop policy if exists "Users manage own progress" on public.progress;
drop policy if exists "Users manage own study plan" on public.study_plan;
drop policy if exists "Users manage own messages" on public.messages;

create policy "Users manage own courses" on public.courses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own sources" on public.sources for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own modules" on public.modules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own lessons" on public.lessons for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own videos" on public.videos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own quizzes" on public.quizzes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own questions" on public.questions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own attempts" on public.attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own progress" on public.progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own study plan" on public.study_plan for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own messages" on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('course-materials', 'course-materials', false)
on conflict (id) do nothing;

drop policy if exists "Users read own course material files" on storage.objects;
drop policy if exists "Users upload own course material files" on storage.objects;
drop policy if exists "Users update own course material files" on storage.objects;
drop policy if exists "Users delete own course material files" on storage.objects;

create policy "Users read own course material files"
on storage.objects for select
using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users upload own course material files"
on storage.objects for insert
with check (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update own course material files"
on storage.objects for update
using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own course material files"
on storage.objects for delete
using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);
