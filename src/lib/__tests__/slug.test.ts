import { describe, expect, it } from "vitest";
import { generateSlug, RESERVED_PRODUCT_SLUGS, resolveSlugCollision } from "@/lib/slug";

describe("slug generation", () => {
  it("matches PRODUCT_CONTENT_SPEC section 26.1 generation rules", () => {
    expect(generateSlug("Applied Nutrition Critical Whey 2KG")).toBe(
      "applied-nutrition-critical-whey-2kg",
    );
    expect(generateSlug("Bucked Up! Woke AF / Blue Raz")).toBe("bucked-up-woke-af-blue-raz");
    expect(generateSlug("  NOW   Foods   Vitamin D-3  ")).toBe("now-foods-vitamin-d3");
    expect(generateSlug("عربي Applied Nutrition")).toBe("applied-nutrition");
  });

  it("truncates generated slugs to 100 characters", () => {
    const slug = generateSlug("a".repeat(120));

    expect(slug).toHaveLength(100);
    expect(slug).toBe("a".repeat(100));
  });

  it("resolves collisions with -2 and -3 suffixes", () => {
    const baseSlug = "critical-whey";

    expect(resolveSlugCollision(baseSlug, new Set())).toBe(baseSlug);
    expect(resolveSlugCollision(baseSlug, new Set([baseSlug]))).toBe("critical-whey-2");
    expect(resolveSlugCollision(baseSlug, new Set([baseSlug, "critical-whey-2"]))).toBe(
      "critical-whey-3",
    );
  });

  it("keeps collision-suffixed slugs within the 100-character limit", () => {
    const baseSlug = "a".repeat(100);
    const collided = resolveSlugCollision(baseSlug, [baseSlug]);

    expect(collided).toHaveLength(100);
    expect(collided.endsWith("-2")).toBe(true);
  });

  it("exports reserved product slugs from PRODUCT_CONTENT_SPEC section 26.3", () => {
    expect(RESERVED_PRODUCT_SLUGS.has("cart")).toBe(true);
    expect(RESERVED_PRODUCT_SLUGS.has("checkout")).toBe(true);
    expect(RESERVED_PRODUCT_SLUGS.has("sign-up")).toBe(true);
  });
});
