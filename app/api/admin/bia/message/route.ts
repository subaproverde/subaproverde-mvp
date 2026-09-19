import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest } from "@/lib/apiAuth";
import { sendBiaCloudMessage } from "@/lib/biaCloud";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const body = await request.json();
    const result = await sendBiaCloudMessage({ caseId: body.caseId, message: body.message, userId: auth.user.id });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao conversar com a Bia." }, { status: 400 });
  }
}
