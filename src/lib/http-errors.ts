import { NextResponse } from "next/server";
import { AppError } from "@/services/errors";

// Shared mapper for Route Handlers: domain errors become their status/code,
// everything else becomes a sanitized 500 (no stack traces or DSNs leak).
export function toHttpError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    const status = error.status >= 500 ? 500 : error.status;
    const message =
      error.status >= 500 ? "Internal server error." : error.message;
    return NextResponse.json(
      { error: { code: error.code, message } },
      { status },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Internal server error." } },
    { status: 500 },
  );
}
