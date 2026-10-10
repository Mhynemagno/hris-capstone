-- Client round 5 follow-up (2026-10-10): personnel gender is Female or Male only, but applicants may still
-- choose "prefer not to say". Hiring copies only a supported gender; otherwise the new personnel record
-- starts blank and HR sets it (the employee form unlocks an empty gender).
do $$
declare
  definition text := pg_get_functiondef('private.hire_application(uuid, text, text)'::regprocedure);
  old_expression constant text := 'applicant_row.date_of_birth, applicant_row.gender, applicant_row.civil_status';
  new_expression constant text := 'applicant_row.date_of_birth, case when applicant_row.gender in (''female'', ''male'') then applicant_row.gender end, applicant_row.civil_status';
begin
  if position(old_expression in definition) = 0 then
    raise exception 'Expected gender copy not found in private.hire_application';
  end if;
  execute replace(definition, old_expression, new_expression);
end;
$$;
