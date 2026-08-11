# HRIS Capstone — Project Scope

## 1. Project Overview

This project is a web-based Human Resource Information System (HRIS) for centralized personnel management. It supports recruitment, employee records, deployment, promotion eligibility, leave requests, biometric attendance, analytics, and automated reports.

The system is a capstone project with one shared Supabase environment and a Vercel deployment. It must use role-based access so each user can only access the pages and data appropriate to their role.

## 2. Core Objective

Provide HR staff and management with a secure, centralized system to manage personnel information and make better decisions using organized records, reports, and AI-assisted applicant shortlisting. AI provides recommendations only; a human HR user makes every final hiring decision.

## 3. User Roles and Access

| Role | Primary access and responsibilities |
| --- | --- |
| **System Administrator** | Manages user accounts, roles, permissions, system settings, job positions, and audit logs. Reviews and approves or rejects employee profile-change requests. |
| **HR Personnel** | Manages recruitment, applicant records, personnel records, service history, qualifications, deployments, promotion data, leave requests, attendance records, notifications, and operational reports. |
| **Applicant** | Registers, views job openings, submits an application and documents, and tracks application status. |
| **Employee / Personnel** | Views their official profile, service history, qualifications, attendance, leave history, and notifications. Submits leave applications and profile-change requests. |
| **Management** | Read-only access to dashboards, analytics, and management reports. Cannot alter operational HR records. |

## 4. Functional Scope

### 4.1 Authentication and Role-Based Access

- Secure login and logout using Supabase Auth.
- Role-based page and data access for the five roles above.
- Protected routes so users cannot access pages outside their role.
- Audit log for critical actions, such as profile approvals, hiring decisions, deployment changes, and role changes.

### 4.2 Centralized Personnel Records

- Create and maintain employee profiles.
- Store employment details, department, position, contact information, service history, qualifications, certifications, and training records.
- Search, filter, and view employee records for authorized HR users.
- Maintain a history of relevant record updates.

### 4.3 Employee Profile-Change Request and Approval Workflow

Employees **cannot directly edit their official personnel profile**.

1. The employee opens **My Profile** and selects **Request Profile Change**.
2. They submit proposed changes (for example: contact details, address, emergency contact, or qualification information) and may attach supporting documents when required.
3. The system stores the request with status **Pending**; the official profile remains unchanged.
4. A System Administrator reviews the current value, requested value, reason, and attachments.
5. The administrator either:
   - **Approves** the request: the official employee profile is updated and the action is recorded in the audit log; or
   - **Rejects** the request: the official profile is not changed and the administrator may provide a reason.
6. The employee receives a notification of the decision.

Profile-change request statuses: `Pending`, `Approved`, `Rejected`, and optionally `Cancelled` by the employee before review.

### 4.4 Recruitment Management

- HR creates and publishes job openings with job-specific qualification criteria.
- Applicants register, complete their profile, upload a résumé/CV and supporting credentials, and submit applications.
- HR views applicants, documents, qualifications, application progress, and hiring decisions.
- Application statuses include: `Submitted`, `Under Review`, `Shortlisted`, `Interview`, `Hired`, and `Not Selected`.
- When an applicant is hired, HR creates or activates the corresponding employee personnel record.

### 4.5 AI-Assisted Applicant Shortlisting

- HR defines required and preferred criteria per job opening (for example: education, experience, skills, certifications, and keywords).
- The system analyzes submitted résumé/CV content against those criteria and produces a match score, explanation, and ranked shortlist.
- HR can review the AI results and documents before changing an application status.
- AI must never automatically reject or hire an applicant. The final decision is always made and recorded by HR.
- For capstone demonstrations, use dummy, consented, or anonymized applicant data only.

### 4.6 Deployment Tracking

- Assign personnel to deployment locations, units, projects, or assignments.
- Record deployment start date, end date, status, role, and relevant notes.
- Update assignments and retain deployment history.
- Generate deployment logs and summaries for HR and management.

### 4.7 Promotion Eligibility Tracking

- Organize eligibility data such as years of service, performance ratings, qualifications, certifications, and training credentials.
- Configure or record promotion criteria for a target position or rank.
- Show eligibility status, missing requirements, and supporting records.
- Provide recommendations for HR review; the system does not automatically grant a promotion.

### 4.8 Employee Self-Service Portal

- View official personal record, qualifications, service history, attendance history, leave history, and HR notifications.
- Submit leave applications.
- Submit profile-change requests subject to administrator approval.
- Receive notifications for leave decisions, profile-change decisions, HR announcements, and relevant updates.

### 4.9 Leave Management

- Employees submit leave requests with leave type, date range, reason, and supporting attachment when required.
- Authorized HR users review, approve, or reject leave requests.
- The employee receives the decision and reason where provided.
- Maintain leave request history and summaries.

### 4.10 Biometric Attendance Monitoring

- Integrate a cloud-enabled biometric device through the vendor's documented cloud API, webhook, export, or supported synchronization method.
- Synchronize login/logout time logs into the HRIS.
- Show attendance status, time-in, time-out, late arrivals, absences, and attendance history.
- Generate attendance reports.
- The HRIS stores attendance logs only; it must not store raw biometric templates or fingerprint data.

### 4.11 Analytics Dashboard and Reports

- Role-appropriate dashboard summaries for HR and Management.
- Visualize recruitment pipeline, applicant shortlisting status, deployment status, attendance, leave activity, workforce summaries, and promotion eligibility.
- Provide prescriptive insights for promotion readiness and training needs based on recorded criteria.
- Generate downloadable or viewable reports including:
  - Applicant tracking and hiring-decision reports
  - Employee/performance summaries
  - Deployment logs
  - Attendance and leave reports
  - Promotion eligibility and training-needs reports

## 5. Technical Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui | Role-based web pages, forms, dashboards, tables, and reports. |
| Hosting / deployment | Vercel | Automatic deployment from the GitHub `main` branch. |
| Database | Supabase PostgreSQL | HRIS relational data and reporting queries. |
| Authentication | Supabase Auth | User login, sessions, and identity. |
| Authorization | Supabase Row Level Security (RLS) | Enforces which records each role can read or modify. |
| File storage | Supabase Storage | Résumés, credentials, leave attachments, and profile-change evidence. |
| Backend operations | Supabase Data API and Edge Functions | CRUD through the generated API; secure multi-step workflows and integrations through Edge Functions. |
| AI integration | An external AI model/API via Supabase Edge Function | Resume parsing, criteria matching, applicant ranking, and recommendation explanations. |
| Attendance integration | Biometric vendor cloud API | Syncs attendance logs into Supabase. |

## 6. Backend Design Decision

No separate self-hosted Express, Node, or Python backend is required for this capstone.

- Use Supabase's generated Data API for normal, RLS-protected CRUD operations.
- Use Supabase Edge Functions for operations that are multi-step, use secrets, need privileged validation, or call third-party services. Examples: inviting/creating an account plus profile records, AI shortlisting, biometric syncing, approval workflows, sending notifications, and generating reports.
- Never expose the Supabase `service_role` key, AI API keys, or biometric vendor secrets in the browser.

## 7. Initial Data Areas

The initial database design should include, at minimum:

- User profiles and roles
- Departments and positions
- Job openings, applicants, applications, applicant documents, and AI scores
- Employees, qualifications, service history, certifications, and training records
- Employee profile-change requests and their approval history
- Deployments
- Performance ratings and promotion evaluations
- Leave requests
- Attendance logs
- Notifications
- Audit logs

## 8. Key Rules and Constraints

- All official personnel data is protected by role-based access and Row Level Security.
- Employees may view their own official profile but do not update it directly.
- Official employee profile fields change only after a System Administrator approves a submitted profile-change request.
- HR makes final hiring decisions; AI only assists with shortlisting and ranking.
- Management is read-only.
- The selected biometric device must have a supported cloud/API integration before purchase. Confirm its documentation and export/webhook/API capability first.
- Development and demonstration data must not contain real sensitive personnel or biometric data unless the institution/client provides explicit approval and adequate safeguards.

## 9. Recommended Implementation Order

1. Configure Supabase, environment variables, Vercel deployment, and CI checks.
2. Create the database schema, RLS policies, roles, and authentication.
3. Build the shared application layout, navigation, and role-based route protection.
4. Build personnel records and the employee profile-change approval workflow.
5. Build recruitment and applicant management.
6. Add AI-assisted shortlisting.
7. Build leave, notifications, deployment, promotion eligibility, and attendance modules.
8. Build dashboards, analytics, automated reports, testing, and final documentation.

## 10. Definition of Completion

The capstone is ready for turnover when all approved role journeys work end-to-end, critical data is protected by RLS, the profile-change approval workflow is functional, recruitment shortlisting is reviewed by HR, attendance data can be demonstrated from the selected supported source, dashboards/reports show real system data, and the deployed Vercel application builds successfully from GitHub.
