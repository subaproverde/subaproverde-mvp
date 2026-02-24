import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ML_CLIENT_ID: process.env.ML_CLIENT_ID ?? null,
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
  });
}