import { NextResponse } from "next/server";
import { serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

type OpenRouterModelsResponse = {
  data?: Array<{
    id: string;
    name?: string;
    context_length?: number;
  }>;
};

export async function GET() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `OpenRouter returned ${response.status}` },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as OpenRouterModelsResponse;
    const models =
      payload.data
        ?.filter((model) => model.id)
        .map((model) => ({
          id: model.id,
          name: model.name ?? model.id,
          context_length: model.context_length,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)) ?? [];

    return NextResponse.json({ models });
  } catch (error) {
    return serverError(error);
  }
}
