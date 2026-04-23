import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth, requireRole } from "../_shared/auth.ts";
import { normalizeTipo, normalizePrioridad, isTicketClosed } from "../_shared/ticketStatus.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);
    await requireRole(ctx, ["admin", "pm", "gerente"]);

    const { ticket_id } = await req.json();
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = ctx.adminClient;

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
        headers: { ...cors, "Content-Type": "application/json" },
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

    // Match deadline. OJO: la tabla real es `tipo` y `prioridad` (no case_type/priority),
    // y los valores vienen con mayúsculas y acentos. Normalizamos antes de comparar.
    const caseType = normalizeTipo(ticket.tipo);
    const priority = normalizePrioridad(ticket.prioridad);
    const deadlines = (effectiveContent as any)?.deadlines || [];
    const normDl = (d: any) => ({
      caseType: normalizeTipo(d.case_type),
      priority: normalizePrioridad(d.priority),
      raw: d,
    });
    const match =
      deadlines.map(normDl).find((d: any) => d.caseType === caseType && d.priority === priority)?.raw ||
      deadlines.map(normDl).find((d: any) => d.priority === priority)?.raw ||
      { deadline_days: 5, notices: 2 };

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
      // auto-check si el ticket YA está cerrado; el equipo puede desmarcarlo después
      closure_type: isTicketClosed(ticket.estado),
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
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("evaluate-case-compliance error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
