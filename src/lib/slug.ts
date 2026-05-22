export const RESERVED_PRODUCT_SLUGS = Object.freeze(
  new Set([
    "cart",
    "checkout",
    "account",
    "admin",
    "brands",
    "categories",
    "search",
    "legal",
    "api",
    "sign-in",
    "sign-up",
  ]),
);

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

export function resolveSlugCollision(
  baseSlug: string,
  existingSlugs: ReadonlySet<string> | readonly string[],
): string {
  const existing = new Set(existingSlugs);
  const hasExistingSlug = (slug: string) => existing.has(slug);

  if (!hasExistingSlug(baseSlug)) return baseSlug;

  let suffixNumber = 2;
  let candidate = withCollisionSuffix(baseSlug, suffixNumber);

  while (hasExistingSlug(candidate)) {
    suffixNumber += 1;
    candidate = withCollisionSuffix(baseSlug, suffixNumber);
  }

  return candidate;
}

function withCollisionSuffix(baseSlug: string, suffixNumber: number): string {
  const suffix = `-${suffixNumber}`;
  const root = baseSlug.substring(0, 100 - suffix.length).replace(/-+$/g, "");
  return `${root}${suffix}`;
}
