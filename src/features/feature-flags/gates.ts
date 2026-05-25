import type { FeatureFlagKey } from "@/features/feature-flags/flags";

export type HighRigorFeatureFlagGate = Readonly<{
  flagKey: FeatureFlagKey;
  signoffMilestone: "M3" | "M4" | "M5" | "M6" | "M7";
  signoffLabel: string;
  consequences: readonly string[];
  enablePhrase?: string;
}>;

export const HIGH_RIGOR_FEATURE_FLAG_GATES = {
  public_storefront_enabled: {
    flagKey: "public_storefront_enabled",
    signoffMilestone: "M3",
    signoffLabel: "M3 public storefront cross-check",
    consequences: [
      "Public catalog pages become reachable by customers and search engines.",
      "Product visibility, slug history, stock badges, and wholesale-column isolation must already be verified.",
    ],
  },
  customer_signup_enabled: {
    flagKey: "customer_signup_enabled",
    signoffMilestone: "M3",
    signoffLabel: "M3 customer auth and PII cross-check",
    consequences: [
      "Customers can create accounts and write customer-owned PII rows.",
      "Auth, RLS, and PDPL-sensitive paths must be signed off first.",
    ],
    enablePhrase: "ENABLE CUSTOMER SIGNUP",
  },
  checkout_enabled: {
    flagKey: "checkout_enabled",
    signoffMilestone: "M4",
    signoffLabel: "M4 checkout authority cross-check",
    consequences: [
      "Customers can enter checkout flows.",
      "Server-side totals, stock checks, VAT, and order creation authority must already be verified.",
    ],
    enablePhrase: "ENABLE CHECKOUT",
  },
  commerce_enabled: {
    flagKey: "commerce_enabled",
    signoffMilestone: "M5",
    signoffLabel: "M5 payment cross-check",
    consequences: [
      "Commerce-affecting paths can create real order and payment workflows.",
      "Payment, stock, idempotency, and webhook controls must be signed off first.",
    ],
    enablePhrase: "ENABLE COMMERCE",
  },
  paymob_live_mode: {
    flagKey: "paymob_live_mode",
    signoffMilestone: "M5",
    signoffLabel: "M5 Paymob live-mode cross-check",
    consequences: [
      "Payment processing switches from stub or sandbox behavior to live Paymob behavior.",
      "Webhook signature verification, idempotency, secret handling, and adversarial tests must be signed off first.",
    ],
    enablePhrase: "ENABLE PAYMOB LIVE",
  },
  icarry_live_mode: {
    flagKey: "icarry_live_mode",
    signoffMilestone: "M6",
    signoffLabel: "M6 iCarry live-mode cross-check",
    consequences: [
      "Shipment creation can use live iCarry integration behavior.",
      "Webhook, credential, PII, and operational failure paths must be signed off first.",
    ],
    enablePhrase: "ENABLE ICARRY LIVE",
  },
  transactional_emails_enabled: {
    flagKey: "transactional_emails_enabled",
    signoffMilestone: "M7",
    signoffLabel: "M7 transactional email cross-check",
    consequences: [
      "Customer-facing transactional email sends can leave the system.",
      "Email content, PII disclosure, deliverability, and retry behavior must be signed off first.",
    ],
    enablePhrase: "ENABLE TRANSACTIONAL EMAILS",
  },
} as const satisfies Partial<Record<FeatureFlagKey, HighRigorFeatureFlagGate>>;

export function getHighRigorFeatureFlagGate(key: FeatureFlagKey): HighRigorFeatureFlagGate | null {
  const gates: Partial<Record<FeatureFlagKey, HighRigorFeatureFlagGate>> =
    HIGH_RIGOR_FEATURE_FLAG_GATES;

  return gates[key] ?? null;
}

export function hasHighRigorSignoff(
  gate: HighRigorFeatureFlagGate,
  lastSessionText: string,
): boolean {
  const normalized = lastSessionText.toLowerCase();
  const milestone = gate.signoffMilestone.toLowerCase();

  return (
    normalized.includes(milestone) &&
    /(?:sign[\s-]?off|cross[\s-]?check).{0,80}(?:pass|passed|complete|completed|green|approved|signed)/i.test(
      lastSessionText,
    )
  );
}
