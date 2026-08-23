"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useApplicantProfile, useSaveApplicantProfile } from "@/hooks/use-recruitment";
import { applicantProfileSchema, type ApplicantProfileInput } from "@/schemas/recruitment";

export function ApplicantProfileForm() {
  const profile = useApplicantProfile();
  const save = useSaveApplicantProfile();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ApplicantProfileInput>({ resolver: zodResolver(applicantProfileSchema), defaultValues: { firstName: "", middleName: "", lastName: "", phone: "", address: "" } });
  useEffect(() => { if (profile.data) form.reset({ firstName: profile.data.first_name, middleName: profile.data.middle_name ?? "", lastName: profile.data.last_name, phone: profile.data.phone ?? "", address: profile.data.address ?? "" }); }, [form, profile.data]);
  if (profile.isLoading) return <LoadingState label="Loading applicant profile…" />;
  if (profile.error) return <ErrorState message={profile.error.message} />;
  return <form className="grid max-w-2xl gap-4 sm:grid-cols-2" noValidate onSubmit={form.handleSubmit(async (values) => { setError(null); try { await save.mutateAsync(values); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not save your profile."); } })}><FormField error={form.formState.errors.firstName?.message} htmlFor="applicant-first-name" label="First name"><Input id="applicant-first-name" {...form.register("firstName")} /></FormField><FormField error={form.formState.errors.middleName?.message} htmlFor="applicant-middle-name" label="Middle name"><Input id="applicant-middle-name" {...form.register("middleName")} /></FormField><FormField error={form.formState.errors.lastName?.message} htmlFor="applicant-last-name" label="Last name"><Input id="applicant-last-name" {...form.register("lastName")} /></FormField><FormField error={form.formState.errors.phone?.message} htmlFor="applicant-phone" label="Phone"><Input id="applicant-phone" {...form.register("phone")} /></FormField><div className="sm:col-span-2"><FormField error={form.formState.errors.address?.message} htmlFor="applicant-address" label="Address"><textarea className="min-h-24 w-full rounded-lg border bg-background p-3" id="applicant-address" {...form.register("address")} /></FormField></div>{error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}<div className="sm:col-span-2"><button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : "Save profile"}</button></div></form>;
}
