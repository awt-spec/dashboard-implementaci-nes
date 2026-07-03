import { corsHeaders, corsPreflight, aiTool, AiError, resolvedModel } from "../_shared/cors.ts";
import { AuthError, requireAuth, requireRole } from "../_shared/auth.ts";
import { logAiCall, checkRateLimit, assertNotCliente } from "../_shared/aiSafety.ts";

/**
 * analyze-contract-ai
 * Analiza un contrato de servicio (cláusulas, valores, SLAs) y devuelve
 * riesgos, obligaciones y recomendaciones.
 * Input:  { contract_id: string }
 * Output: { success, analysis, id }
 * Persiste en client_contracts.ai_analysis + pm_ai_analysis (analysis_type='contract').
 */

const MODEL = "gemini-2.5-flash-lite";
const FUNCTION_NAME = "analyze-contract-ai";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  let ctx: any = null;
  let contract_id_for_log: string | null = null;
  let client_id_for_log: string | null = null;
  try {
    ctx = await requireAuth(req);
    await assertNotCliente(ctx);
    await requireRole(ctx, ["admin", "pm", "gerente", "colaborador"]);
    await checkRateLimit(ctx.adminClient, ctx.userId, FUNCTION_NAME, 20);

    const { contract_id, document_text } = await req.json().catch(() => ({}));
    const docText = typeof document_text === "string" ? document_text.slice(0, 60000) : null;
    if (!contract_id || typeof contract_id !== "string") {
      return new Response(JSON.stringify({ error: "contract_id requerido" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    contract_id_for_log = contract_id;
    const db = ctx.adminClient;

    const { data: contract, error: cErr } = await db
      .from("client_contracts").select("*").eq("id", contract_id).single();
    if (cErr || !contract) {
      return new Response(JSON.stringify({ error: "Contrato no encontrado" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    client_id_for_log = contract.client_id ?? null;

    const { data: client } = await db
      .from("clients").select("id, name, country, industry").eq("id", contract.client_id).maybeSingle();
    const { data: slas } = await db
      .from("client_slas").select("priority_level, case_type, response_time_hours, resolution_time_hours, penalty_amount, penalty_description, is_active")
      .eq("client_id", contract.client_id).eq("is_active", true);

    const context = {
      cliente: client ?? { id: contract.client_id },
      contrato: {
        tipo: contract.contract_type,
        valor_mensual: contract.monthly_value,
        tarifa_hora: contract.hourly_rate,
        horas_incluidas: contract.included_hours,
        moneda: contract.currency,
        inicio: contract.start_date,
        fin: contract.end_date,
        renovacion_automatica: contract.auto_renewal,
        terminos_pago: contract.payment_terms,
        clausula_penalidad: contract.penalty_clause,
        notas: contract.notes,
        clausulado: contract.clauses,
      },
      // Texto completo del documento de contrato subido por el usuario (si aplica).
      documento_subido: docText ?? undefined,
      slas: slas ?? [],
    };

    const systemPrompt = `Eres un abogado corporativo y consultor de contratos de servicios TI con experiencia en instituciones financieras de LATAM (SYSDE: SAF+, banca, pensiones). Analizas contratos de soporte/mantenimiento de software: identificas obligaciones, riesgos legales y comerciales, vacíos, y das recomendaciones accionables. Eres preciso, directo y en español neutro. Si hay penalidades o exposición financiera, la cuantificas.`;

    const userPrompt = `Analiza este contrato y su clausulado, y devuelve un análisis estructurado:\n\n${JSON.stringify(context, null, 2)}`;

    const { result: analysis, usage } = await aiTool<any>({
      model: MODEL,
      system: systemPrompt,
      userPrompt,
      maxTokens: 4096,
      timeoutMs: 45000,
      tool: {
        name: "contract_analysis",
        description: "Análisis estructurado del contrato de servicios",
        input_schema: {
          type: "object",
          properties: {
            resumen_ejecutivo: { type: "string", description: "2-4 frases: qué tipo de contrato es, alcance y postura general de riesgo." },
            obligaciones: {
              type: "array",
              description: "Obligaciones clave de cada parte derivadas del clausulado.",
              items: {
                type: "object",
                properties: {
                  parte: { type: "string", enum: ["SYSDE", "Cliente", "Ambas"] },
                  obligacion: { type: "string" },
                },
                required: ["parte", "obligacion"],
              },
            },
            riesgos: {
              type: "array",
              description: "Riesgos legales/comerciales ordenados por severidad descendente.",
              items: {
                type: "object",
                properties: {
                  titulo: { type: "string" },
                  severidad: { type: "string", enum: ["critico", "alto", "medio", "bajo"] },
                  impacto: { type: "string", description: "Impacto financiero/operativo, cuantificado si aplica." },
                  mitigacion: { type: "string" },
                },
                required: ["titulo", "severidad", "mitigacion"],
              },
            },
            vacios_o_ambiguedades: {
              type: "array",
              description: "Cláusulas faltantes o ambiguas que conviene cerrar. Array vacío si no hay.",
              items: { type: "string" },
            },
            hitos_facturacion: {
              type: "array",
              description: "Hitos FACTURABLES pactados en el contrato (no recurrentes), en orden. Cada uno con la condición que lo dispara y la cláusula que lo origina. Array vacío si el contrato no define hitos facturables explícitos.",
              items: {
                type: "object",
                properties: {
                  numero: { type: "number", description: "Orden del hito (1, 2, 3…)." },
                  descripcion: { type: "string", description: "Qué se factura en este hito." },
                  condicion: { type: "string", description: "Evento/condición que lo dispara (ej. 'cierre de parametrización con acta', 'entrega de ambiente')." },
                  clausula_referencia: { type: "string", description: "Cláusula/sección del contrato que lo origina (ej. 'Cláusula 5.2')." },
                  porcentaje: { type: "number", description: "% del contrato/valor que representa, si aplica." },
                  monto: { type: "number", description: "Monto fijo, si el contrato lo especifica." },
                  horas: { type: "number", description: "Horas asociadas, si aplica." },
                },
                required: ["descripcion", "condicion"],
              },
            },
            recomendaciones: {
              type: "array",
              description: "Acciones concretas recomendadas (renegociar, agregar cláusula, etc.).",
              items: { type: "string" },
            },
            confianza: { type: "number", description: "Confianza del análisis 0-100 según calidad del clausulado disponible." },
          },
          required: ["resumen_ejecutivo", "obligaciones", "riesgos", "recomendaciones", "confianza"],
        },
      },
    });

    const { data: saved } = await db.from("pm_ai_analysis").insert({
      analysis_type: "contract",
      scope: contract_id,
      executive_summary: analysis.resumen_ejecutivo,
      recommendations: analysis.recomendaciones ?? [],
      risks: analysis.riesgos ?? [],
      metrics: { confianza: analysis.confianza, slas_count: (slas ?? []).length },
      full_analysis: analysis,
      model: MODEL,
    }).select().single();

    // Guardar el análisis en el propio contrato para mostrarlo sin recomputar.
    // Si se subió un documento y el contrato no tenía clausulado, lo persistimos.
    await db.from("client_contracts")
      .update({
        ai_analysis: { ...analysis, generated_at: new Date().toISOString() },
        ...(docText && !contract.clauses ? { clauses: docText } : {}),
      })
      .eq("id", contract_id);

    // Persistir los hitos de facturación extraídos como entidades. Solo se
    // reemplazan los propuestos por IA (los confirmados/cumplidos por humanos
    // se preservan).
    const hitos = Array.isArray(analysis.hitos_facturacion) ? analysis.hitos_facturacion : [];
    if (hitos.length > 0) {
      await db.from("contract_milestones")
        .delete()
        .eq("contract_id", contract_id)
        .eq("status", "propuesto")
        .eq("source", "ia");
      const rows = hitos.map((h: any, i: number) => ({
        contract_id,
        client_id: contract.client_id ?? null,
        numero: h.numero ?? i + 1,
        descripcion: h.descripcion,
        condicion: h.condicion ?? null,
        clausula_referencia: h.clausula_referencia ?? null,
        porcentaje: h.porcentaje ?? null,
        monto: h.monto ?? null,
        horas: h.horas ?? null,
        moneda: contract.currency ?? null,
        status: "propuesto",
        source: "ia",
      }));
      await db.from("contract_milestones").insert(rows);
    }

    await logAiCall(db, {
      function_name: FUNCTION_NAME,
      model: resolvedModel(MODEL),
      user_id: ctx.userId,
      scope: contract_id,
      client_id: contract.client_id,
      redacted: false,
      status: "success",
      prompt_tokens: usage.input_tokens,
      completion_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
      metadata: { contract_type: contract.contract_type },
    });

    return new Response(JSON.stringify({ success: true, analysis, id: saved?.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status ?? 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (e instanceof AiError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status ?? 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: e?.message ?? "Error desconocido" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
