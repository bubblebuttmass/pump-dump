alter table users add column traits text[] not null default '{}'::text[];
