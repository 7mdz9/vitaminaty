export type SupportConversationStatus = "open" | "closed" | "escalated";

export interface SupportConversationRecord {
  id: string;
  customer_id: string | null;
  guest_session_id: string | null;
  status: SupportConversationStatus;
  created_at: string;
  closed_at: string | null;
}

export interface SupportMessageRecord {
  id: string;
  conversation_id: string;
  sender: "customer" | "system" | "admin" | "assistant";
  content: string;
  context_refs: Record<string, unknown> | null;
  created_at: string;
}
