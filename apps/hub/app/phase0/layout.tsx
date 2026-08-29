import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Internal architecture harness",
};

export default function PhaseZeroLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return children;
}
