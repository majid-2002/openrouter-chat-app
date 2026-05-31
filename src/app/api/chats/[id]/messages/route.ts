import { NextResponse } from "next/server";
import type {
  ChatCompletionContentPart,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { badRequest, notFound } from "@/lib/http";
import { getOpenRouterClient } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RequestAttachment = {
  name?: string;
  mimeType?: string;
  dataUrl?: string;
};

type OpenRouterWebSearchTool = {
  type: "openrouter:web_search";
  parameters: {
    engine: "auto";
    max_results: number;
    max_total_results: number;
  };
};

type OpenRouterCompletionParams = Omit<
  ChatCompletionCreateParamsStreaming,
  "tools"
> & {
  reasoning?: { effort: "medium" };
  tools?: OpenRouterWebSearchTool[];
};

type OpenRouterReasoningDetail = {
  type?: string;
  text?: string;
  summary?: string;
};

type OpenRouterDelta = {
  content?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
  reasoning_details?: OpenRouterReasoningDetail[] | null;
};

type StreamEvent =
  | { type: "content"; text: string }
  | { type: "reasoning"; text: string };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      content?: string;
      model?: string;
      think?: boolean;
      webSearch?: boolean;
      attachments?: RequestAttachment[];
    };

    const content = body.content?.trim();
    const attachmentsResult = validateAttachments(body.attachments ?? []);
    if ("error" in attachmentsResult) {
      return badRequest(attachmentsResult.error);
    }
    const attachments = attachmentsResult.attachments;

    if (!content && attachments.length === 0) {
      return badRequest("Message or image is required.");
    }

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { attachments: { orderBy: { createdAt: "asc" } } },
        },
      },
    });

    if (!chat) {
      return notFound("Chat not found.");
    }

    const model = body.model?.trim() || chat.model;
    const userMessage = await prisma.message.create({
      data: {
        chatId: chat.id,
        role: "user",
        content: content ?? "",
        attachments: {
          create: attachments.map((attachment) => ({
            name: attachment.name,
            mimeType: attachment.mimeType,
            dataUrl: attachment.dataUrl,
          })),
        },
      },
    });

    const shouldAutoTitle =
      chat.title === "New chat" && chat.messages.length === 0;
    if (shouldAutoTitle || model !== chat.model) {
      await prisma.chat.update({
        where: { id: chat.id },
        data: {
          title: shouldAutoTitle
            ? makeTitle(content || attachments[0]?.name || "Image chat")
            : undefined,
          model: model !== chat.model ? model : undefined,
        },
      });
    }

    const client = getOpenRouterClient();
    const messages: ChatCompletionMessageParam[] = [
      ...chat.messages.map((message) => {
        if (message.role === "user" && message.attachments.length > 0) {
          return {
            role: "user" as const,
            content: buildUserContent(message.content, message.attachments),
          };
        }

        return {
          role: message.role as "user" | "assistant" | "system",
          content: message.content,
        };
      }),
      { role: "user", content: buildUserContent(content ?? "", attachments) },
    ];
    const shouldCaptureReasoning = Boolean(body.think);

    const completionParams: OpenRouterCompletionParams = {
      model,
      messages,
      stream: true,
      ...(body.think
        ? {
            reasoning: {
              effort: "medium" as const,
            },
          }
        : {}),
      ...(body.webSearch
        ? {
            tools: [
              {
                type: "openrouter:web_search" as const,
                parameters: {
                  engine: "auto" as const,
                  max_results: 5,
                  max_total_results: 10,
                },
              },
            ],
          }
        : {}),
    };

    const upstreamAbortController = new AbortController();
    request.signal.addEventListener(
      "abort",
      () => upstreamAbortController.abort(),
      { once: true },
    );

    const stream = await client.chat.completions.create(
      completionParams as ChatCompletionCreateParamsStreaming,
      {
        signal: upstreamAbortController.signal,
      },
    );

    const encoder = new TextEncoder();
    let assistantContent = "";
    let assistantReasoning = "";

    function enqueueEvent(
      controller: ReadableStreamDefaultController,
      event: StreamEvent,
    ) {
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    }

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (request.signal.aborted) {
              break;
            }

            const delta = chunk.choices[0]?.delta as OpenRouterDelta | undefined;
            const reasoningDelta = shouldCaptureReasoning
              ? extractReasoningDelta(delta)
              : "";
            if (reasoningDelta) {
              assistantReasoning += reasoningDelta;
              enqueueEvent(controller, {
                type: "reasoning",
                text: reasoningDelta,
              });
            }

            const contentDelta = delta?.content ?? "";
            if (contentDelta) {
              assistantContent += contentDelta;
              enqueueEvent(controller, {
                type: "content",
                text: contentDelta,
              });
            }
          }

          if (
            !request.signal.aborted &&
            (assistantContent.trim() || assistantReasoning.trim())
          ) {
            await prisma.message.create({
              data: {
                chatId: chat.id,
                role: "assistant",
                content: assistantContent,
                reasoning: assistantReasoning,
              },
            });
          }

          controller.close();
        } catch (error) {
          if (isAbortError(error) || request.signal.aborted) {
            controller.close();
            return;
          }

          controller.error(error);
        }
      },
      cancel() {
        upstreamAbortController.abort();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-User-Message-Id": userMessage.id,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send message.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function extractReasoningDelta(delta: OpenRouterDelta | undefined) {
  if (!delta) {
    return "";
  }

  if (delta.reasoning) {
    return delta.reasoning;
  }

  if (delta.reasoning_content) {
    return delta.reasoning_content;
  }

  return (delta.reasoning_details ?? [])
    .map((detail) => detail.text ?? detail.summary ?? "")
    .join("");
}

function makeTitle(content: string) {
  const singleLine = content.replace(/\s+/g, " ").trim();
  return singleLine.length > 48 ? `${singleLine.slice(0, 45)}...` : singleLine;
}

function validateAttachments(
  attachments: RequestAttachment[],
): { attachments: Array<{ name: string; mimeType: string; dataUrl: string }> } | {
  error: string;
} {
  const allowedMimeTypes = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
  ]);

  const validatedAttachments = [];

  for (const attachment of attachments) {
    const name = attachment.name?.trim() || "Image";
    const mimeType = attachment.mimeType?.trim() || "";
    const dataUrl = attachment.dataUrl?.trim() || "";

    if (!allowedMimeTypes.has(mimeType)) {
      return { error: "Only PNG, JPEG, WEBP, and GIF images are supported." };
    }

    if (!dataUrl.startsWith(`data:${mimeType};base64,`)) {
      return { error: "Invalid image data." };
    }

    validatedAttachments.push({ name, mimeType, dataUrl });
  }

  return { attachments: validatedAttachments };
}

function buildUserContent(
  text: string,
  attachments: Array<{ dataUrl: string }>,
): string | ChatCompletionContentPart[] {
  if (attachments.length === 0) {
    return text;
  }

  return [
    { type: "text", text: text || "Please analyze this image." },
    ...attachments.map((attachment) => ({
      type: "image_url" as const,
      image_url: { url: attachment.dataUrl },
    })),
  ];
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException ||
    (error instanceof Error && error.name === "AbortError")
  );
}
