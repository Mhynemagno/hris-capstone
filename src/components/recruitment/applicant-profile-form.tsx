"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { ApplicantProfileDocuments } from "@/components/recruitment/applicant-profile-documents";
import { ApplicantProfilePhotoControl } from "@/components/recruitment/applicant-profile-photo-control";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useApplicantProfile, useSaveApplicantProfile } from "@/hooks/use-recruitment";
import { applicantProfileSchema, type ApplicantProfileInput } from "@/schemas/recruitment";

const blankProfile: ApplicantProfileInput = {
  firstName: "", middleName: "", lastName: "", qualifier: "", placeOfBirth: "", dateOfBirth: undefined,
  sex: undefined, civilStatus: undefined, religion: "", phone: "", address: "",
};

function formatApplicantNumber(value: number) {
  const digits = String(value).padStart(6, "0");
  return `${digits.slice(0, 1)}-${digits.slice(1)}`;
}

export function ApplicantProfileForm() {
  const profile = useApplicantProfile();
  const save = useSaveApplicantProfile();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ApplicantProfileInput>({ resolver: zodResolver(applicantProfileSchema), defaultValues: blankProfile });

  useEffect(() => {
    if (!profile.data) return;
    form.reset({
      firstName: profile.data.first_name, middleName: profile.data.middle_name ?? "", lastName: profile.data.last_name,
      qualifier: profile.data.qualifier ?? "", placeOfBirth: profile.data.place_of_birth ?? "", dateOfBirth: profile.data.date_of_birth ?? undefined,
      sex: profile.data.sex ?? undefined, civilStatus: profile.data.civil_status ?? undefined, religion: profile.data.religion ?? "",
      phone: profile.data.phone ?? "", address: profile.data.address ?? "",
    });
  }, [form, profile.data]);

  if (profile.isLoading) return <LoadingState label="Loading applicant profile…" />;
  if (profile.error) return <ErrorState message={profile.error.message} />;

  return <div className="max-w-2xl space-y-6">
    {profile.data ? <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:p-6">
      <ApplicantProfilePhotoControl applicant={profile.data} />
      <div><p className="text-sm text-muted-foreground">Applicant number</p><p className="text-xl font-semibold tracking-tight">{formatApplicantNumber(profile.data.applicant_number)}</p><p className="mt-1 text-sm text-muted-foreground">This permanent number is assigned automatically.</p></div>
    </section> : null}

    <form className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2 sm:p-6" noValidate onSubmit={form.handleSubmit(async (values) => {
      setError(null);
      try { await save.mutateAsync(values); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not save your profile."); }
    })}>
      <FormField error={form.formState.errors.firstName?.message} htmlFor="applicant-first-name" label="First name"><Input id="applicant-first-name" {...form.register("firstName")} required /></FormField>
      <FormField error={form.formState.errors.middleName?.message} htmlFor="applicant-middle-name" label="Middle name"><Input id="applicant-middle-name" {...form.register("middleName")} /></FormField>
      <FormField error={form.formState.errors.lastName?.message} htmlFor="applicant-last-name" label="Last name"><Input id="applicant-last-name" {...form.register("lastName")} required /></FormField>
      <FormField error={form.formState.errors.qualifier?.message} htmlFor="applicant-qualifier" label="Qualifier"><Input id="applicant-qualifier" placeholder="Jr., Sr., III" {...form.register("qualifier")} /></FormField>
      <FormField error={form.formState.errors.placeOfBirth?.message} htmlFor="applicant-place-of-birth" label="Place of birth"><Input id="applicant-place-of-birth" {...form.register("placeOfBirth")} /></FormField>
      <FormField error={form.formState.errors.dateOfBirth?.message} htmlFor="applicant-date-of-birth" label="Date of birth"><Input id="applicant-date-of-birth" type="date" {...form.register("dateOfBirth")} /></FormField>
      <FormField error={form.formState.errors.sex?.message} htmlFor="applicant-sex" label="Sex"><select className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" id="applicant-sex" {...form.register("sex")}><option value="">Not provided</option><option value="female">Female</option><option value="male">Male</option><option value="prefer_not_to_say">Prefer not to say</option></select></FormField>
      <FormField error={form.formState.errors.civilStatus?.message} htmlFor="applicant-civil-status" label="Civil status"><select className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" id="applicant-civil-status" {...form.register("civilStatus")}><option value="">Not provided</option><option value="single">Single</option><option value="married">Married</option><option value="widowed">Widowed</option><option value="separated">Separated</option><option value="divorced">Divorced</option></select></FormField>
      <FormField error={form.formState.errors.religion?.message} htmlFor="applicant-religion" label="Religion"><Input id="applicant-religion" {...form.register("religion")} /></FormField>
      <FormField error={form.formState.errors.phone?.message} htmlFor="applicant-phone" label="Phone"><Input id="applicant-phone" {...form.register("phone")} /></FormField>
      <div className="sm:col-span-2"><FormField error={form.formState.errors.address?.message} htmlFor="applicant-address" label="Home address"><textarea className="min-h-24 w-full rounded-lg border bg-background p-3" id="applicant-address" {...form.register("address")} /></FormField></div>
      {error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}
      <div className="sm:col-span-2"><button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : "Save profile"}</button></div>
    </form>

    {profile.data ? <ApplicantProfileDocuments /> : <p className="text-sm text-muted-foreground">Save your basic profile first to upload your required documents and optional photo.</p>}
  </div>;
}
