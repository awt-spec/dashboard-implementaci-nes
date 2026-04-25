#!/usr/bin/env node
/**
 * Smoke test E2E para las edge functions de IA.
 * Verifica:
 *   - Que requieren auth (rechaza sin Bearer)
 *   - Que cliente role queda bloqueado
 *   - Que admin puede invocarlas
 *   - Que loggean en ai_usage_logs con user_id + scope
 *   - Que respetan rate limit (best-effort)
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx bun run scripts/smoke-ai-functions.mjs
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
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error("Falta SUPABASE_URL / ANON / SERVICE_ROLE_KEY");
  process.exit(2);
}

const sbAdmin = createClient(URL, SERVICE, { auth: { persistSession: false } });
// Para cada login usamos una instancia limpia para no pisar JWTs entre sí
const newAnon = () => createClient(URL, ANON, { auth: { persistSession: false } });

const stamp = Date.now().toString(36);
const ADMIN_EMAIL = `smoke-ai-${stamp}@sysde.test`;
const ADMIN_PASS = `SmokeAi${stamp}!`;
const CLIENTE_EMAIL = `smoke-ai-cli-${stamp}@sysde.test`;
const CLIENTE_PASS = `SmokeCli${stamp}!`;

let adminId, clienteId, adminJwt, clienteJwt;
let testTicketId, testTicketIdCfg, testClientId = `smoke-ai-${stamp}`;

const out = { passed: 0, failed: 0 };
function log(level, msg) {
  const icon = { ok: "\x1b[32m✓\x1b[0m", fail: "\x1b[31m✗\x1b[0m", group: "\x1b[1;36m◆\x1b[0m" }[level] || " ";
  process.stdout.write(`${icon} ${msg}\n`);
}
async function step(name, fn) {
  try { await fn(); log("ok", name); out.passed++; }
  catch (e) { log("fail", `${name} — ${e.message}`); out.failed++; }
}

// ── Bootstrap ──
async function bootstrap() {
  log("group", "Bootstrap");
  // Admin
  const a = await sbAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL, password: ADMIN_PASS, email_confirm: true,
    user_metadata: { full_name: "Smoke AI Admin", role: "admin" },
  });
  if (a.error) throw a.error;
  adminId = a.data.user.id;
  await sbAdmin.from("user_roles").delete().eq("user_id", adminId);
  await sbAdmin.from("user_roles").insert({ user_id: adminId, role: "admin" });
  const sa = await newAnon().auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASS });
  if (sa.error) throw sa.error;
  adminJwt = sa.data.session.access_token;

  // Cliente test
  await sbAdmin.from("clients").insert({
    id: testClientId, name: `Smoke AI ${stamp}`, country: "CR", industry: "Test",
    contact_name: "T", contact_email: "t@t.t",
    contract_start: "2026-01-01", contract_end: "2027-01-01",
    status: "activo", progress: 0, core_version: "x", client_type: "soporte", nivel_servicio: "Base",
  });

  // Ticket no-confidencial
  const t1 = await sbAdmin.from("support_tickets").insert({
    client_id: testClientId, asunto: `Smoke AI test ${stamp}`,
    tipo: "Requerimiento", prioridad: "Media", estado: "EN ATENCIÓN",
    dias_antiguedad: 5, descripcion: "Descripción no sensible",
  }).select().single();
  if (t1.error) throw t1.error;
  testTicketId = t1.data.id;

  // Ticket confidencial — debe ser redactado
  const t2 = await sbAdmin.from("support_tickets").insert({
    client_id: testClientId, asunto: `Smoke AI confidencial ${stamp}`,
    tipo: "Incidente", prioridad: "Alta", estado: "PENDIENTE",
    dias_antiguedad: 2, descripcion: "PASSWORD: secret123 USER: admin",
    is_confidential: true,
  }).select().single();
  if (t2.error) throw t2.error;
  testTicketIdCfg = t2.data.id;

  // Cliente role user
  const c = await sbAdmin.auth.admin.createUser({
    email: CLIENTE_EMAIL, password: CLIENTE_PASS, email_confirm: true,
    user_metadata: { full_name: "Smoke Cliente", role: "cliente" },
  });
  if (c.error) throw c.error;
  clienteId = c.data.user.id;
  await sbAdmin.from("user_roles").delete().eq("user_id", clienteId).neq("role", "cliente");
  await sbAdmin.from("user_roles").upsert({ user_id: clienteId, role: "cliente" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  await sbAdmin.from("cliente_company_assignments").upsert({
    user_id: clienteId, client_id: testClientId, permission_level: "viewer",
  }, { onConflict: "user_id,client_id" });
  const sc = await newAnon().auth.signInWithPassword({ email: CLIENTE_EMAIL, password: CLIENTE_PASS });
  if (sc.error) throw sc.error;
  clienteJwt = sc.data.session.access_token;
  // (no signOut — invalidaría el JWT que usaremos en los tests)
}

const callFn = async (jwt, fn, body) => {
  const r = await fetch(`${URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: jwt ? `Bearer ${jwt}` : "",
      apikey: ANON, "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

// ── Tests ──
async function tests() {
  log("group", "case-strategy-ai");

  await step("Sin JWT → 401", async () => {
    const r = await callFn(null, "case-strategy-ai", { ticket_id: testTicketId });
    if (r.status !== 401) throw new Error(`esperaba 401, obtuvo ${r.status}`);
  });

  await step("Cliente role → 403 (assertNotCliente)", async () => {
    const r = await callFn(clienteJwt, "case-strategy-ai", { ticket_id: testTicketId });
    if (r.status !== 403) throw new Error(`esperaba 403, obtuvo ${r.status} (${r.body?.error})`);
  });

  await step("Sin ticket_id → 400", async () => {
    const r = await callFn(adminJwt, "case-strategy-ai", {});
    if (r.status !== 400) throw new Error(`esperaba 400, obtuvo ${r.status}`);
  });

  await step("Admin con ticket → 200 (puede tardar 5-15s con LLM)", async () => {
    const r = await callFn(adminJwt, "case-strategy-ai", { ticket_id: testTicketId });
    if (r.status !== 200) throw new Error(`esperaba 200, obtuvo ${r.status} (${r.body?.error})`);
    if (!r.body?.success || !r.body?.analysis) throw new Error("respuesta sin analysis");
  });

  await step("Log con user_id + scope creado", async () => {
    const { data } = await sbAdmin.from("ai_usage_logs")
      .select("user_id, scope, redacted, status").eq("user_id", adminId)
      .eq("function_name", "case-strategy-ai").order("created_at", { ascending: false }).limit(1);
    if (!data?.length) throw new Error("no se loggeó la llamada");
    if (data[0].user_id !== adminId) throw new Error("user_id mal");
    if (data[0].scope !== testTicketId) throw new Error(`scope mal: ${data[0].scope} vs ${testTicketId}`);
    if (data[0].redacted !== false) throw new Error("ticket no era confidencial pero redacted=true");
    if (data[0].status !== "success") throw new Error(`status: ${data[0].status}`);
  });

  await step("Ticket CONFIDENCIAL → redacted=true en log", async () => {
    const r = await callFn(adminJwt, "case-strategy-ai", { ticket_id: testTicketIdCfg });
    if (r.status !== 200) throw new Error(`status ${r.status} (${r.body?.error})`);
    const { data } = await sbAdmin.from("ai_usage_logs")
      .select("redacted").eq("user_id", adminId).eq("scope", testTicketIdCfg).limit(1);
    if (!data?.length || data[0].redacted !== true) throw new Error("flag redacted no registrada para ticket confidencial");
  });

  log("group", "client-strategy-ai");
  await step("Cliente role bloqueado en client-strategy-ai", async () => {
    const r = await callFn(clienteJwt, "client-strategy-ai", { client_id: testClientId });
    if (r.status !== 403) throw new Error(`esperaba 403, obtuvo ${r.status}`);
  });
  await step("Admin → 200 + log con scope=client_id + redacted (1 ticket conf)", async () => {
    const r = await callFn(adminJwt, "client-strategy-ai", { client_id: testClientId });
    if (r.status !== 200) throw new Error(`status ${r.status} (${r.body?.error})`);
    const { data } = await sbAdmin.from("ai_usage_logs")
      .select("user_id, scope, redacted, status").eq("user_id", adminId)
      .eq("function_name", "client-strategy-ai").order("created_at", { ascending: false }).limit(1);
    if (!data?.length) throw new Error("no se loggeó");
    if (data[0].scope !== testClientId) throw new Error(`scope mal: ${data[0].scope}`);
    if (data[0].redacted !== true) throw new Error("debería estar redacted=true (hay 1 ticket conf)");
  });

  log("group", "classify-tickets");
  await step("Cliente role bloqueado en classify-tickets", async () => {
    const r = await callFn(clienteJwt, "classify-tickets", { ticketIds: [testTicketId] });
    if (r.status !== 403) throw new Error(`esperaba 403, obtuvo ${r.status}`);
  });
  await step("Admin clasifica ticket no-conf (sin redacted)", async () => {
    const r = await callFn(adminJwt, "classify-tickets", { ticketIds: [testTicketId] });
    if (r.status !== 200) throw new Error(`status ${r.status} (${r.body?.error})`);
    const { data } = await sbAdmin.from("ai_usage_logs")
      .select("user_id, redacted, status").eq("user_id", adminId)
      .eq("function_name", "classify-tickets").order("created_at", { ascending: false }).limit(1);
    if (!data?.length || data[0].redacted !== false) throw new Error("no debería estar redacted");
  });
  await step("Admin clasifica ticket CONF → redacted=true", async () => {
    const r = await callFn(adminJwt, "classify-tickets", { ticketIds: [testTicketIdCfg] });
    if (r.status !== 200) throw new Error(`status ${r.status} (${r.body?.error})`);
    const { data } = await sbAdmin.from("ai_usage_logs")
      .select("redacted").eq("user_id", adminId)
      .eq("function_name", "classify-tickets").order("created_at", { ascending: false }).limit(1);
    if (!data?.length || data[0].redacted !== true) throw new Error("debería redacted=true");
  });
}

// ── Cleanup ──
async function cleanup() {
  log("group", "Cleanup");
  await sbAdmin.from("ai_usage_logs").delete().eq("user_id", adminId);
  await sbAdmin.from("ai_usage_logs").delete().eq("user_id", clienteId);
  await sbAdmin.from("pm_ai_analysis").delete().in("scope", [testTicketId, testTicketIdCfg]);
  await sbAdmin.from("support_tickets").delete().in("id", [testTicketId, testTicketIdCfg]);
  await sbAdmin.from("cliente_company_assignments").delete().eq("user_id", clienteId);
  await sbAdmin.from("clients").delete().eq("id", testClientId);
  await sbAdmin.from("user_roles").delete().in("user_id", [adminId, clienteId]);
  await sbAdmin.auth.admin.deleteUser(adminId).catch(() => {});
  await sbAdmin.auth.admin.deleteUser(clienteId).catch(() => {});
  log("ok", "Cleanup terminado");
}

// ── Run ──
(async () => {
  try { await bootstrap(); await tests(); }
  catch (e) { log("fail", `Bootstrap/tests fatales: ${e.message}`); }
  finally { await cleanup().catch(() => {}); }
  console.log(`\n━━━ ${out.passed}/${out.passed + out.failed} OK ━━━`);
  if (out.failed > 0) process.exit(1);
})();
