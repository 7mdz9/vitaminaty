import "server-only";

import { createSupabaseServerClient } from "@/server/db/supabase-server";
import type { Database, Json } from "@/lib/supabase/types.generated";
import type { SupportConversationRecord, SupportMessageRecord } from "@/types/support-chat";

type PublicClient = Pick<Awaited<ReturnType<typeof createSupabaseServerClient>>, "from">;
type SupportConversationRow = Database["public"]["Tables"]["support_conversations"]["Row"];
type SupportMessageRow = Database["public"]["Tables"]["support_messages"]["Row"];

const SUPPORT_CONVERSATION_COLUMNS = [
  "id",
  "customer_id",
  "guest_session_id",
  "status",
  "created_at",
  "closed_at",
].join(", ");

const SUPPORT_MESSAGE_COLUMNS = [
  "id",
  "conversation_id",
  "sender",
  "content",
  "context_refs",
  "created_at",
].join(", ");

export async function listCurrentCustomerSupportConversations(
  customerId: string,
  client?: PublicClient,
): Promise<SupportConversationRecord[]> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("support_conversations")
    .select(SUPPORT_CONVERSATION_COLUMNS)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Current customer support conversations query failed: ${error.message}`);
  }

  return (data as unknown as SupportConversationRow[]).map(mapSupportConversation);
}

export async function listCurrentCustomerSupportMessages(
  conversationId: string,
  client?: PublicClient,
): Promise<SupportMessageRecord[]> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("support_messages")
    .select(SUPPORT_MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Current customer support messages query failed: ${error.message}`);
  }

  return (data as unknown as SupportMessageRow[]).map(mapSupportMessage);
}

async function resolvePublicClient(client?: PublicClient): Promise<PublicClient> {
  return client ?? createSupabaseServerClient();
}

export function mapSupportConversation(row: SupportConversationRow): SupportConversationRecord {
  return {
    ...row,
    status:
      row.status === "closed" || row.status === "escalated" || row.status === "open"
        ? row.status
        : "open",
  };
}

export function mapSupportMessage(row: SupportMessageRow): SupportMessageRecord {
  return {
    ...row,
    sender:
      row.sender === "customer" ||
      row.sender === "system" ||
      row.sender === "admin" ||
      row.sender === "assistant"
        ? row.sender
        : "system",
    context_refs: row.context_refs
      ? mapJsonObject<Record<string, unknown>>(row.context_refs)
      : null,
  };
}

function mapJsonObject<T>(value: Json): T {
  return (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as T;
}
