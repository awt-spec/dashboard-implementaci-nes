import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireAuth, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

// ─────────────────────────────────────────────────────────────────────────────
// ingest-contract-doc — Frente A · Etapas 01 (ingesta) + 02 (embeddings)
//
// Recibe el TEXTO ya extraído de un contrato PDF (el frontend lo extrae con
// pdfjs-dist, igual que el flujo analyze-contract-ai), lo fragmenta con
// solapamiento, genera embeddings y persiste los chunks en el vector store
// (contract_document_chunks) para su posterior recuperación (RAG).
//
// Autorización: admin/pm (coincide con la política de escritura de la tabla).
// Corre con service_role (adminClient) → bypassa RLS para la escritura.
//
// Embeddings: Anthropic (el stack de chat) no expone API de embeddings, así que
// se usa Gemini (el secret GEMINI_API_KEY ya existe en el proyecto). Modelo
// gemini-embedding-001 con outputDimensionality=1536 para calzar vector(1536).
// La distancia coseno es invariante a la magnitud, así que no hace falta
// re-normalizar los vectores truncados.
// ─────────────────────────────────────────────────────────────────────────────

const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIM = 1536;                         // calza con vector(1536)
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`;
const EMBED_BATCH = 64;                          // textos por request de embeddings
const CHUNK_SIZE = 1400;                        // ~350 tokens por chunk
const CHUNK_OVERLAP = 180;                      // solapamiento para no cortar contexto

/** Fragmenta el texto en trozos con solapamiento, respetando límites de párrafo. */
function chunkText(raw: string): string[] {
  const text = raw.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!text) return [];

  // Cortes preferentes en dobles saltos de línea (párrafos).
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let buf = "";
  const flush = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = "";
  };

  for (const para of paras) {
    // Si un solo párrafo excede el tamaño, se parte por ventana deslizante.
    if (para.length > CHUNK_SIZE) {
      flush();
      let i = 0;
      while (i < para.length) {
        const slice = para.slice(i, i + CHUNK_SIZE);
        chunks.push(slice.trim());
        i += CHUNK_SIZE - CHUNK_OVERLAP;
      }
      continue;
    }
    if ((buf + "\n\n" + para).length > CHUNK_SIZE) flush();
    buf = buf ? buf + "\n\n" + para : para;
  }
  flush();

  // Solapamiento entre chunks consecutivos: se antepone la cola del anterior.
  if (chunks.length > 1 && CHUNK_OVERLAP > 0) {
    for (let i = 1; i < chunks.length; i++) {
      const prevTail = chunks[i - 1].slice(-CHUNK_OVERLAP);
      chunks[i] = (prevTail + " " + chunks[i]).trim();
    }
  }
  return chunks;
}

/** Genera embeddings para un lote de textos vía Gemini. Devuelve number[][]. */
async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const resp = await fetch(`${EMBED_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIM,
      })),
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new AuthError(resp.status === 429 ? 429 : 502, `Embeddings ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  return (json.embeddings as { values: number[] }[]).map((e) => e.values);
}

/** pgvector espera el literal "[a,b,c]" para castear a vector. */
function toVectorLiteral(vec: number[]): string {
  return "[" + vec.join(",") + "]";
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  let documentId: string | null = null;
  let admin: Awaited<ReturnType<typeof requireAuth>>["adminClient"] | null = null;

  try {
    const ctx = await requireAuth(req);
    await requireRole(ctx, ["admin", "pm"]);
    admin = ctx.adminClient;

    const body = await req.json();
    const {
      client_id,
      contract_id,
      document_text,
      storage_path,
      filename,
      mime_type,
      byte_size,
      page_count,
    } = body ?? {};

    if (!client_id) throw new AuthError(400, "client_id es requerido");
    if (!filename) throw new AuthError(400, "filename es requerido");
    if (typeof document_text !== "string" || document_text.trim().length < 20) {
      throw new AuthError(400, "document_text vacío o demasiado corto para ingestar");
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new AuthError(
        400,
        "GEMINI_API_KEY no configurada (proveedor de embeddings del vector store).",
      );
    }

    // 1) Registro del documento en estado 'ingesting'.
    const { data: doc, error: docErr } = await admin
      .from("contract_documents")
      .insert({
        client_id,
        contract_id: contract_id ?? null,
        storage_path: storage_path ?? "",
        filename,
        mime_type: mime_type ?? "application/pdf",
        byte_size: byte_size ?? null,
        page_count: page_count ?? null,
        status: "ingesting",
      })
      .select("id")
      .single();
    if (docErr) throw docErr;
    documentId = doc.id as string;

    // 2) Chunking.
    const chunks = chunkText(document_text);
    if (chunks.length === 0) throw new AuthError(400, "No se pudo fragmentar el documento");

    // 3) Embeddings por lotes + 4) inserción de chunks.
    let inserted = 0;
    for (let start = 0; start < chunks.length; start += EMBED_BATCH) {
      const slice = chunks.slice(start, start + EMBED_BATCH);
      const vectors = await embedBatch(slice, GEMINI_API_KEY);
      const rows = slice.map((content, i) => ({
        document_id: documentId,
        client_id,
        chunk_index: start + i,
        content,
        token_count: Math.ceil(content.length / 4),
        embedding: toVectorLiteral(vectors[i]),
        metadata: { model: EMBED_MODEL },
      }));
      const { error: insErr } = await admin.from("contract_document_chunks").insert(rows);
      if (insErr) throw insErr;
      inserted += rows.length;
    }

    // 5) Marcar ingestado.
    await admin
      .from("contract_documents")
      .update({ status: "ingested", chunk_count: inserted, error: null, updated_at: new Date().toISOString() })
      .eq("id", documentId);

    return new Response(
      JSON.stringify({ success: true, document_id: documentId, chunk_count: inserted }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    // Si ya se creó el documento, marcarlo 'failed' con el motivo.
    if (documentId && admin) {
      try {
        await admin
          .from("contract_documents")
          .update({ status: "failed", error: String(err?.message ?? err).slice(0, 500), updated_at: new Date().toISOString() })
          .eq("id", documentId);
      } catch { /* best-effort */ }
    }
    if (err instanceof AuthError) return authErrorResponse(err, cors);
    return new Response(JSON.stringify({ error: err?.message ?? "Error de ingesta" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
