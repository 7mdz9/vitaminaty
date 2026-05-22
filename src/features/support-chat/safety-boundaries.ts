export const SUPPORT_SCOPE = {
  topics_allowed: [
    "vitaminaty_products",
    "vitaminaty_brands",
    "vitaminaty_categories",
    "order_status",
    "shipping_and_delivery",
    "returns_and_refunds",
    "payment_methods",
    "account_management",
    "general_policies",
  ],
  topics_refused: [
    "medical_advice",
    "dosage_recommendations",
    "health_diagnoses",
    "treatment_plans",
    "drug_interactions",
    "pregnancy_safety",
    "pediatric_use",
    "unrelated_topics",
  ],
  product_claims_policy: {
    only_from: ["product.label_data", "product.content.benefits", "product.content.description"],
    never_invent: true,
    never_extrapolate: true,
  },
  escalation_triggers: [
    "customer_says_unwell",
    "customer_requests_human",
    "customer_uses_words_like_doctor_pharmacist_medical",
    "customer_mentions_pregnancy_or_children",
    "customer_mentions_existing_medication",
    "assistant_confidence_below_threshold",
    "three_failed_helpful_responses_in_row",
  ],
} as const;

export const MEDICAL_ADVICE_SAFETY_BLOCK =
  "That sounds like a question best answered by a healthcare professional — supplements interact with individual health situations, and I'm not qualified to advise. I can help you understand what's in any of our products, but for whether it's right for you, please check with your doctor or pharmacist. Would you like me to connect you with our team for anything else?";

export const OUT_OF_SCOPE_RESPONSE_TEMPLATE =
  "I focus on helping with Vitaminaty products and orders. For [topic], you'd want a different resource. Is there anything about our catalog or your orders I can help with?";

export const SUPPORT_CHAT_GREETING =
  "Hi! I'm Vitaminaty's catalog assistant. I can help with products, orders, and shipping. For health questions, please consult a healthcare professional.";
