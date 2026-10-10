-- Client round 5 (2026-10-10): personnel gender is Female or Male only. Records that said
-- "prefer not to say" are cleared so HR can set them (the form unlocks an empty gender).
update public.employees set gender = null where gender = 'prefer_not_to_say';

alter table public.employees
  drop constraint employees_gender_check,
  add constraint employees_gender_check check (gender is null or gender in ('female', 'male'));
