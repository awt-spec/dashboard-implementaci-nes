#!/usr/bin/env bun
/**
 * Bulk import — 6 backlogs de implementación (Aurum, Apex, Dos Pinos, CMI, ARKFIN, AMC)
 *
 * Genera UNA migración SQL one-shot que:
 *   1. UPSERT 2 clientes nuevos (dos-pinos, amc) — los otros ya existen
 *   2. INSERT support_sprints únicos por (client_id, sprint_name) — ON CONFLICT skip
 *   3. INSERT support_tickets por cada work item (~2099) con sprint_id resuelto,
 *      ON CONFLICT (client_id, ticket_id) DO NOTHING para idempotencia.
 *
 * Mapeos:
 *   Work Item Type → tipo
 *     Task                 → "Requerimiento"
 *     Product Backlog Item → "Requerimiento"
 *     Bug                  → "Correccion"
 *   State → estado + scrum_status
 *     New           → PENDIENTE   / backlog
 *     To Do         → PENDIENTE   / ready
 *     Committed     → EN ATENCIÓN / in_sprint
 *     In Progress   → EN ATENCIÓN / in_progress
 *     Ready For QA  → VALORACIÓN  / in_progress
 *     Approved      → APROBADA    / done
 *     Done          → CERRADA     / done
 *
 * CMI: este backlog es del producto "Arrendamiento" (decisión COO — Factoraje
 * ya vive en soporte; Arrendamiento es implementación en proceso). producto=Arrendamiento.
 *
 * Uso:
 *   bun run scripts/import-implementation-backlogs.mjs
 *   SUPABASE_ACCESS_TOKEN=... supabase db push --include-all --yes
 */

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// ─── Config: archivos y mapping cliente ───────────────────────────────────

const FILES = [
  { path: "/Users/awt/Downloads/Grupo Aurum Team - Backlog items.csv", clientId: "aurum",      producto: "Implementación" },
  { path: "/Users/awt/Downloads/Grupo Apex Team - Backlog items.csv",  clientId: "apex",       producto: "Implementación" },
  { path: "/Users/awt/Downloads/Dos Pinos Team - Backlog items.csv",   clientId: "dos-pinos",  producto: "Implementación" },
  { path: "/Users/awt/Downloads/CMI Team - Backlog items.csv",         clientId: "cmi",        producto: "Arrendamiento" },
  { path: "/Users/awt/Downloads/ARKFIN Team - Backlog items.csv",      clientId: "arkfin",     producto: "Implementación" },
  { path: "/Users/awt/Downloads/AMC Team - Backlog items.csv",         clientId: "amc",        producto: "Implementación" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseCsv(text) {
  // Robust CSV parser (handles quoted commas + BOM)
  const out = [];
  let row = [];
  let cur = "";
  let inQ = false;
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur); cur = "";
        if (row.length > 1 || row[0] !== "") out.push(row);
        row = [];
      } else cur += c;
    }
  }
  if (cur || row.length) {
    row.push(cur);
    if (row.length > 1 || row[0] !== "") out.push(row);
  }
  return out;
}

function sqlEsc(s) {
  if (s === null || s === undefined || s === "") return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

const TIPO_MAP = {
  "Task": "Requerimiento",
  "Product Backlog Item": "Requerimiento",
  "Bug": "Correccion",
};
const STATE_MAP = {
  "New":           { estado: "PENDIENTE",    scrum: "backlog"     },
  "To Do":         { estado: "PENDIENTE",    scrum: "ready"       },
  "Committed":     { estado: "EN ATENCIÓN", scrum: "in_sprint"   },
  "In Progress":   { estado: "EN ATENCIÓN", scrum: "in_progress" },
  "Ready For QA":  { estado: "VALORACIÓN",  scrum: "in_progress" },
  "Approved":      { estado: "APROBADA",     scrum: "done"        },
  "Done":          { estado: "CERRADA",      scrum: "done"        },
};

// ─── Parse CSVs ───────────────────────────────────────────────────────────

const allItems = [];
const sprintsByClient = new Map();   // clientId → Set<sprintName>

for (const file of FILES) {
  const text = readFileSync(file.path, "utf8");
  const rows = parseCsv(text);
  const headers = rows[0];
  const get = (row, name) => {
    const i = headers.indexOf(name);
    return i >= 0 ? (row[i] ?? "") : "";
  };
  const data = rows.slice(1).filter(r => r.length > 1 && (get(r, "ID") || "").trim());

  for (const r of data) {
    const id = (get(r, "ID") || "").trim();
    if (!id) continue;
    const wit = (get(r, "Work Item Type") || "").trim();
    const t1 = (get(r, "Title 1") || "").trim();
    const t2 = (get(r, "Title 2") || "").trim();
    const t3 = (get(r, "Title 3") || "").trim();   // CMI only
    const state = (get(r, "State") || "").trim();
    const effort = (get(r, "Effort") || "").trim();
    const iterPath = (get(r, "Iteration Path") || "").trim();
    const tags = (get(r, "Tags") || "").trim();

    // Resolve sprint name from iteration path. Items in bare team folder → null sprint.
    let sprintName = null;
    if (iterPath.includes("\\")) {
      const parts = iterPath.split("\\");
      sprintName = parts[parts.length - 1].trim();   // último segmento = sprint
      if (!sprintsByClient.has(file.clientId)) sprintsByClient.set(file.clientId, new Set());
      sprintsByClient.get(file.clientId).add(sprintName);
    }

    // Compose subject from non-empty title columns (CMI uses 3, others 2)
    const asunto = [t1, t2, t3].filter(Boolean).join(" — ");

    const stMap = STATE_MAP[state] || { estado: "PENDIENTE", scrum: "backlog" };
    const tipoFinal = TIPO_MAP[wit] || "Requerimiento";

    allItems.push({
      clientId: file.clientId,
      producto: file.producto,
      ticketId: id,
      tipo: tipoFinal,
      asunto: asunto || "(sin título)",
      prioridad: "Media",   // CSVs no traen prioridad; default
      estado: stMap.estado,
      scrumStatus: stMap.scrum,
      sprintName,
      effort: effort && !isNaN(parseInt(effort)) ? parseInt(effort) : null,
      tags: tags || null,
      workItemType: wit,
      originalState: state,
    });
  }
}

console.log(`✓ Parseados ${allItems.length} work items de ${FILES.length} CSVs`);

// Dedup intra-CSV duplicates (por (clientId, ticketId))
const seen = new Set();
const unique = [];
let dupCount = 0;
for (const it of allItems) {
  const k = `${it.clientId}||${it.ticketId}`;
  if (seen.has(k)) { dupCount++; continue; }
  seen.add(k);
  unique.push(it);
}
if (dupCount > 0) console.log(`  (descartados ${dupCount} duplicados intra-CSV)`);

// ─── Generar SQL ──────────────────────────────────────────────────────────

const NEW_CLIENTS = [
  ["dos-pinos", "Dos Pinos",   "Costa Rica",   "Cooperativa Lechera", "Mesa Dos Pinos",  "soporte@dospinos.com",   "2024-01-01", "2026-12-31", "activo", 50],
  ["amc",       "AMC",         "El Salvador",  "Microfinanzas",       "Mesa AMC",        "soporte@amc.com.sv",     "2024-03-01", "2026-12-31", "activo", 45],
];

let sql = `-- ════════════════════════════════════════════════════════════════════════════
-- IMPORT MASIVO — Backlogs de implementación (Aurum, Apex, Dos Pinos, CMI, ARKFIN, AMC)
--
-- Fuente: 6 CSVs DevOps "Backlog items" exportados por María Fernanda (COO).
--   • Aurum, Apex, ARKFIN: clientes existentes
--   • Dos Pinos, AMC: clientes nuevos (creados aquí)
--   • CMI: cliente soporte existente; aquí va su backlog del producto "Arrendamiento"
--     (Factoraje queda en sus tickets soporte previos).
--
-- Mapeos:
--   Work Item Type:  Task/PBI → Requerimiento  ·  Bug → Correccion
--   State:           New → PENDIENTE/backlog
--                    To Do → PENDIENTE/ready
--                    Committed → EN ATENCIÓN/in_sprint
--                    In Progress → EN ATENCIÓN/in_progress
--                    Ready For QA → VALORACIÓN/in_progress
--                    Approved → APROBADA/done
--                    Done → CERRADA/done
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Crear/actualizar clientes nuevos ─────────────────────────────────
INSERT INTO public.clients (id, name, country, industry, contact_name, contact_email,
  contract_start, contract_end, status, progress, team_assigned, client_type)
VALUES
`;
sql += NEW_CLIENTS.map(
  ([id, name, country, industry, contact, email, cs, ce, status, progress]) =>
    `  (${sqlEsc(id)}, ${sqlEsc(name)}, ${sqlEsc(country)}, ${sqlEsc(industry)}, ${sqlEsc(contact)}, ${sqlEsc(email)}, ${sqlEsc(cs)}::date, ${sqlEsc(ce)}::date, ${sqlEsc(status)}, ${progress}, '{}', 'implementacion')`
).join(",\n");
sql += `
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, country = EXCLUDED.country, industry = EXCLUDED.industry,
  status = EXCLUDED.status, client_type = EXCLUDED.client_type;

-- ─── 2. Crear sprints únicos (idempotente vía ON CONFLICT en (client_id, name)) ──
-- Las fechas son placeholder en cuadrículas de 2 semanas a partir de 2024-01-01.
-- El COO puede ajustarlas después en la UI de Scrum.

DO $sprints$
DECLARE
  v_existing_count INT;
BEGIN
  -- Asegurar índice único para idempotencia (no-op si ya existe)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_support_sprints_client_name'
  ) THEN
    CREATE UNIQUE INDEX uq_support_sprints_client_name
      ON public.support_sprints(client_id, name);
  END IF;

  -- Insertar sprints
`;

const sprintRows = [];
let sprintInsertCount = 0;
for (const [clientId, names] of sprintsByClient) {
  const sortedNames = [...names].sort((a, b) => {
    // Sort numerically si "Sprint N"
    const ma = a.match(/(\d+)/);
    const mb = b.match(/(\d+)/);
    if (ma && mb) return parseInt(ma[1]) - parseInt(mb[1]);
    return a.localeCompare(b);
  });
  for (let i = 0; i < sortedNames.length; i++) {
    const sprintName = sortedNames[i];
    // Placeholder dates: cada sprint = 2 semanas, empezando 2024-01-01
    const sprintNum = (sprintName.match(/(\d+)/) || [null, i + 1])[1];
    const startMs = new Date("2024-01-01").getTime() + (parseInt(sprintNum) - 1) * 14 * 86400000;
    const endMs = startMs + 13 * 86400000;
    const startISO = new Date(startMs).toISOString().slice(0, 10);
    const endISO = new Date(endMs).toISOString().slice(0, 10);

    // Determinar status del sprint según los items
    const itemsInSprint = unique.filter(it => it.clientId === clientId && it.sprintName === sprintName);
    const allDone = itemsInSprint.length > 0 && itemsInSprint.every(it => it.scrumStatus === "done");
    const anyInProgress = itemsInSprint.some(it => it.scrumStatus === "in_progress" || it.scrumStatus === "in_sprint");
    const status = allDone ? "completado" : anyInProgress ? "activo" : "planificado";
    const capacityPoints = itemsInSprint.reduce((sum, it) => sum + (it.effort ?? 0), 0);

    sprintRows.push(
      `  INSERT INTO public.support_sprints (client_id, name, start_date, end_date, status, capacity_points) VALUES (${sqlEsc(clientId)}, ${sqlEsc(sprintName)}, ${sqlEsc(startISO)}::date, ${sqlEsc(endISO)}::date, ${sqlEsc(status)}, ${capacityPoints}) ON CONFLICT (client_id, name) DO NOTHING;`
    );
    sprintInsertCount++;
  }
}
sql += sprintRows.join("\n");
sql += `

  SELECT COUNT(*) INTO v_existing_count FROM public.support_sprints;
  RAISE NOTICE 'Sprints en BD después del INSERT: %', v_existing_count;
END;
$sprints$;

-- ─── 3. Bumpear la sequence consecutivo_global a MAX+1 ──────────────────
-- Necesario porque inserts previos pueden haber dejado la seq desincronizada
-- (ej. seeds con consecutivo_global explícito). Sin esto, el trigger
-- assign_ticket_consecutivos genera valores que colisionan con UNIQUE.
DO $bump_seq$
DECLARE
  v_max BIGINT;
BEGIN
  SELECT COALESCE(MAX(consecutivo_global), 0) INTO v_max FROM public.support_tickets;
  PERFORM setval('public.support_tickets_consecutivo_global_seq', v_max + 1, false);
  RAISE NOTICE 'Sequence consecutivo_global ajustada a %', v_max + 1;
END;
$bump_seq$;

-- ─── 4. Bulk INSERT tickets vinculados a sus sprints ─────────────────────
-- El sprint_id se resuelve via subquery por (client_id, sprint_name).
-- Si sprint_name es NULL (item en folder raíz del team), sprint_id queda NULL.

INSERT INTO public.support_tickets
  (client_id, ticket_id, producto, asunto, tipo, prioridad, estado,
   fecha_registro, fuente, dias_antiguedad,
   scrum_status, story_points, effort, sprint_id, notas)
VALUES
`;

// Compute fecha_registro placeholder by sprint start_date (or 2024-01-01)
const valueRows = [];
for (const it of unique) {
  let fechaRegistro = "2024-01-01";
  if (it.sprintName) {
    const m = it.sprintName.match(/(\d+)/);
    const num = m ? parseInt(m[1]) : 1;
    const ms = new Date("2024-01-01").getTime() + (num - 1) * 14 * 86400000;
    fechaRegistro = new Date(ms).toISOString().slice(0, 10);
  }
  const dias = Math.max(0, Math.floor((Date.now() - new Date(fechaRegistro).getTime()) / 86400000));

  // sprint_id: subquery por (client_id, sprint_name)
  const sprintIdSql = it.sprintName
    ? `(SELECT id FROM public.support_sprints WHERE client_id = ${sqlEsc(it.clientId)} AND name = ${sqlEsc(it.sprintName)} LIMIT 1)`
    : "NULL";

  const notas = `DevOps ${it.workItemType} · State original: ${it.originalState}${it.tags ? ` · Tags: ${it.tags}` : ""}`;

  valueRows.push(
    `  (${sqlEsc(it.clientId)}, ${sqlEsc(it.ticketId)}, ${sqlEsc(it.producto)}, ${sqlEsc(it.asunto.slice(0, 500))}, ${sqlEsc(it.tipo)}, ${sqlEsc(it.prioridad)}, ${sqlEsc(it.estado)}, ${sqlEsc(fechaRegistro)}::date, 'devops', ${dias}, ${sqlEsc(it.scrumStatus)}, ${it.effort ?? "NULL"}, ${it.effort ?? "NULL"}, ${sprintIdSql}, ${sqlEsc(notas)})`
  );
}
sql += valueRows.join(",\n");
sql += `
ON CONFLICT (client_id, ticket_id) DO NOTHING;

-- ─── 5. Reporte ───────────────────────────────────────────────────────────
DO $report$
DECLARE
  v_total_tickets INT;
  v_total_sprints INT;
  v_in_sprint     INT;
BEGIN
  SELECT COUNT(*) INTO v_total_tickets
    FROM public.support_tickets
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc')
      OR (client_id = 'cmi' AND producto = 'Arrendamiento');
  SELECT COUNT(*) INTO v_total_sprints
    FROM public.support_sprints;
  SELECT COUNT(*) INTO v_in_sprint
    FROM public.support_tickets
   WHERE sprint_id IS NOT NULL
     AND (client_id IN ('aurum','apex','dos-pinos','arkfin','amc')
       OR (client_id = 'cmi' AND producto = 'Arrendamiento'));
  RAISE NOTICE 'Implementation tickets: % | sprints: % | tickets en sprint: %',
    v_total_tickets, v_total_sprints, v_in_sprint;
END;
$report$;
`;

// ─── Escribir migración ───────────────────────────────────────────────────

const migrationName = `20260430140000_import_implementation_backlogs.sql`;
const outPath = resolve(REPO_ROOT, "supabase", "migrations", migrationName);
writeFileSync(outPath, sql);
const sizeKB = (statSync(outPath).size / 1024).toFixed(1);

// ─── Resumen consola ──────────────────────────────────────────────────────

const byClient = {};
const byState = {};
for (const it of unique) {
  byClient[it.clientId] = (byClient[it.clientId] || 0) + 1;
  byState[it.estado] = (byState[it.estado] || 0) + 1;
}
console.log(`\n✓ Distribución a importar:`);
console.log(`  Por cliente:`);
Object.entries(byClient).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`    ${String(n).padStart(5)} ${c}`));
console.log(`  Por estado:`);
Object.entries(byState).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`    ${String(n).padStart(5)} ${s}`));
console.log(`  Sprints únicos: ${sprintInsertCount}`);
console.log(`\n✓ Migración escrita: ${outPath} (${sizeKB} KB)`);
console.log(`\nPara aplicar:`);
console.log(`  cd ${REPO_ROOT}`);
console.log(`  SUPABASE_ACCESS_TOKEN=... supabase db push --include-all --yes`);
