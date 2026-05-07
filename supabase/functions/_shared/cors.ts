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

// ============================================================================
// Helper de IA (Gemini via OpenAI-compat endpoint).
// Vive acá porque la CLI de Supabase solo sube archivos _shared "conocidos"
// (cors.ts, auth.ts, ticketStatus.ts). Archivos nuevos en _shared no se
// bundlean aunque estén importados → workaround: todo el helper va en cors.ts.
// ============================================================================

const AI_DEFAULT_MODEL = "gemini-2.5-flash-lite";
const AI_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export class AiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AiError";
  }
}

export interface AiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

function normalizeModel(requested?: string): string {
  if (!requested) return AI_DEFAULT_MODEL;
  const bare = requested.replace(/^google\//, "");
  if (bare.startsWith("gemini-")) return bare;
  return AI_DEFAULT_MODEL;
}

/**
 * Drop-in replacement para `fetch(lovable-ai-gateway, {...})`. Devuelve un Response
 * con formato OpenAI que los consumidores ya saben parsear.
 */
export async function lovableCompatFetch(
  body: {
    model?: string;
    messages: Array<{ role: string; content: unknown }>;
    tools?: Array<any>;
    tool_choice?: any;
    max_tokens?: number;
    temperature?: number;
    [k: string]: unknown;
  },
  opts: { timeoutMs?: number } = {},
): Promise<Response> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    return new Response(
      JSON.stringify({ error: { message: "GEMINI_API_KEY no configurada" } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const normalizedBody = { ...body, model: normalizeModel(body.model) };
  const timeoutMs = opts.timeoutMs ?? 45000;

  // Retry con backoff exponencial para 503 (model overloaded) y 429.
  const DELAYS = [1500, 4000, 10000];
  let lastResp: Response | null = null;

  for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
    try {
      const resp = await fetch(AI_GEMINI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify(normalizedBody),
      });
      if (resp.ok) return resp;
      if (resp.status !== 503 && resp.status !== 429 && resp.status !== 500 && resp.status !== 502) {
        return resp;
      }
      lastResp = resp;
      if (attempt < DELAYS.length) {
        await new Promise((r) => setTimeout(r, DELAYS[attempt]));
        continue;
      }
      return resp;
    } catch (e: any) {
      const msg = e?.name === "TimeoutError" ? "Timeout esperando respuesta de la IA" : (e?.message ?? String(e));
      if (attempt < DELAYS.length) {
        await new Promise((r) => setTimeout(r, DELAYS[attempt]));
        continue;
      }
      return new Response(
        JSON.stringify({ error: { message: msg } }),
        { status: 504, headers: { "Content-Type": "application/json" } },
      );
    }
  }
  return lastResp ?? new Response(JSON.stringify({ error: { message: "unknown" } }), { status: 500 });
}

/**
 * Wrapper sobre lovableCompatFetch que fuerza tool-use y retorna el input JSON
 * tipado como T.
 *
 * Nota histórica: este helper se llamaba `anthropicTool` cuando el plan
 * original previó usar Claude. La implementación productiva usa Gemini
 * (OpenAI-compat). El rename refleja esto sin romper la abstracción.
 */
export async function aiTool<T = unknown>(
  opts: {
    model?: string;
    system: string;
    userPrompt?: string;
    messages?: Array<{ role: string; content: string }>;
    tool: { name: string; description: string; input_schema: Record<string, unknown> };
    maxTokens?: number;
    timeoutMs?: number;
  },
): Promise<{ result: T; usage: AiUsage }> {
  const messages = opts.messages ?? [
    { role: "system", content: opts.system },
    { role: "user", content: opts.userPrompt ?? "" },
  ];
  const hasSystem = messages.some((m) => m.role === "system");
  const finalMessages = hasSystem ? messages : [{ role: "system", content: opts.system }, ...messages];

  const resp = await lovableCompatFetch({
    model: opts.model,
    messages: finalMessages,
    max_tokens: opts.maxTokens ?? 4096,
    tools: [{
      type: "function",
      function: {
        name: opts.tool.name,
        description: opts.tool.description,
        parameters: opts.tool.input_schema,
      },
    }],
    tool_choice: { type: "function", function: { name: opts.tool.name } },
  }, { timeoutMs: opts.timeoutMs ?? 45000 });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    if (resp.status === 429) throw new AiError(429, "Rate limit excedido, intenta en unos minutos");
    if (resp.status === 401) throw new AiError(401, "GEMINI_API_KEY inválida");
    if (resp.status === 402 || resp.status === 403) throw new AiError(402, "Créditos o billing pendiente");
    throw new AiError(resp.status, `IA error ${resp.status}: ${txt.slice(0, 300)}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new AiError(502, "La IA no devolvió un tool_call válido");
  const args = typeof toolCall.function?.arguments === "string"
    ? JSON.parse(toolCall.function.arguments)
    : toolCall.function?.arguments;

  const usage = data.usage ?? {};
  return {
    result: args as T,
    usage: {
      prompt_tokens: usage.prompt_tokens ?? 0,
      completion_tokens: usage.completion_tokens ?? 0,
      total_tokens: usage.total_tokens ?? 0,
    },
  };
}

export function resolvedModel(model?: string): string {
  return normalizeModel(model);
}
