export function getMlAuthUrl(params: { clientId: string; redirectUri: string; state: string }) {
  const url = new URL("https://auth.mercadolivre.com.br/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  return url.toString();
}

export function getRedirectUri(appUrl: string) {
  return `${appUrl.replace(/\/$/, "")}/api/ml/callback`;
}

export async function exchangeCodeForToken(args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}) {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", args.clientId);
  body.set("client_secret", args.clientSecret);
  body.set("code", args.code);
  body.set("redirect_uri", args.redirectUri);

  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || "Falha ao trocar code por token (Mercado Livre).");
  return json as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
    user_id?: number | string;
    refresh_token?: string;
  };
}
