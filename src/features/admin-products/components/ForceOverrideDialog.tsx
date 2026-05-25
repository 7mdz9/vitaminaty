"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export function ForceOverrideDialog({
  open,
  reviewFlagsByProductId,
  hardBlockedProductIds,
  onCancel,
  onConfirm,
}: Readonly<{
  open: boolean;
  reviewFlagsByProductId: Record<string, string[]>;
  hardBlockedProductIds: string[];
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}>) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onCancel() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish with unresolved flags?</DialogTitle>
          <DialogDescription>
            Soft review flags require an explicit reason. Hard-blocked products are excluded
            server-side.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {Object.entries(reviewFlagsByProductId).map(([productId, flags]) => (
            <div
              className="rounded-admin-sm border border-admin-border p-2 text-admin-sm"
              key={productId}
            >
              <p className="truncate font-medium">{productId}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {flags.map((flag) => (
                  <Badge key={flag} variant="outline">
                    {flag.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          {hardBlockedProductIds.length > 0 ? (
            <div className="rounded-admin-sm border border-admin-danger p-2 text-admin-sm text-admin-danger">
              {hardBlockedProductIds.length} hard-blocked product
              {hardBlockedProductIds.length === 1 ? "" : "s"} excluded.
            </div>
          ) : null}
        </div>
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Override reason</span>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={reason.trim().length < 3}
          >
            Publish anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
