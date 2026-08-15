# Edge Function Deployment Reliability Design

## Goal

Restore the live invitation endpoint immediately and prevent future drift between the merged invite-internal-user source and its Supabase deployment.

## Evidence and root cause

The current main branch contains an OPTIONS handler and SDK CORS headers. A direct production OPTIONS request to the invite-internal-user URL returns HTTP 405 with no CORS headers, matching the browser report. The remote Supabase function is therefore an older deployment; the application source is not the failing layer.

## Delivery model

First, deploy the invite-internal-user Edge Function from the source on current main to project wcjpyzulbiexvwtmyudq. Verify the exact production OPTIONS request returns success, Access-Control-Allow-Origin, and the required allowed headers.

Second, add one GitHub Actions workflow. It runs when files below supabase/functions/invite-internal-user change on main and supports manual workflow dispatch. It installs the Supabase CLI, validates the presence of SUPABASE_ACCESS_TOKEN, and deploys only invite-internal-user to the fixed project reference.

The GitHub repository owner must add SUPABASE_ACCESS_TOKEN as an Actions secret before the first workflow run. The token is never stored in repository files, logs, client code, or the pull request body.

## Scope and safety

No database migration, RLS change, or application behavior change is required. The workflow has read-only repository permissions and the single deployment action is limited to the named Edge Function. A production CORS preflight check proves the current outage is fixed without creating an account or sending an invitation email.

## Verification

- Validate the workflow YAML and ensure its path filter only matches invite-internal-user source changes.
- Deploy the function from the branch, then make a production OPTIONS request with Origin and Access-Control-Request headers.
- Confirm HTTP 200 and CORS headers are present.
- Run the existing test suite, lint, type-check, build, and whitespace checks before the pull request.
