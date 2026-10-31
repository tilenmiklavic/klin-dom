-- migrate:up

create table users (
  id uuid primary key default gen_random_uuid(),
  auth_provider text not null,
  auth_subject text not null,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (auth_provider, auth_subject)
);

create table homes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null,
  owner_id uuid not null references users (id),
  created_at timestamptz not null default now()
);

create table home_members (
  home_id uuid not null references homes (id) on delete cascade,
  user_id uuid not null references users (id),
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  default_reminder_time time not null default '08:00',
  notifications_enabled boolean not null default true,
  primary key (home_id, user_id)
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes (id) on delete cascade,
  code text not null unique,
  created_by uuid not null references users (id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes (id) on delete cascade,
  name text not null,
  icon text not null,
  sort_order int not null default 0,
  archived_at timestamptz
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes (id) on delete cascade,
  name text not null,
  icon text not null,
  notes text,
  interval_count int not null check (interval_count >= 1),
  interval_unit text not null check (interval_unit in ('day', 'week', 'month')),
  due_time time,
  assignee_id uuid references users (id),
  next_due_date date not null,
  last_completed_at timestamptz,
  created_by uuid not null references users (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index tasks_home_due_idx on tasks (home_id, next_due_date) where archived_at is null;

create table task_rooms (
  task_id uuid not null references tasks (id) on delete cascade,
  room_id uuid not null references rooms (id) on delete cascade,
  primary key (task_id, room_id)
);

create table task_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  offset_minutes int not null check (offset_minutes >= 0),
  unique (task_id, offset_minutes)
);

create table task_reminder_mutes (
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references users (id),
  primary key (task_id, user_id)
);

create table completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  home_id uuid not null references homes (id) on delete cascade,
  user_id uuid not null references users (id),
  kind text not null check (kind in ('done', 'skip')),
  completed_at timestamptz not null,
  due_date date not null,
  prev_next_due_date date not null,
  prev_last_completed_at timestamptz,
  assignee_id_at_time uuid references users (id),
  room_ids uuid[] not null,
  interval_count int not null,
  interval_unit text not null
);

create unique index completions_one_done_per_due on completions (task_id, due_date) where kind = 'done';
create index completions_home_time_idx on completions (home_id, completed_at);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create table reminder_log (
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references users (id),
  due_date date not null,
  offset_minutes int not null,
  sent_at timestamptz not null default now(),
  primary key (task_id, user_id, due_date, offset_minutes)
);

create table awards (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes (id) on delete cascade,
  user_id uuid references users (id),
  kind text not null,
  earned_at timestamptz not null default now(),
  meta jsonb not null default '{}'
);

create table daily_rings (
  home_id uuid not null references homes (id) on delete cascade,
  date date not null,
  today_done int not null,
  today_total int not null,
  closed boolean not null,
  week_done int not null,
  week_total int not null,
  fresh_pct int not null,
  primary key (home_id, date)
);

-- migrate:down

drop table daily_rings, awards, reminder_log, push_subscriptions, completions,
  task_reminder_mutes, task_reminders, task_rooms, tasks, rooms, invites,
  home_members, homes, users;
