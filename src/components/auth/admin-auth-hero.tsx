/** Capstone UI sample.html: the Management Portal hero copy. */
export function AdminAuthHero() {
  return (
    <div className="relative z-10 my-auto py-6">
      <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold tracking-widest text-amber-400 uppercase">
        <span>Service</span> • <span>Honor</span> • <span>Justice</span>
      </div>
      <h2 className="text-3xl leading-tight font-extrabold text-white">System Management &amp; Administration</h2>
      <p className="mt-3 max-w-md text-xs leading-relaxed font-normal text-slate-300">
        Authorized portal for managing personnel records, reviewing promotion applications, auditing DTR logs, and configuring station system settings.
      </p>
    </div>
  );
}

/** Capstone UI emplogin.html: employee hero copy, using station branding instead of stock imagery. */
export function EmployeeAuthHero() {
  return (
    <div className="relative z-10 my-auto py-6">
      <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold tracking-widest text-amber-400 uppercase">
        <span>Service</span> • <span>Honor</span> • <span>Justice</span>
      </div>
      <h2 className="text-3xl leading-tight font-extrabold text-white">To Serve and Protect.</h2>
      <p className="mt-3 max-w-md text-xs leading-relaxed font-normal text-slate-300">
        Welcome to the official personnel portal of the San Juan City Police Station. Access your 201 records, submit attendance logs, track promotion history, and view active deployment assignments.
      </p>
    </div>
  );
}
