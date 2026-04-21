import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(model: string, messages: any[]) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (res.status === 429) throw new Error("rate_limited");
  if (res.status === 402) throw new Error("payment_required");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, ticket_id, notice_type } = await req.json();
    if (!mode || !ticket_id) {
      return new Response(JSON.stringify({ error: "mode and ticket_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: ticket }, { data: compliance }, { data: rules }] = await Promise.all([
      supabase.from("support_tickets").select("*").eq("id", ticket_id).maybeSingle(),
      supabase.from("case_compliance").select("*").eq("ticket_id", ticket_id).maybeSingle(),
      supabase.from("business_rules").select("*").eq("is_active", true),
    ]);

    if (!ticket) {
      return new Response(JSON.stringify({ error: "ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signature = (rules || []).find((r: any) => r.rule_type === "signature")?.content?.template
      || "Atentamente,\nEquipo de Soporte SYSDE";
    const checklistDef = (rules || []).find((r: any) => r.rule_type === "checklist")?.content?.items || [];

    const { data: settings } = await supabase
      .from("policy_ai_settings")
      .select("ai_model")
      .eq("scope", "global")
      .maybeSingle();
    const model = settings?.ai_model || "google/gemini-3-flash-preview";

    const ctx = `
Ticket: ${ticket.title || ticket.id}
Tipo: ${ticket.case_type || "n/a"} | Prioridad: ${ticket.priority || "n/a"}
Estado: ${ticket.status} | Cliente: ${ticket.client_id}
Días restantes (política v4.5): ${compliance?.days_remaining ?? "?"}
Semáforo: ${compliance?.semaphore ?? "?"} | Riesgo: ${compliance?.risk_level ?? "?"}
Avisos enviados: ${compliance?.notices_sent ?? 0}/${compliance?.notices_required ?? 3}
Checklist: ${compliance?.checklist_completed_count ?? 0}/5
Descripción: ${ticket.description || "(sin descripción)"}
`.trim();

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "recommend_action") {
      systemPrompt = `Eres el asistente de la Política de Cierre v4.5 de SYSDE. Recomienda la próxima acción concreta para este caso, en español, en menos de 80 palabras. Devuelve una sola acción priorizada (enviar aviso, escalar a sprint, cerrar con diagnóstico, validar con cliente, etc) y la razón en 1 línea.`;
      userPrompt = ctx;
    } else if (mode === "generate_notice") {
      const days = compliance?.days_remaining ?? 3;
      systemPrompt = `Redacta un aviso formal en español al cliente sobre el caso. Tono profesional y empático. Sustituye [X días] por ${Math.max(days, 1)} día(s). Incluye número de ticket. Termina con esta firma exacta:\n\n${signature}`;
      userPrompt = `Tipo de aviso: ${notice_type || "seguimiento"}\n\n${ctx}`;
    } else if (mode === "validate_closing") {
      systemPrompt = `Valida si el caso cumple los 4 elementos obligatorios del diagnóstico v4.5: 1) qué pasó, 2) qué se hizo, 3) estado final, 4) definitiva o temporal. Responde JSON con keys: ok (bool), missing (array de strings), suggestions (string).`;
      userPrompt = `Checklist actual: ${JSON.stringify(compliance?.checklist || {})}\nElementos requeridos: ${JSON.stringify(checklistDef)}\n\n${ctx}`;
    } else {
      return new Response(JSON.stringify({ error: "invalid mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await callAI(model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    // Persist last AI recommendation when it's recommend_action
    if (mode === "recommend_action" && compliance) {
      await supabase
        .from("case_compliance")
        .update({
          ai_recommendation: result,
          ai_last_run_at: new Date().toISOString(),
          ai_model: model,
        })
        .eq("ticket_id", ticket_id);
    }

    return new Response(JSON.stringify({ result, mode, model }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "rate_limited" ? 429 : msg === "payment_required" ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
