// Compara src/integrations/supabase/types.ts contra el esquema vivo.
//
// PostgREST valida los nombres de columna ANTES de revisar el grant: pedir una
// columna inexistente devuelve 42703 aunque anon no pueda leer la tabla. Eso
// permite verificar TODAS las tablas con la sola llave anon.
//
// Alcance honesto: comprueba que todo lo que types.ts DECLARA existe. No puede
// descubrir columnas que estén en la base y falten en types.ts — para eso hace
// falta regenerar el archivo con el CLI.
import { readFileSync } from "node:fs";

const env = readFileSync(".env", "utf8");
const URL = env.match(/VITE_SUPABASE_URL=["']?([^"'\n]+)/)[1];
const KEY = env.match(/VITE_SUPABASE_(?:ANON_KEY|PUBLISHABLE_KEY)=["']?([^"'\n]+)/)[1];
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const src = readFileSync("src/integrations/supabase/types.ts", "utf8");

// ── extraer, por tabla, las columnas del bloque Row ──
function parsear(seccion) {
  const i = src.indexOf(`    ${seccion}: {`);
  if (i < 0) return {};
  const cuerpo = src.slice(i);
  const tablas = {};
  const re = /^      (\w+): \{\n        Row: \{\n([\s\S]*?)\n        \}/gm;
  let m;
  while ((m = re.exec(cuerpo))) {
    if (m.index > cuerpo.indexOf("\n    Views:") && cuerpo.indexOf("\n    Views:") > 0 && seccion === "Tables") {
      // no cortar acá: Views se parsea aparte
    }
    const cols = m[2].split("\n")
      .map(l => l.trim().match(/^(\w+)\??:/))
      .filter(Boolean).map(x => x[1]);
    if (cols.length) tablas[m[1]] = cols;
  }
  return tablas;
}

const tablas = parsear("Tables");
const nombres = Object.keys(tablas);
// El bloque Tables va seguido de Views, y el barrido las toma también. No es un
// problema —PostgREST consulta vistas igual que tablas— pero conviene no
// llamarlas tablas en el reporte.
const finTablas = src.slice(src.indexOf("    Tables: {")).indexOf("\n    Views: {");
const soloTablas = src.slice(src.indexOf("    Tables: {")).slice(0, finTablas);
const nTablas = (soloTablas.match(/\n        Row: \{/g) || []).length;
console.log(`types.ts declara ${nTablas} tablas + ${nombres.length - nTablas} vistas `
  + `= ${nombres.length} relaciones, ${Object.values(tablas).flat().length} columnas.`);

async function pedir(tabla, cols) {
  const r = await fetch(`${URL}/rest/v1/${tabla}?select=${cols.join(",")}&limit=1`, { headers: H });
  if (r.status === 200) return { ok: true };
  const b = await r.json().catch(() => ({}));
  return { ok: false, code: b.code, message: b.message || "" };
}

const faltantes = [];
const tablasAusentes = [];
for (const t of nombres) {
  let cols = [...tablas[t]];
  for (;;) {
    const r = await pedir(t, cols);
    if (r.ok || r.code === "42501") break;              // existe todo (o el grant frena, pero las columnas pasaron)
    if (r.code === "PGRST205" || r.code === "42P01") { tablasAusentes.push(t); break; }
    if (r.code === "42703") {
      const col = (r.message.match(/column [\w."]*?\.?(\w+) does not exist/) || [])[1]
               ?? (r.message.match(/'(\w+)' column/) || [])[1];
      if (!col || !cols.includes(col)) { faltantes.push(`${t}: ??? ${r.message}`); break; }
      faltantes.push(`${t}.${col}`);
      cols = cols.filter(c => c !== col);
      if (!cols.length) break;
      continue;
    }
    faltantes.push(`${t}: ${r.code} ${r.message}`);
    break;
  }
}

// ── controles: sin esto, "0 faltantes" no probaría nada ──
const ctlFalso = await pedir("support_tickets", ["columna_inventada_zzz"]);
const ctlReal  = await pedir("support_tickets", ["id", "prioridad", "estado"]);
const ctlCerrada = await pedir("support_ticket_time", ["ticket_id"]);

console.log("\n── controles ──");
console.log(`columna inventada  -> ${ctlFalso.code} ${ctlFalso.code === "42703" ? "(la sonda detecta lo que falta)" : "SONDA ROTA"}`);
console.log(`columnas reales    -> ${ctlReal.ok ? "200 (la sonda acepta lo que existe)" : "SONDA ROTA: " + ctlReal.code}`);
console.log(`tabla cerrada      -> ${ctlCerrada.code} ${ctlCerrada.code === "42501" ? "(alcanza tablas sin grant)" : "SONDA ROTA"}`);

console.log("\n── resultado ──");
console.log(`tablas que no existen en la base: ${tablasAusentes.length}`);
tablasAusentes.forEach(t => console.log(`  ✗ ${t}`));
console.log(`columnas declaradas que no existen: ${faltantes.length}`);
faltantes.forEach(c => console.log(`  ✗ ${c}`));

const sondaOk = ctlFalso.code === "42703" && ctlReal.ok && ctlCerrada.code === "42501";
if (!sondaOk) { console.log("\nLOS CONTROLES FALLARON: el resultado de arriba no vale."); process.exit(2); }
process.exit(faltantes.length || tablasAusentes.length ? 1 : 0);
