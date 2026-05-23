import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import type { Database } from "@/lib/supabase/types.generated";
import type { SupportConversationRecord, SupportMessageRecord } from "@/types/support-chat";
import { mapSupportConversation, mapSupportMessage } from "./support-chat-repository";

type SupportConversationRow = Database["public"]["Tables"]["support_conversations"]["Row"];
type SupportConversationInsert = Database["public"]["Tables"]["support_conversations"]["Insert"];
type SupportConversationUpdate = Database["public"]["Tables"]["support_conversations"]["Update"];
type SupportMessageRow = Database["public"]["Tables"]["support_messages"]["Row"];
type SupportMessageInsert = Database["public"]["Tables"]["support_messages"]["Insert"];
type AdminClient = Pick<typeof supabaseAdmin, "from">;

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

export async function createSupportConversationForAdmin(
  row: SupportConversationInsert,
  client: AdminClient = supabaseAdmin,
): Promise<SupportConversationRecord> {
  const { data, error } = await client
    .from("support_conversations")
    .insert(row)
    .select(SUPPORT_CONVERSATION_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Support conversation insert failed: ${error.message}`);
  }

  return mapSupportConversation(data as unknown as SupportConversationRow);
}

export async function updateSupportConversationForAdmin(
  conversationId: string,
  patch: SupportConversationUpdate,
  client: AdminClient = supabaseAdmin,
): Promise<SupportConversationRecord> {
  const { data, error } = await client
    .from("support_conversations")
    .update(patch)
    .eq("id", conversationId)
    .select(SUPPORT_CONVERSATION_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Support conversation update failed: ${error.message}`);
  }

  return mapSupportConversation(data as unknown as SupportConversationRow);
}

export async function insertSupportMessageForAdmin(
  row: SupportMessageInsert,
  client: AdminClient = supabaseAdmin,
): Promise<SupportMessageRecord> {
  const { data, error } = await client
    .from("support_messages")
    .insert(row)
    .select(SUPPORT_MESSAGE_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Support message insert failed: ${error.message}`);
  }

  return mapSupportMessage(data as unknown as SupportMessageRow);
}

export async function listSupportMessagesForAdmin(
  conversationId: string,
  client: AdminClient = supabaseAdmin,
): Promise<SupportMessageRecord[]> {
  const { data, error } = await client
    .from("support_messages")
    .select(SUPPORT_MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Admin support messages query failed: ${error.message}`);
  }

  return (data as unknown as SupportMessageRow[]).map(mapSupportMessage);
}
