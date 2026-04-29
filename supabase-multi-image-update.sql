alter table public.trade_entries
add column if not exists image_paths text[] not null default '{}';

alter table public.trade_entries
alter column image_path drop not null;

update public.trade_entries
set image_paths = array[image_path]
where image_path is not null
  and image_paths = '{}';
