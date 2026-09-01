alter table public.profiles add column if not exists default_commission_rate numeric not null default 0;
alter table public.projects
  add column if not exists commissionable_amount numeric,
  add column if not exists commission_rate_override numeric,
  add column if not exists commission_status text not null default 'Pending',
  add column if not exists commissionable_source text not null default 'manual';