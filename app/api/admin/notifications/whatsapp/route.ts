import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/adminNotificationMessages";
import {
  authErrorResponse,
  hasInternalSecret,
  requireAdminRequest,
  type ApiAuthFailure,
} from "@/lib/apiAuth";

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

function getMetaError(data: unknown) {
  if (!data || typeof data !== "object" || !("error" in data)) return null;
  const error = (data as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  return error as {
    code?: number;
    message?: string;
    error_data?: {
      details?: string;
    };
  };
}

function shouldFallbackToText(data: unknown) {
  if (process.env.WHATSAPP_ALLOW_TEXT_FALLBACK === "false") return false;

  const error = getMetaError(data);
  const code = error?.code;
  const text = `${error?.message ?? ""} ${error?.error_data?.details ?? ""}`.toLowerCase();

  return (
    code === 132001 ||
    code === 132015 ||
    code === 132016 ||
    (text.includes("template") &&
      (text.includes("does not exist") ||
        text.includes("not exist") ||
        text.includes("not available") ||
        text.includes("pending")))
  );
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

  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  const sendPayload = (payload: unknown) =>
    fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

  let response = await sendPayload(resolved.payload);
  let data = await response.json().catch(() => null);
  let sendType = resolved.sendType;
  let templateName = resolved.templateName;
  let templateLanguage = resolved.templateLanguage;
  let fallbackFromTemplate = false;
  let templateError: unknown = null;

  if (!response.ok && resolved.sendType === "template" && shouldFallbackToText(data)) {
    fallbackFromTemplate = true;
    templateError = data;
    sendType = "text";
    templateName = null;
    templateLanguage = null;
    response = await sendPayload(buildTextPayload(phone, message));
    data = await response.json().catch(() => null);
  }

  if (!response.ok) {
    return {
      ok: false,
      mode: "live",
      provider: "meta-cloud-api",
      sendType,
      templateName,
      templateLanguage,
      fallbackFromTemplate,
      templateError,
      status: response.status,
      error: data,
    };
  }

  return {
    ok: true,
    mode: "live",
    provider: "meta-cloud-api",
    sendType,
    templateName,
    templateLanguage,
    fallbackFromTemplate,
    templateError,
    data,
  };
}

async function requireWhatsAppAccess(request: NextRequest): Promise<ApiAuthFailure | null> {
  if (
    hasInternalSecret(
      request,
      "ADMIN_NOTIFICATIONS_WHATSAPP_SECRET",
      "ADMIN_NOTIFICATIONS_CRON_SECRET",
      "CRON_SECRET"
    )
  ) {
    return null;
  }

  const admin = await requireAdminRequest(request);
  if (admin.ok === true) return null;
  return { ok: false, status: admin.status, error: admin.error };
}

export async function GET(request: NextRequest) {
  const denied = await requireWhatsAppAccess(request);
  if (denied) return authErrorResponse(denied);

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
    textFallbackEnabled: process.env.WHATSAPP_ALLOW_TEXT_FALLBACK !== "false",
  });
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireWhatsAppAccess(request);
    if (denied) return authErrorResponse(denied);

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
