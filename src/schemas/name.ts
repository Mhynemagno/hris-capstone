import { z } from "zod";

export const namePartsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(60),
  lastName: z.string().trim().min(1, "Last name is required.").max(60),
});

export function withFullName<T extends z.output<typeof namePartsSchema>>(values: T) {
  return { ...values, fullName: `${values.firstName} ${values.lastName}` };
}
