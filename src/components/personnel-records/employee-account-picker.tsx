import Link from "next/link";

import type { UnlinkedEmployeeAccount } from "@/lib/types/database";

function accountLabel(account: UnlinkedEmployeeAccount) {
  const name = [account.first_name, account.last_name].filter(Boolean).join(" ");
  return name || account.full_name || account.email || "Unnamed Employee account";
}

export function EmployeeAccountPicker({ accounts }: { accounts: UnlinkedEmployeeAccount[] }) {
  if (!accounts.length) return null;

  return <section className="rounded-xl border bg-card p-4">
    <div><h2 className="text-lg font-semibold">Accounts awaiting personnel record</h2><p className="mt-1 text-sm text-muted-foreground">Select an active Employee account to prefill and create its first official record.</p></div>
    <ul className="mt-4 divide-y rounded-lg border">{accounts.map((account) => {
      const label = accountLabel(account);
      return <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between" key={account.profile_id}><div><p className="font-medium">{label}</p><p className="text-sm text-muted-foreground">{account.email ?? "No email on account"}</p></div><Link aria-label={`Create record for ${label}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted" href={`/hr/employees/new?profileId=${account.profile_id}`}>Create record</Link></li>;
    })}</ul>
  </section>;
}
