import type { Chat, Message, MessageAttachment } from "@prisma/client";
import type { ChatDetail, ChatMessage, ChatSummary } from "./types";

export function serializeChat(chat: Chat): ChatSummary {
  return {
    id: chat.id,
    title: chat.title,
    model: chat.model,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}

export function serializeAttachment(attachment: MessageAttachment) {
  return {
    id: attachment.id,
    messageId: attachment.messageId,
    name: attachment.name,
    mimeType: attachment.mimeType,
    dataUrl: attachment.dataUrl,
    createdAt: attachment.createdAt.toISOString(),
  };
}

export function serializeMessage(
  message: Message & { attachments?: MessageAttachment[]; reasoning?: string },
): ChatMessage {
  return {
    id: message.id,
    chatId: message.chatId,
    role: message.role as ChatMessage["role"],
    content: message.content,
    reasoning: message.reasoning ?? "",
    createdAt: message.createdAt.toISOString(),
    attachments: message.attachments?.map(serializeAttachment) ?? [],
  };
}

export function serializeChatDetail(
  chat: Chat & {
    messages: Array<
      Message & { attachments: MessageAttachment[]; reasoning?: string }
    >;
  },
): ChatDetail {
  return {
    ...serializeChat(chat),
    messages: chat.messages.map(serializeMessage),
  };
}
