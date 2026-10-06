"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, type DefaultValues } from "react-hook-form";

import { ApplicantProfilePhotoControl } from "@/components/recruitment/applicant-profile-photo-control";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyAccountEmail, useMyApplicantEducation, useSaveMyApplicantEducation } from "@/hooks/use-applicant-portal";
import { useApplicantProfile, useSaveApplicantProfile } from "@/hooks/use-recruitment";
import type { ApplicantEducation } from "@/lib/types/database";
import { APPLICANT_EDUCATION_LEVELS, applicantPersonalDataSheetSchema, type ApplicantPersonalDataSheetInput, type ApplicantPersonalDataSheetValues } from "@/schemas/applicant-portal";
import { APPLICANT_QUALIFIERS } from "@/schemas/auth";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const blankEducation = { schoolName: "", degreeCourse: "", yearGraduated: "", location: "" };
const blankProfile: DefaultValues<ApplicantPersonalDataSheetInput> = {
  firstName: "", middleName: "", lastName: "", qualifier: "", placeOfBirth: "", dateOfBirth: "",
  citizenship: "Filipino", gender: undefined, civilStatus: undefined, religion: "", phone: "", address: "",
  education: { elementary: blankEducation, secondary: blankEducation, college: blankEducation, graduate: blankEducation },
};

/** Hints for "Course completed" where a course does not strictly apply. */
const coursePlaceholders: Partial<Record<(typeof APPLICANT_EDUCATION_LEVELS)[number]["level"], string>> = {
  elementary: "e.g. Primary Education",
  secondary: "e.g. Junior / Senior High School",
};

function formatApplicantNumber(value: number) {
  const digits = String(value).padStart(6, "0");
  return `${digits.slice(0, 1)}-${digits.slice(1)}`;
}

function educationDefaults(rows: ApplicantEducation[] | undefined) {
  const byLevel = new Map((rows ?? []).map((row) => [row.level, row]));
  return Object.fromEntries(APPLICANT_EDUCATION_LEVELS.map(({ level }) => {
    const row = byLevel.get(level);
    return [level, { schoolName: row?.school_name ?? "", degreeCourse: row?.degree_course ?? "", yearGraduated: row?.year_graduated ? String(row.year_graduated) : "", location: row?.location ?? "" }];
  })) as ApplicantPersonalDataSheetInput["education"];
}

export function ApplicantProfileForm() {
  const profile = useApplicantProfile();
  const education = useMyApplicantEducation();
  const email = useMyAccountEmail();
  const save = useSaveApplicantProfile();
  const saveEducation = useSaveMyApplicantEducation();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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

  return <div className="max-w-3xl space-y-6">
    {profile.data ? <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:p-6">
      <ApplicantProfilePhotoControl applicant={profile.data} />
      <div><p className="text-sm text-muted-foreground">Applicant number</p><p className="text-xl font-semibold tracking-tight">{formatApplicantNumber(profile.data.applicant_number)}</p></div>
    </section> : null}

    <form className="space-y-6" noValidate onSubmit={form.handleSubmit(async ({ education: educationValues, ...values }) => {
      setError(null);
      setSaved(false);
      try {
        const applicant = await save.mutateAsync(values);
        await saveEducation.mutateAsync({ applicantId: applicant.id, education: educationValues as ApplicantPersonalDataSheetInput["education"] });
        setSaved(true);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not save your profile."); }
    })}>
      <section aria-labelledby="pds-personal" className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold" id="pds-personal">I. Personal Information</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField error={errors.lastName?.message} htmlFor="applicant-last-name" label="Last name" required><Input autoComplete="family-name" id="applicant-last-name" {...form.register("lastName")} required /></FormField>
          <FormField error={errors.firstName?.message} htmlFor="applicant-first-name" label="First name" required><Input autoComplete="given-name" id="applicant-first-name" {...form.register("firstName")} required /></FormField>
          <FormField error={errors.middleName?.message} htmlFor="applicant-middle-name" label="Middle name"><Input autoComplete="additional-name" id="applicant-middle-name" {...form.register("middleName")} /></FormField>
          <FormField error={errors.qualifier?.message} htmlFor="applicant-qualifier" label="Qualifier" required><select className={nativeSelectClassName} id="applicant-qualifier" {...form.register("qualifier")} required><option disabled value="">Select a qualifier</option><option value="None">None</option>{qualifierOptions.map((qualifier) => <option key={qualifier} value={qualifier}>{qualifier}</option>)}</select></FormField>
          <FormField error={errors.dateOfBirth?.message} htmlFor="applicant-date-of-birth" label="Date of birth" required><Input id="applicant-date-of-birth" type="date" {...form.register("dateOfBirth")} required /></FormField>
          <FormField error={errors.placeOfBirth?.message} htmlFor="applicant-place-of-birth" label="Place of birth" required><Input id="applicant-place-of-birth" {...form.register("placeOfBirth")} required /></FormField>
          <FormField error={errors.citizenship?.message} htmlFor="applicant-citizenship" label="Citizenship" required><Input id="applicant-citizenship" {...form.register("citizenship")} required /></FormField>
          <FormField error={errors.gender?.message} htmlFor="applicant-gender" label="Gender" required><select className={nativeSelectClassName} id="applicant-gender" {...form.register("gender")} required><option disabled value="">Select gender</option><option value="female">Female</option><option value="male">Male</option><option value="prefer_not_to_say">Prefer not to say</option></select></FormField>
          <FormField error={errors.civilStatus?.message} htmlFor="applicant-civil-status" label="Civil status" required><select className={nativeSelectClassName} id="applicant-civil-status" {...form.register("civilStatus")} required><option disabled value="">Select civil status</option><option value="single">Single</option><option value="married">Married</option><option value="widowed">Widowed</option><option value="separated">Separated</option><option value="divorced">Divorced</option></select></FormField>
          <FormField error={errors.religion?.message} htmlFor="applicant-religion" label="Religion" required><Input id="applicant-religion" {...form.register("religion")} required /></FormField>
          <FormField error={errors.phone?.message} htmlFor="applicant-phone" label="Mobile number" required><Input autoComplete="tel" className="placeholder:text-slate-400" id="applicant-phone" placeholder="+639XXXXXXXXX" type="tel" {...form.register("phone")} required /></FormField>
          <div className="sm:col-span-2"><FormField htmlFor="applicant-email" label="Email" required><Input id="applicant-email" readOnly required type="email" value={email.data ?? ""} /></FormField></div>
          <div className="sm:col-span-2"><FormField error={errors.address?.message} htmlFor="applicant-address" label="Home address" required><Textarea autoComplete="street-address" id="applicant-address" {...form.register("address")} required /></FormField></div>
        </div>
      </section>

      <section aria-labelledby="pds-education" className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold" id="pds-education">II. Educational Background</h2>
        <div className="mt-4 space-y-5">
          {APPLICANT_EDUCATION_LEVELS.map(({ level, label, required }) => {
            const levelErrors = errors.education?.[level];
            return <fieldset className="grid gap-4 border-t pt-4 first:border-t-0 first:pt-0 sm:grid-cols-2" key={level}>
              <legend className="mb-2 text-sm font-semibold sm:col-span-2">{required ? label : `${label} (optional)`}</legend>
              <FormField error={levelErrors?.schoolName?.message} htmlFor={`education-${level}-school`} label="Name of school" required={required}><Input id={`education-${level}-school`} {...form.register(`education.${level}.schoolName`)} required={required} /></FormField>
              <FormField error={levelErrors?.degreeCourse?.message} htmlFor={`education-${level}-course`} label="Course completed" required={required}><Input className="placeholder:text-slate-400" id={`education-${level}-course`} placeholder={coursePlaceholders[level]} {...form.register(`education.${level}.degreeCourse`)} required={required} /></FormField>
              <FormField error={levelErrors?.yearGraduated?.message} htmlFor={`education-${level}-year`} label="Year graduated" required={required}><Input id={`education-${level}-year`} inputMode="numeric" maxLength={4} {...form.register(`education.${level}.yearGraduated`)} required={required} /></FormField>
              <FormField error={levelErrors?.location?.message} htmlFor={`education-${level}-location`} label="Location" required={required}><Input id={`education-${level}-location`} {...form.register(`education.${level}.location`)} required={required} /></FormField>
            </fieldset>;
          })}
        </div>
      </section>

      {error ? <ErrorState message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3"><Button disabled={save.isPending || saveEducation.isPending} type="submit">{save.isPending || saveEducation.isPending ? "Saving…" : "Save profile"}</Button>{saved && !save.isPending ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">Profile saved.</p> : null}</div>
    </form>
  </div>;
}
