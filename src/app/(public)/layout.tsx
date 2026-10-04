import { Inter, Montserrat } from "next/font/google";
import type { ReactNode } from "react";

// Loaded here, not in the root layout, so only the public portal downloads these two fonts.
const portalBody = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const portalHeading = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div className={`${portalBody.variable} ${portalHeading.variable} portal-type flex flex-1 flex-col`}>{children}</div>;
}
