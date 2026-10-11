import { cn } from "@/lib/utils";

const tones = {
  blue: "bg-blue-100 border-blue-200 text-blue-800",
  emerald: "bg-emerald-100 border-emerald-300 text-emerald-800",
  purple: "bg-purple-100 border-purple-200 text-purple-800",
  rose: "bg-rose-100 border-rose-200 text-rose-800",
  slate: "bg-slate-100 border-slate-200 text-slate-700",
} as const;
const sizes = { sm: "size-8 text-[10px]", md: "size-9 text-xs", lg: "size-10 text-xs" } as const;

export function initialsOf(name: string) {
  return name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join("") || "?";
}

export function InitialsAvatar({ name, size = "md", tone = "blue" }: { name: string; size?: keyof typeof sizes; tone?: keyof typeof tones }) {
  return <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-full border font-extrabold", sizes[size], tones[tone])}>{initialsOf(name)}</span>;
}

/** A stable colour per person, so the same name always gets the same avatar tint. */
export function avatarTone(seed: string): keyof typeof tones {
  const order = ["blue", "purple", "emerald", "rose"] as const;
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return order[hash % order.length]!;
}
