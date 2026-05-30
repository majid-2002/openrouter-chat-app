import { NextResponse } from "next/server";
import { serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

type OpenRouterCreditsResponse = {
  data?: {
    total_credits?: number;
    total_usage?: number;
  };
  error?: {
    message?: string;
  };
};

export async function GET() {
  try {
    const apiKey =
      process.env.OPENROUTER_MANAGEMENT_KEY ?? process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENROUTER_API_KEY in .env." },
        { status: 500 },
      );
    }

    const response = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    const payload = (await response
      .json()
      .catch(() => ({}))) as OpenRouterCreditsResponse;

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload.error?.message ??
            `OpenRouter credits returned ${response.status}`,
        },
        { status: response.status },
      );
    }

    const totalCredits = Number(payload.data?.total_credits ?? 0);
    const totalUsage = Number(payload.data?.total_usage ?? 0);

    return NextResponse.json({
      credits: {
        totalCredits,
        totalUsage,
        remaining: totalCredits - totalUsage,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
