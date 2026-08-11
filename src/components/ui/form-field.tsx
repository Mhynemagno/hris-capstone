import type { ReactNode } from "react";

type FormFieldProps = {
  children: ReactNode;
  description?: string;
  error?: string;
  htmlFor: string;
  label: string;
};

export function FormField({
  children,
  description,
  error,
  htmlFor,
  label,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
