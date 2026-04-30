#!/usr/bin/env bun
/**
 * Extrae responsables de los títulos de los 6 CSV de backlog y genera:
 *   1. SQL UPSERT a sysde_team_members con los colaboradores nuevos
 *   2. SQL UPDATE a tasks.owner basado en la abreviatura → nombre completo
 *
 * Convención SYSDE de abreviatura: primera letra(s) del nombre + apellido.
 * Ej: MAVARGAS = Maria Vargas, CRICO = Carlos Rico, OCASTRO = Orlando Castro.
 *
 * Mapeo construido con datos cruzados de:
 *   • data (1).csv (DevOps query con Assigned To completos)
 *   • Heurística de patrones SYSDE para los no presentes
 *
 * Output: supabase/migrations/<ts>_link_task_owners.sql
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// ─── 1. Mapeo abreviatura → { name, email } ──────────────────────────────
// Construido del DevOps CSV (data (1).csv) + heurísticas para los nuevos.
// Las abreviaturas comunes son: primera_letra+apellido (CRICO=Carlos Rico)
// o iniciales+apellido (MAVARGAS=Maria A. Vargas).
const MAP = {
  // ── Confirmados desde data (1).csv ──
  AJGOMEZ:    { name: "Andrés Julián Gómez",            email: "ajgomez-contratista@sysde.com" },
  AGOMEZ:     { name: "Andrés Julián Gómez",            email: "ajgomez-contratista@sysde.com" },
  CRICO:      { name: "Carlos Andrés Rico",             email: "crico@sysde.com" },
  CCAMBRONERO:{ name: "Cindy Alvarado Cambronero",      email: "calvarado@sysde.com" },
  CALVARADO:  { name: "Cindy Alvarado Cambronero",      email: "calvarado@sysde.com" },
  DBAQUEDANO: { name: "Daniel Baquedano",               email: "dbaquedano@sysde.com" },
  EORTIZ:     { name: "Eduardo Ortiz Ramírez",          email: "eortiz@sysde.com" },
  ERAMIREZ:   { name: "Eduardo Ortiz Ramírez",          email: "eortiz@sysde.com" },
  FCABALLERO: { name: "Fernando Caballero",             email: "fcaballero-contratista@sysde.com" },
  FPINTO:     { name: "Fernando Pinto",                 email: "fpinto-contratista@sysde.com" },
  GRAMOS:     { name: "Gabriel Ramos",                  email: "gramos@sysde.com" },
  HFERNANDEZ: { name: "Héctor Fernandez",               email: "hfernandez-contratista@sysde.com" },
  JARAGON:    { name: "John Aragon Cordoba",            email: "jaragon@sysde.com" },
  JCORDOBA:   { name: "John Aragon Cordoba",            email: "jaragon@sysde.com" },
  JMONTALVA:  { name: "Jonathan Montalva Miñan",        email: "jmontalva@sysde.com" },
  JPEREZ:     { name: "Juan Perez Villegas",            email: "jperez@sysde.com" },
  JVILLEGAS:  { name: "Juan Perez Villegas",            email: "jperez@sysde.com" },
  JRAMIREZ:   { name: "Juan Ramirez Horna",             email: "jramirez@sysde.com" },
  JHORNA:     { name: "Juan Ramirez Horna",             email: "jramirez@sysde.com" },
  LBONILLA:   { name: "Luis Gustavo Bonilla",           email: "lbonilla@sysde.com" },
  MANGULO:    { name: "Maria Fernanda Angulo Blanco",   email: "mangulo@sysde.com" },
  MAVARGAS:   { name: "Maria Nelly Vargas Salazar",     email: "mavargas-contratista@sysde.com" },
  MVARGAS:    { name: "Maria Nelly Vargas Salazar",     email: "mavargas-contratista@sysde.com" },
  OCASTRO:    { name: "Orlando Castro",                 email: "orlando.castro@sysde.com" },
  RVELILLA:   { name: "Rainer Velilla",                 email: "rvelilla-contratista@sysde.com" },
  SGUERRA:    { name: "Sandra Guerra",                  email: "sguerra-contratista@sysde.com" },
  SMEDINA:    { name: "Silvana Medina",                 email: "smedina@sysde.com" },
  SORTEGA:    { name: "Soledad Ortega",                 email: "sortega@sysde.com" },

  // ── Inferidos del contexto SYSDE (no en data (1).csv pero presentes en backlogs) ──
  LALFARO:    { name: "Luis Alfaro",                    email: "lalfaro-contratista@sysde.com" },
  LMALFARO:   { name: "Luis M. Alfaro",                 email: "lalfaro-contratista@sysde.com" },
  CQUESADA:   { name: "Carlos Quesada",                 email: "cquesada-contratista@sysde.com" },
  BHERNANDEZ: { name: "Bryan Hernandez",                email: "bhernandez-contratista@sysde.com" },
  OCUERVO:    { name: "Olga Lucia Cuervo",              email: "olga.lucia@sysde.com" },
  WGOMEZ:     { name: "Walter Gómez",                   email: "wgomez-contratista@sysde.com" },
  FNAVARRO:   { name: "Fauricio Navarro",               email: "navarro.fuentes@sysde.com" },
  DGARCIA:    { name: "Diego García",                   email: "dgarcia-contratista@sysde.com" },
  AVENEGAS:   { name: "Andrés Venegas",                 email: "avenegas-contratista@sysde.com" },
  MPISACRETA: { name: "Marco Pisacreta",                email: "mpisacreta-contratista@sysde.com" },
  LMANGEL:    { name: "Luis Mangel",                    email: "lmangel-contratista@sysde.com" },
  JBRENES:    { name: "Joaquín Brenes",                 email: "jbrenes-contratista@sysde.com" },
  ABRENES:    { name: "Adrián Brenes",                  email: "abrenes-contratista@sysde.com" },
  MARROYO:    { name: "Mario Arroyo",                   email: "marroyo-contratista@sysde.com" },
  AROJAS:     { name: "Alex Rojas",                     email: "arojas-contratista@sysde.com" },
};

// Algunas variantes de escritura que vimos
const ALIASES = {
  "C.QUESADA": "CQUESADA",
  "CQUEZADA":  "CQUESADA",
  "M.VARGAS":  "MVARGAS",
  "Mavargas":  "MAVARGAS",
  "O. Castro": "OCASTRO",
  "Luis Mangel": "LMANGEL",
  "Luis Alfaro": "LALFARO",
};

// ─── 2. Parser de CSV ────────────────────────────────────────────────────
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const out = [];
  let row = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
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
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out;
}

// ─── 3. Extraer abreviatura del título ───────────────────────────────────
function extractToken(title) {
  if (!title) return null;
  // Tokens al final separados por "-" o "|"
  const parts = title.split(/\s*[-|]\s*/).map(s => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    // Caso 1: ALL CAPS abbreviation, 4-12 chars, sin números/espacios
    if (/^[A-ZÁÉÍÓÚÑ]{4,12}$/.test(p)) return p.toUpperCase();
    // Caso 2: ALL CAPS con dot o variantes (M.VARGAS, C.QUESADA)
    if (/^[A-Z]\.[A-ZÁÉÍÓÚÑ]{3,}$/.test(p)) return p.replace(".","").toUpperCase();
    // Caso 3: "X. Apellido" → tomar como abreviatura
    const m = p.match(/^([A-Z])\.\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)$/);
    if (m) return (m[1] + m[2]).toUpperCase();
    // Caso 4: nombre completo tipo "Luis Mangel" — buscar en ALIASES
    if (ALIASES[p]) return ALIASES[p];
    // No es token de assignee, seguir buscando antes
    // Si es muy largo, parar (probablemente texto descriptivo)
    if (p.length > 25) return null;
  }
  return null;
}

// ─── 4. Procesar las 6 CSVs ──────────────────────────────────────────────
const FILES = [
  ["/Users/awt/Downloads/Grupo Aurum Team - Backlog items.csv", "aurum"],
  ["/Users/awt/Downloads/Grupo Apex Team - Backlog items.csv", "apex"],
  ["/Users/awt/Downloads/Dos Pinos Team - Backlog items.csv", "dos-pinos"],
  ["/Users/awt/Downloads/CMI Team - Backlog items.csv", "cmi"],
  ["/Users/awt/Downloads/ARKFIN Team - Backlog items.csv", "arkfin"],
  ["/Users/awt/Downloads/AMC Team - Backlog items.csv", "amc"],
];

const updates = []; // {client_id, original_id, owner_name, email}
const stats = { mapped: 0, unmapped: 0 };
const unmappedTokens = new Map();
const mappedCounts = new Map();

for (const [path, clientId] of FILES) {
  const text = readFileSync(path, "utf8");
  const rows = parseCsv(text);
  const headers = rows[0];
  const idIdx = headers.indexOf("ID");
  const t1Idx = headers.indexOf("Title 1");
  const t2Idx = headers.indexOf("Title 2");
  const t3Idx = headers.indexOf("Title 3"); // CMI

  for (const r of rows.slice(1)) {
    const id = (r[idIdx] || "").trim();
    if (!id) continue;
    const titles = [t2Idx >= 0 ? r[t2Idx] : "", t3Idx >= 0 ? r[t3Idx] : "", t1Idx >= 0 ? r[t1Idx] : ""].filter(Boolean);
    let token = null;
    for (const t of titles) {
      token = extractToken(t.trim());
      if (token) break;
    }
    // Resolver alias
    if (token && ALIASES[token]) token = ALIASES[token];

    if (token && MAP[token]) {
      updates.push({
        client_id: clientId,
        original_id: id,
        owner_name: MAP[token].name,
        email: MAP[token].email,
        token,
      });
      stats.mapped++;
      mappedCounts.set(MAP[token].name, (mappedCounts.get(MAP[token].name) || 0) + 1);
    } else if (token) {
      stats.unmapped++;
      unmappedTokens.set(token, (unmappedTokens.get(token) || 0) + 1);
    }
  }
}

console.log(`✓ Mapeados: ${stats.mapped} tasks · Sin mapear: ${stats.unmapped}`);
console.log(`\n  Top mapped:`);
[...mappedCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 12).forEach(([n,c]) => console.log(`    ${String(c).padStart(4)} ${n}`));
console.log(`\n  Top unmapped tokens (revisar si son personas reales):`);
[...unmappedTokens.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 8).forEach(([t,c]) => console.log(`    ${String(c).padStart(4)} ${t}`));

// ─── 5. Generar SQL ──────────────────────────────────────────────────────
const uniquePeople = new Map(); // email → {name, email}
updates.forEach(u => uniquePeople.set(u.email, { name: u.owner_name, email: u.email }));

let sql = `-- ════════════════════════════════════════════════════════════════════════════
-- Link task owners (responsables) a partir de las CSVs de backlog
--
-- Las CSVs no tienen columna "Assigned To" pero embeden el responsable al
-- final del título: "... - MAVARGAS", "... - O. Castro", etc.
-- Este migration:
--   1. UPSERT sysde_team_members para los colaboradores nuevos
--   2. UPDATE tasks.owner = nombre_completo basado en (client_id, original_id)
--   3. Si existe auth user con ese email, UPDATE tasks.assigned_user_id
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. UPSERT colaboradores ─────────────────────────────────────────────
INSERT INTO public.sysde_team_members (name, email, role, department, is_active)
VALUES
`;
sql += [...uniquePeople.values()].map(p =>
  `  (${q(p.name)}, ${q(p.email)}, 'colaborador', 'Implementación', TRUE)`
).join(",\n");
sql += `
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = TRUE,
  updated_at = NOW();

-- ─── 2. UPDATE tasks.owner por (client_id, original_id) ──────────────────
-- Cada update se hace en lote por persona → menos statements.
`;

// Group updates by owner_name → list of (client_id, original_id)
const byOwner = new Map();
updates.forEach(u => {
  const key = u.owner_name;
  if (!byOwner.has(key)) byOwner.set(key, []);
  byOwner.get(key).push([u.client_id, u.original_id]);
});

for (const [ownerName, list] of byOwner) {
  // chunks de 200 para SQL más legible
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200);
    sql += `UPDATE public.tasks SET owner = ${q(ownerName)} WHERE (client_id, original_id) IN (\n`;
    sql += chunk.map(([c, oid]) => `  (${q(c)}, ${oid})`).join(",\n");
    sql += `\n);\n\n`;
  }
}

sql += `
-- ─── 3. Linkear assigned_user_id donde haya auth user (si corresponde) ───
UPDATE public.tasks t
   SET assigned_user_id = au.id
  FROM auth.users au
  JOIN public.sysde_team_members m ON LOWER(m.email) = LOWER(au.email)
 WHERE t.owner = m.name
   AND t.assigned_user_id IS NULL
   AND t.client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

-- ─── 4. Reporte ──────────────────────────────────────────────────────────
DO $report$
DECLARE
  v_with_owner    INTEGER;
  v_with_user     INTEGER;
  v_total         INTEGER;
  v_team_members  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');
  SELECT COUNT(*) INTO v_with_owner
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi')
     AND owner IS NOT NULL AND owner != '—';
  SELECT COUNT(*) INTO v_with_user
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi')
     AND assigned_user_id IS NOT NULL;
  SELECT COUNT(*) INTO v_team_members
    FROM public.sysde_team_members WHERE is_active = TRUE;
  RAISE NOTICE 'Tasks: % total · % con owner (%.1f%%) · % linked a auth user',
    v_total, v_with_owner, (v_with_owner::float / v_total * 100), v_with_user;
  RAISE NOTICE 'Sysde team_members activos: %', v_team_members;
END;
$report$;
`;

function q(s) {
  if (s === null || s === undefined) return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

const migrationName = `20260430220000_link_task_owners.sql`;
const outPath = resolve(REPO_ROOT, "supabase", "migrations", migrationName);
writeFileSync(outPath, sql);
console.log(`\n✓ Migración escrita: ${outPath}`);
console.log(`  ${uniquePeople.size} colaboradores únicos identificados`);
console.log(`  ${updates.length} updates de tasks.owner generados`);
