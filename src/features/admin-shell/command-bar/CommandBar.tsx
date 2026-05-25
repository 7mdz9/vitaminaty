"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { getAdminCommandItems, type AdminCommandItem } from "./search-actions";
import { useCommandSearch } from "./use-search";

export function CommandBar({
  open,
  onOpenChange,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const router = useRouter();
  const [items, setItems] = useState<AdminCommandItem[]>([]);
  const [query, setQuery] = useState("");
  const [meta, setMeta] = useState<{ totalCount: number; decision: "client" } | null>(null);
  const [isPending, startTransition] = useTransition();
  const results = useCommandSearch(items, query);

  useEffect(() => {
    if (!open || items.length > 0) {
      return;
    }

    startTransition(() => {
      void getAdminCommandItems().then((result) => {
        setItems(result.items);
        setMeta({ totalCount: result.totalCount, decision: result.decision });
      });
    });
  }, [items.length, open]);

  function go(item: AdminCommandItem) {
    onOpenChange(false);
    setQuery("");
    router.push(item.href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command bar">
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search products, brands, categories, queues..."
          value={query}
          onValueChange={setQuery}
        />
        <div className="flex items-center justify-between px-3 py-2 text-admin-caption text-admin-text-muted">
          <span>
            {isPending ? "Loading..." : `${meta?.totalCount ?? items.length} searchable items`}
          </span>
          <span>{meta?.decision === "client" ? "Client search" : null}</span>
        </div>
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          {results.map((item) => (
            <CommandItem key={item.id} value={item.id} onSelect={() => go(item)}>
              <div className="min-w-0 flex-1">
                <p className="truncate">{item.label}</p>
                <p className="truncate text-admin-caption text-admin-text-muted">
                  {item.description}
                </p>
              </div>
              <Badge variant="outline">{item.kind}</Badge>
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
