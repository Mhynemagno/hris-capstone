drop policy profiles_select_own on public.profiles;
drop policy profiles_select_hr_or_admin on public.profiles;

create policy profiles_select_authorized
  on public.profiles for select to authenticated
  using (
    (select auth.uid()) = id
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
    or (select private.current_user_has_role('system_administrator'::public.app_role))
  );

drop policy user_roles_select_own on public.user_roles;
drop policy user_roles_select_admin on public.user_roles;

create policy user_roles_select_authorized
  on public.user_roles for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.current_user_has_role('system_administrator'::public.app_role))
  );
