-- ============================================================
-- Binalyst — Supabase Schema
-- Run this in your Supabase project SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Users (extends Supabase auth.users) ─────────────────────
create table if not exists public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  email         text unique not null,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── User settings (encrypted Binance keys stored here) ──────
create table if not exists public.user_settings (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade unique,
  binance_key_enc text,         -- AES encrypted API key
  binance_sec_enc text,         -- AES encrypted API secret
  auto_trade      boolean default false,
  chat_mode       text default 'assistant',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Alerts ──────────────────────────────────────────────────
create table if not exists public.alerts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id) on delete cascade,
  symbol      text not null,
  condition   text not null check (condition in ('above','below')),
  target      numeric not null,
  note        text,
  active      boolean default true,
  triggered_at timestamptz,
  created_at  timestamptz default now()
);

-- ── Agent rules ──────────────────────────────────────────────
create table if not exists public.agent_rules (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade,
  name            text not null,
  symbol          text not null,
  trigger_type    text not null,
  trigger_value   numeric not null,
  action_type     text not null,
  active          boolean default true,
  last_triggered  timestamptz,
  created_at      timestamptz default now()
);

-- ── Square post history ──────────────────────────────────────
create table if not exists public.square_posts (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references public.profiles(id) on delete cascade,
  content      text not null,
  tags         text[] default '{}',
  status       text default 'draft' check (status in ('draft','published')),
  square_id    text,    -- Binance Square post ID after publish
  published_at timestamptz,
  created_at   timestamptz default now()
);

-- ── RLS policies (Row Level Security) ────────────────────────
alter table public.profiles       enable row level security;
alter table public.user_settings  enable row level security;
alter table public.alerts         enable row level security;
alter table public.agent_rules    enable row level security;
alter table public.square_posts   enable row level security;

-- Users can only read/write their own data
create policy "own profile"      on public.profiles       for all using (auth.uid() = id);
create policy "own settings"     on public.user_settings  for all using (auth.uid() = user_id);
create policy "own alerts"       on public.alerts         for all using (auth.uid() = user_id);
create policy "own agent rules"  on public.agent_rules    for all using (auth.uid() = user_id);
create policy "own square posts" on public.square_posts   for all using (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists alerts_user_id_idx       on public.alerts(user_id);
create index if not exists agent_rules_user_id_idx  on public.agent_rules(user_id);
create index if not exists square_posts_user_id_idx on public.square_posts(user_id);
