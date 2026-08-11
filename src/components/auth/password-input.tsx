"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function PasswordInput() {
  const [isVisible, setIsVisible] = useState(false);
  const label = isVisible ? "Hide password" : "Show password";

  return (
    <div className="relative">
      <input
        autoComplete="current-password"
        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 pr-12 text-slate-950 shadow-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
        id="login-password"
        name="password"
        type={isVisible ? "text" : "password"}
      />
      <button
        aria-label={label}
        aria-pressed={isVisible}
        className="absolute inset-y-0 right-0 flex size-11 items-center justify-center rounded-r-lg text-slate-600 outline-none hover:text-slate-950 focus-visible:ring-3 focus-visible:ring-primary/20"
        onClick={() => setIsVisible((visible) => !visible)}
        type="button"
      >
        {isVisible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
      </button>
    </div>
  );
}
