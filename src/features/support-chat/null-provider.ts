/**
 * SAFETY BOUNDARIES from AI_SUPPORT_FUTURE_SPEC.md:
 * - Refuse anything in SUPPORT_SCOPE.topics_refused.
 * - Give no medical advice, including dosage, diagnosis, treatment, drug interactions,
 *   pregnancy safety, pediatric use, or specific health-condition guidance.
 * - Never invent product claims; future real providers may only state facts present in productContext.
 * - Refuse out-of-scope topics and route customers to a human where needed.
 */
import { logger } from "@/lib/logger";
import { SUPPORT_SCOPE } from "@/features/support-chat/safety-boundaries";
import type {
  AssistantMessage,
  SupportChatProvider,
  SupportConversation,
  UserMessage,
} from "@/features/support-chat/provider";

export class NullSupportChatProvider implements SupportChatProvider {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async sendMessage(
    conversation: SupportConversation,
    userMessage: UserMessage,
  ): Promise<AssistantMessage> {
    logger.debug("support_chat.null_provider.message", {
      conversation_id: conversation.conversation_id,
      customer_id: conversation.customer_id,
      guest_session_id: conversation.guest_session_id,
      product_id: conversation.product_id,
      message: userMessage.content,
      safety_topics_refused: SUPPORT_SCOPE.topics_refused,
    });

    return {
      kind: "unavailable",
      content: "Support chat will be available soon — for now please email support@vitaminaty.ae.",
      created_at: new Date().toISOString(),
    };
  }
}
