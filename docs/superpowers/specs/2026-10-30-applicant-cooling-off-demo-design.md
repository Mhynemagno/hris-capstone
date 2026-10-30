# Applicant cooling-off and presentation simulation

## Intent

An applicant whose recruitment result is **Not Selected** must be unable to sign in for six months from the failed-result date.  At the end of that period, the account becomes eligible to sign in automatically; HR must not manually reactivate it.  A System Administrator presenting the production deployment needs to demonstrate both sides of this rule without changing the real server clock or affecting real applicants.

## Goals

- Keep the applicant's account and application history after rejection.
- Immediately block the rejected applicant and end any active session.
- Restore sign-in automatically once the six-month cooling-off period ends.
- Let a System Administrator run the complete scenario against one designated demo applicant in production.
- Make all simulation actions conspicuous, reversible, and auditable.

## Non-goals

- Do not change the production clock, job deadlines, reports, or dates for other accounts.
- Do not give HR or applicants a way to bypass a real applicant's cooling-off period.
- Do not automatically create a new application or change the historical rejection result when access resumes.

## Approaches considered

1. **Production-wide simulated date.** Easy to demonstrate, but unsafe: it could distort every other date-based rule and user.
2. **Manual HR reactivation after six months.** This is the current behaviour, but it conflicts with the required automatic re-login rule.
3. **Per-demo-applicant simulator (chosen).** The real rule is based on an account-level cooling-off end date.  A System Administrator may simulate a later effective date for one explicitly designated demo applicant, allowing the normal login path to demonstrate the automatic outcome without changing any other account.

## Design

### Normal applicant rule

- When HR records a failed result that moves an application to `Not Selected`, the database records a `cooling_off_ends_at` value six months later for that applicant.
- The account's normal active status remains separate from this temporary cooling-off rule; `is_active = false` remains available for genuine administrator deactivation.
- The rejection immediately invalidates active sessions and blocks password login until `cooling_off_ends_at`.
- On and after `cooling_off_ends_at`, the sign-in path permits the applicant automatically. No admin action is necessary.
- The applicant's history continues to show the original decision. Being allowed to sign in does not reopen or change that application.

### Production presentation simulator

- System Administration identifies a deliberately created **Demo Applicant**. Real applicants cannot be marked as demo accounts through the ordinary HR workflow.
- Its account page has a `6-month login simulation` card, visible only to System Administrators. The card offers: **Start six-month-passed simulation**, **Reset to real date**, and a read-only summary of the actual rejection date, normal eligibility date, and current simulated state.
- Starting the simulation only makes that demo applicant behave as if the cooling-off end date has passed. It never changes the server time or any other account.
- A high-visibility banner appears while the simulator is active. Each start and reset is written to the audit log with the administrator, target account, timestamp, and prior/new state.
- Reset returns the demo account to the actual current rule. The simulator also expires automatically after a short fixed period, so an abandoned presentation state cannot persist.

### Login and access protection

- The server-side login and authenticated application access checks use the same cooling-off decision, so a cached or direct session cannot bypass the rule.
- The demo simulation is accepted only for the designated demo account and only while its audited, unexpired simulation state is active.
- The existing generic disabled-account message remains neutral and does not reveal recruitment information to an unauthenticated visitor.

## Acceptance checks

1. A newly rejected ordinary applicant is signed out and cannot log in before six months.
2. The same ordinary applicant can log in on/after the recorded end date without HR reactivation.
3. A System Administrator starts the simulator for the designated demo applicant in production, sees its banner, and can log in as that applicant.
4. No System Administrator control can move global time or simulate a real applicant.
5. Reset and automatic expiry restore the real block; audit records exist for each simulation action.
