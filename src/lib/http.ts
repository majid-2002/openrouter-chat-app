import { NextResponse } from "next/server";

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Something went wrong on the server";

  return NextResponse.json({ error: message }, { status: 500 });
}
