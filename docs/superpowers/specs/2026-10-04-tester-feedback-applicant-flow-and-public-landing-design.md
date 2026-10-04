# Tester feedback: attendance messages, applicant flow, and public landing page

**Branches** (fixes first, feature second):
1. `fix/tester-feedback-oct`: Parts A–C (attendance messages, document rules, applicant flow).
2. `feat/public-landing-announcements`: Part D (landing page redesign, HR-managed announcements and contacts). Branched from `main` after branch 1 merges.

**Goal:** Remove the friction the testers hit when applying, make required documents obviously required and saved, give face-attendance errors their real cause, and turn the landing page into a public portal for ordinary visitors as well as applicants.

## Findings (audit before this change)

- **Duplicate face.** `private.enroll_employee_face` already rejects a face within `match_threshold` (0.5) of another employee's enrollment and raises *"This face is too similar to another registered employee."* The UI shows it verbatim. Testers probably saw one of two other messages:
  - *"The captured samples did not match each other…"*, when two people were in view or the subject moved.
  - The kiosk's *"Face not recognized."*, which `private.record_face_attendance` also returns when the best two matches are within `ambiguity_margin` (0.04) of each other.
- **Threshold gap.** Enrollment ignores `ambiguity_margin`. Two lookalikes stored 0.5–0.54 apart can both enroll. The kiosk can then never tell them apart and always shows "Face not recognized."
- **Documents.** The five required profile documents (`resume`, `psa`, `photo`, `eligibility`, `diploma`) upload the moment a file is picked, with no Save button. Every type except `photo` accepts PDF/PNG/JPEG.
- **Submitting without documents.** The server already rejects an application when any of the five is missing (`private.submit_application`). The client never pre-checks, so the applicant finds out only after clicking Submit.
- **Flow.**
  - The application form exists only at `/applicant/applications?jobId=X` and is reachable only through a job's "Apply now".
  - The required documents live on a separate page, so the applicant has to leave and come back.
  - The form asks for a second CV even though the profile already holds one.
  - The applicant sidebar has no job openings entry.
- **HR view.** HR's application detail lists only the application's attached files. It does not show the five profile documents, although RLS (`applicant_profile_documents_select_own_or_hr`) already allows HR to read them.
- **Landing page.** No news, announcements, or contact information exists anywhere in the system.

## Part A — Attendance messages (branch 1)

New migration `…_face_enrollment_ambiguity_and_messages.sql`. It redefines the functions below; there are no table changes.

- **`private.enroll_employee_face`**
  - Block when the distance is `<= match_threshold + ambiguity_margin` (0.54 by default), not `<= match_threshold`, so enrollment refuses pairs the kiosk could not separate.
  - New message: *"This face is already registered to another employee. Each employee can register only their own face."* SQLSTATE `23505` is unchanged.
- **`private.record_face_attendance`** (kiosk)
  - When a scan is rejected **only** because the top two matches are within `ambiguity_margin`, the outcome becomes `ambiguous`, not `not_recognized`.
  - The stored message is *"More than one employee matches this face. Please see HR."*
  - Add `ambiguous` to the outcome check constraint on `private.face_attendance_scans`.
  - Extend the "no employee" check there to `(outcome in ('not_recognized', 'ambiguous')) = (employee_id is null)`.
  - Let `private.reject_face_scan` take the outcome; it currently always stores "Face not recognized.".
  - Attendance is still never written. No distance or employee identity is returned.
- **Client**
  - `src/lib/face-recognition/scanner-machine.ts` maps the `ambiguous` outcome to `{ kind: "ambiguous", message }`.
  - `face-attendance-kiosk.tsx` gives it the title "Multiple possible matches".
- **Unchanged**
  - Self-scan (1:1) has no ambiguity.
  - Existing enrollments are not re-checked. If two current enrollments now violate the new rule, HR re-registers one of them; the rule applies to new registrations only.

**Tests**
- pgTAP:
  - A lookalike at a distance between 0.5 and 0.54 is now rejected at enrollment with the new message.
  - A kiosk probe equidistant to two enrollments seeded directly produces outcome `ambiguous` and no attendance row.
- Vitest: scanner-machine mapping and kiosk title.

## Part B — Required documents (branch 1)

### Format rules
| Kind | Allowed |
| --- | --- |
| `photo` (2x2 picture) | PNG, JPEG (unchanged) |
| `resume`, `psa`, `eligibility`, `diploma` | **PDF only** |

Enforced in three places:
1. `applicantProfileDocumentFileSchema` becomes PDF-only. The `accept` attribute becomes `application/pdf,.pdf` for these four kinds.
2. `private.save_my_applicant_profile_document` rejects a non-PDF for these kinds with *"Upload the {label} as a PDF file."*
3. A table check constraint `applicant_profile_documents_non_photo_is_pdf`, added `NOT VALID` so rows already uploaded as PNG/JPEG stay valid. They remain usable until the applicant replaces them.

`src/queries/recruitment.ts` (`saveApplicantProfileDocuments`) currently re-parses every file with the generic schema. It must use the kind-specific schema, or a photo would fail the new PDF-only check.

### Explicit Save per document
Applies to `ApplicantProfileDocuments` and to its reuse in the apply page (Part C).
- Picking a file no longer uploads it. The card shows the chosen file name and size, a **Save** button, and **Cancel**.
- Format and size are validated on pick, and the error appears under that card.
- **Save** uploads the file through the existing `save_my_applicant_profile_document` path. The button shows "Saving…" and is disabled while the upload runs. The card then shows **Saved ✓** with the date and View / Replace / Remove.
- A summary line above the list reads **"3 of 5 required documents saved"**, and each missing item is named.
- If the applicant leaves the page with an unsaved pick, `beforeunload` warns them.

### Submit cannot proceed while a required document is missing
- The apply page's **Submit application** button is disabled until all five are saved.
- Next to the disabled button: *"Save all 5 required documents to submit."*
- The server gate in `private.submit_application` stays as the authority.

## Part C — One-page application flow (branch 1)

### Route
New page **`/applicant/apply/[jobId]`**. It replaces the `?jobId=` form on the status page.
- `/applicant/applications?jobId=X` redirects to `/applicant/apply/X`, so existing links and the login `next` paths keep working.
- `PublicJobDetail`'s `applyPath` becomes `/applicant/apply/{id}`.
- Login, register, `auth/continue`, and `getRecruitmentNextPath` already allow `/applicant/*`.

### Page layout, top to bottom
1. **Job summary**: title, location, deadline, and a link back to the job's details.
2. **Required documents**: the Part B component, embedded. Documents already saved for an earlier application show as Saved and are reused.
3. **Additional credentials (optional)**: multiple PDF/PNG/JPEG files. Unchanged.
4. **Cover note (optional)**.
5. **Submit application**: disabled until all five documents are saved. On success the page shows the confirmation and a "Track application" link to `/applicant/applications/{id}`.

If the applicant already applied to this job, the page shows the existing "Application already submitted" card. If the job is closed or unpublished, it shows the existing error state.

### No second CV upload
- The form's CV field is removed.
- On submit, the client downloads the saved profile `resume` from the `applicant-profile-documents` bucket. The applicant already has read access there. The existing `submitApplication` path re-uploads it into `applicant-documents` as the `cv` document. No storage policy change is needed.
- The application therefore keeps its own snapshot of the CV. The AI scoring function (`process-application-analysis`) and `submit_application`'s "a CV is present" rule stay unchanged.
- If the copy fails, the submit fails with *"We could not attach your saved CV. Try again."*, and copied files are cleaned up as today.

### Navigation
- The applicant sidebar becomes: Dashboard, **Job Openings** (`/jobs`, icon `BriefcaseBusiness`), Profile, Documents, Application Status.
- Applicant dashboard: if there is no application yet, the primary card's action is **"Browse job openings"**. Otherwise it is "View application status".
- After registering without a `next` path, the applicant goes to `/jobs`, not `/applicant`.
- The status page (`/applicant/applications`) only lists and tracks applications. When the list is empty, it keeps its "Browse job openings" action.

### HR sees the required documents
`HrApplicationDetail` gains a **Required documents** section. It lists the applicant's five profile documents with label, file name, date, and an Open action that uses the signed URL from `getApplicantProfileDocumentUrl`. HR already has read access through RLS and the storage policy, and the plan confirms the storage policy covers HR. A missing document shows "Not uploaded", which can only happen for legacy applications.

**Tests (branch 1)**
- Vitest:
  - The documents component: pick, then Save, then Saved, plus validation errors.
  - The apply page: Submit disabled until 5 are saved; the CV copy is called; success state.
  - The redirect from `?jobId`.
  - The sidebar items and dashboard action.
  - HR detail lists the required documents.
- pgTAP: a non-PDF resume is rejected; a legacy PNG row still exists.
- Update the Playwright applicant e2e test to the new route and the Save flow.

## Part D — Public landing page with announcements and contacts (branch 2)

### Visual direction
Port the look of the supplied mock `pnp_hr_portal.html` into `PublicCareersLanding` using the app's Tailwind tokens:
- Dark navy background with a subtle grid, gold accents, Montserrat headings, Inter body, and glass cards.
- Use the real `san-juan-police-logo.png` and `bagong-pilipinas-logo.png`, not the mock's icon logo.
- Lucide icons (already a dependency), not Font Awesome.
- Text is at least 14px (the mock uses 10–12px), with ≥4.5:1 contrast and ≥44px touch targets.
- Respect `prefers-reduced-motion` for the card hover lift.

### Sections, in order
1. **Top bar**: "Republic of the Philippines • Philippine National Police" and a live PST clock.
2. **Header**: logos, "San Juan City Police Station HRIS", anchor nav (Portals, Announcements, About, Why Join, FAQs, Contact), and the existing Login dropdown / Application Status button from `PublicSiteHeader`.
3. **Hero**: badge, headline, and one-sentence description.
4. **Two portal cards**:
   - **Personnel Portal**: real features (records, leave, attendance, deployments, promotion) and "Sign in as personnel", linking to `/login?as=employee`.
   - **Applicant & Career Portal**: "View job openings" to `/jobs`, and "Check application status" to `/login?as=applicant&next=/applicant/applications`.
5. **Latest job openings**: the existing `<PublicJobList featured pageSize={3}/>` and "View all openings".
6. **Announcements (new)**: the latest 6 published announcements as cards (date, category, title, summary), with "Read more" opening `/announcements/[id]`. The empty state reads "No announcements right now."
7. **About**: the existing Vision / Mission / Motto content, styled like the mock's "Core Values" panel.
8. **Why join**: three benefit cards with generic, non-numeric text. The mock's salary figures are not used.
9. **FAQs**: accordion built with native `<details>`/`<summary>`. Starter questions: who can apply, which documents are needed (the five, with formats), and how to check status.
10. **Contact (new)**: the HR-managed contact entries (see below).
11. **Footer**: logos, logins, privacy line.

**Not included:**
- The mock's "Police Recruitment Process" four-step section.
- Its simulated 2FA login, reference-code status checker, and in-page apply modal. Real pages replace these.
- Its invented statistics, pay figures, hotline, email, and "ORPAS" naming.

### Data model (migration `…_public_announcements_and_contacts.sql`)

| Object | Columns / rules |
| --- | --- |
| `public.announcements` | `id uuid pk`, `title text` (1–150), `summary text` (1–300), `body text` (1–10,000), `category text` check in (`news`, `advisory`, `event`, `recruitment`), `status text` check in (`draft`, `published`, `archived`) default `draft`, `published_at timestamptz` (set when first published), `created_by`/`updated_by uuid` references `profiles` `on delete set null`, `created_at`/`updated_at`. |
| `public.public_contacts` | `id uuid pk`, `label text` (e.g. "HR Office", "Station hotline"), `kind text` check in (`phone`, `email`, `address`, `hours`, `facebook`), `value text` (1–300), `sort_order int`, `is_visible boolean` default true, plus timestamps. |

RLS is on for both tables:
- `anon` and `authenticated` can **select** published announcements and visible contacts.
- Active HR can select everything. HR is checked through the existing HR-role helper used in RLS policies.
- Writes go only through `security definer` RPCs gated by `private.require_active_hr()`:
  - `save_announcement`, `set_announcement_status`, `delete_announcement`
  - `save_public_contact`, `delete_public_contact`, `reorder_public_contacts`
- Each write adds an `audit_logs` row, following the existing audit pattern.
- **Placeholder contacts are seeded (changed 2026-10-04 at the user's request):** Station hotline `(02) 0000-0000`, HR office email `hr-office@example.com`, Station address `Address to follow, San Juan City, Metro Manila`, Office hours `Monday to Friday, 8:00 AM to 5:00 PM (to be confirmed)`. HR replaces them from `/hr/public-site`. The landing page still hides the Contact section whenever no contact is visible.

### HR management page
- **`/hr/public-site`**, added to the HR sidebar as "Public Announcements" (icon `ScrollText`, group "Public Portal").
- Two tabs:
  - **Announcements**: a list with status badges, plus Create/Edit with title, category, summary, and body. Body is plain text with paragraphs, rendered with line breaks and no HTML. Actions: Publish, Archive, Delete (drafts only).
  - **Contacts**: an editable list with kind, label, value, visibility toggle, and up/down reordering.
- Uses existing UI primitives (`PageHeader`, `FormField`, `Input`, `Button`, `ErrorState`), React Query hooks, and zod schemas in `src/schemas/public-site.ts`.

### Public announcement page
- `/announcements/[id]` is a server component with the public header. It shows title, category, date, and body, and returns `notFound()` when the announcement isn't published.
- `generateMetadata` uses the title and summary.
- Before writing route code, check `node_modules/next/dist/docs/` for the current dynamic route, `params` Promise, and `notFound` APIs.

**Tests (branch 2)**
- pgTAP:
  - `anon` sees only published announcements and visible contacts.
  - Non-HR roles cannot call the write RPCs.
  - Audit rows are written.
- Vitest:
  - Landing sections render.
  - The Contact section is hidden when there are no contacts.
  - The Recruitment Process section is absent.
  - The HR forms validate and call the RPCs.
- Playwright: HR publishes an announcement, and an anonymous visitor sees it on `/`.

## Out of scope
- Rich-text or image attachments on announcements.
- Email or SMS notification of announcements.
- Re-validating existing face enrollments against the new margin.
- Converting legacy PNG/JPEG profile documents to PDF.
