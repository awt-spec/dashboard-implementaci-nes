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
// Helper de IA — Anthropic Messages API (Claude)
//
// Migración 2026-05-06: reemplazado Google Gemini (OpenAI-compat) por
// Anthropic Messages API native con default `claude-haiku-4-5`.
//
// Vive acá (no en _shared/ai.ts) porque la CLI de Supabase solo bundlea
// archivos _shared "conocidos" (cors.ts, auth.ts, ticketStatus.ts). Archivos
// nuevos en _shared no se suben aunque estén importados → workaround: todo
// el helper va en cors.ts.
//
// Dos formas de llamar:
//   1) `aiTool<T>({ system, userPrompt, tool, ... })` — fuerza tool_use y
//      retorna el input parseado tipado como T. Usa Anthropic native con
//      prompt caching automático en el system block.
//   2) `lovableCompatFetch(body)` — acepta un body shape OpenAI-style
//      (`{messages: [{role, content}], tools: [{type:"function", function:{
//      name, description, parameters}}], tool_choice: {type:"function",...}}`)
//      y devuelve un Response con shape OpenAI-compat (`choices[0].message.
//      tool_calls[0].function.arguments`). Internamente traduce a Anthropic.
//      Mantiene compatibilidad con las 17 funciones que llaman al endpoint
//      de IA sin pasar por aiTool.
// ============================================================================

const AI_DEFAULT_MODEL = "claude-haiku-4-5";
const AI_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const AI_ANTHROPIC_VERSION = "2023-06-01";

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

// Modelos Claude soportados. Si llega algo distinto (ej: residuo de
// "gemini-2.5-flash-lite" en config viejo), caemos al default.
const VALID_CLAUDE_MODELS = new Set([
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-opus-4-5",
  "claude-opus-4-6",
  "claude-opus-4-7",
]);

function normalizeModel(requested?: string): string {
  if (!requested) return AI_DEFAULT_MODEL;
  const bare = requested.trim();
  return VALID_CLAUDE_MODELS.has(bare) ? bare : AI_DEFAULT_MODEL;
}

// ─── Native Anthropic call ──────────────────────────────────────────────────
// `anthropicFetch` recibe el body en shape Anthropic Messages (system top-level,
// content[]+tool_use response). `aiTool` lo usa internamente.

interface AnthropicMessagesBody {
  model?: string;
  system?: string | Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral"; ttl?: string } }>;
  messages: Array<{ role: "user" | "assistant"; content: string | Array<unknown> }>;
  tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  tool_choice?: { type: "tool" | "auto" | "any"; name?: string };
  max_tokens?: number;
  temperature?: number;
  [k: string]: unknown;
}

async function anthropicFetch(
  body: AnthropicMessagesBody,
  opts: { timeoutMs?: number } = {},
): Promise<Response> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    return new Response(
      JSON.stringify({ error: { message: "ANTHROPIC_API_KEY no configurada" } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const normalizedBody = {
    ...body,
    model: normalizeModel(body.model as string | undefined),
    max_tokens: body.max_tokens ?? 4096,
  };

  const timeoutMs = opts.timeoutMs ?? 45000;
  // Backoff exponencial para 429/500/502/503/529 (overloaded en Anthropic).
  const DELAYS = [1500, 4000, 10000];
  let lastResp: Response | null = null;

  for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
    try {
      const resp = await fetch(AI_ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": AI_ANTHROPIC_VERSION,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify(normalizedBody),
      });
      if (resp.ok) return resp;
      const retryable = resp.status === 429 || resp.status === 500 || resp.status === 502 || resp.status === 503 || resp.status === 529;
      if (!retryable) return resp;
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

// ─── lovableCompatFetch ──────────────────────────────────────────────────────
// Drop-in replacement para las 17 funciones que históricamente llamaban
// `fetch()` directo al endpoint Gemini OpenAI-compat. Acepta el body OpenAI-
// style, traduce internamente a Anthropic Messages, y devuelve un Response con
// shape OpenAI-compat para que las funciones consumidoras (que parsean
// `choices[0].message.tool_calls[0].function.arguments`) no necesiten
// cambiar. El nombre se mantiene por compatibilidad con imports existentes.

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
  // 1) Traducir messages → { system, messages[] sin role=system }
  const incoming = body.messages ?? [];
  const systemParts: string[] = [];
  const chatMessages: Array<{ role: "user" | "assistant"; content: any }> = [];
  for (const m of incoming) {
    if (m.role === "system") {
      systemParts.push(typeof m.content === "string" ? m.content : JSON.stringify(m.content));
    } else if (m.role === "user" || m.role === "assistant") {
      chatMessages.push({ role: m.role, content: m.content as any });
    }
  }
  const systemText = systemParts.join("\n\n");

  // 2) Traducir tools OpenAI-style → Anthropic-style.
  //    OpenAI: [{type:"function", function:{name, description, parameters}}]
  //    Anthropic: [{name, description, input_schema}]
  const tools = (body.tools ?? []).map((t: any) => {
    if (t?.type === "function" && t.function) {
      return {
        name: t.function.name,
        description: t.function.description ?? "",
        input_schema: t.function.parameters ?? { type: "object", properties: {} },
      };
    }
    // Si ya viene en formato Anthropic, pasa sin cambios.
    return { name: t.name, description: t.description ?? "", input_schema: t.input_schema ?? t.parameters ?? {} };
  });

  // 3) Traducir tool_choice OpenAI-style → Anthropic-style.
  //    OpenAI: {type:"function", function:{name}}
  //    Anthropic: {type:"tool", name}
  let toolChoice: any = undefined;
  if (body.tool_choice) {
    if (typeof body.tool_choice === "object" && body.tool_choice.type === "function" && body.tool_choice.function?.name) {
      toolChoice = { type: "tool", name: body.tool_choice.function.name };
    } else if (typeof body.tool_choice === "object" && body.tool_choice.type === "tool") {
      toolChoice = body.tool_choice;
    } else if (body.tool_choice === "auto" || body.tool_choice === "any") {
      toolChoice = { type: body.tool_choice };
    }
  }

  // 4) Aplicar prompt caching al system prompt cuando es lo suficientemente
  //    largo. Min 4096 tokens en Haiku 4.5; aproximamos por chars (~4 chars
  //    por token). Si es chico simplemente lo enviamos plano.
  const CACHE_MIN_CHARS = 4096 * 4; // ~16k chars ≈ 4096 tokens
  let systemField: AnthropicMessagesBody["system"] | undefined;
  if (systemText) {
    if (systemText.length >= CACHE_MIN_CHARS) {
      systemField = [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }];
    } else {
      systemField = systemText;
    }
  }

  // 5) Llamada nativa
  const resp = await anthropicFetch({
    model: body.model,
    system: systemField,
    messages: chatMessages,
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: toolChoice,
    max_tokens: body.max_tokens ?? 4096,
    temperature: body.temperature,
  }, opts);

  // 6) Si falló, devolver el Response tal cual (los callers ya manejan
  //    !resp.ok). El error JSON de Anthropic tiene shape distinta pero los
  //    callers solo leen `status`/`text` para logging, no parsean el body.
  if (!resp.ok) return resp;

  // 7) Traducir respuesta Anthropic → shape OpenAI-compat
  let data: any;
  try {
    data = await resp.json();
  } catch {
    return resp;
  }

  // Anthropic: { content: [{type:"text", text}|{type:"tool_use", name, input, id}], usage:{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens} }
  const content: Array<any> = data.content ?? [];
  const textBlock = content.find((b) => b.type === "text");
  const toolBlock = content.find((b) => b.type === "tool_use");

  const openaiShaped = {
    id: data.id ?? "",
    model: data.model ?? "",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: textBlock?.text ?? null,
        tool_calls: toolBlock ? [{
          id: toolBlock.id ?? "call_0",
          type: "function",
          function: {
            name: toolBlock.name,
            arguments: JSON.stringify(toolBlock.input ?? {}),
          },
        }] : undefined,
      },
      finish_reason: data.stop_reason === "tool_use" ? "tool_calls" : (data.stop_reason ?? "stop"),
    }],
    usage: anthropicUsageToOpenAI(data.usage ?? {}),
  };

  return new Response(JSON.stringify(openaiShaped), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Mapea el shape de usage de Anthropic al de OpenAI manteniendo visibilidad
// del cache. Los `cache_*_input_tokens` se suman a prompt_tokens para que el
// total siga siendo correcto en consumidores que muestran cost stats.
function anthropicUsageToOpenAI(u: any): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
  const input = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  const output = u.output_tokens ?? 0;
  return {
    prompt_tokens: input,
    completion_tokens: output,
    total_tokens: input + output,
  };
}

// ─── aiTool — interfaz nativa para llamadas tool-use forzadas ───────────────
// Versiones anteriores se llamaban `anthropicTool` (correctamente, ahora sí).
// Mantenemos el alias `aiTool` para no romper los 2 callers existentes
// (case-strategy-ai, client-strategy-ai).

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
  // Anthropic separa el system prompt del array de messages. Filtramos
  // cualquier mensaje legacy con role=system y agregamos el contenido al
  // system prompt principal.
  const userMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
  const systemFromMessages: string[] = [];
  for (const m of opts.messages ?? []) {
    if (m.role === "system") {
      systemFromMessages.push(m.content);
    } else if (m.role === "user" || m.role === "assistant") {
      userMessages.push({ role: m.role, content: m.content });
    }
  }
  if (userMessages.length === 0 && opts.userPrompt) {
    userMessages.push({ role: "user", content: opts.userPrompt });
  }
  const fullSystem = [opts.system, ...systemFromMessages].filter(Boolean).join("\n\n");

  // Prompt caching en el system block — case-strategy-ai y client-strategy-ai
  // se llaman muchas veces con el mismo system prompt (uno por ticket / uno
  // por cliente). El cache_control: ephemeral hace que después de la primera
  // llamada, el system prefix se sirva del cache (~10% del costo).
  // Min cacheable prefix en Haiku 4.5 = 4096 tokens; aproximamos por chars.
  const CACHE_MIN_CHARS = 4096 * 4;
  const systemField: AnthropicMessagesBody["system"] = fullSystem.length >= CACHE_MIN_CHARS
    ? [{ type: "text", text: fullSystem, cache_control: { type: "ephemeral" } }]
    : fullSystem;

  const resp = await anthropicFetch({
    model: opts.model,
    system: systemField,
    messages: userMessages,
    max_tokens: opts.maxTokens ?? 4096,
    tools: [{
      name: opts.tool.name,
      description: opts.tool.description,
      input_schema: opts.tool.input_schema,
    }],
    tool_choice: { type: "tool", name: opts.tool.name },
  }, { timeoutMs: opts.timeoutMs ?? 45000 });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    if (resp.status === 429) throw new AiError(429, "Rate limit excedido, intenta en unos minutos");
    if (resp.status === 401) throw new AiError(401, "ANTHROPIC_API_KEY inválida");
    if (resp.status === 402 || resp.status === 403) throw new AiError(402, "Créditos o billing pendiente");
    throw new AiError(resp.status, `IA error ${resp.status}: ${txt.slice(0, 300)}`);
  }

  const data = await resp.json();
  const content: Array<any> = data.content ?? [];
  const toolUseBlock = content.find((b) => b.type === "tool_use" && b.name === opts.tool.name);
  if (!toolUseBlock) {
    throw new AiError(502, "La IA no devolvió un bloque tool_use válido");
  }

  return {
    result: toolUseBlock.input as T,
    usage: anthropicUsageToOpenAI(data.usage ?? {}),
  };
}

export function resolvedModel(model?: string): string {
  return normalizeModel(model);
}
