import type { ReactNode } from "react";

/** The Data Privacy Notice text, shared by the apply consent dialog and the login page's Privacy Policy link. */
export const PRIVACY_SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: "Information we collect",
    body: <ul className="list-disc space-y-1 pl-5"><li>Your name, qualifier, birthdate, citizenship, sex, civil status and address.</li><li>Your email address and mobile number.</li><li>Your educational background.</li><li>The documents you upload for your application.</li></ul>,
  },
  {
    title: "How we use your information",
    body: <p>Your information is used only to evaluate your application, contact you about its status, and complete hiring requirements for the San Juan City Police Station.</p>,
  },
  {
    title: "How your information is protected",
    body: <p>Your data is kept confidential and stored securely within this system. Only authorized HR personnel and system administrators can access it, and every access and change is recorded. It is never sold or shared with third parties outside the recruitment process, except when required by law.</p>,
  },
  {
    title: "Retention",
    body: <p>Your information is kept only for as long as needed for recruitment and for record-keeping required by law. You may ask for your account and its data to be deleted.</p>,
  },
  {
    title: "Your rights",
    body: <p>Under the Data Privacy Act of 2012, you have the right to be informed, to access, to correct, and to object to the processing of your personal data, and to have it erased or blocked.</p>,
  },
];

export function PrivacyNoticeBody() {
  return (
    <>
      <p>The San Juan City Police Station respects your privacy and is committed to protecting your personal data in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173). By applying, you agree to the collection and use of your information as described below.</p>
      {PRIVACY_SECTIONS.map((section) => (
        <section key={section.title}>
          <h3 className="text-base font-bold">{section.title}</h3>
          <div className="mt-1">{section.body}</div>
        </section>
      ))}
    </>
  );
}
