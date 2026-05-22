export const FEATURE_FLAGS = {
  public_storefront_enabled: {
    default: false,
    category: "surface",
    description: "Gate the public storefront until M3 sign-off.",
  },
  admin_portal_enabled: {
    default: true,
    category: "surface",
    description: "Gate the admin portal surface.",
  },
  commerce_enabled: {
    default: false,
    category: "surface",
    description: "Gate commerce paths until M5 payment sign-off.",
  },
  customer_signup_enabled: {
    default: false,
    category: "surface",
    description: "Gate customer self-signup.",
  },
  support_chat_enabled: {
    default: false,
    category: "surface",
    description: "Gate the support chat placeholder bubble.",
  },
  cart_visible: {
    default: false,
    category: "feature",
    description: "Gate cart visibility.",
  },
  checkout_enabled: {
    default: false,
    category: "feature",
    description: "Gate checkout entry points.",
  },
  paymob_live_mode: {
    default: false,
    category: "feature",
    description: "Gate live Paymob processing.",
  },
  icarry_live_mode: {
    default: false,
    category: "feature",
    description: "Gate live iCarry processing.",
  },
  transactional_emails_enabled: {
    default: false,
    category: "feature",
    description: "Gate transactional email sends.",
  },
  notify_me_enabled: {
    default: false,
    category: "feature",
    description: "Gate notify-me flows.",
  },
  reviews_enabled: {
    default: false,
    category: "feature",
    description: "Gate reviews.",
  },
  promo_codes_enabled: {
    default: false,
    category: "feature",
    description: "Gate promo codes.",
  },
  wishlist_enabled: {
    default: false,
    category: "feature",
    description: "Gate wishlist.",
  },
  arabic_rtl_enabled: {
    default: false,
    category: "feature",
    description: "Gate Arabic RTL surfaces.",
  },
  same_day_delivery_enabled: {
    default: false,
    category: "feature",
    description: "Gate same-day delivery.",
  },
  customer_mfa_enabled: {
    default: false,
    category: "feature",
    description: "Gate customer MFA.",
  },
  maintenance_mode: {
    default: false,
    category: "operational",
    description: "Incident-only maintenance mode.",
  },
  read_only_mode: {
    default: false,
    category: "operational",
    description: "Incident-only read-only mode.",
  },
  feature_flag_admin_ui: {
    default: true,
    category: "operational",
    description: "Gate the admin feature-flag UI.",
  },
} as const satisfies Record<
  string,
  {
    readonly default: boolean;
    readonly category: "surface" | "feature" | "operational";
    readonly description: string;
  }
>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
