import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";

import { PasswordInput } from "./password-input";

type LoginFormProps = {
  error?: string;
  nextPath: string;
};

export function LoginForm({ error, nextPath }: LoginFormProps) {
  return <form action="/auth/login" className="space-y-4" method="post" noValidate>
    <input name="next" type="hidden" value={nextPath} />
    <FormField htmlFor="login-email" label="Email"><input autoComplete="email" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 shadow-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20" id="login-email" name="email" type="email" /></FormField>
    <FormField htmlFor="login-password" label="Password"><PasswordInput /></FormField>
    {error ? <ErrorState message={error} /> : null}
    <button className="w-full rounded-md bg-sky-400 px-4 py-2 font-medium text-slate-950" type="submit">Sign in</button>
  </form>;
}
