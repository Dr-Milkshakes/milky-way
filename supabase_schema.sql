-- =============================================
-- StudyApp Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  full_name text,
  role text default 'student' check (role in ('student', 'admin')),
  created_at timestamptz default now()
);

-- Topics synced from Notion
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text unique not null,
  title text not null,
  subject text not null,
  content text,                        -- raw text extracted from Notion page
  last_synced_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Questions (MCQ)
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics(id) on delete cascade,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  explanation text,
  status text default 'draft' check (status in ('draft', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- Quiz sessions
create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  subject text,
  total_questions int not null,
  correct_answers int default 0,
  score_percent numeric(5,2) default 0,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Individual question attempts within a session
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.quiz_sessions(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  selected_option text check (selected_option in ('A','B','C','D')),
  is_correct boolean not null,
  created_at timestamptz default now()
);

-- Flashcard decks per user
create table public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  source text default 'quiz_weakness' check (source in ('quiz_weakness', 'manual')),
  created_at timestamptz default now(),
  unique(user_id, topic_id)
);

-- Individual flashcards
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid references public.flashcard_decks(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  -- Spaced repetition fields
  ease_factor numeric(4,2) default 2.5,
  interval_days int default 1,
  repetitions int default 0,
  due_date date default current_date,
  last_reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- =============================================
-- Row Level Security
-- =============================================
alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;

-- Profiles: users see only their own
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Topics: everyone can read
create policy "All users can read topics" on public.topics
  for select using (true);

-- Questions: students see approved only; admins see all
create policy "Students see approved questions" on public.questions
  for select using (
    status = 'approved'
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Quiz sessions: own only
create policy "Users see own sessions" on public.quiz_sessions
  for all using (auth.uid() = user_id);

create policy "Users see own attempts" on public.quiz_attempts
  for all using (
    session_id in (
      select id from public.quiz_sessions where user_id = auth.uid()
    )
  );

-- Flashcards: own only
create policy "Users see own decks" on public.flashcard_decks
  for all using (auth.uid() = user_id);

create policy "Users see own flashcards" on public.flashcards
  for all using (
    deck_id in (
      select id from public.flashcard_decks where user_id = auth.uid()
    )
  );

-- =============================================
-- Helper: auto-create profile on signup
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
