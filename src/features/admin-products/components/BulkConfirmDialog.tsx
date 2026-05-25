"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BulkConfirmDialog({
  open,
  count,
  actionLabel,
  onCancel,
  onConfirm,
}: Readonly<{
  open: boolean;
  count: number;
  actionLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  const [confirmed, setConfirmed] = useState(false);
  const needsDoubleConfirm = count > 20;

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onCancel() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{actionLabel}</DialogTitle>
          <DialogDescription>
            This will affect {count} selected product{count === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>
        {needsDoubleConfirm ? (
          <label className="flex items-center gap-2 text-admin-sm">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            <span>I understand this affects more than 20 products.</span>
          </label>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={needsDoubleConfirm && !confirmed}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
