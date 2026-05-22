import type { ReactNode } from "react";

// TODO(M3): Public header/footer wrapper per PROJECT_STRUCTURE.md §2.
export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
