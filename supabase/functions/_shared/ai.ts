// ============================================================================
// Helper centralizado para llamadas a IA desde edge functions.
//
// Proveedor: Google Gemini via su endpoint OpenAI-compatible.
// Docs:      https://ai.google.dev/gemini-api/docs/openai
//
// Ventaja: el formato (messages, tools, tool_choice, response.choices[0].message)
// es idéntico al que ya usan las funciones → cambio mínimo al migrar.
//
// Env obligatoria:
//   GEMINI_API_KEY  — generala en https://aistudio.google.com/apikey
//
// Modelos:
//   - gemini-2.5-pro      (top quality, default)
//   - gemini-2.5-flash    (rápido y barato, para clasificación/parse)
// ============================================================================

const DEFAULT_MODEL = "gemini-2.5-pro";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export class AiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AiError";
  }
}

/**
 * Normaliza el nombre del modelo para Gemini:
 * - `google/gemini-2.5-pro` → `gemini-2.5-pro` (remueve prefix del gateway viejo)
 * - `claude-sonnet-4-6`     → `gemini-2.5-pro` (fallback al default)
 * - `gemini-*` se respeta
 */
function normalizeModel(requested?: string): string {
  if (!requested) return DEFAULT_MODEL;
  const bare = requested.replace(/^google\//, "");
  if (bare.startsWith("gemini-")) return bare;
  // Modelos de otros providers caen al default de Gemini
  return DEFAULT_MODEL;
}

/**
 * Drop-in replacement para `fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {...})`.
 * Retorna un `Response` real, por lo que el código que hace `if (!resp.ok)` + `await resp.json()`
 * sigue funcionando sin cambios.
 *
 * Uso:
 *   const response = await lovableCompatFetch({ model, messages, tools, tool_choice, max_tokens });
 *   if (!response.ok) { ... }
 *   const data = await response.json();
 *   const toolCall = data.choices[0].message.tool_calls[0];
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

  try {
    return await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 45000),
      body: JSON.stringify(normalizedBody),
    });
  } catch (e: any) {
    const msg = e?.name === "TimeoutError" ? "Timeout esperando respuesta de la IA" : (e?.message ?? String(e));
    return new Response(
      JSON.stringify({ error: { message: msg } }),
      { status: 504, headers: { "Content-Type": "application/json" } },
    );
  }
}

// ─── Helpers opcionales para nuevas funciones ──────────────────────────
// (Mantenidas por compatibilidad con `case-strategy-ai` y `client-strategy-ai`.)

export interface AiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Wrapper sobre lovableCompatFetch que fuerza tool-use y retorna el input JSON
 * de la herramienta tipado como T. Útil para funciones nuevas que quieren
 * output estructurado garantizado.
 */
export async function anthropicTool<T = unknown>(
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
  // Si messages no incluye system, lo prepondemos
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

/** Shim para funciones que esperaban `resolvedModel(x)` devolviendo el nombre final. */
export function resolvedModel(model?: string): string {
  return normalizeModel(model);
}
