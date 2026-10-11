import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const staffInputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none disabled:opacity-60";

export function StaffLabel({ children, required, className, ...props }: ComponentProps<"label"> & { required?: boolean }) {
  return <label className={cn("mb-1.5 block text-xs font-semibold text-slate-700", className)} {...props}>{children}{required ? <span aria-hidden="true" className="text-rose-500"> *</span> : null}</label>;
}
export function StaffInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(staffInputClass, className)} {...props} />;
}
export function StaffTextarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(staffInputClass, "resize-y", className)} {...props} />;
}
export function StaffSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(staffInputClass, "cursor-pointer appearance-none pr-9 font-semibold", className)} {...props}>{children}</select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-slate-500" />
    </div>
  );
}
