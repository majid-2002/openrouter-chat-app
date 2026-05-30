export type ChatAttachment = {
  id: string;
  messageId?: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  createdAt?: string;
};

export type ChatSummary = {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  attachments: ChatAttachment[];
};

export type ChatDetail = ChatSummary & {
  messages: ChatMessage[];
};

export type OpenRouterModel = {
  id: string;
  name: string;
  context_length?: number;
};

export type OpenRouterCredits = {
  totalCredits: number;
  totalUsage: number;
  remaining: number;
};
