"use client";

import type { ReactNode } from "react";
import { KeyboardProvider } from "./keyboard-provider";
import { AdminThemeProvider } from "./theme-provider";

export function AdminShellProviders({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AdminThemeProvider>
      <KeyboardProvider>{children}</KeyboardProvider>
    </AdminThemeProvider>
  );
}
