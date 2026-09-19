import { NextResponse } from "next/server";
import { authErrorResponse, requireAdminRequest } from "@/lib/apiAuth";
import { listBiaCloudCases, listBiaCloudMessages } from "@/lib/biaCloud";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const cases = await listBiaCloudCases();
    const caseId = new URL(request.url).searchParams.get("caseId") || cases[0]?.id;
    const messages = caseId ? await listBiaCloudMessages(caseId) : [];
    return NextResponse.json({ cases, activeCaseId: caseId || null, messages, configured: Boolean(process.env.OPENAI_API_KEY?.trim()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao carregar a Bia." }, { status: 503 });
  }
}
