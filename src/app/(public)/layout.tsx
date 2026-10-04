import type { ReactNode } from "react";

/** Public portal pages (landing and announcements) use the app's own theme and font. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
