import type { ReactNode } from "react";

export function SectionCard({
  id,
  title,
  children,
}: Readonly<{
  id: string;
  title: string;
  children: ReactNode;
}>) {
  return (
    <section className="border-b border-admin-border p-4" id={id}>
      <h3 className="mb-3 font-admin-display text-admin-title text-admin-text">{title}</h3>
      {children}
    </section>
  );
}
