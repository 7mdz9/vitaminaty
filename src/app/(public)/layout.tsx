import type { ReactNode } from "react";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { isEnabled } from "@/features/feature-flags/eval";
import { getSupportChatProvider } from "@/features/support-chat";

export default async function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supportChatVisible = await isEnabled("support_chat_enabled");
  const unavailableMessage = supportChatVisible ? await getUnavailableSupportMessage() : "";

  return (
    <>
      {children}
      <ChatBubble visible={supportChatVisible} unavailableMessage={unavailableMessage} />
    </>
  );
}

async function getUnavailableSupportMessage(): Promise<string> {
  const provider = getSupportChatProvider("null");
  const message = await provider.sendMessage(
    { conversation_id: "placeholder", guest_session_id: "public-layout" },
    { content: "support_chat_placeholder_opened" },
  );

  return message.content;
}
