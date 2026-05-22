"use client";

import { useState } from "react";

type ChatBubbleProps = Readonly<{
  visible: boolean;
  unavailableMessage: string;
}>;

export function ChatBubble({ visible, unavailableMessage }: ChatBubbleProps) {
  const [open, setOpen] = useState(false);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-[min(22rem,calc(100vw-2.5rem))] flex-col items-end gap-3">
      {open ? (
        <section className="w-full rounded-card border border-border bg-surface-card p-4 font-body text-body-sm text-text-primary shadow-modal">
          <p className="font-semibold text-deep-maroon">Vitaminaty support</p>
          <p className="mt-2 leading-relaxed text-text-secondary">{unavailableMessage}</p>
        </section>
      ) : null}
      <button
        type="button"
        className="rounded-pill bg-action px-5 py-3 font-body text-body-sm font-semibold text-text-inverse shadow-card transition hover:bg-deep-maroon focus:outline-none focus:ring-2 focus:ring-action focus:ring-offset-2"
        aria-expanded={open}
        aria-label="Open support chat"
        onClick={() => setOpen((current) => !current)}
      >
        Need help?
      </button>
    </div>
  );
}
