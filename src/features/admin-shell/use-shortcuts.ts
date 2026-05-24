"use client";

import { useContext, useEffect } from "react";
import { ShortcutContext } from "./keyboard-provider";

export type ShortcutBinding = Readonly<{
  key: string;
  meta?: boolean;
  shift?: boolean;
  label: string;
  action: () => void;
}>;

export function useShortcuts(bindings: ShortcutBinding[]): void {
  const context = useContext(ShortcutContext);

  useEffect(() => context.register(bindings), [bindings, context]);
}
