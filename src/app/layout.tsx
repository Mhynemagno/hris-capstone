import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "San Juan City Police HRIS",
  description: "Human resources information system for San Juan City Police.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      data-scroll-behavior="smooth"
      lang="en"
      className={`${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
