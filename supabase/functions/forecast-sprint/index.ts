import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { velocity_history, backlog_points } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Eres un Scrum Master experto. Analiza la velocity histórica del equipo y predice cuándo terminarán el backlog. Responde SIEMPRE usando la función forecast_sprint.`;

    const userPrompt = `Velocity histórica (últimos sprints):
${JSON.stringify(velocity_history, null, 2)}

Backlog actual pendiente: ${backlog_points} story points.

Calcula velocity promedio, cuántos sprints faltan, fecha estimada de fin (asumiendo sprints de 2 semanas desde hoy), nivel de confianza basado en la consistencia, factores de riesgo y recomendaciones.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "forecast_sprint",
            description: "Devuelve la predicción de fin del backlog",
            parameters: {
              type: "object",
              properties: {
                avg_velocity: { type: "number", description: "Velocity promedio en story points" },
                sprints_to_complete: { type: "number", description: "Sprints faltantes para terminar el backlog" },
                estimated_end_date: { type: "string", description: "Fecha YYYY-MM-DD estimada de fin" },
                confidence: { type: "string", enum: ["alta", "media", "baja"] },
                risk_factors: { type: "array", items: { type: "string" } },
                recommendations: { type: "array", items: { type: "string" } },
              },
              required: ["avg_velocity", "sprints_to_complete", "estimated_end_date", "confidence", "risk_factors", "recommendations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "forecast_sprint" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos agotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await response.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : {};
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("forecast-sprint error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
