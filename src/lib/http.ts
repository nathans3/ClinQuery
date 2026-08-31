import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
