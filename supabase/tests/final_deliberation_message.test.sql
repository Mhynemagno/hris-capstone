begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(1);

select extensions.is(
  private.application_status_message('Final Evaluation'),
  'Your application is under final deliberation.',
  'Applicants are told their application is under final deliberation'
);

select * from extensions.finish();

rollback;
