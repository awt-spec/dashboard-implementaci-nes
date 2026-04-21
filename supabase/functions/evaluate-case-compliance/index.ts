import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { ticket_id } = await req.json();
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load ticket
    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticket_id)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!ticket) {
      return new Response(JSON.stringify({ error: "ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load active SLA rule (global)
    const { data: slaRule } = await supabase
      .from("business_rules")
      .select("*")
      .eq("rule_type", "sla")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Look for client override
    let effectiveContent = slaRule?.content || {};
    if (slaRule && ticket.client_id) {
      const { data: override } = await supabase
        .from("client_rule_overrides")
        .select("override_content")
        .eq("client_id", ticket.client_id)
        .eq("rule_id", slaRule.id)
        .eq("is_active", true)
        .maybeSingle();
      if (override?.override_content) {
        effectiveContent = { ...effectiveContent, ...override.override_content };
      }
    }

    // Match deadline
    const caseType = (ticket.case_type || "consulta").toLowerCase();
    const priority = (ticket.priority || "media").toLowerCase();
    const deadlines = (effectiveContent as any)?.deadlines || [];
    const match = deadlines.find(
      (d: any) => d.case_type === caseType && d.priority === priority,
    ) || deadlines.find((d: any) => d.priority === priority) || { deadline_days: 5, notices: 2 };

    const createdAt = new Date(ticket.created_at);
    const ageDays = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
    const daysRemaining = match.deadline_days - ageDays;

    let semaphore = "green";
    let risk_level = "low";
    if (daysRemaining < 0) {
      semaphore = "overdue";
      risk_level = "critical";
    } else if (daysRemaining <= 1) {
      semaphore = "red";
      risk_level = "high";
    } else if (daysRemaining <= 2) {
      semaphore = "yellow";
      risk_level = "medium";
    }

    // Existing compliance
    const { data: existing } = await supabase
      .from("case_compliance")
      .select("*")
      .eq("ticket_id", ticket_id)
      .maybeSingle();

    const checklist = existing?.checklist || {
      documented_solution: false,
      client_notification: false,
      ticket_reference: true,
      closure_type: !!ticket.status && ticket.status !== "open",
      validation_guide: false,
    };
    const checklist_completed_count = Object.values(checklist).filter(Boolean).length;

    const payload = {
      ticket_id,
      client_id: ticket.client_id,
      rule_id: slaRule?.id || null,
      policy_version: slaRule?.policy_version || "v4.5",
      applicable_deadline_days: match.deadline_days,
      days_remaining: daysRemaining,
      semaphore,
      notices_required: match.notices || 3,
      checklist,
      checklist_completed_count,
      risk_level,
      last_evaluated_at: new Date().toISOString(),
    };

    const { data: upserted, error: uErr } = await supabase
      .from("case_compliance")
      .upsert(payload, { onConflict: "ticket_id" })
      .select()
      .maybeSingle();
    if (uErr) throw uErr;

    return new Response(JSON.stringify({ compliance: upserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-case-compliance error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
