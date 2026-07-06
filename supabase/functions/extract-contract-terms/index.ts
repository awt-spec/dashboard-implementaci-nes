import { corsHeaders, corsPreflight, aiTool, AiError, resolvedModel } from "../_shared/cors.ts";
import { AuthError, requireAuth, requireRole } from "../_shared/auth.ts";
import { logAiCall, checkRateLimit, assertNotCliente } from "../_shared/aiSafety.ts";

// ─────────────────────────────────────────────────────────────────────────────
// extract-contract-terms — Frente A · Etapa 03 (agente extractor RAG)
//
// Extracción estructurada de términos del contrato FUNDAMENTADA en el documento
// real ya ingestado (contract_document_chunks). En lugar de mandar el texto
// crudo truncado, recupera por similitud (match_contract_chunks) los fragmentos
// relevantes a cada aspecto y hace grounding sobre ellos → escala a contratos
// largos y cita la evidencia.
//
// Extrae: SLAs, paquetes de horas, hitos de facturación y disparadores de alerta.
//
// Escritura (segura):
//   • pm_ai_analysis  ← artefacto de revisión con toda la extracción (no destruye
//                       nada; queda para que un humano lo promueva).
//   • contract_milestones ← solo los hitos, como 'propuesto' (source='rag'),
//                       idempotente; preserva los confirmados/cumplidos por humanos.
//   Los SLAs y paquetes de horas NO se escriben en vivo (client_slas alimenta el
//   motor de SLA y no tiene flujo de propuesta): se devuelven para revisión.
//
// Embeddings de las queries de recuperación: OPENAI_API_KEY (text-embedding-3-small).
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = "gemini-2.5-flash-lite"; // el gateway lo normaliza a Claude
const FUNCTION_NAME = "extract-contract-terms";
const EMBED_URL = "https://api.openai.com/v1/embeddings";
const EMBED_MODEL = "text-embedding-3-small";
const TOP_K_PER_ASPECT = 6;

// Cada aspecto de extracción tiene una query de recuperación semántica.
const ASPECTS: { key: string; query: string }[] = [
  { key: "slas", query: "niveles de servicio SLA, tiempos de respuesta y resolución por prioridad, penalidades por incumplimiento, horario hábil" },
  { key: "horas", query: "paquetes de horas incluidas, tarifa por hora, reglas de acumulación y vencimiento de horas, bolsa de horas" },
  { key: "hitos", query: "hitos de facturación, condiciones de pago, entregables facturables, porcentajes y montos, cláusulas de pago" },
  { key: "alertas", query: "disparadores de alerta, umbrales, notificaciones, vencimientos, renovación automática, avisos previos" },
];

async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch(EMBED_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new AiError(resp.status === 429 ? 429 : 502, `Embeddings ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  return json.data[0].embedding as number[];
}

function toVectorLiteral(vec: number[]): string {
  return "[" + vec.join(",") + "]";
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);
    await assertNotCliente(ctx);
    await requireRole(ctx, ["admin", "pm"]);
    await checkRateLimit(ctx.adminClient, ctx.userId, FUNCTION_NAME, 15);

    const { client_id, contract_id } = await req.json().catch(() => ({}));
    if (!client_id || typeof client_id !== "string") {
      return new Response(JSON.stringify({ error: "client_id requerido" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const db = ctx.adminClient;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({
        error: "OPENAI_API_KEY no configurada. Set via `supabase secrets set OPENAI_API_KEY=sk-...` (embeddings del vector store).",
      }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Contexto del contrato (si se pasa) para moneda y metadatos.
    let contract: any = null;
    if (contract_id) {
      const { data } = await db.from("client_contracts").select("*").eq("id", contract_id).maybeSingle();
      contract = data ?? null;
    }

    // ── RAG: recuperar chunks relevantes por aspecto ──────────────────────
    const retrieved = new Map<string, { content: string; chunk_index: number; similarity: number }>();
    for (const aspect of ASPECTS) {
      const qvec = await embedQuery(aspect.query, OPENAI_API_KEY);
      const { data: rows, error: rpcErr } = await db.rpc("match_contract_chunks", {
        query_embedding: toVectorLiteral(qvec),
        match_count: TOP_K_PER_ASPECT,
        p_client_id: client_id,
      });
      if (rpcErr) throw rpcErr;
      for (const r of (rows ?? []) as any[]) {
        if (!retrieved.has(r.id)) {
          retrieved.set(r.id, { content: r.content, chunk_index: r.chunk_index, similarity: r.similarity });
        }
      }
    }

    if (retrieved.size === 0) {
      return new Response(JSON.stringify({
        error: "No hay documento de contrato ingestado para este cliente. Corré primero la ingesta (ingest-contract-doc).",
      }), { status: 409, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Ensamblar evidencia ordenada por posición en el documento.
    const evidence = [...retrieved.values()]
      .sort((a, b) => a.chunk_index - b.chunk_index)
      .map((r) => `[fragmento ${r.chunk_index}]\n${r.content}`)
      .join("\n\n---\n\n");

    const systemPrompt = `Eres un consultor de contratos de servicios TI de SYSDE (soporte/mantenimiento de software para banca y pensiones en LATAM). Extraes términos operativos y comerciales de contratos con precisión legal, en español neutro. REGLA CRÍTICA: extrae ÚNICAMENTE lo que esté respaldado por los fragmentos provistos. No inventes valores. Si un dato no aparece, omítelo. Cuando extraigas algo, referencia la cláusula/sección si el fragmento la menciona.`;

    const userPrompt = `A partir de estos fragmentos recuperados del contrato firmado, extrae los términos estructurados. Fragmentos:\n\n${evidence.slice(0, 48000)}`;

    const { result: extraction, usage } = await aiTool<any>({
      model: MODEL,
      system: systemPrompt,
      userPrompt,
      maxTokens: 4096,
      timeoutMs: 45000,
      tool: {
        name: "contract_terms",
        description: "Términos operativos y comerciales extraídos del contrato, fundamentados en los fragmentos.",
        input_schema: {
          type: "object",
          properties: {
            resumen: { type: "string", description: "2-3 frases: alcance de horas/SLA/facturación según el documento." },
            slas: {
              type: "array",
              description: "Niveles de servicio por prioridad. Vacío si el documento no los define.",
              items: {
                type: "object",
                properties: {
                  prioridad: { type: "string", description: "Nivel/prioridad (ej. Crítica, Alta, Media, Baja)." },
                  tipo_caso: { type: "string", description: "Tipo de caso si aplica." },
                  tiempo_respuesta_horas: { type: "number" },
                  tiempo_resolucion_horas: { type: "number" },
                  horario_habil_solo: { type: "boolean", description: "true si el SLA aplica solo en horario hábil." },
                  penalidad_monto: { type: "number" },
                  penalidad_descripcion: { type: "string" },
                  clausula_referencia: { type: "string" },
                },
                required: ["prioridad"],
              },
            },
            paquetes_horas: {
              type: "array",
              description: "Paquetes/bolsas de horas y sus reglas. Vacío si no aplica.",
              items: {
                type: "object",
                properties: {
                  descripcion: { type: "string" },
                  horas_incluidas: { type: "number" },
                  tarifa_hora: { type: "number" },
                  acumulacion: { type: "string", description: "Regla de acumulación (ej. no acumulables, acumulan hasta 3 meses)." },
                  vencimiento: { type: "string", description: "Regla de vencimiento de horas." },
                  clausula_referencia: { type: "string" },
                },
                required: ["descripcion"],
              },
            },
            hitos_facturacion: {
              type: "array",
              description: "Hitos facturables (no recurrentes) en orden, con su condición disparadora.",
              items: {
                type: "object",
                properties: {
                  numero: { type: "number" },
                  descripcion: { type: "string" },
                  condicion: { type: "string" },
                  clausula_referencia: { type: "string" },
                  porcentaje: { type: "number" },
                  monto: { type: "number" },
                  horas: { type: "number" },
                },
                required: ["descripcion", "condicion"],
              },
            },
            disparadores_alerta: {
              type: "array",
              description: "Condiciones que deben generar alerta (vencimientos, umbrales de horas, renovación).",
              items: {
                type: "object",
                properties: {
                  titulo: { type: "string" },
                  condicion: { type: "string" },
                  umbral: { type: "string" },
                  clausula_referencia: { type: "string" },
                },
                required: ["titulo", "condicion"],
              },
            },
            confianza: { type: "number", description: "Confianza 0-100 según cuán explícito es el documento." },
          },
          required: ["resumen", "confianza"],
        },
      },
    });

    // ── Persistir artefacto de revisión (no destructivo) ──────────────────
    const { data: saved } = await db.from("pm_ai_analysis").insert({
      analysis_type: "contract_extraction",
      scope: contract_id ?? client_id,
      executive_summary: extraction.resumen ?? "",
      recommendations: [],
      risks: [],
      metrics: {
        confianza: extraction.confianza,
        slas: (extraction.slas ?? []).length,
        paquetes_horas: (extraction.paquetes_horas ?? []).length,
        hitos: (extraction.hitos_facturacion ?? []).length,
        alertas: (extraction.disparadores_alerta ?? []).length,
        evidence_chunks: retrieved.size,
      },
      full_analysis: extraction,
      model: MODEL,
    }).select("id").single();

    // ── Hitos como 'propuesto' (source='rag'), idempotente ────────────────
    const hitos = Array.isArray(extraction.hitos_facturacion) ? extraction.hitos_facturacion : [];
    if (hitos.length > 0 && contract_id) {
      await db.from("contract_milestones")
        .delete()
        .eq("contract_id", contract_id)
        .eq("status", "propuesto")
        .in("source", ["ia", "rag"]);
      const rows = hitos.map((h: any, i: number) => ({
        contract_id,
        client_id,
        numero: h.numero ?? i + 1,
        descripcion: h.descripcion,
        condicion: h.condicion ?? null,
        clausula_referencia: h.clausula_referencia ?? null,
        porcentaje: h.porcentaje ?? null,
        monto: h.monto ?? null,
        horas: h.horas ?? null,
        moneda: contract?.currency ?? null,
        status: "propuesto",
        source: "rag",
      }));
      await db.from("contract_milestones").insert(rows);
    }

    await logAiCall(db, {
      function_name: FUNCTION_NAME,
      model: resolvedModel(MODEL),
      user_id: ctx.userId,
      scope: contract_id ?? client_id,
      client_id,
      redacted: false,
      status: "success",
      prompt_tokens: usage.input_tokens,
      completion_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
      metadata: { evidence_chunks: retrieved.size, milestones: hitos.length },
    });

    return new Response(JSON.stringify({
      success: true,
      extraction,
      evidence_chunks: retrieved.size,
      analysis_id: saved?.id,
      milestones_proposed: hitos.length,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
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
    return new Response(JSON.stringify({ error: e?.message ?? "Error de extracción" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
