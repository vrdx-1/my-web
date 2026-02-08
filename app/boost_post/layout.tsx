"use client";

import { BoostSlipProvider } from "./BoostSlipContext";

export default function BoostPostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BoostSlipProvider>{children}</BoostSlipProvider>;
}
