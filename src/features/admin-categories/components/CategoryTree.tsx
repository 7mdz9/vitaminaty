"use client";

import Link from "next/link";
import type { KeyboardEvent } from "react";
import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Edit, GripVertical, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reorderCategories } from "@/features/admin-categories/actions";
import type { AdminCategoryListItem } from "@/server/repositories/category-repository";

type TreeCategory = AdminCategoryListItem & {
  children: TreeCategory[];
};

export function CategoryTree({ categories }: Readonly<{ categories: AdminCategoryListItem[] }>) {
  const [items, setItems] = useState(categories);
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const tree = useMemo(() => buildTree(items), [items]);

  function moveSibling(categoryId: string, direction: -1 | 1) {
    setItems((current) => {
      const category = current.find((candidate) => candidate.id === categoryId);
      if (!category) {
        return current;
      }

      const siblings = current
        .filter((candidate) => candidate.parent_id === category.parent_id)
        .sort(sortCategories);
      const index = siblings.findIndex((candidate) => candidate.id === categoryId);
      const target = index + direction;

      if (index < 0 || target < 0 || target >= siblings.length) {
        return current;
      }

      const nextSiblings = [...siblings];
      [nextSiblings[index], nextSiblings[target]] = [nextSiblings[target], nextSiblings[index]];

      return current.map((candidate) => {
        const siblingIndex = nextSiblings.findIndex((sibling) => sibling.id === candidate.id);
        return siblingIndex >= 0
          ? { ...candidate, sort_order: (siblingIndex + 1) * 10 }
          : candidate;
      });
    });
  }

  function indent(categoryId: string) {
    setItems((current) => {
      const category = current.find((candidate) => candidate.id === categoryId);
      if (!category) {
        return current;
      }

      const siblings = current
        .filter((candidate) => candidate.parent_id === category.parent_id)
        .sort(sortCategories);
      const index = siblings.findIndex((candidate) => candidate.id === categoryId);
      const previousSibling = siblings[index - 1];

      if (!previousSibling) {
        return current;
      }

      return current.map((candidate) =>
        candidate.id === categoryId
          ? {
              ...candidate,
              parent_id: previousSibling.id,
              parent_nav: previousSibling.parent_nav,
              sort_order: 10,
            }
          : candidate,
      );
    });
  }

  function outdent(categoryId: string) {
    setItems((current) => {
      const category = current.find((candidate) => candidate.id === categoryId);
      const parent = category?.parent_id
        ? current.find((candidate) => candidate.id === category.parent_id)
        : null;

      if (!category || !parent) {
        return current;
      }

      return current.map((candidate) =>
        candidate.id === categoryId
          ? {
              ...candidate,
              parent_id: parent.parent_id,
              parent_nav: parent.parent_nav,
              sort_order: parent.sort_order + 1,
            }
          : candidate,
      );
    });
  }

  function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    setItems((current) => {
      const dragged = current.find((candidate) => candidate.id === draggedId);
      const target = current.find((candidate) => candidate.id === targetId);

      if (!dragged || !target) {
        return current;
      }

      return current.map((candidate) =>
        candidate.id === dragged.id
          ? {
              ...candidate,
              parent_id: target.parent_id,
              parent_nav: target.parent_nav,
              sort_order: target.sort_order + 1,
            }
          : candidate,
      );
    });
    setDraggedId(null);
  }

  function handleKey(categoryId: string, event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === " ") {
      event.preventDefault();
      setGrabbedId((current) => (current === categoryId ? null : categoryId));
      return;
    }

    if (event.key === "Escape") {
      setGrabbedId(null);
      return;
    }

    if (grabbedId !== categoryId) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSibling(categoryId, -1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSibling(categoryId, 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      indent(categoryId);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      outdent(categoryId);
    }
  }

  function save() {
    setStatus(null);
    startTransition(async () => {
      const result = await reorderCategories({
        items: items.map((item) => ({
          categoryId: item.id,
          parentId: item.parent_id,
          sortOrder: item.sort_order,
        })),
      });

      setStatus(
        result.ok ? `Saved ${result.changedCategoryIds.length} categories.` : result.message,
      );
    });
  }

  return (
    <section className="rounded-admin-md border border-admin-border bg-admin-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border px-3 py-2">
        <div>
          <h3 className="font-admin-display text-lg text-admin-text">Category tree</h3>
          <p className="text-admin-sm text-admin-text-muted">
            Space grabs, arrows move, Escape cancels
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status ? <span className="text-admin-sm text-admin-text-muted">{status}</span> : null}
          <Button disabled={isPending} onClick={save} size="sm" type="button">
            <Save className="size-4" />
            Save order
          </Button>
        </div>
      </div>
      <div className="divide-y divide-admin-border">
        {tree.map((category) => (
          <CategoryNode
            category={category}
            draggedId={draggedId}
            grabbedId={grabbedId}
            key={category.id}
            level={0}
            onDragStart={setDraggedId}
            onDrop={dropOn}
            onIndent={indent}
            onKey={handleKey}
            onMove={moveSibling}
            onOutdent={outdent}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryNode({
  category,
  level,
  grabbedId,
  draggedId,
  onKey,
  onMove,
  onIndent,
  onOutdent,
  onDragStart,
  onDrop,
}: Readonly<{
  category: TreeCategory;
  level: number;
  grabbedId: string | null;
  draggedId: string | null;
  onKey: (categoryId: string, event: KeyboardEvent<HTMLDivElement>) => void;
  onMove: (categoryId: string, direction: -1 | 1) => void;
  onIndent: (categoryId: string) => void;
  onOutdent: (categoryId: string) => void;
  onDragStart: (categoryId: string | null) => void;
  onDrop: (categoryId: string) => void;
}>) {
  const grabbed = grabbedId === category.id;
  const dragging = draggedId === category.id;

  return (
    <>
      <div
        aria-grabbed={grabbed}
        className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-admin-accent"
        draggable
        onDragOver={(event) => event.preventDefault()}
        onDragStart={() => onDragStart(category.id)}
        onDrop={() => onDrop(category.id)}
        onKeyDown={(event) => onKey(category.id, event)}
        role="treeitem"
        aria-selected={grabbed}
        style={{ paddingLeft: `${12 + level * 24}px` }}
        tabIndex={0}
      >
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical
            className={dragging ? "size-4 text-admin-accent" : "size-4 text-admin-text-muted"}
          />
          <span className="truncate font-medium text-admin-text">{category.name}</span>
          <Badge variant="outline">{category.parent_nav}</Badge>
          <span className="text-admin-caption text-admin-text-muted tabular-nums">
            {category.product_count} products
          </span>
          {!category.is_visible ? <Badge variant="outline">hidden</Badge> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            aria-label="Move up"
            onClick={() => onMove(category.id, -1)}
            size="icon"
            variant="ghost"
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            aria-label="Move down"
            onClick={() => onMove(category.id, 1)}
            size="icon"
            variant="ghost"
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            aria-label="Outdent"
            onClick={() => onOutdent(category.id)}
            size="icon"
            variant="ghost"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Button
            aria-label="Indent"
            onClick={() => onIndent(category.id)}
            size="icon"
            variant="ghost"
          >
            <ArrowRight className="size-4" />
          </Button>
          <Button
            render={<Link href={`/admin/categories/${category.id}`} />}
            size="icon"
            variant="ghost"
          >
            <Edit className="size-4" />
          </Button>
        </div>
      </div>
      {category.children.map((child) => (
        <CategoryNode
          category={child}
          draggedId={draggedId}
          grabbedId={grabbedId}
          key={child.id}
          level={level + 1}
          onDragStart={onDragStart}
          onDrop={onDrop}
          onIndent={onIndent}
          onKey={onKey}
          onMove={onMove}
          onOutdent={onOutdent}
        />
      ))}
    </>
  );
}

function buildTree(categories: AdminCategoryListItem[]): TreeCategory[] {
  const byId = new Map<string, TreeCategory>();

  for (const category of categories) {
    byId.set(category.id, { ...category, children: [] });
  }

  const roots: TreeCategory[] = [];

  for (const category of byId.values()) {
    if (category.parent_id && byId.has(category.parent_id)) {
      byId.get(category.parent_id)?.children.push(category);
    } else {
      roots.push(category);
    }
  }

  for (const category of byId.values()) {
    category.children.sort(sortCategories);
  }

  return roots.sort(sortCategories);
}

function sortCategories(left: AdminCategoryListItem, right: AdminCategoryListItem): number {
  return left.sort_order - right.sort_order || left.name.localeCompare(right.name);
}
