"use client";

import { createContext, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { CommandBar } from "./command-bar/CommandBar";
import type { ShortcutBinding } from "./use-shortcuts";

type ShortcutRegistry = Readonly<{
  bindings: ShortcutBinding[];
  register: (bindings: ShortcutBinding[]) => () => void;
}>;

export const ShortcutContext = createContext<ShortcutRegistry>({
  bindings: [],
  register: () => () => undefined,
});

export function KeyboardProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [registered, setRegistered] = useState<ShortcutBinding[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const register = useCallback((bindings: ShortcutBinding[]) => {
    setRegistered((current) => [...current, ...bindings]);

    return () => {
      setRegistered((current) => current.filter((binding) => !bindings.includes(binding)));
    };
  }, []);

  const defaultBindings = useMemo<ShortcutBinding[]>(
    () => [
      {
        key: "k",
        meta: true,
        label: "Open command bar",
        action: () => setCommandOpen(true),
      },
      {
        key: "?",
        shift: true,
        label: "Open shortcut help",
        action: () => setHelpOpen(true),
      },
      {
        key: "Escape",
        label: "Close overlay",
        action: () => {
          setCommandOpen(false);
          setHelpOpen(false);
        },
      },
    ],
    [],
  );
  const allBindings = useMemo(
    () => [...defaultBindings, ...registered],
    [defaultBindings, registered],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTextInput(event.target)) {
        return;
      }

      const binding = allBindings.find((candidate) => matchesShortcut(candidate, event));

      if (!binding) {
        return;
      }

      event.preventDefault();
      binding.action();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allBindings]);

  const value = useMemo(() => ({ bindings: allBindings, register }), [allBindings, register]);

  return (
    <ShortcutContext.Provider value={value}>
      {children}
      <CommandBar open={commandOpen} onOpenChange={setCommandOpen} />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {allBindings.map((binding) => (
              <div className="flex items-center justify-between gap-4" key={binding.label}>
                <span>{binding.label}</span>
                <Kbd>{formatShortcut(binding)}</Kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </ShortcutContext.Provider>
  );
}

function matchesShortcut(binding: ShortcutBinding, event: KeyboardEvent): boolean {
  const metaMatches = binding.meta
    ? event.metaKey || event.ctrlKey
    : !event.metaKey && !event.ctrlKey;
  const shiftMatches = binding.shift === undefined || binding.shift === event.shiftKey;

  return metaMatches && shiftMatches && event.key.toLowerCase() === binding.key.toLowerCase();
}

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

function formatShortcut(binding: ShortcutBinding): string {
  const parts = [];

  if (binding.meta) {
    parts.push("Cmd/Ctrl");
  }

  if (binding.shift) {
    parts.push("Shift");
  }

  parts.push(binding.key === " " ? "Space" : binding.key.toUpperCase());

  return parts.join(" + ");
}
