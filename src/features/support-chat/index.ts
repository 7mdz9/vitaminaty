import { env } from "@/lib/env";
import { NotImplementedError } from "@/lib/errors";
import { NullSupportChatProvider } from "@/features/support-chat/null-provider";
import type { SupportChatProvider } from "@/features/support-chat/provider";

export function getSupportChatProvider(
  provider: "null" | "anthropic" = env.SUPPORT_CHAT_PROVIDER,
): SupportChatProvider {
  if (provider === "anthropic") {
    throw new NotImplementedError("Anthropic support chat provider lands post-MVP.");
  }

  return new NullSupportChatProvider();
}
