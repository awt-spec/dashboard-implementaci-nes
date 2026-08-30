/**
 * Rota las contraseñas de las cuentas demo.
 *
 * Por qué hace falta: estuvieron en texto plano en README.md, ARCHITECTURE.md y
 * tres scripts de seed. Sacarlas del código NO las invalida — siguen en el
 * historial de git y siguen funcionando. La única forma de cerrarlas es
 * reemplazarlas.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/rotate-demo-passwords.mjs
 *
 * Imprime las nuevas UNA sola vez, por stdout. No las escribe en ningún
 * archivo: guardalas en el gestor de secretos del equipo desde ahí.
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE) {
  console.error("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  console.error("La service_role key se saca del panel de Supabase → Settings → API.");
  console.error("No la pegues en un chat ni la commitees: sólo en el entorno de esta corrida.");
  process.exit(2);
}

const sb = createClient(URL, SERVICE, { auth: { persistSession: false } });

// 20 bytes de entropía real. base64url evita caracteres que rompen el copiado
// en terminales o URLs; el sufijo satisface políticas de complejidad.
const nueva = () => crypto.randomBytes(20).toString("base64url") + "!aA1";

// Sólo las que estuvieron expuestas en el repo. Los usuarios de cliente creados
// por seed-cliente-users.mjs ya nacen con contraseña aleatoria.
const CUENTAS = [
  "ceo@sysde.com",
  "admin@sysde.com",
  "pm@sysde.com",
  "carlos.castante@sysde.com",
  "lalfaro-contratista@sysde.com",
  "cliente.apex@sysde.com",
];

const { data: lista, error: errLista } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (errLista) {
  console.error("No se pudo listar usuarios:", errLista.message);
  process.exit(1);
}

const resultados = [];
for (const email of CUENTAS) {
  const user = lista.users.find((u) => u.email === email);
  if (!user) {
    resultados.push({ email, estado: "no existe", password: null });
    continue;
  }
  const password = nueva();
  const { error } = await sb.auth.admin.updateUserById(user.id, { password });
  resultados.push({
    email,
    estado: error ? `error: ${error.message}` : "rotada",
    password: error ? null : password,
  });
}

console.log("\n──────────────────────────────────────────────────────────────");
console.log(" NUEVAS CONTRASEÑAS — se muestran una sola vez");
console.log("──────────────────────────────────────────────────────────────");
for (const r of resultados) {
  console.log(`${r.email.padEnd(34)} ${r.estado.padEnd(12)} ${r.password ?? ""}`);
}
console.log("──────────────────────────────────────────────────────────────");
console.log("Guardalas en el gestor de secretos del equipo y cerrá esta terminal.");
console.log("Si usás historial de shell, borrá esta salida de ahí también.\n");

const fallos = resultados.filter((r) => r.estado !== "rotada");
process.exit(fallos.length ? 1 : 0);
