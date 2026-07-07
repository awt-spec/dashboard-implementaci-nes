import { corsHeaders, corsPreflight, aiTool, AiError, resolvedModel } from "../_shared/cors.ts";
import { AuthError, requireAuth, requireRole } from "../_shared/auth.ts";
import { logAiCall, checkRateLimit, assertNotCliente } from "../_shared/aiSafety.ts";

// ─────────────────────────────────────────────────────────────────────────────
// audit-contract-scope — Auditor de contrato · Capa 2 (alcance, IA/RAG)
//
// Responde "no realizar gestiones fuera del contrato". Recupera el ALCANCE del
// contrato desde la KB (match_contract_chunks) y clasifica los tickets/gestiones
// recientes del cliente como dentro / fuera / dudoso de alcance, fundamentado en
// la evidencia recuperada (no en suposiciones).
//
// Resultado ADVISORY: se persiste en pm_ai_analysis para revisión; no dispara
// acciones destructivas. Un humano decide qué hacer con los "fuera de alcance".
//
// Requiere: GEMINI_API_KEY (embeddings) + la ruta Claude (aiTool) para el juicio.
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = "gemini-2.5-flash-lite"; // el gateway lo normaliza a Claude
const FUNCTION_NAME = "audit-contract-scope";
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIM = 1536;
const MAX_TICKETS = 30;

const SCOPE_QUERIES = [
  "objeto y alcance del contrato, servicios incluidos, módulos y sistemas cubiertos",
  "exclusiones del contrato, qué no cubre, actividades fuera de alcance, desarrollos nuevos vs soporte",
];

async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] }, outputDimensionality: EMBED_DIM }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new AiError(resp.status === 429 ? 429 : 502, `Embeddings ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  return json.embedding.values as number[];
}

const toVectorLiteral = (v: number[]) => "[" + v.join(",") + "]";

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

    // Clausulado del contrato (fallback de alcance + moneda). Por contract_id si
    // viene; si no, el contrato activo del cliente.
    const contractSel = contract_id
      ? db.from("client_contracts").select("clauses").eq("id", contract_id)
      : db.from("client_contracts").select("clauses").eq("client_id", client_id).eq("is_active", true).order("included_hours", { ascending: false });
    const { data: contractRow } = await contractSel.limit(1).maybeSingle();
    const clausesText = typeof (contractRow as any)?.clauses === "string" ? (contractRow as any).clauses : "";

    // ── Recuperar el alcance: preferimos la KB (RAG); si no hay chunks
    //    ingestados (o falla), caemos al clausulado del contrato. ────────────
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const scopeChunks = new Map<string, string>();
    if (GEMINI_API_KEY) {
      try {
        for (const q of SCOPE_QUERIES) {
          const qvec = await embedQuery(q, GEMINI_API_KEY);
          const { data: rows } = await db.rpc("match_contract_chunks", {
            query_embedding: toVectorLiteral(qvec),
            match_count: 6,
            p_client_id: client_id,
          });
          for (const r of (rows ?? []) as any[]) scopeChunks.set(r.id, r.content);
        }
      } catch (_e) { /* si la KB falla, usamos el clausulado */ }
    }

    let scopeText = "";
    let scopeSource: "kb" | "clausulado" | "" = "";
    if (scopeChunks.size > 0) {
      scopeText = [...scopeChunks.values()].join("\n\n---\n\n").slice(0, 20000);
      scopeSource = "kb";
    } else if (clausesText.trim().length > 40) {
      scopeText = clausesText.slice(0, 30000);
      scopeSource = "clausulado";
    }

    if (!scopeText) {
      return new Response(JSON.stringify({
        error: "No hay alcance disponible: ni contrato ingestado en la KB ni clausulado registrado en el contrato. Subí el contrato a la Base de conocimiento o registrá su clausulado.",
      }), { status: 409, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── Tickets/gestiones recientes a evaluar ─────────────────────────────
    const { data: tickets, error: tErr } = await db
      .from("support_tickets")
      .select("ticket_id, asunto, tipo, descripcion, estado, created_at")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(MAX_TICKETS);
    if (tErr) throw tErr;

    if (!tickets || tickets.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        audit: { resumen: "No hay gestiones recientes para auditar.", hallazgos: [] },
        evaluated: 0, scope_chunks: scopeChunks.size,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const ticketsForPrompt = tickets.map((t: any) => ({
      ticket_id: t.ticket_id,
      asunto: t.asunto,
      tipo: t.tipo,
      descripcion: typeof t.descripcion === "string" ? t.descripcion.slice(0, 300) : null,
    }));

    const systemPrompt = `Eres un auditor de cumplimiento contractual de SYSDE (soporte/mantenimiento de software para banca y pensiones). Tu tarea: determinar si cada gestión (ticket) cae DENTRO o FUERA del alcance del contrato, o si es DUDOSO. REGLAS: (1) Juzga SOLO con base en el alcance provisto; no inventes cláusulas. (2) Típico fuera de alcance: desarrollos nuevos no contemplados, integraciones no pactadas, capacitaciones fuera de lo acordado, trabajo de terceros/otros módulos. (3) Si el alcance no permite decidir, marca 'dudoso'. (4) Sé conservador: ante señal fuerte de exceso, marca 'fuera'; ante ambigüedad, 'dudoso'. Español neutro.`;

    const userPrompt = `ALCANCE DEL CONTRATO (fragmentos recuperados):\n\n${scopeText}\n\n---\n\nGESTIONES A EVALUAR (JSON):\n\n${JSON.stringify(ticketsForPrompt, null, 2)}`;

    const { result: audit, usage } = await aiTool<any>({
      model: MODEL,
      system: systemPrompt,
      userPrompt,
      maxTokens: 4096,
      timeoutMs: 45000,
      tool: {
        name: "scope_audit",
        description: "Clasificación de cada gestión según el alcance del contrato.",
        input_schema: {
          type: "object",
          properties: {
            resumen: { type: "string", description: "2-3 frases: postura general de cumplimiento de alcance y cuántas gestiones parecen fuera." },
            hallazgos: {
              type: "array",
              description: "Una entrada por gestión evaluada.",
              items: {
                type: "object",
                properties: {
                  ticket_id: { type: "string" },
                  asunto: { type: "string" },
                  veredicto: { type: "string", enum: ["dentro", "fuera", "dudoso"] },
                  razon: { type: "string", description: "Justificación breve citando el alcance." },
                  confianza: { type: "number", description: "0-100." },
                },
                required: ["ticket_id", "veredicto", "razon"],
              },
            },
          },
          required: ["resumen", "hallazgos"],
        },
      },
    });

    const hallazgos = Array.isArray(audit.hallazgos) ? audit.hallazgos : [];
    const fuera = hallazgos.filter((h: any) => h.veredicto === "fuera").length;
    const dudoso = hallazgos.filter((h: any) => h.veredicto === "dudoso").length;

    const { data: saved } = await db.from("pm_ai_analysis").insert({
      analysis_type: "contract_scope_audit",
      scope: contract_id ?? client_id,
      executive_summary: audit.resumen ?? "",
      recommendations: [],
      risks: [],
      metrics: { evaluados: hallazgos.length, fuera, dudoso, scope_chunks: scopeChunks.size, scope_source: scopeSource },
      full_analysis: audit,
      model: MODEL,
    }).select("id").single();

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
      metadata: { evaluados: hallazgos.length, fuera, dudoso },
    });

    return new Response(JSON.stringify({
      success: true,
      audit,
      evaluated: hallazgos.length,
      fuera,
      dudoso,
      scope_chunks: scopeChunks.size,
      scope_source: scopeSource,
      analysis_id: saved?.id,
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
    return new Response(JSON.stringify({ error: e?.message ?? "Error de auditoría de alcance" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
