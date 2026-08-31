import { NextResponse } from "next/server";
import { AUTH_COOKIE, isValidPassword, sessionToken } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };
  const password = body.password?.trim() ?? "";

  if (!isValidPassword(password)) {
    return jsonError("Incorrect password.", 401);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return response;
}
