/**
 * Audita clients + cliente_company_assignments + user_roles para detectar
 * clientes sin usuarios, assignments huérfanos, roles desalineados.
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx bun run scripts/inspect-cliente-links.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env")) {
  readFileSync(".env", "utf8").split("\n").forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) { console.error("Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(2); }
const sb = createClient(URL, SERVICE, { auth: { persistSession: false } });

console.log("━━━ CLIENTES ACTIVOS ━━━");
const { data: clients } = await sb.from("clients")
  .select("id, name, client_type, status").order("name");
console.log(clients.map(c => `${c.id.padEnd(30)} | ${c.name.padEnd(30)} | ${c.client_type} | ${c.status}`).join("\n"));

console.log("\n━━━ CLIENTE ASSIGNMENTS ━━━");
const { data: assigns } = await sb.from("cliente_company_assignments")
  .select("id, user_id, client_id, permission_level, created_at").order("client_id");

// Join with profiles to get email
const userIds = [...new Set(assigns.map(a => a.user_id))];
const { data: profiles } = await sb.from("profiles")
  .select("user_id, email, full_name").in("user_id", userIds);
const emailByUser = new Map(profiles.map(p => [p.user_id, p.email]));

console.log(assigns.map(a => {
  const email = emailByUser.get(a.user_id) || "?";
  const client = clients.find(c => c.id === a.client_id);
  const clientName = client?.name || "⚠ NOT FOUND";
  return `${a.client_id.padEnd(30)} | ${email.padEnd(40)} | ${a.permission_level} | → ${clientName}`;
}).join("\n"));

console.log("\n━━━ CLIENTES SIN USUARIOS CLIENTE ━━━");
const clientsWithUsers = new Set(assigns.map(a => a.client_id));
const without = clients.filter(c => !clientsWithUsers.has(c.id) && c.status === "activo");
console.log(without.map(c => `${c.id} | ${c.name}`).join("\n") || "(ninguno)");

console.log("\n━━━ ASSIGNMENTS CON CLIENT_ID HUÉRFANO (no matchea ningún client) ━━━");
const clientIds = new Set(clients.map(c => c.id));
const orphans = assigns.filter(a => !clientIds.has(a.client_id));
console.log(orphans.length ? orphans.map(a => `${a.client_id} (user ${emailByUser.get(a.user_id)})`).join("\n") : "(ninguno)");

console.log("\n━━━ USUARIOS CLIENTE SIN ASSIGNMENT ━━━");
const { data: clienteRoles } = await sb.from("user_roles").select("user_id").eq("role", "cliente");
const usersWithRole = new Set(clienteRoles.map(r => r.user_id));
const usersWithAssign = new Set(assigns.map(a => a.user_id));
const roleButNoAssign = [...usersWithRole].filter(u => !usersWithAssign.has(u));
if (roleButNoAssign.length) {
  const { data: orphanProfiles } = await sb.from("profiles").select("email, user_id").in("user_id", roleButNoAssign);
  console.log(orphanProfiles.map(p => p.email).join("\n"));
} else {
  console.log("(ninguno)");
}
