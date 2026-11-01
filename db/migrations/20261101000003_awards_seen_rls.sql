-- migrate:up

-- When a member last looked at the awards list; newer awards show as unseen.
alter table home_members add column awards_seen_at timestamptz not null default now();

-- One award of a kind per home and user (user_id is null for home-wide awards).
create unique index awards_once on awards (home_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), kind);

-- Supabase exposes the public schema through its Data API using the app's
-- publishable key. Row level security with no policies denies those roles
-- everything, while the API connects as the table owner and is unaffected.
-- Self-hosted Postgres simply ignores this.
alter table users enable row level security;
alter table homes enable row level security;
alter table home_members enable row level security;
alter table invites enable row level security;
alter table rooms enable row level security;
alter table tasks enable row level security;
alter table task_rooms enable row level security;
alter table task_reminders enable row level security;
alter table task_reminder_mutes enable row level security;
alter table completions enable row level security;
alter table push_subscriptions enable row level security;
alter table reminder_log enable row level security;
alter table awards enable row level security;
alter table daily_rings enable row level security;
alter table home_removals enable row level security;
alter table schema_migrations enable row level security;

-- migrate:down

alter table schema_migrations disable row level security;
alter table home_removals disable row level security;
alter table daily_rings disable row level security;
alter table awards disable row level security;
alter table reminder_log disable row level security;
alter table push_subscriptions disable row level security;
alter table completions disable row level security;
alter table task_reminder_mutes disable row level security;
alter table task_reminders disable row level security;
alter table task_rooms disable row level security;
alter table tasks disable row level security;
alter table rooms disable row level security;
alter table invites disable row level security;
alter table home_members disable row level security;
alter table homes disable row level security;
alter table users disable row level security;
drop index awards_once;
alter table home_members drop column awards_seen_at;
