-- Clearing "Account can sign in" (profiles.is_active = false) was only recorded: nothing stopped the
-- person from signing in, and applicants in particular kept full use of their portal (the tester's
-- "deactivating an applicant did nothing"). The block is now enforced for every role:
--   * Supabase Auth refuses the sign-in and token refresh (the auth user is banned) and existing
--     sessions are revoked, so a disabled account is signed out within one access-token lifetime;
--   * role checks used by row-level security ignore disabled accounts;
--   * the app itself also refuses disabled accounts at sign-in and on every protected page.

create or replace function private.sync_auth_sign_in_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active is distinct from old.is_active then
    begin
      update auth.users
      set banned_until = case when new.is_active then null else now() + interval '100 years' end
      where id = new.id;
      if not new.is_active then
        delete from auth.sessions where user_id = new.id;
      end if;
    exception
      -- Never block the account change itself; the app and RLS checks still apply.
      when insufficient_privilege or undefined_table or undefined_column then null;
    end;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_auth_sign_in_block() from public, anon, authenticated;

create trigger profiles_sync_auth_sign_in_block
after update of is_active on public.profiles
for each row execute function private.sync_auth_sign_in_block();

-- Accounts that were already disabled.
do $$
begin
  update auth.users auth_user
  set banned_until = now() + interval '100 years'
  from public.profiles profile
  where profile.id = auth_user.id
    and not profile.is_active
    and (auth_user.banned_until is null or auth_user.banned_until < now());
  delete from auth.sessions auth_session
  using public.profiles profile
  where profile.id = auth_session.user_id and not profile.is_active;
exception
  when insufficient_privilege or undefined_table or undefined_column then null;
end;
$$;

-- A disabled account keeps its role row (so it can be re-enabled as the same role) but no longer
-- passes any role check.
create or replace function private.current_user_has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.user_roles user_role
      join public.profiles profile on profile.id = user_role.user_id
      where user_role.user_id = (select auth.uid())
        and user_role.role = required_role
        and profile.is_active
    );
$$;
