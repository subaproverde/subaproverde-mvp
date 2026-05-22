import { NextRequest, NextResponse } from "next/server";
import {
  mockAdminAppointments,
  mockAdminClients,
  mockAdminRemovals,
} from "@/app/admin/admin-data";
import { buildDailySummaryMessage } from "@/lib/adminNotificationMessages";

function isAuthorized(request: NextRequest) {
  const expected = process.env.ADMIN_NOTIFICATIONS_CRON_SECRET;
  if (!expected) return true;

  const authHeader = request.headers.get("authorization");
  const secretParam = request.nextUrl.searchParams.get("secret");

  return authHeader === `Bearer ${expected}` || secretParam === expected;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const message = buildDailySummaryMessage({
    appointments: mockAdminAppointments,
    clients: mockAdminClients,
    removals: mockAdminRemovals,
  });

  const origin = request.nextUrl.origin;
  const adminPhone = process.env.ADMIN_WHATSAPP_TO ?? "554388231544";
  const response = await fetch(`${origin}/api/admin/notifications/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: adminPhone,
      message,
    }),
  });

  const data = await response.json().catch(() => null);
  return NextResponse.json({
    ok: response.ok,
    type: "daily-summary",
    whatsapp: data,
    message,
  });
}
