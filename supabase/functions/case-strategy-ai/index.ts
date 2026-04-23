import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth, requireRole } from "../_shared/auth.ts";
import { isTicketClosed } from "../_shared/ticketStatus.ts";
import { anthropicTool, AiError, resolvedModel } from "../_shared/ai.ts";

/**
 * case-strategy-ai
 * Genera una estrategia IA para UN caso de soporte específico.
 * Input:  { ticket_id: string }
 * Output: { success, analysis, id }
 *
 * El análisis persiste en pm_ai_analysis con analysis_type='case_strategy'
 * y scope=<uuid del ticket>.
 */

const MODEL = "gemini-2.5-flash-lite";
const FUNCTION_NAME = "case-strategy-ai";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);
    await requireRole(ctx, ["admin", "pm", "gerente", "colaborador"]);

    const { ticket_id } = await req.json().catch(() => ({}));
    if (!ticket_id || typeof ticket_id !== "string") {
      return new Response(JSON.stringify({ error: "ticket_id requerido" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const db = ctx.adminClient;

    // ─── 1. Ticket objetivo ──────────────────────────────────────────────
    const { data: ticket, error: ticketErr } = await db
      .from("support_tickets")
      .select("*")
      .eq("id", ticket_id)
      .single();
    if (ticketErr || !ticket) {
      return new Response(JSON.stringify({ error: "Caso no encontrado" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ─── 2. Cliente + contrato + SLA ─────────────────────────────────────
    const [clientR, contractsR, slasR, financialsR] = await Promise.all([
      db.from("clients").select("*").eq("id", ticket.client_id).maybeSingle(),
      db.from("client_contracts").select("*").eq("client_id", ticket.client_id).eq("is_active", true),
      db.from("client_slas").select("*").eq("client_id", ticket.client_id).eq("is_active", true),
      db.from("client_financials").select("*").eq("client_id", ticket.client_id).maybeSingle(),
    ]);
    const client = clientR.data;
    const contract = contractsR.data?.[0] ?? null;
    const slas = slasR.data ?? [];
    const financials = financialsR.data;

    // SLA más relevante (matcheo laxo por priority_level)
    const prioLower = (ticket.prioridad || "").toLowerCase();
    const matchSla = slas.find((s: any) => {
      const lvl = (s.priority_level || "").toLowerCase();
      return prioLower.includes(lvl) || lvl.includes(prioLower);
    }) ?? slas[0] ?? null;

    // ─── 3. Historial del caso (audit + notas) ───────────────────────────
    const [auditR, notesR, subtasksR] = await Promise.all([
      db.from("ticket_access_log").select("action, metadata, created_at, user_id").eq("ticket_id", ticket_id).order("created_at", { ascending: true }).limit(100),
      db.from("support_ticket_notes").select("*").eq("ticket_id", ticket_id).order("created_at", { ascending: true }).limit(50),
      db.from("support_ticket_subtasks").select("title, description, completed, priority, due_date, assignee").eq("ticket_id", ticket_id).order("sort_order"),
    ]);

    // ─── 4. Casos similares (mismo cliente o mismo producto/tipo, cerrados) ─
    const { data: similar } = await db
      .from("support_tickets")
      .select("id, ticket_id, asunto, estado, prioridad, tipo, producto, responsable, created_at, fecha_entrega, dias_antiguedad")
      .or(
        [
          `client_id.eq.${ticket.client_id}`,
          ticket.producto ? `producto.eq.${ticket.producto}` : null,
          ticket.tipo ? `tipo.eq.${ticket.tipo}` : null,
        ].filter(Boolean).join(",")
      )
      .neq("id", ticket_id)
      .in("estado", ["CERRADA", "ENTREGADA", "ANULADA"])
      .order("created_at", { ascending: false })
      .limit(10);

    // ─── 5. Calcular edad y estado SLA ──────────────────────────────────
    const created = new Date(ticket.created_at);
    const now = new Date();
    const hoursOpen = Math.floor((now.getTime() - created.getTime()) / 3600000);
    const daysOpen = Math.floor(hoursOpen / 24);
    const slaResponseH = Number(matchSla?.response_time_hours ?? 0);
    const slaResolutionH = Number(matchSla?.resolution_time_hours ?? 0);
    const slaState = !slaResolutionH
      ? "sin_sla"
      : isTicketClosed(ticket.estado)
        ? "cerrado"
        : hoursOpen > slaResolutionH
          ? "incumplido"
          : hoursOpen > slaResolutionH * 0.75
            ? "en_riesgo"
            : "ok";

    // ─── 6. Construir contexto para el prompt ───────────────────────────
    const context = {
      ticket: {
        id: ticket.ticket_id,
        asunto: ticket.asunto,
        estado: ticket.estado,
        prioridad: ticket.prioridad,
        tipo: ticket.tipo,
        producto: ticket.producto,
        responsable: ticket.responsable,
        descripcion: ticket.is_confidential ? "(confidencial, no compartido)" : (ticket.descripcion ?? null),
        created_at: ticket.created_at,
        fecha_entrega: ticket.fecha_entrega,
        dias_antiguedad: ticket.dias_antiguedad ?? daysOpen,
        hours_open: hoursOpen,
        effort: ticket.effort,
        business_value: ticket.business_value,
        story_points: ticket.story_points,
      },
      client: client ? {
        id: client.id,
        name: client.name,
        type: client.client_type,
        status: client.status,
        monthly_value: contract?.monthly_value ?? 0,
        hourly_rate: contract?.hourly_rate ?? 0,
        contract_type: contract?.contract_type ?? null,
        hours_used: financials?.hours_used ?? null,
        hours_estimated: financials?.hours_estimated ?? null,
      } : null,
      sla: matchSla ? {
        priority_level: matchSla.priority_level,
        response_time_hours: slaResponseH,
        resolution_time_hours: slaResolutionH,
        business_hours_only: matchSla.business_hours_only,
        penalty_amount: matchSla.penalty_amount,
        penalty_description: matchSla.penalty_description,
        current_state: slaState,
      } : null,
      subtasks: (subtasksR.data || []).map((s: any) => ({
        title: s.title,
        completed: s.completed,
        priority: s.priority,
        due_date: s.due_date,
        assignee: s.assignee,
      })),
      notes: (notesR.data || []).slice(-10).map((n: any) => ({
        author: n.author_name,
        visibility: n.visibility,
        message: (n.content ?? "").slice(0, 500),
        created_at: n.created_at,
      })),
      events_count: auditR.data?.length ?? 0,
      similar_cases: (similar ?? []).map((t: any) => ({
        id: t.ticket_id,
        asunto: t.asunto,
        estado: t.estado,
        producto: t.producto,
        tipo: t.tipo,
        responsable: t.responsable,
        dias_antiguedad: t.dias_antiguedad,
      })),
    };

    // ─── 7. Prompt + tool calling ───────────────────────────────────────
    const systemPrompt = `Eres un líder de soporte senior de SYSDE (SAF+, FileMaster, banca, pensiones) con 15+ años resolviendo casos críticos en instituciones financieras de LATAM. Tu trabajo: diagnóstico preciso, acción concreta inmediata, y alerta temprana sobre riesgos. Eres directo, técnico, sin relleno. Hablas en español neutro. Priorizas cumplimiento de SLA y relación con el cliente — si hay penalidad financiera, la mencionas explícitamente.`;

    const userPrompt = `Analiza este caso y devuelve una estrategia accionable:\n\n${JSON.stringify(context, null, 2)}`;

    const { result: analysis, usage } = await anthropicTool<any>({
      model: MODEL,
      system: systemPrompt,
      userPrompt,
      maxTokens: 4096,
      timeoutMs: 45000,
      tool: {
        name: "case_strategy",
        description: "Análisis estratégico del caso de soporte",
        input_schema: {
          type: "object",
          properties: {
            diagnostico: {
              type: "string",
              description: "Diagnóstico técnico/funcional del caso en 2-4 frases. Qué está pasando realmente, causa raíz probable.",
            },
            accion_recomendada: {
              type: "object",
              properties: {
                titulo: { type: "string", description: "Acción concreta a tomar AHORA (imperativo, 1 línea)" },
                detalle: { type: "string", description: "Cómo ejecutar la acción, pasos concretos" },
                responsable_sugerido: { type: "string", description: "Nombre del responsable sugerido o rol" },
                urgencia: { type: "string", enum: ["inmediata", "hoy", "esta_semana", "este_mes"] },
                esfuerzo_estimado_horas: { type: "number" },
              },
              required: ["titulo", "detalle", "urgencia"],
            },
            riesgos: {
              type: "array",
              description: "Riesgos identificados, ordenados por severidad descendente",
              items: {
                type: "object",
                properties: {
                  titulo: { type: "string" },
                  severidad: { type: "string", enum: ["critico", "alto", "medio", "bajo"] },
                  impacto_financiero: { type: "string", description: "Si aplica, estimación en USD o descripción del impacto" },
                  mitigacion: { type: "string" },
                },
                required: ["titulo", "severidad", "mitigacion"],
              },
            },
            casos_similares: {
              type: "array",
              description: "Qué se aprende de los casos similares del histórico. Si no hay patrones útiles, devolver array vacío.",
              items: {
                type: "object",
                properties: {
                  ticket_id: { type: "string" },
                  asunto: { type: "string" },
                  relevancia: { type: "string", description: "Por qué este caso es relevante para el actual" },
                  leccion_aplicable: { type: "string" },
                },
                required: ["ticket_id", "relevancia", "leccion_aplicable"],
              },
            },
            sla_status: {
              type: "object",
              properties: {
                estado: { type: "string", enum: ["ok", "en_riesgo", "incumplido", "sin_sla", "cerrado"] },
                mensaje: { type: "string", description: "Una línea: 'Dentro de SLA (4h restantes)' o 'Incumplido hace 3h — penalidad $500'" },
                accion_sla: { type: "string", description: "Qué hacer para cumplir o mitigar el incumplimiento" },
              },
              required: ["estado", "mensaje"],
            },
            confianza: {
              type: "number",
              description: "Confianza del análisis 0-100 basada en calidad de la data disponible",
            },
          },
          required: ["diagnostico", "accion_recomendada", "riesgos", "casos_similares", "sla_status", "confianza"],
        },
      },
    });

    // ─── 8. Persistir + loggear uso ─────────────────────────────────────
    const { data: saved } = await db.from("pm_ai_analysis").insert({
      analysis_type: "case_strategy",
      scope: ticket_id,
      executive_summary: analysis.diagnostico,
      recommendations: [analysis.accion_recomendada],
      risks: analysis.riesgos ?? [],
      metrics: {
        sla_hours_open: hoursOpen,
        sla_state: slaState,
        similar_cases_count: context.similar_cases.length,
        notes_count: context.notes.length,
        confianza: analysis.confianza,
      },
      full_analysis: analysis,
      model: MODEL,
    }).select().single();

    await db.from("ai_usage_logs").insert({
      function_name: FUNCTION_NAME,
      model: resolvedModel(MODEL),
      prompt_tokens: usage.input_tokens,
      completion_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
      status: "success",
      client_id: ticket.client_id,
      metadata: { ticket_id: ticket.ticket_id, scope: ticket_id },
    });

    return new Response(JSON.stringify({ success: true, analysis, id: saved?.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    if (e instanceof AiError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    console.error("case-strategy-ai error:", e);
    // Intentar loggear el fallo (best-effort)
    try {
      const ctx = await requireAuth(req).catch(() => null);
      if (ctx) {
        await ctx.adminClient.from("ai_usage_logs").insert({
          function_name: FUNCTION_NAME,
          model: MODEL,
          status: "error",
          error_message: String(e?.message ?? e).slice(0, 500),
        });
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: e?.message ?? "Error desconocido" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
