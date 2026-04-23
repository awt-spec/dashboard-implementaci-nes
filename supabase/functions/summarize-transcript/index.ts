import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth } from "../_shared/auth.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);

    const { transcript, clientName } = await req.json();
    if (typeof transcript !== "string" || transcript.length === 0 || transcript.length > 200000) {
      return new Response(JSON.stringify({ error: "transcript must be a non-empty string up to 200000 chars" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const supabase = ctx.adminClient;

    const model = "gemini-2.5-flash-lite";
    const startTime = Date.now();

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `Eres un asistente ejecutivo experto en gestión de proyectos para SYSDE. Tu trabajo es analizar transcripciones de reuniones con clientes y generar un resumen estructurado en español.

Debes retornar un JSON con esta estructura exacta:
{
  "title": "Título sugerido para la minuta",
  "summary": "Resumen ejecutivo de la reunión en 2-4 párrafos",
  "agreements": ["Acuerdo 1", "Acuerdo 2", ...],
  "actionItems": ["Pendiente 1", "Pendiente 2", ...],
  "attendees": ["Persona 1", "Persona 2", ...],
  "taskUpdates": [
    {"taskTitle": "nombre de la tarea mencionada", "suggestedStatus": "completada|en-progreso|bloqueada|pendiente", "note": "detalle del avance"}
  ]
}

Extrae los asistentes mencionados, los acuerdos tomados, los pendientes y cualquier actualización de estado de tareas o entregables. Se conciso y profesional.`
          },
          {
            role: "user",
            content: `Cliente: ${clientName}\n\nTranscripción de la reunión:\n${transcript}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_minute_summary",
              description: "Generate a structured meeting minute summary from transcript",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Suggested title for the meeting minute" },
                  summary: { type: "string", description: "Executive summary of the meeting" },
                  agreements: { type: "array", items: { type: "string" }, description: "List of agreements" },
                  actionItems: { type: "array", items: { type: "string" }, description: "List of action items" },
                  attendees: { type: "array", items: { type: "string" }, description: "List of attendees" },
                  taskUpdates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        taskTitle: { type: "string" },
                        suggestedStatus: { type: "string", enum: ["completada", "en-progreso", "bloqueada", "pendiente"] },
                        note: { type: "string" }
                      },
                      required: ["taskTitle", "suggestedStatus", "note"]
                    },
                    description: "Suggested task status updates based on the discussion"
                  }
                },
                required: ["title", "summary", "agreements", "actionItems", "attendees", "taskUpdates"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_minute_summary" } }
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      
      await supabase.from("ai_usage_logs").insert({
        function_name: "summarize-transcript",
        model,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        status: "error",
        error_message: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
        metadata: { client_name: clientName, elapsed_ms: elapsed },
      });

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en un momento." }), {
          status: 429, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

    // Log successful AI call
    await supabase.from("ai_usage_logs").insert({
      function_name: "summarize-transcript",
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      status: "success",
      metadata: { client_name: clientName, elapsed_ms: elapsed },
    });
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "No se pudo parsear la respuesta de IA" }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Respuesta vacía de IA" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("summarize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
