# HRIS Update: Leave Rules and the Full Applicant Cycle

Changes made after the client consultation | October 6, 2026

## Summary

Based on the consultation with the client and the adviser, we made three groups of changes:

- **"For Approval" instead of "Pending".** A leave request that is waiting for HR now reads **For Approval** everywhere.
- **Leave rules.** Vacation Leave is removed. Each leave type now has a yearly limit, and the system stops an employee from going over it. Paternity Leave can go past its limit, but the extra days are deducted from retirement benefits.
- **The complete applicant cycle.** The application no longer ends at the interview. It continues to Camp Crame (BMI and neuro-psychiatric exam) and training, with the applicant uploading proof of passing the BMI and HR recording progress remarks.

Email notifications, the client's other request, will follow in a separate update. They need an email sending service to be set up first.

## 1. Leave status: "For Approval"

A leave request that HR has not decided yet used to show **Pending**. It now shows **For Approval** on:

- the employee's leave history
- HR's leave request queue and its status filter
- the dashboard ("3 leave requests for approval") and its leave charts
- the attendance and leave report

Approved, Rejected and Cancelled are unchanged.

## 2. Leave rules

### Leave types and their yearly limits

| Leave type | Days per year | When the days run out |
| --- | --- | --- |
| Sick Leave | 20 | The employee cannot apply for more that year. |
| Mandatory Leave | 2 | The employee cannot apply for more that year. |
| Maternity Leave | 105 (RA 11210) | The employee cannot apply for more that year. |
| Paternity Leave | 7 | Extra days are allowed, but they are deducted from the employee's retirement benefits. |

**Vacation Leave is removed.** It no longer appears in the leave type list. Requests that were already filed under Vacation Leave are kept in the history.

### How the limit works

1. When the employee picks a leave type, the form shows how many days are left, for example *"1 day of 2 left for 2026."*
2. Days are counted as calendar days, from the start date to the end date. A request counts toward the year it starts in.
3. Requests that are For Approval or Approved both count. This stops an employee from filing several requests that together go over the limit.
4. If a request is longer than what is left, the employee sees *"You have 1 day of this leave left for 2026. Shorten the request to fit."* If nothing is left, they see that all days have been used. The request is not sent.
5. The system also checks on the server side, so the limit cannot be bypassed.

**Example (Mandatory Leave):** an employee who has already used their 2 Mandatory Leave days this year can no longer apply for Mandatory Leave until next year.

### Paternity Leave beyond 7 days

An employee can still file Paternity Leave longer than 7 days. The days beyond the limit are recorded on the request, and both the employee and HR see a note such as *"3 days beyond the yearly limit, deducted from your retirement benefits."*

### HR can adjust the limits

On the **Leave types** page, HR can see each type's limit and change it under **Edit type**:

- **Days per year**: leave blank for no limit.
- **Allow extra days beyond the limit, deducted from retirement benefits**: tick this for leave types that work like Paternity Leave.

The 20 days for Sick Leave is our reading of the client's "20 days a year". HR can change it at any time without a system change.

## 3. The complete applicant cycle

### Before

The process in the system ended at the interview. Everything after it (endorsement to Crame, BMI, neuro exam, training) happened outside the system.

### Now

| Step | Status | What happens |
| --- | --- | --- |
| 1 | Submitted / Under Review | The applicant submits the requirements and HR reviews them. |
| 2 | **Interview** | HR sets the applicant for interview. The applicant is notified: *"Your requirements are complete. You are now for interview."* |
| 3 | **Endorsed to Crame** | After the interview in San Juan, HR endorses the applicant to Camp Crame for the BMI and neuro-psychiatric exam. The applicant is asked to upload proof of passing the BMI. |
| 4 | **Neuro Exam** | Once the BMI proof is uploaded and checked, HR moves the applicant to the neuro-psychiatric exam. |
| 5 | **For Training** | After the neuro exam, HR endorses the applicant for training. |
| 6 | **Hired** | HR hires the applicant and the personnel record is created. |

The applicant can be marked **Not Selected** at any step. The applicant is notified of every change.

### The applicant uploads proof of passing the BMI

While endorsed to Crame, the applicant's application page shows a **Proof of passing the BMI** box. They upload a PDF, PNG or JPEG file (up to 10 MB) and click **Upload BMI proof**. Uploading again replaces the earlier file.

On HR's side, the application page says whether the proof has been uploaded. **HR cannot move the applicant to Neuro Exam until it is uploaded.** The proof is listed with the application's files as **BMI proof**, and HR can open it.

### HR progress remarks

HR's application page has a new **Progress remarks** box. HR can write a note at any stage without changing the status, for example *"Passed the BMI at Crame."* or *"Scheduled for neuro exam on October 20."*

- Each remark appears in the application history, marked **Remark**, with its date.
- The applicant sees the remark in their status history and gets a notification.

### What the applicant sees

The **Application Status** tracker now lists every stage of the cycle: Application Submitted, Under Review, For Interview, Endorsed to Crame, Neuro Exam and For Training, then Hired. The current stage explains what happens next.

### Hiring now happens at the end of the cycle

The **Hire applicant** button only appears once the applicant is **For Training**. Applicants who were at Shortlisted or Interview before this update go through the new stages before they can be hired.
