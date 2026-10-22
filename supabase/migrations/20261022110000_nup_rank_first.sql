-- NUP (Non-Uniformed Personnel) is the most junior rank and is listed first, above PAT.
-- Every rank list orders by ranks.sort_order, so NUP takes order 0. The order check is
-- relaxed to allow 0; uniformed ranks keep 1 and above.

alter table public.ranks drop constraint ranks_sort_order_check;
alter table public.ranks
  add constraint ranks_sort_order_check check (sort_order between 0 and 10000);

do $$
begin
  if exists (select 1 from public.ranks where code = 'NUP') then
    update public.ranks
    set sort_order = 0,
        is_active = true,
        -- Keep a custom name only when the standard one is already taken by another rank.
        name = case
          when exists (select 1 from public.ranks other where other.name = 'Non-Uniformed Personnel' and other.code <> 'NUP')
            then name
          else 'Non-Uniformed Personnel'
        end
    where code = 'NUP';
  elsif exists (select 1 from public.ranks where name = 'Non-Uniformed Personnel') then
    update public.ranks
    set code = 'NUP', sort_order = 0, is_active = true
    where name = 'Non-Uniformed Personnel';
  else
    insert into public.ranks (name, code, sort_order, is_active)
    values ('Non-Uniformed Personnel', 'NUP', 0, true);
  end if;
end;
$$;
