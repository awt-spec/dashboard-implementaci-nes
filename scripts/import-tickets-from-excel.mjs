#!/usr/bin/env bun
/**
 * Bulk import — Excel "Reporte de Boletas 2026, CONSOLIDADO 24042026.xlsx"
 *
 * Genera una migración SQL one-shot que:
 *   1. UPSERT 4 clientes nuevos (afp-atlantida, micitt, sofimsa, cmi-leasing)
 *   2. UPDATE crg-credit-rural.country = 'Guinea' (corrección)
 *   3. INSERT 575 support_tickets con ON CONFLICT (client_id, ticket_id) DO NOTHING
 *
 * El SQL se emite en supabase/migrations/<timestamp>_import_tickets_excel.sql
 * y se aplica via `supabase db push`.
 *
 * Uso:
 *   bun run scripts/import-tickets-from-excel.mjs
 *
 * Idempotente: re-correr regenera el SQL pero la migración ya aplicada queda.
 * Si querés re-importar: bumpea el timestamp en el filename antes de re-correr.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const XLSX_PATH = "/Users/awt/Downloads/Reporte de Boletas 2026, CONSOLIDADO 24042026.xlsx";

// ─── 1. Extraer xlsx ──────────────────────────────────────────────────────

const TMPDIR = "/tmp/sva-import-xlsx";
if (existsSync(TMPDIR)) rmSync(TMPDIR, { recursive: true, force: true });
mkdirSync(TMPDIR, { recursive: true });

const cpRes = spawnSync("cp", [XLSX_PATH, `${TMPDIR}/file.xlsx`]);
if (cpRes.status !== 0) {
  console.error(`No se pudo copiar el xlsx: ${XLSX_PATH}`);
  process.exit(2);
}
const unzipRes = spawnSync("unzip", ["-o", `${TMPDIR}/file.xlsx`, "-d", `${TMPDIR}/unpacked`]);
if (unzipRes.status !== 0) {
  console.error("unzip failed");
  process.exit(2);
}

const ssXml = readFileSync(`${TMPDIR}/unpacked/xl/sharedStrings.xml`, "utf8");
const sheetXml = readFileSync(`${TMPDIR}/unpacked/xl/worksheets/sheet1.xml`, "utf8");

const strings = [...ssXml.matchAll(/<si><t[^>]*>([^<]*)<\/t><\/si>/g)].map((m) => m[1]);

// ─── 2. Parsear filas ─────────────────────────────────────────────────────

const rowRe = /<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
const cellRe = /<c r="([A-Z]+)(\d+)"(?:[^>]*?t="([^"]+)")?[^>]*?>(?:<v>([^<]*)<\/v>)?<\/c>/g;
const rows = [];
let rm;
while ((rm = rowRe.exec(sheetXml))) {
  const cells = {};
  const inner = rm[2];
  let cm;
  while ((cm = cellRe.exec(inner))) {
    const col = cm[1];
    const type = cm[3];
    const val = cm[4];
    if (val === undefined || val === "") {
      cells[col] = "";
      continue;
    }
    if (type === "s") cells[col] = strings[parseInt(val)] ?? "";
    else cells[col] = val;
  }
  rows.push(cells);
}

const HEADERS = {
  B: "producto",
  C: "id",
  D: "cons_cliente",
  E: "cliente",
  F: "asunto",
  G: "fecha_registro",
  H: "tipo",
  I: "prioridad",
  J: "estado",
};

const records = rows
  .slice(1) // skip header row
  .map((r) => {
    const o = {};
    for (const [col, key] of Object.entries(HEADERS)) o[key] = (r[col] ?? "").trim();
    return o;
  })
  .filter((r) => r.id && r.cliente && r.asunto); // descartar rows totalmente vacías

console.log(`✓ Excel parseado: ${records.length} filas con datos`);

// ─── 3. Mapeo de clientes ─────────────────────────────────────────────────

const CLIENT_MAP = new Map();
const addAlias = (alias, id) => CLIENT_MAP.set(alias.toLowerCase(), id);

// Match directo (existentes)
addAlias("AFP ATLÁNTICO", "afp-atlantico");
addAlias("AFPC Occidente", "afpc-occidente");
addAlias("Banco de Bogotá", "banco-bogota");
addAlias("CFE PANAMÁ", "cfe-panama");
addAlias("Coopecar", "coopecar");
addAlias("Credicefi", "credicefi");
addAlias("FACTOR Y VALOR", "factor-y-valor");
addAlias("Fafidess", "fafidess");
addAlias("FIACG", "fiacg");
addAlias("Fundap", "fundap");
addAlias("INS Filemaster", "ins-filemaster");
addAlias("MECZY", "meczy");
addAlias("CMI", "cmi");
addAlias("KAFO JIGINEW", "kafo-jiginew");

// Variantes a existentes
addAlias("MUNICIPALIDAD DE ESCAZÚ", "mun-escazu");
addAlias("Quiero Confianza (ION)", "quiero-confianza");
addAlias("CRG CREDIT RURAL DE GUINEE", "crg-credit-rural");

// Nuevos (consolidados)
addAlias("AFP Atlántida", "afp-atlantida");
addAlias("AFP Atlántida Implem 11g", "afp-atlantida"); // mismo cliente
addAlias("AFP Atlántida SAF", "afp-atlantida"); // mismo cliente
addAlias("Micitt", "micitt");
addAlias("SOFIMSA", "sofimsa");
addAlias("Sofimsa", "sofimsa"); // case-insensitive dedup explícito
addAlias("CMI Leasing S.A.", "cmi-leasing");

function resolveClientId(name) {
  return CLIENT_MAP.get(name.trim().toLowerCase());
}

// Verificar mapeo
const unmapped = new Set();
for (const r of records) {
  if (!resolveClientId(r.cliente)) unmapped.add(r.cliente);
}
if (unmapped.size > 0) {
  console.error(`✗ Clientes sin mapeo (${unmapped.size}):`);
  for (const u of unmapped) console.error(`    "${u}"`);
  process.exit(2);
}
console.log(`✓ Mapeo de clientes: 0 huérfanos`);

// ─── 4. Helpers SQL ───────────────────────────────────────────────────────

function sqlEsc(s) {
  if (s === null || s === undefined || s === "") return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

function excelSerialToISO(serial) {
  if (!serial) return null;
  const num = parseFloat(serial);
  if (isNaN(num)) return null;
  // Excel epoch: 1900-01-01 (con bug Lotus 1-2-3 día 60). Offset Unix = 25569.
  const ms = (num - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (d.getFullYear() < 2020 || d.getFullYear() > 2030) return null;
  return d.toISOString().slice(0, 10);
}

function diffDaysFromNow(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

// Validar conversión de fecha con muestra (row 1 = 46090 → ~2026-03-30)
const sampleDate = excelSerialToISO("46090");
if (!sampleDate || sampleDate < "2026-01-01" || sampleDate > "2026-06-30") {
  console.error(`✗ Conversión de fecha inválida: 46090 → ${sampleDate} (esperado ~2026-03-30)`);
  process.exit(2);
}
console.log(`✓ Conversión de fechas OK (sample 46090 → ${sampleDate})`);

// ─── 5. Distribución pre-import ───────────────────────────────────────────

const dist = { byEstado: {}, byTipo: {}, byCliente: {} };
for (const r of records) {
  dist.byEstado[r.estado] = (dist.byEstado[r.estado] || 0) + 1;
  dist.byTipo[r.tipo] = (dist.byTipo[r.tipo] || 0) + 1;
  const cid = resolveClientId(r.cliente);
  dist.byCliente[cid] = (dist.byCliente[cid] || 0) + 1;
}
console.log(`\n✓ Distribución a importar:`);
console.log(`  Estados:`);
Object.entries(dist.byEstado)
  .sort((a, b) => b[1] - a[1])
  .forEach(([s, n]) => console.log(`    ${String(n).padStart(4)} ${s}`));
console.log(`  Clientes (top 10):`);
Object.entries(dist.byCliente)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([c, n]) => console.log(`    ${String(n).padStart(4)} ${c}`));

// ─── 6. Generar migración SQL ─────────────────────────────────────────────

const NEW_CLIENTS = [
  ["afp-atlantida",  "AFP Atlántida",     "Honduras",   "Pensiones",      "Mesa AFP Atlántida",  "soporte@afpatlantida.hn", "2024-01-01", "2026-12-31", "activo", 55],
  ["micitt",         "Micitt",            "Costa Rica", "Sector Público", "Mesa MICITT",         "soporte@micitt.go.cr",    "2024-06-01", "2026-12-31", "activo", 45],
  ["sofimsa",        "SOFIMSA",           "Honduras",   "Microfinanzas",  "Mesa SOFIMSA",        "soporte@sofimsa.hn",      "2024-03-01", "2026-12-31", "activo", 50],
  ["cmi-leasing",    "CMI Leasing S.A.",  "Guatemala",  "Leasing",        "Mesa CMI Leasing",    "soporte@cmileasing.gt",   "2024-02-01", "2026-12-31", "activo", 50],
];

let sql = `-- ════════════════════════════════════════════════════════════════════════════
-- IMPORT MASIVO — 575 tickets de soporte (Excel CONSOLIDADO 24/04/2026)
--
-- Fuente: María Fernanda (COO) + Hellen — extracción DevOps + estados manuales
-- de Hellen como autoridad client-facing.
--
-- Generado por scripts/import-tickets-from-excel.mjs
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Crear/actualizar clientes nuevos ─────────────────────────────────
INSERT INTO public.clients (id, name, country, industry, contact_name, contact_email,
  contract_start, contract_end, status, progress, team_assigned, client_type)
VALUES
`;
sql += NEW_CLIENTS.map(
  ([id, name, country, industry, contact, email, cs, ce, status, progress]) =>
    `  (${sqlEsc(id)}, ${sqlEsc(name)}, ${sqlEsc(country)}, ${sqlEsc(industry)}, ${sqlEsc(contact)}, ${sqlEsc(email)}, ${sqlEsc(cs)}::date, ${sqlEsc(ce)}::date, ${sqlEsc(status)}, ${progress}, '{}', 'soporte')`
).join(",\n");
sql += `
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  country = EXCLUDED.country,
  industry = EXCLUDED.industry,
  status = EXCLUDED.status,
  client_type = EXCLUDED.client_type;

-- ─── 2. Corrección: CRG Credit Rural está en Guinea (no Costa Rica) ──────
UPDATE public.clients SET country = 'Guinea' WHERE id = 'crg-credit-rural';

-- ─── 3. INSERT bulk de tickets (idempotente vía ON CONFLICT) ─────────────
-- Omitimos consecutivo_global y consecutivo_cliente: el trigger
-- assign_ticket_consecutivos los rellena automáticamente.
-- ticket_id viene del Excel y se respeta porque el trigger solo genera si NULL.
INSERT INTO public.support_tickets
  (client_id, ticket_id, producto, asunto, tipo, prioridad, estado,
   fecha_registro, fuente, notas, dias_antiguedad)
VALUES
`;

const valueRows = [];
for (const r of records) {
  const cid = resolveClientId(r.cliente);
  const fecha = excelSerialToISO(r.fecha_registro);
  const dias = diffDaysFromNow(fecha);
  const producto = r.producto || "General";
  const tipo = r.tipo || "Requerimiento";
  const prioridad = r.prioridad || "Media";
  const notas = r.cons_cliente ? `Cons. cliente original: ${r.cons_cliente}` : null;

  valueRows.push(
    `  (${sqlEsc(cid)}, ${sqlEsc(r.id)}, ${sqlEsc(producto)}, ${sqlEsc(r.asunto)}, ${sqlEsc(tipo)}, ${sqlEsc(prioridad)}, ${sqlEsc(r.estado)}, ${fecha ? sqlEsc(fecha) + "::date" : "NULL"}, 'devops', ${sqlEsc(notas)}, ${dias})`
  );
}
sql += valueRows.join(",\n");
sql += `
ON CONFLICT (client_id, ticket_id) DO NOTHING;

-- ─── 4. Reporte (NOTICE) ──────────────────────────────────────────────────
DO $report$
DECLARE
  v_total INTEGER;
  v_devops INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.support_tickets;
  SELECT COUNT(*) INTO v_devops FROM public.support_tickets WHERE fuente = 'devops';
  RAISE NOTICE 'Total tickets: %, de los cuales fuente=devops: %', v_total, v_devops;
END;
$report$;
`;

// ─── 7. Escribir migración ────────────────────────────────────────────────

const ts = new Date().toISOString().replace(/[-T:]/g, "").slice(0, 14);
// Usar fecha 20260430120000 — un slot después de la última migración
const migrationName = `20260430120000_import_tickets_excel_24042026.sql`;
const outPath = resolve(REPO_ROOT, "supabase", "migrations", migrationName);
writeFileSync(outPath, sql);
const sizeKB = (statSync(outPath).size / 1024).toFixed(1);
console.log(`\n✓ Migración escrita: ${outPath} (${sizeKB} KB, ${valueRows.length} INSERT VALUES)`);
console.log(`\nPara aplicar:`);
console.log(`  cd ${REPO_ROOT}`);
console.log(`  SUPABASE_ACCESS_TOKEN="..." supabase db push --include-all --yes`);
