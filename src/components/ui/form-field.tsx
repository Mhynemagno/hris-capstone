import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

type FormFieldProps = {
  children: ReactNode;
  description?: string;
  error?: string;
  htmlFor: string;
  label: string;
  /** Shows a visible required marker; the control itself should still carry `required`/zod validation. */
  required?: boolean;
};

type DescribableProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

export function FormField({
  children,
  description,
  error,
  htmlFor,
  label,
  required = false,
}: FormFieldProps) {
  const descriptionId = description ? `${htmlFor}-description` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  // Connect helper and error text to a single control so screen readers announce them.
  const control =
    isValidElement<DescribableProps>(children) && describedBy
      ? cloneElement(children as ReactElement<DescribableProps>, {
          "aria-describedby": [children.props["aria-describedby"], describedBy].filter(Boolean).join(" "),
          ...(error && children.props["aria-invalid"] === undefined ? { "aria-invalid": true } : {}),
        })
      : children;

  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-foreground">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        ) : null}
      </label>
      {control}
      {description ? (
        <p className="text-sm text-muted-foreground" id={descriptionId}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-destructive" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
