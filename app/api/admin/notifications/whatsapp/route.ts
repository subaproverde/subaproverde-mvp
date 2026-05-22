import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/adminNotificationMessages";

type WhatsAppRequestBody = {
  phone?: string;
  message?: string;
  forceText?: boolean;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: string[];
};

function buildTextPayload(phone: string, message: string) {
  return {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: {
      preview_url: false,
      body: message,
    },
  };
}

function buildTemplatePayload({
  phone,
  templateName,
  templateLanguage,
  templateParams,
}: {
  phone: string;
  templateName: string;
  templateLanguage: string;
  templateParams: string[];
}) {
  return {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: templateLanguage,
      },
      components:
        templateParams.length > 0
          ? [
              {
                type: "body",
                parameters: templateParams.map((text) => ({
                  type: "text",
                  text,
                })),
              },
            ]
          : undefined,
    },
  };
}

function resolveSendPayload(phone: string, message: string, body: WhatsAppRequestBody) {
  const templateName =
    body.templateName?.trim() ||
    process.env.WHATSAPP_TEMPLATE_NAME?.trim() ||
    process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME?.trim();
  const templateLanguage =
    body.templateLanguage?.trim() ||
    process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() ||
    "pt_BR";
  const templateParams = Array.isArray(body.templateParams) ? body.templateParams : [message];

  if (!body.forceText && templateName) {
    return {
      sendType: "template",
      payload: buildTemplatePayload({
        phone,
        templateName,
        templateLanguage,
        templateParams,
      }),
      templateName,
      templateLanguage,
    };
  }

  return {
    sendType: "text",
    payload: buildTextPayload(phone, message),
    templateName: null,
    templateLanguage: null,
  };
}

async function sendViaMetaCloudApi(phone: string, message: string, body: WhatsAppRequestBody) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0";
  const resolved = resolveSendPayload(phone, message, body);

  if (!accessToken || !phoneNumberId) {
    return {
      ok: true,
      mode: "mock",
      provider: "meta-cloud-api",
      sendType: resolved.sendType,
      templateName: resolved.templateName,
      templateLanguage: resolved.templateLanguage,
      whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      note: "Configure WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID para envio real.",
    };
  }

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resolved.payload),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      mode: "live",
      provider: "meta-cloud-api",
      sendType: resolved.sendType,
      templateName: resolved.templateName,
      templateLanguage: resolved.templateLanguage,
      status: response.status,
      error: data,
    };
  }

  return {
    ok: true,
    mode: "live",
    provider: "meta-cloud-api",
    sendType: resolved.sendType,
    templateName: resolved.templateName,
    templateLanguage: resolved.templateLanguage,
    data,
  };
}

export async function GET() {
  const hasAccessToken = Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
  const hasPhoneNumberId = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const hasDefaultTo = Boolean(process.env.ADMIN_WHATSAPP_TO);
  const templateName =
    process.env.WHATSAPP_TEMPLATE_NAME ?? process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME ?? null;

  return NextResponse.json({
    ok: true,
    mode: hasAccessToken && hasPhoneNumberId ? "live-ready" : "mock",
    hasAccessToken,
    hasPhoneNumberId,
    hasDefaultTo,
    templateName,
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "pt_BR",
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as WhatsAppRequestBody;
    const phone = normalizePhone(body.phone ?? process.env.ADMIN_WHATSAPP_TO ?? "");
    const message = body.message?.trim();

    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Número de WhatsApp ausente." },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Mensagem de WhatsApp ausente." },
        { status: 400 }
      );
    }

    const result = await sendViaMetaCloudApi(phone, message, body);
    const status = result.ok ? 200 : 502;
    return NextResponse.json({ ...result, phone }, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
