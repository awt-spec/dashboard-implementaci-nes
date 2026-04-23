import { corsHeaders, corsPreflight } from "../_shared/cors.ts";

/**
 * transcribe-audio
 * Transcribe audio/video de feedback y persiste el texto en
 * support_minutes_feedback.audio_transcript / video_transcript.
 *
 * Entrada:  { feedback_id, audio_url, kind: "audio" | "video" }
 * Salida:   { success, transcript }
 *
 * Usa Gemini 2.5 Flash (multimodal) via Lovable AI gateway.
 *
 * Es INVOCADA sin auth obligatoria desde la página pública: el caller anónimo
 * recién subió el media y tiene el feedback_id, así que lo aceptamos. El
 * impacto está acotado porque solo escribe columnas de transcript/metadata en
 * una fila existente y no expone nada más.
 */

const MODEL = "google/gemini-2.5-flash";
const FUNCTION_NAME = "transcribe-audio";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB cap

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const { feedback_id, audio_url, kind } = await req.json().catch(() => ({}));
    if (!feedback_id || !audio_url || !kind) {
      return new Response(JSON.stringify({ error: "feedback_id, audio_url y kind son requeridos" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (kind !== "audio" && kind !== "video") {
      return new Response(JSON.stringify({ error: "kind debe ser 'audio' o 'video'" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ─── 1. Descargar el archivo ────────────────────────────────────────
    const mediaResp = await fetch(audio_url);
    if (!mediaResp.ok) throw new Error(`No se pudo descargar media: ${mediaResp.status}`);
    const contentLength = Number(mediaResp.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BYTES) {
      await logUsage({
        status: "error",
        error_message: `Media excede ${MAX_BYTES} bytes: ${contentLength}`,
        metadata: { feedback_id, audio_url, kind },
      });
      return new Response(JSON.stringify({ error: "Archivo demasiado grande para transcribir" }), {
        status: 413, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const mediaBlob = await mediaResp.blob();
    const mime = mediaBlob.type || (kind === "audio" ? "audio/webm" : "video/webm");
    const b64 = await blobToBase64(mediaBlob);

    // ─── 2. Pedir transcripción al LLM multimodal ───────────────────────
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "Eres un transcriptor profesional. Devuelve ÚNICAMENTE la transcripción textual del audio en español neutro, sin preámbulos, sin metadatos, sin etiquetas de speaker. Si el audio está vacío o inaudible, devuelve la cadena literal: '[audio inaudible]'.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Transcribí este ${kind === "video" ? "video (solo el audio)" : "audio"}:` },
              {
                type: "input_audio",
                input_audio: { data: b64, format: guessFormat(mime) },
              },
            ],
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      await logUsage({
        status: "error",
        error_message: `AI ${aiResp.status}: ${txt.slice(0, 300)}`,
        metadata: { feedback_id, kind },
      });
      return new Response(JSON.stringify({ error: `AI gateway error: ${aiResp.status}` }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const transcript = (aiData.choices?.[0]?.message?.content ?? "").toString().trim();
    if (!transcript) throw new Error("La IA no devolvió transcripción");

    // ─── 3. Persistir en la fila de feedback ────────────────────────────
    const col = kind === "audio" ? "audio_transcript" : "video_transcript";
    const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/support_minutes_feedback?id=eq.${feedback_id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ [col]: transcript }),
    });
    if (!updateResp.ok) {
      const t = await updateResp.text();
      throw new Error(`Error actualizando feedback: ${t}`);
    }

    // ─── 4. Loggear uso (best-effort) ──────────────────────────────────
    const usage = aiData.usage ?? {};
    await logUsage({
      status: "success",
      prompt_tokens: usage.prompt_tokens ?? 0,
      completion_tokens: usage.completion_tokens ?? 0,
      total_tokens: usage.total_tokens ?? 0,
      metadata: { feedback_id, kind, transcript_length: transcript.length },
    });

    return new Response(JSON.stringify({ success: true, transcript }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("transcribe-audio error:", e);
    await logUsage({
      status: "error",
      error_message: String(e?.message ?? e).slice(0, 500),
    }).catch(() => { /* ignore */ });
    return new Response(JSON.stringify({ error: e?.message ?? "Error desconocido" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ─── helpers ──────────────────────────────────────────────────────────
  async function logUsage(row: {
    status: "success" | "error";
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    error_message?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_logs`, {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          function_name: FUNCTION_NAME,
          model: MODEL,
          prompt_tokens: row.prompt_tokens ?? 0,
          completion_tokens: row.completion_tokens ?? 0,
          total_tokens: row.total_tokens ?? 0,
          status: row.status,
          error_message: row.error_message ?? null,
          metadata: row.metadata ?? {},
        }),
      });
    } catch { /* swallow */ }
  }
});

// ─── utils top-level ──────────────────────────────────────────────────────

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function guessFormat(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("mp4"))  return "mp4";
  if (m.includes("webm")) return "webm";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav"))  return "wav";
  if (m.includes("ogg"))  return "ogg";
  return "webm";
}
