# HRIS workflow guide

Applicants receive an immutable, server-generated Applicant Number displayed as `0-12345`. It is not an employee Badge Number. When HR hires an applicant, HR assigns the employee's Badge Number.

Applicants may optionally upload a private profile photo. If they do not, the system displays the standard silhouette avatar. Eligibility and diploma records are private and must be uploaded before submitting an application.

HR can return an application as **Needs Revision** with an optional note. Only that status lets the applicant replace application documents and resubmit. Existing applications cannot be submitted again for the same opening.

HR can delete an unused draft opening or withdraw an active opening without removing its application history. Unit/Station is selected from the active catalogue when creating or editing a personnel record. Deployments use the operational states **active** and **rejected**; HR selects an employee by Badge Number and chooses a Unit Assignment.

## Deactivate, archive, or delete

Every screen that manages records offers the non-destructive action first. **Delete** is only available where permanent removal cannot erase business history, and the database decides whether it is allowed.

| Record | Permanent delete | Otherwise |
| --- | --- | --- |
| Departments, positions (Admin) | Only when no position, personnel record, service history, job opening, or promotion criteria refer to it. The last active Patrolman/Patrolwoman position is always protected because hiring depends on it. | **Deactivate** hides it from new records and keeps history. |
| Leave types (HR) | Only when no leave request has used it. | **Deactivate** stops new requests. |
| Promotion criteria (HR) | Only before any evaluation used them; their required credentials are removed with them. | **Deactivate** (works even after evaluations exist). |
| Draft job openings (HR) | Drafts with no applications. | **Withdraw** closes an opening and keeps its applications. |
| Accounts (Admin) | Only when the person has created or decided nothing, has no linked personnel record and no applications, is not you, and is not the last active administrator. | **Deactivate** blocks sign-in and keeps everything they created. |
| Qualifications, certifications, training (HR) | Allowed for data-entry corrections unless used as promotion evidence. A copy stays in the record history. | Keep the entry. |
| Notifications (recipient) | Recipients can delete their own. | Mark as read. |
| Employees, service history, applications, deployments, leave and profile-change requests, attendance data, audit logs | Never. | Use the record's status: employment status, withdraw/cancel, reject, or deactivate. |

Before anything is deleted, the confirmation dialog shows what depends on the record, with counts, and what will be removed with it. A blocked deletion explains why and offers the deactivate/withdraw path instead. Every deletion is written to the audit log with the acting user.
