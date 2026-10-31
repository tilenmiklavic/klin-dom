-- migrate:up

-- Early completions can legitimately record the same due date twice (e.g. a daily
-- task done twice in one day); duplicate ticks are deduped in the API instead.
drop index completions_one_done_per_due;
create index completions_task_due_idx on completions (task_id, due_date);

-- Members removed by the owner can't come back through invites made before removal.
create table home_removals (
  home_id uuid not null references homes (id) on delete cascade,
  user_id uuid not null references users (id),
  removed_at timestamptz not null,
  primary key (home_id, user_id)
);

-- migrate:down

drop table home_removals;
drop index completions_task_due_idx;
create unique index completions_one_done_per_due on completions (task_id, due_date) where kind = 'done';
