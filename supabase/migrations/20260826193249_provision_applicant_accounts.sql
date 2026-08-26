create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'applicant'::public.app_role)
  on conflict (user_id) do nothing;

  if nullif(btrim(new.raw_user_meta_data ->> 'first_name'), '') is not null
     and nullif(btrim(new.raw_user_meta_data ->> 'last_name'), '') is not null then
    insert into public.applicants (profile_id, first_name, last_name)
    values (
      new.id,
      btrim(new.raw_user_meta_data ->> 'first_name'),
      btrim(new.raw_user_meta_data ->> 'last_name')
    )
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;
