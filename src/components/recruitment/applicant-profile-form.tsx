"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Award, CircleAlert, GraduationCap, IdCard, Landmark, Save, School } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm, type DefaultValues } from "react-hook-form";

import { notifyApplicant } from "@/components/app-shell/applicant-toaster";
import { ApplicantProfilePhotoControl } from "@/components/recruitment/applicant-profile-photo-control";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyAccountEmail, useMyApplicantEducation, useSaveMyApplicantEducation } from "@/hooks/use-applicant-portal";
import { useApplicantProfile, useSaveApplicantProfile } from "@/hooks/use-recruitment";
import { formatApplicantNumber } from "@/lib/recruitment/applicant-number";
import type { ApplicantEducation, ApplicantEducationLevel } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { APPLICANT_EDUCATION_LEVELS, applicantPersonalDataSheetSchema, RELIGION_OPTIONS, type ApplicantPersonalDataSheetInput, type ApplicantPersonalDataSheetValues } from "@/schemas/applicant-portal";
import { APPLICANT_QUALIFIERS } from "@/schemas/auth";

const blankEducation = { schoolName: "", degreeCourse: "", yearGraduated: "", location: "" };
const blankProfile: DefaultValues<ApplicantPersonalDataSheetInput> = {
  firstName: "", middleName: "", lastName: "", qualifier: "", placeOfBirth: "", dateOfBirth: "",
  citizenship: "Filipino", gender: undefined, civilStatus: undefined, religion: "", phone: "", address: "",
  education: { elementary: blankEducation, secondary: blankEducation, college: blankEducation, graduate: blankEducation },
};

/** Capstone UI profile.html field styles. */
const personalInputClassName = "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 font-medium text-slate-800 outline-none transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-100 aria-invalid:border-red-500";

type EducationField = "schoolName" | "degreeCourse" | "yearGraduated" | "location";

/** How each education level looks and is labelled in Capstone UI profile.html. */
const EDUCATION_LEVELS: Record<ApplicantEducationLevel, {
  title: string;
  Icon: typeof School;
  iconClassName: string;
  cardClassName: string;
  titleClassName: string;
  inputBorderClassName: string;
  labels: Record<EducationField, string>;
  placeholders: Partial<Record<EducationField, string>>;
}> = {
  elementary: {
    title: "Primary Education", Icon: School, iconClassName: "text-teal-600",
    cardClassName: "border-slate-100 bg-slate-50/60", titleClassName: "text-slate-800", inputBorderClassName: "border-slate-200",
    labels: { schoolName: "Name of School", degreeCourse: "Course Completed", yearGraduated: "Year Graduated", location: "Location" },
    placeholders: { schoolName: "Elementary School Name", degreeCourse: "Primary Education", yearGraduated: "YYYY", location: "City, Province" },
  },
  secondary: {
    title: "Secondary Education", Icon: Landmark, iconClassName: "text-teal-600",
    cardClassName: "border-slate-100 bg-slate-50/60", titleClassName: "text-slate-800", inputBorderClassName: "border-slate-200",
    labels: { schoolName: "Name of School", degreeCourse: "Course / Strand", yearGraduated: "Year Graduated", location: "Location" },
    placeholders: { schoolName: "High School Name", degreeCourse: "Junior / Senior High", yearGraduated: "YYYY", location: "City, Province" },
  },
  college: {
    title: "Tertiary / Bachelor's Degree", Icon: GraduationCap, iconClassName: "text-blue-600",
    cardClassName: "border-blue-100 bg-blue-50/40", titleClassName: "text-blue-900", inputBorderClassName: "border-blue-200",
    labels: { schoolName: "Name of Institution", degreeCourse: "Degree / Course", yearGraduated: "Year Graduated", location: "Location" },
    placeholders: { schoolName: "College or University", degreeCourse: "e.g. BS Criminology", yearGraduated: "YYYY", location: "City, Province" },
  },
  graduate: {
    title: "Graduate Studies / Post-Graduate Degree", Icon: Award, iconClassName: "text-amber-600",
    cardClassName: "border-slate-100 bg-slate-50/60", titleClassName: "text-slate-800", inputBorderClassName: "border-slate-200",
    labels: { schoolName: "Name of Institution", degreeCourse: "Degree / Program", yearGraduated: "Year Graduated", location: "Location" },
    placeholders: { schoolName: "e.g. Master's / Doctoral School", degreeCourse: "e.g. Master in Public Administration", yearGraduated: "YYYY", location: "City, Province" },
  },
};

function educationDefaults(rows: ApplicantEducation[] | undefined) {
  const byLevel = new Map((rows ?? []).map((row) => [row.level, row]));
  return Object.fromEntries(APPLICANT_EDUCATION_LEVELS.map(({ level }) => {
    const row = byLevel.get(level);
    return [level, { schoolName: row?.school_name ?? "", degreeCourse: row?.degree_course ?? "", yearGraduated: row?.year_graduated ? String(row.year_graduated) : "", location: row?.location ?? "" }];
  })) as ApplicantPersonalDataSheetInput["education"];
}

function initialsOf(...names: (string | null | undefined)[]) {
  return names.filter(Boolean).map((name) => name!.trim()[0]?.toUpperCase() ?? "").join("").slice(0, 2);
}

/** A labelled control with its required marker and validation message (Capstone UI label style). */
function Field({ children, className, error, htmlFor, label, labelClassName = "mb-1.5 text-slate-700", required }: { children: ReactNode; className?: string; error?: string; htmlFor: string; label: string; labelClassName?: string; required?: boolean }) {
  return (
    <div className={className}>
      <label className={cn("block font-semibold", labelClassName)} htmlFor={htmlFor}>
        {label}{required ? <> <span aria-hidden="true" className="text-red-500">*</span></> : null}
      </label>
      {children}
      {error ? <p className="mt-1 text-[11px] font-medium text-red-600" id={`${htmlFor}-error`} role="alert">{error}</p> : null}
    </div>
  );
}

function SectionHeader({ children, icon, iconClassName, id, trailing }: { children: ReactNode; icon: ReactNode; iconClassName: string; id: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4 text-white">
      <div className="flex items-center gap-2.5">
        <div className={cn("flex size-7 items-center justify-center rounded-lg border text-xs", iconClassName)}>{icon}</div>
        <h2 className="text-xs font-bold tracking-wider uppercase" id={id}>{children}</h2>
      </div>
      {trailing}
    </div>
  );
}

/** Capstone UI profile.html: profile header, I. Personal Information, II. Educational Background. */
export function ApplicantProfileForm() {
  const profile = useApplicantProfile();
  const education = useMyApplicantEducation();
  const email = useMyAccountEmail();
  const save = useSaveApplicantProfile();
  const saveEducation = useSaveMyApplicantEducation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ApplicantPersonalDataSheetInput, unknown, ApplicantPersonalDataSheetValues>({ resolver: zodResolver(applicantPersonalDataSheetSchema), defaultValues: blankProfile });
  const errors = form.formState.errors;

  useEffect(() => {
    if (!profile.data) return;
    form.reset({
      firstName: profile.data.first_name, middleName: profile.data.middle_name ?? "", lastName: profile.data.last_name,
      // No stored qualifier means the applicant chose "None" at registration.
      qualifier: profile.data.qualifier ?? "None", placeOfBirth: profile.data.place_of_birth ?? "", dateOfBirth: profile.data.date_of_birth ?? "",
      citizenship: profile.data.citizenship ?? "Filipino",
      gender: profile.data.gender ?? undefined, civilStatus: profile.data.civil_status ?? undefined, religion: profile.data.religion ?? "",
      phone: profile.data.phone ?? "", address: profile.data.address ?? "",
      education: educationDefaults(education.data),
    });
  }, [form, profile.data, education.data]);

  if (profile.isLoading || education.isLoading) return <LoadingState label="Loading applicant profile…" />;
  if (profile.error) return <ErrorState message={profile.error.message} />;

  const savedQualifier = profile.data?.qualifier;
  const qualifierOptions: string[] = savedQualifier && !(APPLICANT_QUALIFIERS as readonly string[]).includes(savedQualifier) ? [...APPLICANT_QUALIFIERS, savedQualifier] : [...APPLICANT_QUALIFIERS];
  const savedReligion = profile.data?.religion;
  const religionOptions: string[] = savedReligion && !(RELIGION_OPTIONS as readonly string[]).includes(savedReligion) ? [...RELIGION_OPTIONS, savedReligion] : [...RELIGION_OPTIONS];
  const fullName = profile.data ? [profile.data.first_name, profile.data.middle_name, profile.data.last_name].filter(Boolean).join(" ") : "Applicant profile";
  const applicantNumber = formatApplicantNumber(profile.data?.applicant_number);
  const saving = save.isPending || saveEducation.isPending;

  const personal = (name: keyof ApplicantPersonalDataSheetInput) => {
    const message = errors[name]?.message as string | undefined;
    return { "aria-invalid": message ? true : undefined, "aria-describedby": message ? `applicant-${name}-error` : undefined } as const;
  };

  return <div className="mx-auto max-w-5xl space-y-6 pb-12">
    {/* TOP HERO / PROFILE HEADER CARD */}
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 text-white shadow-xl sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -bottom-10 size-48 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="relative z-10 flex flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          {profile.data ? <ApplicantProfilePhotoControl applicant={profile.data} initials={initialsOf(profile.data.first_name, profile.data.last_name)} variant="ring" /> : null}
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{fullName}</h1>
            {!profile.data?.profile_image_path ? (
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-500/20 px-3 py-1 text-[11px] font-semibold text-red-200">
                <CircleAlert aria-hidden="true" className="size-3 shrink-0 text-red-400" />
                <span><strong>Required:</strong> 2x2 ID Picture (Format: JPG or PNG only, Max 5 MB)</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="w-full shrink-0 rounded-xl border border-white/15 bg-white/10 p-4 text-center shadow-inner backdrop-blur-md md:w-auto md:text-right">
          <span className="block text-[10px] font-bold tracking-widest text-slate-300 uppercase">Applicant Number</span>
          <span className="font-mono text-2xl font-black tracking-wider text-white">{applicantNumber ?? "Pending"}</span>
          {applicantNumber ? null : <span className="block text-[10px] text-slate-300">Issued once HR accepts your application</span>}
        </div>
      </div>
    </div>

    <form className="space-y-6" noValidate onSubmit={form.handleSubmit(async ({ education: educationValues, ...values }) => {
      setError(null);
      try {
        const applicant = await save.mutateAsync(values);
        await saveEducation.mutateAsync({ applicantId: applicant.id, education: educationValues as ApplicantPersonalDataSheetInput["education"] });
        notifyApplicant({ title: "Profile Updated Successfully!", description: "Your personal and academic details have been saved." });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "We could not save your profile.";
        setError(message);
        notifyApplicant({ title: "Profile not saved", description: message, tone: "error" });
      }
    })}>
      {/* SECTION I: PERSONAL INFORMATION */}
      <section aria-labelledby="pds-personal" className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <SectionHeader icon={<IdCard aria-hidden="true" className="size-3.5" />} iconClassName="border-blue-500/40 bg-blue-600/30 text-blue-400" id="pds-personal" trailing={<span className="text-[10px] font-medium text-slate-400">* Required fields</span>}>
          I. Personal Information
        </SectionHeader>
        <div className="grid grid-cols-1 gap-5 p-6 text-xs md:grid-cols-2 lg:grid-cols-3">
          <Field error={errors.lastName?.message} htmlFor="applicant-lastName" label="Last Name" required><input autoComplete="family-name" className={personalInputClassName} id="applicant-lastName" {...personal("lastName")} {...form.register("lastName")} required /></Field>
          <Field error={errors.firstName?.message} htmlFor="applicant-firstName" label="First Name" required><input autoComplete="given-name" className={personalInputClassName} id="applicant-firstName" {...personal("firstName")} {...form.register("firstName")} required /></Field>
          <Field error={errors.middleName?.message} htmlFor="applicant-middleName" label="Middle Name"><input autoComplete="additional-name" className={personalInputClassName} id="applicant-middleName" {...personal("middleName")} {...form.register("middleName")} /></Field>
          <Field error={errors.qualifier?.message} htmlFor="applicant-qualifier" label="Qualifier / Extension" required>
            <select className={personalInputClassName} id="applicant-qualifier" {...personal("qualifier")} {...form.register("qualifier")} required>
              <option disabled value="">Select a qualifier</option>
              <option value="None">None</option>
              {qualifierOptions.map((qualifier) => <option key={qualifier} value={qualifier}>{qualifier}</option>)}
            </select>
          </Field>
          <Field error={errors.dateOfBirth?.message} htmlFor="applicant-dateOfBirth" label="Date of Birth" required><input className={personalInputClassName} id="applicant-dateOfBirth" type="date" {...personal("dateOfBirth")} {...form.register("dateOfBirth")} required /></Field>
          <Field error={errors.placeOfBirth?.message} htmlFor="applicant-placeOfBirth" label="Place of Birth" required><input className={personalInputClassName} id="applicant-placeOfBirth" {...personal("placeOfBirth")} {...form.register("placeOfBirth")} required /></Field>
          <Field error={errors.citizenship?.message} htmlFor="applicant-citizenship" label="Citizenship" required><input className={personalInputClassName} id="applicant-citizenship" {...personal("citizenship")} {...form.register("citizenship")} required /></Field>
          <Field error={errors.gender?.message} htmlFor="applicant-gender" label="Gender" required>
            <select className={personalInputClassName} id="applicant-gender" {...personal("gender")} {...form.register("gender")} required>
              <option disabled value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </Field>
          <Field error={errors.civilStatus?.message} htmlFor="applicant-civilStatus" label="Civil Status" required>
            <select className={personalInputClassName} id="applicant-civilStatus" {...personal("civilStatus")} {...form.register("civilStatus")} required>
              <option disabled value="">Select civil status</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="widowed">Widowed</option>
              <option value="separated">Separated</option>
              <option value="divorced">Divorced</option>
            </select>
          </Field>
          <Field error={errors.religion?.message} htmlFor="applicant-religion" label="Religion" required>
            <select className={personalInputClassName} id="applicant-religion" {...personal("religion")} {...form.register("religion")} required>
              <option value="">Select Religion</option>
              {religionOptions.map((religion) => <option key={religion} value={religion}>{religion}</option>)}
            </select>
          </Field>
          <Field error={errors.phone?.message} htmlFor="applicant-phone" label="Mobile Number" required><input autoComplete="tel" className={cn(personalInputClassName, "placeholder:text-slate-400")} id="applicant-phone" placeholder="+639XXXXXXXXX" type="tel" {...personal("phone")} {...form.register("phone")} required /></Field>
          <Field htmlFor="applicant-email" label="Email Address" required><input className={cn(personalInputClassName, "cursor-not-allowed text-slate-500")} id="applicant-email" readOnly required type="email" value={email.data ?? ""} /></Field>
          <Field className="md:col-span-2 lg:col-span-3" error={errors.address?.message} htmlFor="applicant-address" label="Home Address" required>
            <textarea autoComplete="street-address" className={personalInputClassName} id="applicant-address" placeholder="House No., Street, Barangay, City, Province" rows={2} {...personal("address")} {...form.register("address")} required />
          </Field>
        </div>
      </section>

      {/* SECTION II: EDUCATIONAL BACKGROUND */}
      <section aria-labelledby="pds-education" className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <SectionHeader icon={<GraduationCap aria-hidden="true" className="size-3.5" />} iconClassName="border-teal-500/40 bg-teal-600/30 text-teal-400" id="pds-education">
          II. Educational Background
        </SectionHeader>
        <div className="space-y-6 p-6 text-xs">
          {APPLICANT_EDUCATION_LEVELS.map(({ level, required }) => {
            const look = EDUCATION_LEVELS[level];
            const levelErrors = errors.education?.[level];
            return (
              <fieldset className={cn("relative rounded-xl border p-4", look.cardClassName)} key={level}>
                {/* Floated so the legend sits inside the card like the mockup's heading instead of on its border. */}
                <legend className={cn("float-left mb-3 flex w-full items-center gap-2 pr-20 text-xs font-bold tracking-wider uppercase", look.titleClassName)}>
                  <look.Icon aria-hidden="true" className={cn("size-3.5", look.iconClassName)} /> {look.title}
                </legend>
                {!required ? <span className="absolute top-4 right-4 rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase">Optional</span> : null}
                <div className="clear-left grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {(["schoolName", "degreeCourse", "yearGraduated", "location"] as const).map((field) => {
                    const id = `education-${level}-${field}`;
                    const message = levelErrors?.[field]?.message;
                    return (
                      <Field error={message} htmlFor={id} key={field} label={look.labels[field]} labelClassName={cn("mb-1", level === "college" ? "text-slate-700" : "text-slate-600")} required={required}>
                        <input
                          aria-describedby={message ? `${id}-error` : undefined}
                          aria-invalid={message ? true : undefined}
                          className={cn("w-full rounded-lg border bg-white px-3 py-2 font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-600 aria-invalid:border-red-500", look.inputBorderClassName)}
                          id={id}
                          inputMode={field === "yearGraduated" ? "numeric" : undefined}
                          maxLength={field === "yearGraduated" ? 4 : undefined}
                          placeholder={look.placeholders[field]}
                          {...form.register(`education.${level}.${field}`)}
                          required={required}
                        />
                      </Field>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      {error ? <ErrorState message={error} /> : null}
      {/* SAVE BUTTON */}
      <div className="flex justify-end pt-2">
        <button className="flex cursor-pointer items-center gap-2 rounded-xl bg-blue-700 px-7 py-3 text-xs font-bold text-white shadow-lg transition-all hover:bg-blue-800 hover:shadow-blue-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} type="submit">
          <Save aria-hidden="true" className="size-3.5" />
          <span>{saving ? "Saving…" : "Save Changes & Update Profile"}</span>
        </button>
      </div>
    </form>
  </div>;
}
