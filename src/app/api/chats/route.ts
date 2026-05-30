import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/http";
import { DEFAULT_MODEL } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";
import { serializeChat } from "@/lib/serializers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ chats: chats.map(serializeChat) });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      model?: string;
    };

    const title = body.title?.trim() || "New chat";
    const model = body.model?.trim() || DEFAULT_MODEL;

    if (title.length > 120) {
      return badRequest("Title must be 120 characters or fewer.");
    }

    const chat = await prisma.chat.create({
      data: { title, model },
    });

    return NextResponse.json({ chat: serializeChat(chat) }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
