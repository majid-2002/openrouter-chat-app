import { NextResponse } from "next/server";
import { badRequest, notFound, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { serializeChat, serializeChatDetail } from "@/lib/serializers";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    return NextResponse.json({ chat: serializeChatDetail(chat) });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      model?: string;
    };

    const data: { title?: string; model?: string } = {};

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) {
        return badRequest("Title cannot be empty.");
      }
      if (title.length > 120) {
        return badRequest("Title must be 120 characters or fewer.");
      }
      data.title = title;
    }

    if (body.model !== undefined) {
      const model = body.model.trim();
      if (!model) {
        return badRequest("Model cannot be empty.");
      }
      data.model = model;
    }

    const existingChat = await prisma.chat.findUnique({ where: { id } });
    if (!existingChat) {
      return notFound("Chat not found.");
    }

    const chat = await prisma.chat.update({
      where: { id },
      data,
    });

    return NextResponse.json({ chat: serializeChat(chat) });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existingChat = await prisma.chat.findUnique({ where: { id } });

    if (!existingChat) {
      return notFound("Chat not found.");
    }

    await prisma.chat.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
