"use client";

import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { useDepartmentOptions, useRankOptions } from "@/hooks/use-administration";
import { rankLabel } from "@/lib/ranks";
import type { Department, Rank } from "@/lib/types/database";

export type SelectChoice = { value: string; label: string };

type ChoiceOptions = {
  /** Only offer active rows (the record's saved value is always kept). */
  activeOnly?: boolean;
};

/**
 * Unit / Section (department) choices for a dropdown. Inactive departments are hidden unless
 * they are the record's saved value, which stays selectable and is labelled
 * "(inactive)" so editing never silently drops it.
 */
export function buildDepartmentChoices(
  departments: readonly Department[] | undefined,
  savedDepartmentId: number | null | undefined,
  { activeOnly = true }: ChoiceOptions = {},
): SelectChoice[] {
  const rows = departments ?? [];
  const choices = rows
    .filter((department) => !activeOnly || department.is_active || department.id === savedDepartmentId)
    .map((department) => ({
      value: String(department.id),
      label: department.is_active ? department.name : `${department.name} (inactive)`,
    }));
  if (savedDepartmentId && !rows.some((department) => department.id === savedDepartmentId)) {
    // Keep the saved value submittable while the catalogue loads or if it is unavailable.
    choices.unshift({ value: String(savedDepartmentId), label: departments ? "Current unit / section (unavailable)" : "Current unit / section (loading…)" });
  }
  return choices;
}

/**
 * Rank choices, junior to senior. Every rank applies to every department, so
 * the list never depends on the selected department. A saved inactive rank
 * stays selectable and is labelled "(inactive)".
 */
export function buildRankChoices(
  ranks: readonly Rank[] | undefined,
  savedRankId: number | null | undefined,
  { activeOnly = true }: ChoiceOptions = {},
): SelectChoice[] {
  const rows = [...(ranks ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const choices = rows
    .filter((rank) => !activeOnly || rank.is_active || rank.id === savedRankId)
    .map((rank) => ({ value: String(rank.id), label: rank.is_active ? rankLabel(rank) : `${rankLabel(rank)} (inactive)` }));
  if (savedRankId && !rows.some((rank) => rank.id === savedRankId)) {
    choices.unshift({ value: String(savedRankId), label: ranks ? "Current rank (unavailable)" : "Current rank (loading…)" });
  }
  return choices;
}

type DepartmentRankFieldsProps = {
  idPrefix: string;
  departmentId: string;
  rankId: string;
  onDepartmentChange: (departmentId: string) => void;
  onRankChange: (rankId: string) => void;
  /** The record's saved values; kept selectable even if inactive. */
  savedDepartmentId?: number | null;
  savedRankId?: number | null;
  departmentName?: string;
  rankName?: string;
  departmentError?: string;
  rankError?: string;
  required?: boolean;
  activeOnly?: boolean;
  departmentLabel?: string;
  rankLabel?: string;
  departmentPlaceholder?: string;
  rankPlaceholder?: string;
};

type DepartmentFieldProps = {
  idPrefix: string;
  value: string;
  onChange: (departmentId: string) => void;
  savedId?: number | null;
  name?: string;
  error?: string;
  required?: boolean;
  activeOnly?: boolean;
  label?: string;
  placeholder?: string;
};

/** The Unit / Section (department) select on its own. */
export function DepartmentField({
  idPrefix,
  value,
  onChange,
  savedId,
  name,
  error,
  required = false,
  activeOnly = true,
  label = "Unit / Section",
  placeholder = "Select a unit / section",
}: DepartmentFieldProps) {
  const departments = useDepartmentOptions();
  const choices = buildDepartmentChoices(departments.data, savedId, { activeOnly });
  const description = departments.isLoading
    ? "Loading units / sections…"
    : departments.error
      ? "Units / sections could not be loaded. Refresh the page to try again."
      : undefined;
  return (
    <FormField description={description} error={error} htmlFor={`${idPrefix}-department`} label={label} required={required}>
      <NativeSelect
        aria-busy={departments.isLoading || undefined}
        id={`${idPrefix}-department`}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">{placeholder}</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </NativeSelect>
    </FormField>
  );
}

type RankFieldProps = Omit<DepartmentFieldProps, "label" | "placeholder"> & { label?: string; placeholder?: string };

/** The Rank select on its own, junior to senior. */
export function RankField({
  idPrefix,
  value,
  onChange,
  savedId,
  name,
  error,
  required = false,
  activeOnly = true,
  label = "Rank",
  placeholder = "Select a rank",
}: RankFieldProps) {
  const ranks = useRankOptions();
  const choices = buildRankChoices(ranks.data, savedId, { activeOnly });
  const description = ranks.isLoading
    ? "Loading ranks…"
    : ranks.error
      ? "Ranks could not be loaded. Refresh the page to try again."
      : undefined;
  return (
    <FormField description={description} error={error} htmlFor={`${idPrefix}-rank`} label={label} required={required}>
      <NativeSelect
        aria-busy={ranks.isLoading || undefined}
        id={`${idPrefix}-rank`}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">{placeholder}</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </NativeSelect>
    </FormField>
  );
}

/**
 * Independent Unit / Section and Rank selects. Render inside a grid; the two
 * fields are returned as siblings.
 */
export function DepartmentRankFields({
  idPrefix,
  departmentId,
  rankId,
  onDepartmentChange,
  onRankChange,
  savedDepartmentId,
  savedRankId,
  departmentName,
  rankName,
  departmentError,
  rankError,
  required = false,
  activeOnly = true,
  departmentLabel,
  rankLabel: rankFieldLabel,
  departmentPlaceholder,
  rankPlaceholder,
}: DepartmentRankFieldsProps) {
  return (
    <>
      <DepartmentField
        activeOnly={activeOnly}
        error={departmentError}
        idPrefix={idPrefix}
        label={departmentLabel}
        name={departmentName}
        onChange={onDepartmentChange}
        placeholder={departmentPlaceholder}
        required={required}
        savedId={savedDepartmentId}
        value={departmentId}
      />
      <RankField
        activeOnly={activeOnly}
        error={rankError}
        idPrefix={idPrefix}
        label={rankFieldLabel}
        name={rankName}
        onChange={onRankChange}
        placeholder={rankPlaceholder}
        required={required}
        savedId={savedRankId}
        value={rankId}
      />
    </>
  );
}
