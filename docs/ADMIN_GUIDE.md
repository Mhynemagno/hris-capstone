# Administrator guide

- Invite internal accounts from **Admin → Users**. Set Employee, HR Personnel, Management, or Administrator role through the audited administrator workflow; do not expose Supabase secret keys in the browser.
- Activate/deactivate accounts and change roles only through the audited workflow. Keep at least one active System Administrator.
- Review employee profile-change requests; approval changes the official record and creates audit/notification entries, while rejection leaves official data unchanged.
- Maintain departments, positions, organization settings, and audit-log review from the protected Admin area.
- Before a demonstration or handover, follow [release verification matrix](release-verification-matrix.md), [deployment runbook](DEPLOYMENT_RUNBOOK.md), and [environment checklist](ENVIRONMENT_CHECKLIST.md). Do not mark an unavailable vendor or Vercel check as passed.

## Deleting versus deactivating

Use **Deactivate** for day-to-day clean-up: it hides a department, position, or account from new work while keeping every historic record that refers to it. **Delete** permanently removes a record and is only allowed when nothing depends on it; the confirmation dialog lists any dependent records with counts and offers **Deactivate instead** when deletion is blocked. You cannot delete your own account or the last active administrator. See the full policy in [HRIS workflow guide](HRIS_WORKFLOWS.md#deactivate-archive-or-delete).

