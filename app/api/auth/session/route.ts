import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
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
