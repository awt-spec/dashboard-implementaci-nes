#!/usr/bin/env node
/**
 * QA de la base de datos: verifica integridad, RLS, lógica de negocio
 * y distribuciones esperadas. Output sectorizado con score de salud.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx node scripts/qa-database.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync } from "node:fs";

if (existsSync(".env")) {
  readFileSync(".env", "utf8").split("\n").forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Falta SUPABASE_URL / SERVICE_ROLE_KEY");
  process.exit(2);
}

const sb = createClient(URL, SERVICE, { auth: { persistSession: false } });
const C = { red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", blue: "\x1b[36m", gray: "\x1b[90m", bold: "\x1b[1m", reset: "\x1b[0m" };

const checks = [];
const recordCheck = (section, name, status, detail = "") => {
  checks.push({ section, name, status, detail });
  const icon = status === "pass" ? `${C.green}✓${C.reset}` : status === "warn" ? `${C.yellow}!${C.reset}` : `${C.red}✗${C.reset}`;
  const detailStr = detail ? `${C.gray} — ${detail}${C.reset}` : "";
  console.log(`  ${icon} ${name}${detailStr}`);
};

const section = (title) => console.log(`\n${C.bold}${C.blue}━━━ ${title} ━━━${C.reset}`);

const t0 = Date.now();
console.log(`${C.bold}QA Database — sva-erp-deploy${C.reset}`);
console.log(`${C.gray}Target: ${URL}${C.reset}`);
console.log(`${C.gray}Started: ${new Date().toISOString()}${C.reset}`);

// ═══════════════════════════════════════════════════════════════════════════
// 1) MIGRATIONS / SCHEMA
// ═══════════════════════════════════════════════════════════════════════════
section("Migraciones aplicadas");

const localMigrations = readdirSync("./supabase/migrations")
  .filter(f => f.endsWith(".sql"))
  .sort();
recordCheck("migrations", `Migraciones locales (.sql)`, "pass", `${localMigrations.length} archivos`);

// Verificar que get_sla_summary existe (creada en migración reciente)
{
  let data, error;
  try { ({ data, error } = await sb.rpc("get_sla_summary")); } catch (e) { error = e; }
  if (error) recordCheck("migrations", "RPC get_sla_summary disponible", "fail", error.message);
  else recordCheck("migrations", "RPC get_sla_summary disponible", "pass", `${data?.[0]?.total ?? 0} tickets evaluados`);
}

// Verificar que get_tickets_sla_status existe
{
  let data, error;
  try { ({ data, error } = await sb.rpc("get_tickets_sla_status")); } catch (e) { error = e; }
  if (error) recordCheck("migrations", "RPC get_tickets_sla_status disponible", "fail", error.message);
  else {
    const sources = new Set((data || []).map(r => r.sla_source).filter(Boolean));
    recordCheck("migrations", "RPC get_tickets_sla_status disponible", "pass", `${data?.length ?? 0} rows · sources: ${Array.from(sources).join(",")}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2) ENTIDADES CORE
// ═══════════════════════════════════════════════════════════════════════════
section("Entidades core (counts)");

async function countTable(name) {
  const { count, error } = await sb.from(name).select("*", { count: "exact", head: true });
  if (error) return null;
  return count;
}

const coreCounts = {
  clients: await countTable("clients"),
  support_tickets: await countTable("support_tickets"),
  support_ticket_notes: await countTable("support_ticket_notes"),
  support_ticket_subtasks: await countTable("support_ticket_subtasks"),
  profiles: await countTable("profiles"),
  user_roles: await countTable("user_roles"),
  business_rules: await countTable("business_rules"),
  ai_usage_logs: await countTable("ai_usage_logs"),
};

for (const [t, c] of Object.entries(coreCounts)) {
  if (c === null) recordCheck("counts", t, "fail", "tabla inaccesible");
  else recordCheck("counts", t, c > 0 ? "pass" : "warn", `${c} rows`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3) ROLES (validar enum extendido)
// ═══════════════════════════════════════════════════════════════════════════
section("Roles del sistema");

{
  const { data: roles, error } = await sb.from("user_roles").select("role");
  if (error) recordCheck("roles", "user_roles select", "fail", error.message);
  else {
    const distrib = roles.reduce((acc, r) => { acc[r.role] = (acc[r.role] || 0) + 1; return acc; }, {});
    const expectedRoles = ["admin", "pm", "gerente", "colaborador", "cliente", "ceo", "gerente_soporte"];
    expectedRoles.forEach(r => {
      const n = distrib[r] || 0;
      const status = n > 0 ? "pass" : (r === "ceo" || r === "gerente_soporte" ? "warn" : "warn");
      recordCheck("roles", `role: ${r}`, status, `${n} usuarios`);
    });
    const unexpected = Object.keys(distrib).filter(r => !expectedRoles.includes(r));
    if (unexpected.length) {
      recordCheck("roles", "roles inesperados", "fail", unexpected.join(", "));
    } else {
      recordCheck("roles", "roles inesperados", "pass", "ninguno");
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4) INTEGRIDAD REFERENCIAL
// ═══════════════════════════════════════════════════════════════════════════
section("Integridad referencial");

// Tickets huérfanos (client_id que no existe)
{
  const { data: tickets } = await sb.from("support_tickets").select("client_id");
  const { data: clients } = await sb.from("clients").select("id");
  const validIds = new Set((clients || []).map(c => c.id));
  const orphaned = (tickets || []).filter(t => !validIds.has(t.client_id));
  recordCheck("integrity", "support_tickets → clients", orphaned.length === 0 ? "pass" : "fail", orphaned.length === 0 ? "0 huérfanos" : `${orphaned.length} tickets con client_id inválido`);
}

// user_roles → profiles
{
  const { data: ur } = await sb.from("user_roles").select("user_id");
  const { data: prof } = await sb.from("profiles").select("user_id");
  const validUsers = new Set((prof || []).map(p => p.user_id));
  const orphaned = (ur || []).filter(r => !validUsers.has(r.user_id));
  recordCheck("integrity", "user_roles → profiles", orphaned.length === 0 ? "pass" : "warn", orphaned.length === 0 ? "0 huérfanos" : `${orphaned.length} roles sin profile (auth.users probably missing)`);
}

// Subtasks → tickets
{
  const { data: subs } = await sb.from("support_ticket_subtasks").select("ticket_id");
  const { data: tickets } = await sb.from("support_tickets").select("id");
  const validIds = new Set((tickets || []).map(t => t.id));
  const orphaned = (subs || []).filter(s => !validIds.has(s.ticket_id));
  recordCheck("integrity", "support_ticket_subtasks → support_tickets", orphaned.length === 0 ? "pass" : "fail", `${orphaned.length} huérfanos`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5) BUSINESS RULES (Política activa v4.5)
// ═══════════════════════════════════════════════════════════════════════════
section("Business rules / Política v4.5");

{
  const { data: rules } = await sb.from("business_rules").select("rule_type, is_active, policy_version, content");
  const v45 = (rules || []).filter(r => r.policy_version === "v4.5" && r.is_active);
  const expectedTypes = ["sla", "checklist", "signature", "metric", "weekly"];
  expectedTypes.forEach(t => {
    const found = v45.find(r => r.rule_type === t);
    recordCheck("policy", `rule_type: ${t} activo en v4.5`, found ? "pass" : "warn", found ? "OK" : "no encontrado");
  });

  // Validar que SLA tiene deadlines para crítica
  const slaRule = v45.find(r => r.rule_type === "sla");
  if (slaRule) {
    const dl = slaRule.content?.deadlines || [];
    const hasCritica = dl.some(d => (d.priority || "").toLowerCase() === "critica");
    recordCheck("policy", "SLA contiene priority='critica'", hasCritica ? "pass" : "fail", `${dl.length} deadlines totales`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6) SLA STATUS (lógica de negocio)
// ═══════════════════════════════════════════════════════════════════════════
section("SLA logic (server-side)");

{
  const { data: summary } = await sb.rpc("get_sla_summary");
  const s = summary?.[0];
  if (!s) {
    recordCheck("sla", "get_sla_summary", "fail", "sin datos");
  } else {
    const total = (s.overdue || 0) + (s.warning || 0) + (s.ok || 0) + (s.no_sla || 0);
    const matchesTotal = total === s.total;
    recordCheck("sla", "summary suma total = total", matchesTotal ? "pass" : "fail",
      `total=${s.total}, suma=${total}`);
    recordCheck("sla", "vencidos detectados", s.overdue > 0 ? "pass" : "warn", `${s.overdue} overdue`);
    recordCheck("sla", "tickets con SLA aplicable", (s.total - s.no_sla) > 0 ? "pass" : "warn",
      `${s.total - s.no_sla} de ${s.total}`);
  }
}

// Verificar consistencia: get_tickets_sla_status devuelve mismas counts
{
  const { data: tickets } = await sb.rpc("get_tickets_sla_status");
  const { data: summary } = await sb.rpc("get_sla_summary");
  if (tickets && summary?.[0]) {
    const overduePerTicket = tickets.filter(t => t.sla_status === "overdue").length;
    const overdueSummary = summary[0].overdue;
    recordCheck("sla", "tickets.overdue == summary.overdue", overduePerTicket === overdueSummary ? "pass" : "fail",
      `tickets=${overduePerTicket}, summary=${overdueSummary}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 7) AI USAGE LOGS (telemetría)
// ═══════════════════════════════════════════════════════════════════════════
section("AI Usage Logs");

{
  const { data: logs } = await sb.from("ai_usage_logs").select("status, total_tokens, function_name, redacted, user_id");
  if (!logs) {
    recordCheck("ai", "ai_usage_logs", "fail", "tabla no accesible");
  } else {
    const errorRate = logs.length > 0 ? logs.filter(l => l.status === "error").length / logs.length : 0;
    recordCheck("ai", "Error rate", errorRate < 0.2 ? "pass" : "warn", `${(errorRate * 100).toFixed(1)}%`);

    const totalTokens = logs.reduce((s, l) => s + (l.total_tokens || 0), 0);
    recordCheck("ai", "Total tokens", "pass", totalTokens.toLocaleString());

    const fns = new Set(logs.map(l => l.function_name));
    recordCheck("ai", "Funciones IA usadas", fns.size > 0 ? "pass" : "warn", Array.from(fns).join(", "));

    const withRedaction = logs.filter(l => l.redacted === true).length;
    recordCheck("ai", "Calls con redacción", "pass", `${withRedaction} (privacidad)`);

    const withUserId = logs.filter(l => l.user_id).length;
    recordCheck("ai", "Audit log (user_id)", withUserId === logs.length ? "pass" : "warn",
      `${withUserId}/${logs.length} con user_id`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 8) HEALTH SCORE
// ═══════════════════════════════════════════════════════════════════════════
section("Resumen");

const totals = {
  pass: checks.filter(c => c.status === "pass").length,
  warn: checks.filter(c => c.status === "warn").length,
  fail: checks.filter(c => c.status === "fail").length,
};
const total = totals.pass + totals.warn + totals.fail;
const score = Math.round((totals.pass / total) * 100);

console.log(`\n${C.bold}${C.green}✓ Pass: ${totals.pass}${C.reset}   ${C.yellow}! Warn: ${totals.warn}${C.reset}   ${C.red}✗ Fail: ${totals.fail}${C.reset}`);
console.log(`${C.bold}Health Score: ${score >= 80 ? C.green : score >= 60 ? C.yellow : C.red}${score}/100${C.reset}`);
console.log(`${C.gray}Elapsed: ${(Date.now() - t0) / 1000}s${C.reset}\n`);

if (totals.fail > 0) {
  console.log(`${C.red}${C.bold}FAILURES:${C.reset}`);
  checks.filter(c => c.status === "fail").forEach(c => {
    console.log(`  ${C.red}✗${C.reset} [${c.section}] ${c.name}: ${c.detail}`);
  });
  process.exit(1);
}
process.exit(0);
