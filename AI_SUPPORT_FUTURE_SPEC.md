# AI_SUPPORT_FUTURE_SPEC.md

**Project:** Vitaminaty
**Document version:** v1.0
**Status:** **POST-MVP / FUTURE.** No AI is built or invoked in M0–M8. This document specifies how the system is **structurally prepared** during MVP so that a future AI implementation slots in cleanly, and what the eventual AI feature must look like when it ships.
**Owned by:** Post-MVP milestone (TBD, after M8 launch + readiness assessment)
**HIGH_RIGOR when built:** Yes — AI decisions surface affecting customer trust, brand reputation, and (critically) health-adjacent content.

---

## 1. What this document covers

Three layers:

1. **MVP preparation** — what M0–M8 ship to make a future AI assistant possible without rework.
2. **Future feature scope** — what the AI assistant will and will not do when built.
3. **Safety boundaries** — the non-negotiable guardrails the AI must enforce, especially around health and supplements.

This is a forward-looking spec. Nothing in this document is built before the post-MVP milestone is explicitly opened.

---

## 2. Why an AI assistant fits Vitaminaty's roadmap

Vitaminaty sells supplements. The two highest-friction questions customers ask are:

1. **"Which product should I take for X goal?"** — currently answered by category pages, goal pills, and bestseller rails. A targeted assistant could answer with one specific recommendation grounded in the actual catalog.
2. **"What's in this? Is it safe for me?"** — currently answered by PDP label-data sections. An assistant could answer questions in conversational form ("does this have soy?") without the customer parsing the panel.

A scoped, well-guarded assistant adds value. An unscoped, hallucinating one creates liability.

---

## 3. MVP preparation (what M0–M8 ship)

The following is built during MVP **as scaffolding only**, with no AI invocation. The post-MVP milestone fills in the AI behavior.

### 3.1 `SupportChatProvider` interface (built in M0)

```typescript
// src/features/support-chat/provider.ts
export interface SupportChatProvider {
  /**
   * Open or continue a conversation. The provider decides whether to spin
   * up a session, route to a human, or no-op.
   */
  startConversation(input: StartConversationInput): Promise<ConversationStarted>;

  /**
   * Submit a customer message. Returns an assistant response or an
   * escalation directive.
   */
  sendMessage(input: SendMessageInput): Promise<MessageResult>;

  /**
   * Mark a conversation as closed (by customer, admin, or system timeout).
   */
  closeConversation(conversationId: string): Promise<void>;
}

export interface StartConversationInput {
  customer_id?: string;             // null for guests
  guest_session_id?: string;
  initial_context?: {
    page: string;                   // current URL
    referrer?: string;
    product_id?: string;            // if started from a PDP
  };
}

export interface ConversationStarted {
  conversation_id: string;
  greeting: string;
  suggested_prompts: string[];      // canned questions to one-click
}

export interface SendMessageInput {
  conversation_id: string;
  customer_message: string;
}

export type MessageResult =
  | { kind: 'reply'; content: string; references?: Array<{ kind: 'product' | 'policy' | 'faq'; id: string; label: string }> }
  | { kind: 'escalate'; reason: EscalationReason; handoff_payload: HandoffPayload }
  | { kind: 'safety_block'; reason: SafetyReason; user_facing_message: string };

export type EscalationReason =
  | 'medical_question'              // anything that sounds like medical advice request
  | 'complaint'                     // unhappy customer
  | 'refund_request'                // wants money back
  | 'order_issue'                   // missing/damaged/wrong order
  | 'out_of_scope'                  // off-topic
  | 'low_confidence'                // assistant unsure
  | 'customer_request';             // customer explicitly asked for a human

export type SafetyReason =
  | 'medical_advice_attempt'        // assistant would have to opine on dosage/diagnosis/treatment
  | 'prohibited_topic'              // anything outside Vitaminaty scope
  | 'unsupported_product_claim'     // would have to invent claims not on label
  | 'pii_redaction'                 // customer pasted secrets
  | 'safety_filter_triggered';      // upstream model safety filter fired
```

### 3.2 Null implementation (built in M0)

```typescript
// src/features/support-chat/null-provider.ts
export class NullSupportChatProvider implements SupportChatProvider {
  async startConversation(input): Promise<ConversationStarted> {
    return {
      conversation_id: 'null-session',
      greeting: "Our support assistant isn't available yet. Please email support@vitaminaty.ae and we'll get back to you within 24 hours.",
      suggested_prompts: []
    };
  }
  async sendMessage(input): Promise<MessageResult> {
    return {
      kind: 'escalate',
      reason: 'out_of_scope',
      handoff_payload: { route: 'email', address: 'support@vitaminaty.ae' }
    };
  }
  async closeConversation(): Promise<void> { /* no-op */ }
}
```

### 3.3 Adapter selection (built in M0)

```typescript
// src/features/support-chat/index.ts
export function getSupportChatProvider(): SupportChatProvider {
  if (env.SUPPORT_CHAT_PROVIDER === 'anthropic') {
    return new AnthropicSupportChatProvider(env);  // built post-MVP
  }
  return new NullSupportChatProvider();
}
```

### 3.4 Database tables (built in M0 per `DB_SCHEMA.md` §8.3)

```sql
support_conversations(id, customer_id, guest_session_id, status, created_at, closed_at)
support_messages(id, conversation_id, sender, content, context_refs, created_at)
```

These tables sit empty during MVP. The null provider doesn't write to them. Post-MVP, the real provider writes every customer message and assistant response.

### 3.5 UI placeholder (built in M0)

```typescript
// src/components/chat/ChatBubble.tsx
'use client';
export function ChatBubble() {
  const enabled = useFeatureFlag('support_chat_enabled');
  if (!enabled) return null;
  return (
    <button className="..." onClick={openChatDrawer}>
      <ChatIcon /> Need help?
    </button>
  );
}
```

When `support_chat_enabled` is OFF (the MVP default), the bubble doesn't render at all. When ON with `SUPPORT_CHAT_PROVIDER='null'`, the bubble renders, opens a drawer, and the drawer immediately shows the "not available yet, email us" message — no input box.

When the real provider ships post-MVP, the same drawer gains an input box and full conversation UI.

### 3.6 Safety boundary constants (built in M0)

```typescript
// src/features/support-chat/safety.ts
export const SUPPORT_SCOPE = {
  topics_allowed: [
    'vitaminaty_products',
    'vitaminaty_brands',
    'vitaminaty_categories',
    'order_status',
    'shipping_and_delivery',
    'returns_and_refunds',
    'payment_methods',
    'account_management',
    'general_policies'
  ],
  topics_refused: [
    'medical_advice',
    'dosage_recommendations',
    'health_diagnoses',
    'treatment_plans',
    'drug_interactions',
    'pregnancy_safety',
    'pediatric_use',
    'unrelated_topics'
  ],
  product_claims_policy: {
    only_from: ['product.label_data', 'product.content.benefits', 'product.content.description'],
    never_invent: true,
    never_extrapolate: true        // "X is in this" doesn't license "therefore X does Y"
  },
  escalation_triggers: [
    'customer_says_unwell',
    'customer_requests_human',
    'customer_uses_words_like_doctor_pharmacist_medical',
    'customer_mentions_pregnancy_or_children',
    'customer_mentions_existing_medication',
    'assistant_confidence_below_threshold',
    'three_failed_helpful_responses_in_row'
  ]
} as const;
```

These constants exist in M0. The post-MVP AI implementation reads them and enforces them.

---

## 4. Future feature scope (when built post-MVP)

### 4.1 What the AI WILL do

- Answer questions about **specific products in our catalog** using only:
  - Product name, brand, category
  - Label data (nutrition panel, ingredients, allergens, directions, warnings) as the admin entered it
  - Description and benefits as the admin entered them (verified content only — never `draft` status fields)
- **Recommend products from our catalog** for a stated goal (e.g., "I want a chocolate whey protein under AED 200"). Recommendations use:
  - Product filters by category, goal tag, price, in-stock
  - The Featured/Bestseller rails as a soft prior
- Answer questions about **policies** (shipping times, return windows, payment methods) by citing the policy pages directly
- Answer **order status** questions for the signed-in customer by querying their own orders (RLS-enforced — assistant cannot see other customers' orders)
- **Hand off to a human** for anything outside scope
- **Refuse** anything in `topics_refused`

### 4.2 What the AI WILL NOT do

- Give medical advice. Not "should I take this?" Not "is this safe for me?" Not "will this interact with my medication?" Every such question routes to escalation with a polite explanation that the customer should consult a healthcare professional.
- Invent product information not in the database. If a customer asks "does this contain X?" and `label_data.ingredients` is empty, the assistant says "I don't have ingredient information for this product yet — please contact us and we'll check the label" and escalates.
- Make supplement-facts claims. "This protein has 25g protein per serving" is OK only if the nutrition panel says so. "This will help you build muscle faster than Brand Y" is never OK.
- Compare against competitors. The assistant operates within the Vitaminaty catalog only.
- Discuss other retailers, prices on other sites, or where to buy.
- Discuss pregnancy, children, elderly, or any specific health condition.
- Discuss dosage beyond what's on the product label's "Directions of use."
- Process refunds, modify orders, change addresses, cancel orders, or perform any account mutations. (These remain customer-self-service or admin-mediated.)

### 4.3 Tone

- Friendly, concise, professional.
- One short paragraph per response by default.
- Lists only when the customer asks for options or comparisons.
- No emojis (matches site tone).
- No "as an AI" disclaimers in normal responses. (The greeting once per session: "Hi! I'm Vitaminaty's catalog assistant. I can help with products, orders, and shipping. For health questions, please consult a healthcare professional.")

---

## 5. Safety boundaries (non-negotiable)

### 5.1 The medical-advice firewall

If the customer message matches any of these patterns (regex + classifier), the assistant **must** safety-block and offer to escalate. No exceptions, no clever reframing.

- Words: "doctor", "doc", "pharmacist", "GP", "physician", "diagnose", "diagnosis", "treatment", "cure", "prescribe", "prescription", "medication", "medicine", "drug", "illness", "disease", "condition", "symptom", "sick", "unwell"
- Phrases: "should I take", "is this safe for", "can I take this with", "I'm pregnant", "my child", "I have [condition]", "I take [medication]", "will this help my [condition]"

Safety-block response template:

> "That sounds like a question best answered by a healthcare professional — supplements interact with individual health situations, and I'm not qualified to advise. I can help you understand what's in any of our products, but for whether it's right for you, please check with your doctor or pharmacist. Would you like me to connect you with our team for anything else?"

### 5.2 The product-claim firewall

The assistant constructs every product statement from a structured fetch:

```typescript
const productContext = await productRepo.getForSupport(productId);
// returns ONLY:
// - name, brand, category
// - label_data (nutrition_panel, ingredients, allergens, directions, warnings)
// - content.description, content.benefits   (only if status = 'verified' or 'complete', NOT 'draft')
// - retail_price_aed, variants, in_stock state
```

The system prompt instructs the model: "You may only state facts present in `productContext`. If asked about something not present, respond: 'I don't have that information for this product. Would you like me to connect you with our team?'"

A post-response audit pass checks that every claim made by the assistant traces back to a value in `productContext`. If not, the response is replaced with a safety-block.

### 5.3 The scope firewall

The assistant refuses any topic outside `SUPPORT_SCOPE.topics_allowed`. The system prompt explicitly enumerates allowed topics and instructs refusal for everything else.

Examples of out-of-scope:
- Politics, news, religion
- General health advice
- Workout programming
- Diet plans
- Other retailers, comparisons with competitors
- Anything personal about the user beyond their own orders
- Anything about Vitaminaty staff, internal operations, finances

Refusal response template:

> "I focus on helping with Vitaminaty products and orders. For [topic], you'd want a different resource. Is there anything about our catalog or your orders I can help with?"

### 5.4 The PII firewall

If a customer pastes a credit card number, password, government ID, or other obvious PII in a message:

1. The assistant detects (regex for card patterns, common ID patterns).
2. The message is redacted in the DB before storage.
3. The assistant responds: "I noticed you may have shared sensitive information. Please don't share card numbers, passwords, or ID numbers in chat. I've removed it from our records. Could you describe what you need without the sensitive details?"

### 5.5 Confidence threshold

Each AI response carries an internal confidence score. If confidence < threshold (TBD at build time), the assistant escalates rather than answering.

### 5.6 Three-strike rule

If the assistant fails to give a satisfying answer three times in a row (signal: customer says "no", "that's not what I asked", repeats the question), the assistant escalates regardless of confidence.

---

## 6. Knowledge sources

The AI's knowledge is bounded and structured:

| Source | Content | Access |
|---|---|---|
| `products` table (filtered view) | Name, brand, category, label data, verified description/benefits, price, stock | Read-only via dedicated repository function `productRepo.getForSupport()` |
| `brands` table | Name, country of origin, descriptions | Read-only |
| `categories` table | Name, listing copy | Read-only |
| `goals` table | Name, description | Read-only |
| Policy pages | Shipping, returns, payment, privacy, T&Cs (curated FAQ derived from these) | Read-only, admin-curated FAQ |
| `orders` table (filtered to customer) | Customer's own orders only | RLS-enforced, signed-in only |
| Admin-curated FAQ | Hand-written Q&A pairs for common queries | Read-only |

The AI **does not** have access to:
- Other customers' orders
- Audit log
- Payment events (raw)
- Wholesale prices
- Internal admin notes on products
- `draft`-status field content
- Anything not in the `productRepo.getForSupport()` projection

### 6.1 Admin-curated FAQ

A separate admin surface at `/admin/support/faq` (Phase 2 build) lets admins write Q&A pairs that the AI will preference over generated answers. Useful for:
- "What are your shipping times?" → curated answer
- "How do I return a product?" → curated answer
- "Do you ship to [emirate]?" → curated answer

The FAQ table:

```sql
CREATE TABLE support_faqs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_canonical text NOT NULL,
  question_paraphrases text[] DEFAULT '{}',
  answer text NOT NULL,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

The AI's RAG step queries this table first; if a high-confidence match exists, the curated answer is returned verbatim.

---

## 7. Implementation outline (when built post-MVP)

### 7.1 Model selection

Default to Anthropic's Claude (Haiku for cost; Sonnet if quality demands). Reasoning:
- Strong safety/refusal behaviors out of the box
- Native tool use for the structured fetch pattern
- Reasonable cost for chat workloads

Provider abstraction stays via `SupportChatProvider`, so swapping providers later is a single-file change.

### 7.2 Conversation flow

```
1. Customer sends message
2. Pre-flight checks:
   a. Safety pattern match (medical-advice firewall)
   b. PII detection + redaction
   c. Rate limit check
3. If pre-flight passes:
   a. Retrieve admin-curated FAQ match (if any, return that)
   b. Otherwise, retrieve product context if a product is referenced or implied
   c. Build system prompt with safety scope + product context + policy snippets
   d. Call AI with customer message + system prompt
   e. Post-flight audit: does the response contain only claims traceable to context?
   f. If yes, return response
   g. If no, replace with safety-block and escalate
4. Persist message + response to support_messages
5. Update support_conversations.updated_at
```

### 7.3 Escalation handoff

When escalating, the assistant:

1. Tells the customer it's connecting them to a human.
2. Creates a record in `support_conversations` with `status = 'escalated'`.
3. Optionally drafts an email to support@vitaminaty.ae with the conversation context + customer info.
4. Customer is given a reference number and told to expect a response within 24 hours.

### 7.4 Admin oversight

- `/admin/support-chat` shows all conversations (Phase 2 build).
- Each conversation viewable in full with safety triggers highlighted.
- Admin can mark a conversation as "needs follow-up" or "resolved."
- Admin can flag specific exchanges as "AI got this wrong" — feeds into prompt-tuning or FAQ creation.

### 7.5 Cost controls

- Per-customer rate limit (e.g., 30 messages per day for guests, 100 per day for signed-in customers).
- Max tokens per response (e.g., 300 tokens).
- Auto-close idle conversations after 30 minutes (no AI cost for idle sessions).
- Monthly cost dashboard in admin settings.

---

## 8. Cross-references and dependencies

| Concern | Where it lives in MVP | Notes |
|---|---|---|
| `SupportChatProvider` interface | `src/features/support-chat/provider.ts` | Built M0 |
| Null implementation | `src/features/support-chat/null-provider.ts` | Built M0 |
| Database tables | `support_conversations`, `support_messages` per `DB_SCHEMA.md` §8.3 | Built M1 |
| UI placeholder | `src/components/chat/ChatBubble.tsx` | Built M0 |
| Safety constants | `src/features/support-chat/safety.ts` | Built M0 |
| Feature flag | `support_chat_enabled` per `DECISION_CAPTURE.md` §4 | Built M0 |
| Admin FAQ table + UI | Phase 2 / post-MVP | Not in MVP |
| Real AI implementation | Post-MVP milestone | Not in MVP |
| Admin oversight UI | Post-MVP | Not in MVP |

---

## 9. Why this is post-MVP

Reasoning for deferring the AI feature past launch:

1. **Catalog enrichment is the prerequisite.** The AI's value depends on product label data being complete. At MVP launch, much of the catalog is still being enriched. An AI that says "I don't have that info" for 60% of products is worse than no AI.
2. **Health-adjacent AI carries reputational risk.** Launching with a half-baked AI that even once gives a medical-sounding answer is a brand-damaging event. We want the product live and stable first, then layer in the AI carefully.
3. **Cost predictability.** AI inference costs are variable. Better to launch with predictable infrastructure costs, then add AI when revenue justifies it.
4. **The MVP UX is fine without it.** Category pages, goal pills, and search cover the primary discovery flows. Email-based support handles edge cases.

---

## 10. Decision gate to ship the AI feature

Before building this feature, the following must be true:

- [ ] At least 80% of published products have complete `label_data` (ingredients + nutrition panel + allergens).
- [ ] At least 6 months of operational data on what customers email/ask via support — informs the FAQ scope.
- [ ] Admin team has bandwidth to curate the FAQ and review flagged conversations.
- [ ] Legal review of the safety boundaries (especially medical-advice firewall) signed off.
- [ ] Budget for ongoing AI inference allocated.
- [ ] A dedicated milestone is opened with full HIGH_RIGOR posture.

Until those gates pass, this document is a forward-looking spec and the system runs with the null provider.

---

_End of `AI_SUPPORT_FUTURE_SPEC.md` v1.0._
