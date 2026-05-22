export interface SupportConversation {
  conversation_id: string;
  customer_id?: string;
  guest_session_id?: string;
  page?: string;
  product_id?: string;
}

export interface UserMessage {
  content: string;
  created_at?: string;
}

export interface AssistantMessage {
  kind: "reply" | "unavailable";
  content: string;
  created_at: string;
}

export interface SupportChatProvider {
  sendMessage(
    conversation: SupportConversation,
    userMessage: UserMessage,
  ): Promise<AssistantMessage>;
  isAvailable(): Promise<boolean>;
}
