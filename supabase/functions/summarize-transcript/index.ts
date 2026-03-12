import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, clientName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en un momento." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse content as JSON
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "No se pudo parsear la respuesta de IA" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Respuesta vacía de IA" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
