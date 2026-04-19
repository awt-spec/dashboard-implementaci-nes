import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay() || 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day + 1);
  return date;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { member_id } = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!member_id) {
      return new Response(JSON.stringify({ error: "member_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ws = startOfWeek();
    const wsIso = ws.toISOString();
    const wsDate = ws.toISOString().slice(0, 10);

    const [{ data: member }, { data: goal }] = await Promise.all([
      supabase.from("sysde_team_members").select("id, name, role, email").eq("id", member_id).maybeSingle(),
      supabase.from("time_tracking_goals").select("*").eq("user_id", member_id).maybeSingle(),
    ]);

    if (!member) {
      return new Response(JSON.stringify({ error: "member not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch hours this week (best-effort)
    let hoursThisWeek = 0;
    let billableHours = 0;
    try {
      const { data: entries } = await supabase
        .from("work_time_entries" as any)
        .select("started_at, ended_at, duration_seconds, is_billable")
        .gte("started_at", wsIso);
      (entries || []).forEach((e: any) => {
        const secs = e.duration_seconds || (e.ended_at && e.started_at ? (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 1000 : 0);
        const h = secs / 3600;
        hoursThisWeek += h;
        if (e.is_billable) billableHours += h;
      });
    } catch (_e) { /* table may not exist yet */ }

    // Open tasks/tickets count
    const [{ count: openTasks }, { count: openTickets }] = await Promise.all([
      supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "Completado").eq("owner", member.name),
      supabase.from("support_tickets").select("*", { count: "exact", head: true }).neq("estado", "Cerrado").eq("responsable", member.name),
    ]);

    const target = goal?.weekly_target_hours ?? 40;
    const billableTargetPct = goal?.billable_target_pct ?? 80;
    const billablePct = hoursThisWeek > 0 ? Math.round((billableHours / hoursThisWeek) * 100) : 0;
    const goalPct = Math.round((hoursThisWeek / target) * 100);

    const prompt = `Genera un resumen semanal MOTIVADOR y CONCRETO en español para ${member.name} (${member.role || "colaborador"}).

Métricas de la semana:
- Horas registradas: ${hoursThisWeek.toFixed(1)}h de ${target}h (${goalPct}% de la meta)
- Facturable: ${billableHours.toFixed(1)}h (${billablePct}% vs meta ${billableTargetPct}%)
- Tareas abiertas: ${openTasks ?? 0}
- Tickets abiertos: ${openTickets ?? 0}

Responde en JSON estricto:
{
  "summary": "2-3 frases con tono cercano destacando lo positivo y un foco para la próxima semana",
  "suggestions": [
    {"icon": "🎯|📚|🤝|💪|⏰", "title": "max 6 palabras", "detail": "1 frase accionable"}
  ]
}
Devuelve 3 sugerencias máximo. NO uses markdown, solo JSON.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un coach que produce JSON válido." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (r.status === 429 || r.status === 402) {
      return new Response(JSON.stringify({ error: r.status === 429 ? "Rate limit" : "Sin créditos" }), { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!r.ok) throw new Error(`AI gateway ${r.status}`);

    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let parsed: any = { summary: "", suggestions: [] };
    try { parsed = JSON.parse(content); } catch { parsed.summary = content; }

    const metrics = { hoursThisWeek, billableHours, billablePct, goalPct, openTasks: openTasks ?? 0, openTickets: openTickets ?? 0 };

    const { data: digest, error } = await supabase
      .from("member_ai_digests")
      .upsert({
        member_id,
        week_start: wsDate,
        summary: parsed.summary || "Sin resumen",
        suggestions: parsed.suggestions || [],
        metrics,
      }, { onConflict: "member_id,week_start" })
      .select()
      .maybeSingle();

    if (error) throw error;

    return new Response(JSON.stringify({ digest }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("member-agent-weekly-digest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
