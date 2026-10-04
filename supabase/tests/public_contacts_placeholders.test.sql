begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(4);

select extensions.is(
  (select array_agg(label order by sort_order) from public.public_contacts),
  array['Station hotline', 'HR office email', 'Station address', 'Office hours'],
  'Placeholder contacts are seeded in display order'
);
select extensions.ok((select bool_and(is_visible) from public.public_contacts), 'Placeholder contacts are visible on the landing page');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000d301', 'authenticated', 'authenticated', 'placeholder-hr@example.test', now(), now());
update public.user_roles set role = 'hr_personnel'::public.app_role where user_id = '00000000-0000-4000-8000-00000000d301';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000d301';

-- Re-saving each placeholder unchanged must pass the format checks.
select extensions.lives_ok(
  $$select public.save_public_contact(contact.id, contact.kind, contact.label, contact.value, false) from public.public_contacts contact$$,
  'HR can re-save every placeholder without retyping it'
);
select extensions.is((select count(*) from public.public_contacts where is_visible), 0::bigint, 'HR can hide the placeholders');

select * from extensions.finish();
rollback;
