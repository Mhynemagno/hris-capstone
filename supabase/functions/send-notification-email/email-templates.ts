// HTML emails copied from the client's designs (Final Changes PDF, Oct 2026):
// emailud.html for applicants and emailemp.html for personnel. Gmail strips <style>, so every rule is inline.

export type EmailContext = {
  applicant_first_name?: string | null;
  applicant_number?: string | null;
  application_status?: string | null;
  application_stage_result?: string | null;
  application_submitted_at?: string | null;
  employee_first_name?: string | null;
  employee_last_name?: string | null;
  rank_code?: string | null;
  badge_number?: string | null;
  deployment_location?: string | null;
  deployment_role?: string | null;
  deployment_starts_on?: string | null;
  deployment_ends_on?: string | null;
};

export type EmailJobContent = {
  template_key: string;
  notification_title: string;
  notification_body: string;
};

export type RenderedEmail = { html: string; text: string };

const APPLICANT_TEMPLATES = new Set(["application_update", "application_remark", "applicant_welcome"]);
const FONT = "font-family: Arial, Helvetica, sans-serif;";

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function multiline(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

/** "October 11, 2026". Date-only values are calendar dates; timestamps are shown in Philippine time. */
export function formatEmailDate(value: string | null | undefined) {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: dateOnly ? "UTC" : "Asia/Manila" }).format(date);
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function header(subtitle: string) {
  return `<tr>
            <td align="center" style="background-color: #0B1A30; padding: 24px; text-align: center; border-bottom: 4px solid #CE1126;">
              <h1 style="color: #ffffff; font-size: 18px; margin: 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; ${FONT}">San Juan City Police Station</h1>
              <p style="color: #F59E0B; font-size: 11px; margin: 4px 0 0 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; ${FONT}">${subtitle}</p>
            </td>
          </tr>`;
}

function footer(lines: { station: string; hotline: string }) {
  return `<tr>
            <td align="center" style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5; ${FONT}">
              <p style="margin: 0 0 4px 0; font-weight: bold; color: #334155;">${lines.station}</p>
              <p style="margin: 0 0 4px 0;">Santolan Rd. cor. Col. Bonny Serrano Ave., San Juan City</p>
              <p style="margin: 0; color: #CE1126; font-weight: bold;">${lines.hotline}</p>
            </td>
          </tr>`;
}

function shell(title: string, rows: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; ${FONT} color: #334155; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 20px 0; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 0 10px;">
        <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          ${rows}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detail(label: string, value: string, valueStyle = "") {
  return `<p style="font-size: 12px; color: #334155; margin: 6px 0; ${FONT}"><strong>${label}:</strong> ${valueStyle ? `<span style="${valueStyle}">${value}</span>` : value}</p>`;
}

function fallbackLink(url: string, color: string) {
  const safeUrl = escapeHtml(url);
  return `<p style="font-size: 11px; color: #64748b; line-height: 1.5; text-align: center; margin: 0 0 24px 0; ${FONT}">
                Or copy and paste this URL into your browser:<br>
                <a href="${safeUrl}" target="_blank" style="color: ${color}; text-decoration: underline; font-weight: bold;">${safeUrl}</a>
              </p>`;
}

function disclaimer(text: string) {
  return `<p style="font-size: 11px; color: #94a3b8; line-height: 1.5; font-style: italic; margin: 20px 0 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px; ${FONT}">* ${text}</p>`;
}

function paragraph(html: string) {
  return `<p style="font-size: 13px; line-height: 1.6; color: #475569; margin: 0 0 20px 0; ${FONT}">${html}</p>`;
}

function applicantStatusLabel(status: string | null) {
  if (!status) return "Application Received";
  return status === "Application Submission" ? "Application Received" : status;
}

function renderApplicantEmail(job: EmailJobContent, context: EmailContext, continueUrl: string): RenderedEmail {
  const firstName = clean(context.applicant_first_name) ?? "Applicant";
  const status = applicantStatusLabel(clean(context.application_status));
  const rejected = status === "Not Selected";
  const applicantNumber = clean(context.applicant_number) ?? "To be issued once your application is accepted";
  const submitted = formatEmailDate(context.application_submitted_at);
  const intro = job.template_key === "application_remark"
    ? "We would like to inform you that a new remark has been added to your application."
    : job.template_key === "applicant_welcome"
      ? "We would like to inform you that your application has been accepted."
      : "We would like to inform you that your application status has been updated.";
  const safeUrl = escapeHtml(continueUrl);

  const html = shell("San Juan CPS HRIS Notification", `${header("Human Resource Information System")}
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="font-size: 16px; color: #0f172a; margin: 0 0 12px 0; ${FONT}">Greetings, ${escapeHtml(firstName)}!</h2>
              ${paragraph(intro)}
              <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 20px 0;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; margin: 0 0 8px 0; ${FONT}">Application Status</p>
                    <span style="display: inline-block; background-color: ${rejected ? "#fee2e2" : "#dcfce7"}; color: ${rejected ? "#991b1b" : "#166534"}; font-size: 12px; font-weight: bold; padding: 6px 12px; border-radius: 20px; text-transform: uppercase; ${FONT}">&#9679; ${escapeHtml(status)}</span>
                    <div style="border-top: 1px solid #e2e8f0; margin: 12px 0;"></div>
                    ${detail("Applicant Number", escapeHtml(applicantNumber), "color: #CE1126;")}
                    ${submitted ? detail("Submission Date", escapeHtml(submitted)) : ""}
                    <p style="font-size: 12px; color: #475569; line-height: 1.6; margin: 10px 0 0 0; ${FONT}">${multiline(job.notification_body)}</p>
                  </td>
                </tr>
              </table>
              ${paragraph("Please click the link below to access your applicant account and check your application status:")}
              <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${safeUrl}" target="_blank" style="background-color: #CE1126; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; padding: 14px 28px; border-radius: 8px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 10px rgba(206, 17, 38, 0.25); ${FONT}">Applicant Login</a>
                  </td>
                </tr>
              </table>
              ${fallbackLink(continueUrl, "#0B1A30")}
              ${disclaimer("This is an automated email notification from the San Juan CPS HRIS Portal. Please do not reply directly to this message.")}
            </td>
          </tr>
          ${footer({ station: "San Juan City Police Station", hotline: "Hotline: 0917-773-7885" })}`);

  const text = [
    `Greetings, ${firstName}!`,
    "",
    intro,
    "",
    `Application Status: ${status}`,
    `Applicant Number: ${applicantNumber}`,
    ...(submitted ? [`Submission Date: ${submitted}`] : []),
    "",
    job.notification_body,
    "",
    `Applicant Login: ${continueUrl}`,
    "",
    "This is an automated email notification from the San Juan CPS HRIS Portal. Please do not reply directly to this message.",
  ].join("\n");
  return { html, text };
}

function renderPersonnelEmail(job: EmailJobContent, context: EmailContext, continueUrl: string): RenderedEmail {
  const name = [context.rank_code, context.employee_first_name, context.employee_last_name].map(clean).filter(Boolean).join(" ") || "Personnel";
  const badge = clean(context.badge_number) ?? "—";
  const deployment = job.template_key === "deployment_update";
  const location = clean(context.deployment_location) ?? "—";
  const starts = formatEmailDate(context.deployment_starts_on);
  const ends = formatEmailDate(context.deployment_ends_on);
  const effective = starts ? (ends ? `${starts} to ${ends}` : starts) : "—";
  const badgeLabel = deployment
    ? (job.notification_title.toLowerCase().includes("updated") ? "Deployment Order Updated" : "Deployment Order Issued")
    : job.notification_title;
  const introHtml = deployment
    ? "Please be advised that a new <strong>Official Deployment Order / Duty Assignment</strong> has been issued to your personnel profile under the San Juan City Police Station HRIS Portal."
    : "Please be advised that there is an update on your personnel record under the San Juan City Police Station HRIS Portal.";
  const introText = introHtml.replace(/<\/?strong>/g, "");
  const directive = deployment
    ? "Please click the link below to access the Personnel Portal to acknowledge receipt of this directive and view complete duty guidelines:"
    : "Please click the link below to access the Personnel Portal and view the complete details:";
  const note = deployment
    ? "This is an automated official directive from the San Juan CPS HRIS Portal. Strict compliance with standard operating procedure (SOP) is required."
    : "This is an automated email notification from the San Juan CPS HRIS Portal. Please do not reply directly to this message.";
  const safeUrl = escapeHtml(continueUrl);

  const details = deployment
    ? [
      detail("Badge / Badge No", escapeHtml(badge), "color: #CE1126; font-weight: bold;"),
      detail("Assignment / Post", escapeHtml(location)),
      detail("Effective Date", escapeHtml(effective)),
      detail("Issuing Office", "Office of the Station Commander / Administrative Section"),
    ].join("\n                    ")
    : [
      detail("Badge / Badge No", escapeHtml(badge), "color: #CE1126; font-weight: bold;"),
      `<p style="font-size: 12px; color: #475569; line-height: 1.6; margin: 10px 0 0 0; ${FONT}">${multiline(job.notification_body)}</p>`,
    ].join("\n                    ");

  const html = shell(`San Juan CPS HRIS - ${deployment ? "Duty Assignment / Deployment Notice" : job.notification_title}`, `${header("Human Resource Information System &bull; Personnel Gateway")}
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="font-size: 16px; color: #0f172a; margin: 0 0 12px 0; ${FONT}">Greetings, ${escapeHtml(name)}!</h2>
              ${paragraph(introHtml)}
              <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 18px;">
                    <p style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; margin: 0 0 10px 0; ${FONT}">${deployment ? "Special Order / Deployment Summary" : "Notification Summary"}</p>
                    <div style="display: inline-block; background-color: #1e3a8a; color: #ffffff; font-size: 11px; font-weight: bold; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; ${FONT}">&#9679; ${escapeHtml(badgeLabel)}</div>
                    <div style="border-top: 1px solid #e2e8f0; margin: 14px 0;"></div>
                    ${details}
                  </td>
                </tr>
              </table>
              ${paragraph(directive)}
              <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${safeUrl}" target="_blank" style="background-color: #0B1A30; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; padding: 14px 32px; border-radius: 8px; display: inline-block; letter-spacing: 0.5px; border-bottom: 3px solid #CE1126; ${FONT}">Personnel Portal Access</a>
                  </td>
                </tr>
              </table>
              ${fallbackLink(continueUrl, "#CE1126")}
              ${disclaimer(note)}
            </td>
          </tr>
          ${footer({ station: "San Juan City Police Station &bull; EPD NCRPO", hotline: "Administrative Section Hotline: 0917-773-7885" })}`);

  const text = [
    `Greetings, ${name}!`,
    "",
    introText,
    "",
    `${badgeLabel}`,
    `Badge / Badge No: ${badge}`,
    ...(deployment
      ? [`Assignment / Post: ${location}`, `Effective Date: ${effective}`, "Issuing Office: Office of the Station Commander / Administrative Section"]
      : ["", job.notification_body]),
    "",
    `Personnel Portal Access: ${continueUrl}`,
    "",
    note,
  ].join("\n");
  return { html, text };
}

export function renderNotificationEmail(job: EmailJobContent, context: EmailContext, continueUrl: string): RenderedEmail {
  return APPLICANT_TEMPLATES.has(job.template_key)
    ? renderApplicantEmail(job, context, continueUrl)
    : renderPersonnelEmail(job, context, continueUrl);
}
