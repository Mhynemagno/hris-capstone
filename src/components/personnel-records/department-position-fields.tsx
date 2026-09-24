"use client";

import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { useDepartmentOptions, usePositionOptions } from "@/hooks/use-administration";
import type { Department, Position } from "@/lib/types/database";

export type SelectChoice = { value: string; label: string };

type ChoiceOptions = {
  /** Only offer active rows (the record's saved value is always kept). */
  activeOnly?: boolean;
};

/**
 * Department choices for a dropdown. Inactive departments are hidden unless
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
    choices.unshift({ value: String(savedDepartmentId), label: departments ? "Current department (unavailable)" : "Current department (loading…)" });
  }
  return choices;
}

/** Position choices that belong to the selected department. */
export function buildPositionChoices(
  positions: readonly Position[] | undefined,
  departmentId: string,
  savedPositionId: number | null | undefined,
  { activeOnly = true }: ChoiceOptions = {},
): SelectChoice[] {
  const rows = positions ?? [];
  const selectedDepartment = departmentId ? Number(departmentId) : null;
  const choices = rows
    .filter((position) => selectedDepartment !== null && position.department_id === selectedDepartment)
    .filter((position) => !activeOnly || position.is_active || position.id === savedPositionId)
    .map((position) => ({
      value: String(position.id),
      label: position.is_active ? position.title : `${position.title} (inactive)`,
    }));
  const saved = savedPositionId ? rows.find((position) => position.id === savedPositionId) : undefined;
  if (savedPositionId && !choices.some((choice) => choice.value === String(savedPositionId))) {
    if (!positions) {
      choices.unshift({ value: String(savedPositionId), label: "Current position (loading…)" });
    } else if (saved && (saved.department_id === null || selectedDepartment === null)) {
      // Legacy record whose position has no (or no selected) department: keep it visible.
      choices.unshift({ value: String(saved.id), label: saved.is_active ? saved.title : `${saved.title} (inactive)` });
    }
  }
  return choices;
}

type DepartmentPositionFieldsProps = {
  idPrefix: string;
  departmentId: string;
  positionId: string;
  onDepartmentChange: (departmentId: string) => void;
  onPositionChange: (positionId: string) => void;
  /** The record's saved values; kept selectable even if inactive. */
  savedDepartmentId?: number | null;
  savedPositionId?: number | null;
  departmentName?: string;
  positionName?: string;
  departmentError?: string;
  positionError?: string;
  required?: boolean;
  activeOnly?: boolean;
  departmentLabel?: string;
  positionLabel?: string;
  departmentPlaceholder?: string;
  positionPlaceholder?: string;
};

/**
 * Department select plus a Position select filtered to that department.
 * Changing the department clears the position. Render inside a grid; the two
 * fields are returned as siblings.
 */
export function DepartmentPositionFields({
  idPrefix,
  departmentId,
  positionId,
  onDepartmentChange,
  onPositionChange,
  savedDepartmentId,
  savedPositionId,
  departmentName,
  positionName,
  departmentError,
  positionError,
  required = false,
  activeOnly = true,
  departmentLabel = "Department",
  positionLabel = "Position",
  departmentPlaceholder = "Select a department",
  positionPlaceholder = "Select a position",
}: DepartmentPositionFieldsProps) {
  const departments = useDepartmentOptions();
  const positions = usePositionOptions();
  const departmentChoices = buildDepartmentChoices(departments.data, savedDepartmentId, { activeOnly });
  const positionChoices = buildPositionChoices(positions.data, departmentId, savedPositionId, { activeOnly });
  // Never disable while a value is set: disabled controls are left out of form data.
  const positionDisabled = !departmentId && !positionId;
  const departmentDescription = departments.isLoading
    ? "Loading departments…"
    : departments.error
      ? "Departments could not be loaded. Refresh the page to try again."
      : undefined;
  const positionDescription = positions.isLoading
    ? "Loading positions…"
    : positions.error
      ? "Positions could not be loaded. Refresh the page to try again."
      : departmentId && !positionChoices.length
        ? "No active positions in this department yet."
        : undefined;

  return (
    <>
      <FormField description={departmentDescription} error={departmentError} htmlFor={`${idPrefix}-department`} label={departmentLabel} required={required}>
        <NativeSelect
          aria-busy={departments.isLoading || undefined}
          id={`${idPrefix}-department`}
          name={departmentName}
          onChange={(event) => {
            onDepartmentChange(event.target.value);
            onPositionChange("");
          }}
          required={required}
          value={departmentId}
        >
          <option value="">{departmentPlaceholder}</option>
          {departmentChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField description={positionDescription} error={positionError} htmlFor={`${idPrefix}-position`} label={positionLabel} required={required}>
        <NativeSelect
          aria-busy={positions.isLoading || undefined}
          disabled={positionDisabled}
          id={`${idPrefix}-position`}
          name={positionName}
          onChange={(event) => onPositionChange(event.target.value)}
          required={required}
          value={positionId}
        >
          <option value="">{positionDisabled ? "Select a department first" : positionPlaceholder}</option>
          {positionChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
    </>
  );
}
