import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedEntry {
  source: "task" | "ticket";
  item_id: string | null;
  item_hint?: string;
  client_id: string | null;
  client_hint?: string;
  work_date: string;
  hours: number;
  description: string;
  is_billable: boolean;
  category: string;
  confidence: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const text: string = body?.text ?? "";
    if (!text || text.length > 1000) {
      return new Response(JSON.stringify({ error: "text required (1-1000 chars)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cargar contexto: tareas y tickets activos del usuario, clientes
    const [tasksRes, ticketsRes, clientsRes] = await Promise.all([
      supabase.from("tasks").select("id, title, client_id").eq("assigned_user_id", user.id).neq("status", "completada").limit(30),
      supabase.from("support_tickets").select("id, asunto, client_id").eq("assigned_user_id", user.id).neq("estado", "cerrado").limit(30),
      supabase.from("clients").select("id, name").limit(50),
    ]);

    const tasks = tasksRes.data || [];
    const tickets = ticketsRes.data || [];
    const clients = clientsRes.data || [];

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `Eres un parser de registros de tiempo. Extrae de un texto en lenguaje natural una entrada estructurada de horas trabajadas.

CONTEXTO DEL USUARIO:
Tareas asignadas: ${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, client_id: t.client_id })))}
Tickets asignados: ${JSON.stringify(tickets.map(t => ({ id: t.id, asunto: t.asunto, client_id: t.client_id })))}
Clientes: ${JSON.stringify(clients.map(c => ({ id: c.id, name: c.name })))}
Fecha de hoy: ${today}

REGLAS:
- "ayer" = un día antes de hoy. "hoy" = hoy. "lunes/martes..." = el más reciente.
- "esta mañana" / "esta tarde" → work_date = hoy
- Identifica horas explícitas ("2h", "2 horas", "media hora"=0.5, "una hora y media"=1.5)
- Si menciona un cliente o tarea por nombre parcial, busca el match más cercano y devuelve el id correspondiente.
- Si no hay match exacto: devuelve item_id=null e item_hint con el texto que mencionó.
- category: desarrollo | soporte | reunion | documentacion | testing | consultoria | otros
- is_billable: true por defecto, false solo si menciona "interno", "capacitación", "reunión interna"
- confidence: 0-1 (qué tan seguro estás del parseo)`;

    const userPrompt = `Texto del usuario: """${text}"""

Devuelve SOLO un JSON con este formato exacto:
{
  "source": "task" | "ticket",
  "item_id": string | null,
  "item_hint": string,
  "client_id": string | null,
  "client_hint": string,
  "work_date": "YYYY-MM-DD",
  "hours": number,
  "description": string,
  "is_billable": boolean,
  "category": string,
  "confidence": number
}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes, intenta en un momento" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Sin créditos de IA. Agrega fondos en Workspace > Usage" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI gateway error", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiResp.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: ParsedEntry;
    try { parsed = JSON.parse(content); }
    catch { parsed = { source: "task", item_id: null, client_id: null, work_date: today, hours: 1, description: text, is_billable: true, category: "otros", confidence: 0.2 }; }

    // Log uso IA
    await supabase.from("ai_usage_logs").insert({
      function_name: "parse-time-entry",
      model: "google/gemini-2.5-flash",
      prompt_tokens: aiJson?.usage?.prompt_tokens ?? 0,
      completion_tokens: aiJson?.usage?.completion_tokens ?? 0,
      total_tokens: aiJson?.usage?.total_tokens ?? 0,
      status: "success",
    });

    return new Response(JSON.stringify({ parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
