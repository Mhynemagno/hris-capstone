alter table public.promotion_criteria
  add constraint promotion_criteria_minimum_years_of_service_1_to_3
  check (minimum_years_of_service between 1 and 3) not valid;
