"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setVariantStock } from "@/features/admin-products/actions";
import type { ProductVariantRecord } from "@/types/product";

export function StockEditCell({
  variant,
  onSaved,
}: Readonly<{
  variant: ProductVariantRecord;
  onSaved: (variant: ProductVariantRecord) => void;
}>) {
  const [value, setValue] = useState(variant.stock_quantity?.toString() ?? "0");
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "stale" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(variant.stock_quantity?.toString() ?? "0");
    setStatus("idle");
    setMessage(null);
  }, [variant.id, variant.stock_quantity]);

  function save(force = false) {
    const newQuantity = Number.parseInt(value, 10);

    if (Number.isNaN(newQuantity) || newQuantity < 0) {
      setStatus("error");
      setMessage("Enter 0 or more.");
      return;
    }

    setStatus("saving");
    setMessage(null);
    startTransition(async () => {
      const result = await setVariantStock({
        variantId: variant.id,
        expectedUpdatedAt: variant.updated_at,
        newQuantity,
        force,
      });

      if (result.ok) {
        setStatus("idle");
        setMessage("Saved");
        onSaved(result.variant);
        return;
      }

      setStatus(result.error === "stale_data" ? "stale" : "error");
      setMessage(result.message);
    });
  }

  return (
    <div className="flex min-w-32 items-center justify-end gap-2">
      <Input
        aria-label="Stock quantity"
        className={
          status === "dirty"
            ? "h-8 w-24 border-admin-accent text-right tabular-nums"
            : "h-8 w-24 text-right tabular-nums"
        }
        disabled={isPending}
        min={0}
        type="number"
        value={value}
        onBlur={() => {
          if (status === "dirty") {
            save(false);
          }
        }}
        onChange={(event) => {
          setValue(event.currentTarget.value);
          setStatus("dirty");
          setMessage(null);
        }}
      />
      {status === "stale" ? (
        <Button size="sm" type="button" variant="outline" onClick={() => save(true)}>
          Save anyway
        </Button>
      ) : null}
      {message ? (
        <span className="max-w-32 text-admin-caption text-admin-text-muted">{message}</span>
      ) : null}
    </div>
  );
}
