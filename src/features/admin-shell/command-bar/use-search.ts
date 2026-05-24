"use client";

import { useMemo } from "react";
import type { AdminCommandItem } from "./search-actions";

export function useCommandSearch(items: AdminCommandItem[], query: string): AdminCommandItem[] {
  return useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return items.slice(0, 20);
    }

    return items
      .map((item) => ({ item, score: scoreItem(item, normalized) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .slice(0, 30)
      .map((entry) => entry.item);
  }, [items, query]);
}

function scoreItem(item: AdminCommandItem, query: string): number {
  const label = item.label.toLowerCase();
  const description = item.description.toLowerCase();
  const haystack = `${label} ${description} ${item.kind}`;

  if (label === query) {
    return 100;
  }

  if (label.startsWith(query)) {
    return 80;
  }

  if (haystack.includes(query)) {
    return 50;
  }

  const tokens = query.split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token)) ? 35 : 0;
}
