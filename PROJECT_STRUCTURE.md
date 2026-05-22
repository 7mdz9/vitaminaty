# PROJECT_STRUCTURE.md

**Project:** Vitaminaty production codebase
**Document version:** v1.0
**Purpose:** Authoritative file/folder layout for the Vitaminaty production app. Every executor (BOB v5 / Claude Code / Codex) must respect this structure when creating new files or moving existing ones.

---

## 1. Top-level principles

The layout is designed around five principles. These come first because they explain *why* the tree looks the way it does:

1. **Public storefront and admin portal share infrastructure but live in clearly distinct route groups.** Both use the same Next.js app, same database, same auth, but the public visitor and the admin operator never see each other's pages. Route groups (`(public)`, `(admin)`) make this physical.
2. **Feature modules under `src/features/` are the unit of work for milestones.** Each milestone touches one or more feature modules. A feature module owns its UI, server actions, types, and tests, and reaches into shared `lib/`, `server/`, and `components/` for cross-cutting concerns. This boundary is what lets v5 step prompts say "you are editing the `features/checkout/` module" cleanly.
3. **Adapters are pluggable.** Paymob and iCarry are defined as interfaces with stub implementations from day one. Swapping a stub for a real implementation never requires changes outside `src/lib/paymob/`, `src/lib/icarry/`, and the webhook handlers.
4. **The prototype HTML lives in the repo as design reference.** Not in `public/` (it's not served), but in `docs/reference/` where the AI agent can read it when designing components.
5. **Documentation and state files are first-class artifacts in `docs/`**, not afterthoughts. They're how v5 maintains continuity between milestones.

---

## 2. Full file tree

```txt
vitaminaty/
├── docs/                                  # Human + AI readable specs and state files
│   ├── PROJECT_STATE.md                   # v5 reads this every session
│   ├── LAST_SESSION.md                    # v5 reads this every session
│   ├── THREAT_MODEL.md                    # v5 reads this when HIGH_RIGOR security/payments fire
│   ├── ARCHITECTURE.md                    # System architecture overview
│   ├── PROJECT_STRUCTURE.md               # This file
│   ├── API_SPEC.md                        # Server actions + API route contracts
│   ├── DB_SCHEMA.md                       # Postgres schema, RLS policies, indexes
│   ├── ADMIN_PORTAL_SPEC.md               # Admin portal UX and data flows
│   ├── PAYMENT_SPEC.md                    # Paymob integration spec
│   ├── DELIVERY_SPEC.md                   # iCarry integration spec
│   ├── AI_SUPPORT_FUTURE_SPEC.md          # Future AI assistant boundaries
│   ├── ENVIRONMENT_VARIABLES.md           # Full env var inventory
│   ├── PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md   # Copied from prior work
│   ├── vitaminaty-website-plan-v2.md      # Copied from prior work
│   └── reference/
│       ├── vitaminaty-prototype.html      # The design reference prototype
│       └── product.md                     # Grouped catalog source for import
│
├── src/
│   ├── app/                               # Next.js App Router
│   │   ├── layout.tsx                     # Root layout — fonts, providers, html lang
│   │   ├── page.tsx                       # Homepage (public)
│   │   ├── globals.css                    # Tailwind base + design tokens from prototype
│   │   ├── not-found.tsx                  # 404 page
│   │   ├── error.tsx                      # Root error boundary
│   │   │
│   │   ├── (public)/                      # Public storefront route group
│   │   │   ├── layout.tsx                 # Public header/footer wrapper
│   │   │   ├── products/
│   │   │   │   ├── page.tsx               # Listing (category-wide or all)
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx           # PDP with adaptive rendering
│   │   │   ├── brands/
│   │   │   │   ├── page.tsx               # Brand directory
│   │   │   │   └── [brandSlug]/
│   │   │   │       └── page.tsx           # Brand landing
│   │   │   ├── categories/
│   │   │   │   └── [categorySlug]/
│   │   │   │       └── page.tsx           # Category listing
│   │   │   ├── search/
│   │   │   │   └── page.tsx               # Search results
│   │   │   ├── offers/
│   │   │   │   └── page.tsx               # Offers (empty state at launch)
│   │   │   ├── cart/
│   │   │   │   └── page.tsx               # Cart preview
│   │   │   ├── checkout/
│   │   │   │   └── page.tsx               # Multi-step checkout
│   │   │   ├── order-confirmation/
│   │   │   │   └── [orderId]/
│   │   │   │       └── page.tsx
│   │   │   ├── account/
│   │   │   │   ├── page.tsx               # Account dashboard
│   │   │   │   ├── orders/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [orderId]/page.tsx
│   │   │   │   └── addresses/page.tsx
│   │   │   └── (legal)/
│   │   │       ├── terms/page.tsx
│   │   │       ├── privacy/page.tsx
│   │   │       ├── returns/page.tsx
│   │   │       └── shipping/page.tsx
│   │   │
│   │   ├── (auth)/                        # Customer auth route group
│   │   │   ├── sign-in/page.tsx
│   │   │   ├── sign-up/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   ├── verify-email/page.tsx
│   │   │   └── callback/route.ts          # Supabase auth callback
│   │   │
│   │   ├── admin/                         # Admin portal — separate auth gate
│   │   │   ├── layout.tsx                 # Admin chrome — sidebar, header, MFA gate
│   │   │   ├── sign-in/page.tsx           # Admin signin (MFA-required)
│   │   │   ├── page.tsx                   # Dashboard
│   │   │   ├── products/
│   │   │   │   ├── page.tsx               # Product list with filters
│   │   │   │   ├── [productId]/
│   │   │   │   │   └── page.tsx           # Product editor
│   │   │   │   └── import/page.tsx        # MD import UI
│   │   │   ├── brands/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [brandId]/page.tsx
│   │   │   ├── categories/page.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [orderId]/page.tsx
│   │   │   ├── homepage/page.tsx          # Homepage curation (rails, featured brands)
│   │   │   ├── audit-log/page.tsx
│   │   │   ├── settings/
│   │   │   │   ├── feature-flags/page.tsx
│   │   │   │   ├── integrations/page.tsx  # Paymob, iCarry credentials
│   │   │   │   └── users/page.tsx         # Admin user management
│   │   │   └── support-chat/page.tsx      # Support conversations (Phase 2 AI)
│   │   │
│   │   ├── api/                           # Webhooks + health + special endpoints
│   │   │   ├── webhooks/
│   │   │   │   ├── paymob/route.ts        # Paymob webhook — signature-verified
│   │   │   │   └── icarry/route.ts        # iCarry webhook — signature-verified
│   │   │   ├── health/route.ts            # Liveness probe
│   │   │   └── sitemap.xml/route.ts       # Dynamic sitemap
│   │   │
│   │   └── opengraph-image.tsx            # Default OG image
│   │
│   ├── components/                        # Cross-feature UI components
│   │   ├── ui/                            # Primitive UI (button, input, dialog, etc.)
│   │   ├── layout/
│   │   │   ├── PublicHeader.tsx
│   │   │   ├── PublicFooter.tsx
│   │   │   ├── AdminSidebar.tsx
│   │   │   ├── AdminHeader.tsx
│   │   │   └── ChatBubble.tsx             # Support chat placeholder
│   │   ├── product/
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductMock.tsx            # Brand-color placeholder image
│   │   │   ├── ProductGallery.tsx
│   │   │   ├── VariantSelector.tsx
│   │   │   └── PriceDisplay.tsx
│   │   ├── cart/
│   │   │   ├── CartDrawer.tsx
│   │   │   └── CartItemRow.tsx
│   │   ├── checkout/
│   │   │   ├── CheckoutStep.tsx
│   │   │   └── OrderSummary.tsx
│   │   ├── admin/
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── FieldStatusIndicator.tsx
│   │   │   ├── CompletionScoreBadge.tsx
│   │   │   └── ImageUploader.tsx
│   │   └── forms/
│   │       └── (form primitives — input, select, checkbox, etc.)
│   │
│   ├── features/                          # Feature modules — unit of milestone work
│   │   ├── products/
│   │   │   ├── queries.ts                 # Data fetchers (server-side)
│   │   │   ├── actions.ts                 # Server actions
│   │   │   ├── render-mode.ts             # Cases A-G adaptive rendering logic
│   │   │   └── __tests__/
│   │   ├── brands/
│   │   ├── categories/
│   │   ├── search/
│   │   │   └── queries.ts                 # Search index + ranking
│   │   ├── cart/
│   │   │   ├── client-cart-store.ts       # Client-side cart state (C2)
│   │   │   ├── cart-types.ts              # Shape forward-compatible with C1
│   │   │   └── server-revalidate.ts       # Server-side cart revalidation
│   │   ├── checkout/
│   │   │   ├── actions.ts                 # Server actions — order creation
│   │   │   ├── totals.ts                  # Authoritative totals computation
│   │   │   ├── vat.ts                     # VAT 5% inclusive math
│   │   │   └── __tests__/
│   │   ├── orders/
│   │   │   ├── queries.ts
│   │   │   ├── actions.ts                 # Status transitions
│   │   │   └── emails.ts                  # Transactional email triggers
│   │   ├── admin-products/
│   │   │   ├── actions.ts                 # Edit, publish, archive
│   │   │   ├── completion-score.ts        # v1.1 §5.5
│   │   │   ├── field-status.ts            # v1.1 §5
│   │   │   └── status-transitions.ts      # v1.1 §4
│   │   ├── admin-orders/
│   │   ├── admin-brands/
│   │   ├── admin-categories/
│   │   ├── payments/
│   │   │   └── intent.ts                  # Payment intent creation via adapter
│   │   ├── delivery/
│   │   │   └── shipping-quote.ts          # Quote via iCarry adapter
│   │   ├── auth/
│   │   │   ├── customer-session.ts
│   │   │   ├── admin-session.ts           # MFA-gated
│   │   │   └── rbac.ts                    # Role checks
│   │   ├── audit-log/
│   │   │   └── record.ts                  # Audit log writer
│   │   ├── feature-flags/
│   │   │   ├── flags.ts                   # Flag definitions
│   │   │   └── eval.ts                    # Runtime flag evaluation
│   │   └── support-chat/
│   │       ├── provider.ts                # SupportChatProvider interface
│   │       ├── null-provider.ts           # Stub implementation
│   │       └── safety-boundaries.ts       # Documented constraints
│   │
│   ├── lib/                               # Lower-level, framework-adjacent utilities
│   │   ├── supabase/
│   │   │   ├── server.ts                  # Server-side client (service role)
│   │   │   ├── client.ts                  # Browser client (anon key)
│   │   │   ├── middleware.ts              # Session refresh middleware
│   │   │   └── types.generated.ts         # Generated from schema
│   │   ├── paymob/                        # Paymob adapter
│   │   │   ├── types.ts                   # Paymob domain types
│   │   │   ├── adapter.ts                 # PaymentAdapter interface
│   │   │   ├── paymob-adapter.ts          # Real Paymob implementation
│   │   │   ├── stub-adapter.ts            # Stub for M0-M4
│   │   │   ├── webhook-verify.ts          # Signature verification
│   │   │   └── __tests__/
│   │   ├── icarry/                        # iCarry adapter
│   │   │   ├── types.ts
│   │   │   ├── adapter.ts                 # ShippingAdapter interface
│   │   │   ├── icarry-adapter.ts          # Real iCarry implementation
│   │   │   ├── stub-adapter.ts            # Stub for M0-M5
│   │   │   ├── webhook-verify.ts
│   │   │   └── __tests__/
│   │   ├── auth/
│   │   │   ├── session.ts                 # Session helpers
│   │   │   ├── mfa.ts                     # MFA enrollment + verification
│   │   │   └── policies.ts                # Authz policies
│   │   ├── validation/                    # Zod schemas for runtime validation
│   │   │   ├── product.ts
│   │   │   ├── order.ts
│   │   │   ├── address.ts
│   │   │   └── webhook-payloads.ts
│   │   ├── money/
│   │   │   ├── aed.ts                     # AED integer money type
│   │   │   ├── vat.ts                     # VAT calculation primitives
│   │   │   └── format.ts                  # Display formatting
│   │   ├── slug.ts                        # Slug generation (immutable)
│   │   ├── email/                         # Transactional email
│   │   │   ├── send.ts
│   │   │   └── templates/
│   │   │       ├── order-confirmation.tsx
│   │   │       ├── password-reset.tsx
│   │   │       └── back-in-stock.tsx
│   │   ├── images/
│   │   │   ├── upload.ts                  # Supabase Storage upload
│   │   │   └── url.ts                     # CDN URL generation
│   │   ├── logger.ts                      # Structured logger
│   │   ├── env.ts                         # Type-safe env access
│   │   ├── errors.ts                      # Error classes
│   │   ├── rate-limit.ts                  # Rate limit primitives
│   │   ├── idempotency.ts                 # Idempotency key utilities
│   │   ├── crypto.ts                      # HMAC, hashing primitives
│   │   └── i18n/                          # Future Arabic support stubs
│   │       └── direction.ts               # LTR/RTL helpers
│   │
│   ├── server/                            # Server-only orchestration layer
│   │   ├── services/                      # Business logic services
│   │   │   ├── product-service.ts
│   │   │   ├── order-service.ts
│   │   │   ├── checkout-service.ts        # Authoritative server-side checkout
│   │   │   ├── payment-service.ts
│   │   │   ├── shipping-service.ts
│   │   │   ├── inventory-service.ts
│   │   │   └── audit-service.ts
│   │   └── repositories/                  # Database access boundary
│   │       ├── product-repository.ts
│   │       ├── order-repository.ts
│   │       ├── brand-repository.ts
│   │       ├── category-repository.ts
│   │       ├── customer-repository.ts
│   │       ├── admin-repository.ts
│   │       └── audit-log-repository.ts
│   │
│   └── types/                             # Shared TypeScript types
│       ├── product.ts                     # Maps to v1.1 §10 schema
│       ├── brand.ts                       # Maps to v1.1 §12.3
│       ├── category.ts
│       ├── order.ts
│       ├── cart.ts
│       ├── address.ts
│       ├── customer.ts
│       ├── admin.ts
│       ├── payment.ts
│       ├── shipment.ts
│       ├── audit-log.ts
│       ├── feature-flag.ts
│       └── support-chat.ts
│
├── supabase/                              # Supabase project artifacts
│   ├── config.toml                        # Supabase CLI config
│   ├── migrations/                        # SQL migrations
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_products_brands_categories.sql
│   │   ├── 0003_orders_cart_payments.sql
│   │   ├── 0004_audit_log.sql
│   │   ├── 0005_feature_flags.sql
│   │   ├── 0006_support_chat.sql
│   │   └── 0007_rls_policies.sql
│   ├── seed/
│   │   ├── brand-normalization.sql        # v1.1 §12.2 mapping
│   │   ├── categories.sql                 # v1.1 §13.2 public taxonomy
│   │   ├── goals.sql                      # v1.1 §15
│   │   └── feature-flags.sql              # Default flag values
│   ├── policies/                          # RLS policies (also in migrations, mirrored here)
│   │   └── README.md
│   └── functions/                         # Edge functions (if needed)
│       └── (none in MVP — server actions cover this)
│
├── scripts/                               # One-shot scripts
│   ├── import-products-from-md.ts         # MD → DB import (v1.1 §11)
│   ├── normalize-brands.ts                # Brand normalization re-run
│   ├── validate-catalog.ts                # Catalog integrity check
│   ├── generate-types.ts                  # Supabase type generation
│   ├── seed-admin-user.ts                 # Initial admin user creation
│   └── README.md
│
├── tests/
│   ├── unit/                              # Component + utility tests (Vitest)
│   ├── integration/                       # Server action + service tests
│   ├── e2e/                               # Playwright end-to-end tests
│   │   ├── public-browse.spec.ts
│   │   ├── checkout-stub.spec.ts
│   │   ├── admin-product-edit.spec.ts
│   │   └── paymob-webhook.spec.ts
│   └── fixtures/                          # Test data
│
├── public/                                # Statically served files
│   ├── images/
│   │   └── placeholders/                  # Brand-color product mocks (SVG)
│   ├── fonts/                             # Self-hosted fonts if not via next/font
│   ├── favicon.ico
│   ├── robots.txt
│   └── manifest.json
│
├── .env.example                           # All env vars with placeholders
├── .env.local                             # Local dev env (gitignored)
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── pnpm-lock.yaml
├── playwright.config.ts
├── vitest.config.ts
└── README.md
```

---

## 3. Where what lives — quick lookup

| If you need to... | Go to... |
|---|---|
| Add a public page | `src/app/(public)/...` |
| Add an admin page | `src/app/admin/...` |
| Add a webhook handler | `src/app/api/webhooks/...` |
| Create a server action | `src/features/{feature}/actions.ts` |
| Add cross-feature business logic | `src/server/services/{service}.ts` |
| Access the database | `src/server/repositories/{thing}-repository.ts` |
| Add a UI primitive | `src/components/ui/...` |
| Add a product-shaped component | `src/components/product/...` |
| Define a shared type | `src/types/{thing}.ts` |
| Add a Zod validation schema | `src/lib/validation/{thing}.ts` |
| Add a Supabase migration | `supabase/migrations/{NNNN}_{name}.sql` |
| Seed reference data | `supabase/seed/{thing}.sql` |
| Write a one-shot script | `scripts/{name}.ts` |
| Add a Paymob feature | `src/lib/paymob/...` |
| Add an iCarry feature | `src/lib/icarry/...` |
| Edit auth logic | `src/features/auth/` or `src/lib/auth/` |
| Edit feature flag definitions | `src/features/feature-flags/flags.ts` |
| Update documentation | `docs/...` |
| Reference the design prototype | `docs/reference/vitaminaty-prototype.html` |

---

## 4. Module boundary rules

These are enforced by code review and by `.eslintrc` import restrictions (set up in M0):

1. **`src/components/` may not import from `src/server/` or `src/features/*/actions.ts`.** Components are dumb. They receive data via props. Server actions and queries call them, not vice versa.
2. **`src/app/(public)/` route handlers may not import from `src/app/admin/`** and vice versa. The two surfaces are isolated by route group.
3. **Only `src/server/repositories/` may import from `src/lib/supabase/server.ts`** (the service-role client). All database access funnels through the repository layer. No leaking the service role client into routes, actions, or features.
4. **Only `src/lib/paymob/` and `src/lib/icarry/` may import their respective SDKs.** Everywhere else uses the `PaymentAdapter` / `ShippingAdapter` interfaces.
5. **`src/lib/money/` is the only place money math happens.** No raw arithmetic on `price_aed` outside this module.
6. **`src/features/feature-flags/eval.ts` is the only gate for flag-controlled code paths.** No env-var sniffing for feature toggles.
7. **`src/types/` may not import from anywhere except other type files.** Types are pure.
8. **`src/server/services/` may import from `src/server/repositories/` but not vice versa.** Repositories don't know about business logic.

---

## 5. Naming conventions

- **Files:** kebab-case (`product-service.ts`), except for React components which are PascalCase (`ProductCard.tsx`).
- **Folders:** kebab-case.
- **Route groups:** parenthesized (`(public)`, `(auth)`).
- **Server action files:** always `actions.ts` inside a feature folder.
- **Test files:** colocate as `__tests__/{name}.test.ts` inside the module they test, or in top-level `tests/` for integration/e2e.
- **Migration files:** `NNNN_snake_case_description.sql` where NNNN is zero-padded sequence.
- **Types:** PascalCase exports (`interface ProductRecord`, `type OrderStatus`).
- **Env vars:** SCREAMING_SNAKE_CASE, prefixed with `NEXT_PUBLIC_` for client-exposed, `VITAMINATY_` for server-only Vitaminaty-specific.

---

## 6. The prototype HTML in this tree

`docs/reference/vitaminaty-prototype.html` is the design source-of-truth. Production components reproduce its design tokens (colors, spacing, type), its IA (5-item nav, 2 mega menus, page structure), its copy patterns, and its interaction patterns. It is **not** served — visitors don't see it. It exists so:

- The AI agent can read it when building components ("the ProductCard in the prototype looks like this — here's the markup, build the React equivalent").
- Designers can compare the live production rendering against the original reference.
- Future redesigns have a starting point.

When the production design system stabilises (likely M2-M3), the prototype can be deprecated, but it stays in the repo until then.

---

## 7. What is NOT in this tree (intentional non-goals)

- **No `pages/` directory.** App Router only.
- **No `src/utils/` catch-all.** Utilities go to a specific `lib/` subfolder by domain.
- **No `src/hooks/` top-level.** Hooks live with the component or feature that owns them.
- **No `src/store/` or `src/redux/`.** State is server-driven via Server Components + URL state. Client state for cart is in `src/features/cart/client-cart-store.ts` (small, scoped).
- **No top-level `models/`.** Domain shapes live in `src/types/`.
- **No `src/contexts/`.** React contexts colocate with their providers in `src/features/`.
- **No CMS code.** Homepage curation lives in admin pages and writes to specific DB rows; no headless CMS at launch.

---

_End of `PROJECT_STRUCTURE.md` (v1.0)._
