import { NextRequest } from "next/server";
import { authErrorResponse, requireAdminRequest } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const admin = await requireAdminRequest(req);
    if (admin.ok !== true) return authErrorResponse(admin);
  }

  // ⚠️ Essa rota roda no server, mas a sessão do seu setup está no browser/localStorage.
  // Então aqui a gente só devolve info do request (cookies) pra diagnosticar.
  const cookies = req.cookies.getAll().map((c) => ({ name: c.name, hasValue: !!c.value }));

  return Response.json({
    ok: true,
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    cookies,
    note:
      "Se sua auth está em localStorage, cookies aqui normalmente virão vazios. O login tem que acontecer no MESMO domínio (ngrok) que você está abrindo o dashboard.",
  });
}
