import { NextRequest, NextResponse } from "next/server";

type MetaWebhookValue = {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: Array<{
    profile?: {
      name?: string;
    };
    wa_id?: string;
  }>;
  messages?: Array<{
    from?: string;
    id?: string;
    timestamp?: string;
    type?: string;
    text?: {
      body?: string;
    };
  }>;
  statuses?: Array<{
    id?: string;
    status?: "sent" | "delivered" | "read" | "failed";
    timestamp?: string;
    recipient_id?: string;
    conversation?: unknown;
    pricing?: unknown;
    errors?: Array<{
      code?: number;
      title?: string;
      message?: string;
      error_data?: {
        details?: string;
      };
    }>;
  }>;
};

type MetaWebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: MetaWebhookValue;
    }>;
  }>;
};

const webhookEvents: Array<{
  receivedAt: string;
  summary: unknown;
  payload: MetaWebhookBody;
}> = [];

function summarizePayload(payload: MetaWebhookBody) {
  const changes = payload.entry?.flatMap((entry) => entry.changes ?? []) ?? [];

  return changes.map((change) => {
    const value = change.value;

    return {
      field: change.field,
      phoneNumberId: value?.metadata?.phone_number_id,
      displayPhoneNumber: value?.metadata?.display_phone_number,
      messages: value?.messages?.map((message) => ({
        from: message.from,
        id: message.id,
        type: message.type,
        text: message.text?.body,
      })),
      statuses: value?.statuses?.map((status) => ({
        id: status.id,
        status: status.status,
        recipientId: status.recipient_id,
        errors: status.errors?.map((error) => ({
          code: error.code,
          title: error.title,
          message: error.message,
          details: error.error_data?.details,
        })),
      })),
    };
  });
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!mode && !token && !challenge) {
    return NextResponse.json({
      ok: true,
      recentEvents: webhookEvents.slice(-10).reverse(),
    });
  }

  if (mode === "subscribe" && token && token === expectedToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ ok: false, error: "Webhook verification failed." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as MetaWebhookBody;
  const summary = summarizePayload(payload);

  webhookEvents.push({
    receivedAt: new Date().toISOString(),
    summary,
    payload,
  });

  if (webhookEvents.length > 50) {
    webhookEvents.splice(0, webhookEvents.length - 50);
  }

  console.log("[whatsapp-webhook]", JSON.stringify(summary));

  return NextResponse.json({ ok: true });
}
