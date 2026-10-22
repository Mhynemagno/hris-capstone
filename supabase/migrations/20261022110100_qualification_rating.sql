-- An employee may hold any number of eligibilities, each with an optional rating in percent
-- (e.g. NAPOLCOM 85%). The rating is shown with the eligibility; it is not scored.

alter table public.qualifications
  add column rating numeric(5,2)
    constraint qualifications_rating_check check (rating is null or rating between 0 and 100);

comment on column public.qualifications.rating is 'Eligibility rating in percent (0-100), e.g. 85.00 for NAPOLCOM 85%.';
