export const DUPLICATE_EMAIL_MESSAGE = "This email is already registered.";

type EmailErrorLike = { code?: string | null; message?: string | null } | null | undefined;

/** True for the errors Supabase Auth returns when an email address is already in use. */
export function isDuplicateEmailError(error: EmailErrorLike) {
  if (!error) return false;
  if (error.code === "user_already_exists" || error.code === "email_exists") return true;
  return /already (been )?registered|already exists/i.test(error.message ?? "");
}

/** With email confirmation on, signing up an existing email "succeeds" with a user that has no identities. */
export function isObfuscatedExistingUser(user: { identities?: unknown[] | null } | null | undefined) {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length === 0);
}
