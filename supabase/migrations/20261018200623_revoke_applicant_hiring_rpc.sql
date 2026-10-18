-- Recruitment ends at Shortlisted. Employee provisioning is handled by Training,
-- so the obsolete hiring RPC must not remain callable through the database API.
drop function public.hire_application(uuid, text, text);
drop function private.hire_application(uuid, text, text);
