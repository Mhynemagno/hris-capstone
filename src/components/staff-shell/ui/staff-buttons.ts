const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
export const staffButton = {
  primary: `${base} bg-blue-700 text-white shadow-md shadow-blue-900/20 hover:bg-blue-800`,
  dark: `${base} bg-slate-900 text-white shadow-md hover:bg-slate-800`,
  secondary: `${base} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100`,
  danger: `${base} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`,
  success: `${base} bg-emerald-600 text-white shadow-md shadow-emerald-900/20 hover:bg-emerald-700`,
} as const;
export const staffIconButton = "rounded-lg p-2 text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600";
