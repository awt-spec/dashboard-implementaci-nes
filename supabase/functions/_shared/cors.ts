// CORS helper — lee ALLOWED_ORIGINS (coma-separadas) del entorno.
// En dev (si ALLOWED_ORIGINS no está configurado) se permite localhost.
// En prod, cualquier origen no listado recibe "null" → el browser bloquea.

const rawAllowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DEV_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function resolveOrigin(origin: string): string {
  if (rawAllowed.length > 0) {
    return rawAllowed.includes(origin) ? origin : "null";
  }
  return DEV_ORIGIN_REGEX.test(origin) ? origin : "null";
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": resolveOrigin(origin),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function corsPreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { headers: corsHeaders(req) });
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}
