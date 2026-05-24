"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadProductImage, type AdminProductImageUploadResult } from "@/features/admin-products/actions";
import type { ProductImageKind } from "@/types/product";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ImageUploadField({
  productId,
  isPrimaryDefault = false,
  onUploaded,
}: Readonly<{
  productId: string;
  isPrimaryDefault?: boolean;
  onUploaded: (result: Extract<AdminProductImageUploadResult, { ok: true }>) => void;
}>) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setMessage("Use JPEG, PNG, or WebP.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("Image must be 10 MB or smaller.");
      return;
    }

    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });
    setMessage("Ready to upload");
    startTransition(() => {
      void upload(file);
    });
  }

  async function upload(file: File) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("file", file);
    formData.set("kind", "front" satisfies ProductImageKind);
    formData.set("isPrimary", String(isPrimaryDefault));

    const result = await uploadProductImage(formData);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setMessage("Uploaded");
    onUploaded(result);
  }

  return (
    <div
      className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-admin-md border border-dashed border-admin-border bg-admin-surface-muted p-4 text-center transition-colors hover:border-admin-accent"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        handleFile(event.dataTransfer.files.item(0) ?? undefined);
      }}
    >
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="max-h-32 rounded-admin-sm border border-admin-border object-contain" src={previewUrl} />
      ) : (
        <ImagePlus className="size-8 text-admin-text-muted" />
      )}
      <div>
        <p className="text-admin-sm font-medium text-admin-text">Drop or choose an image</p>
        {message ? <p className="text-admin-caption text-admin-text-muted">{message}</p> : null}
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={(event) => handleFile(event.target.files?.item(0) ?? undefined)}
      />
      <Button
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        size="sm"
        type="button"
        variant="outline"
      >
        <Upload className="size-4" />
        {isPending ? "Uploading" : "Choose file"}
      </Button>
    </div>
  );
}
