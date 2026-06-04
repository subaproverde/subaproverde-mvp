import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest } from "@/lib/apiAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    const admin = await requireAdminRequest(req);
    if (!admin.ok) return authErrorResponse(admin);
  }

  return NextResponse.json({
    hasMlClientId: Boolean(process.env.ML_CLIENT_ID),
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
  });
}
