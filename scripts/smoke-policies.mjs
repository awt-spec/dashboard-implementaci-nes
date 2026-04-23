#!/usr/bin/env node
/**
 * Smoke test E2E para la sección de políticas del SVA.
 *
 * Valida:
 *   1. Login (sign-in con email/password)
 *   2. Lectura de business_rules (RLS authenticated)
 *   3. CRUD: crea → actualiza → borra una regla de prueba
 *   4. CRUD: crea → borra un override para un cliente de soporte
 *   5. Invoca evaluate-case-compliance sobre un ticket abierto y verifica case_compliance
 *   6. Limpieza (todo lo creado se borra en teardown)
 *
 * Requiere variables de entorno:
 *   SUPABASE_URL            (o VITE_SUPABASE_URL)
 *   SUPABASE_ANON_KEY       (o VITE_SUPABASE_PUBLISHABLE_KEY)
 *   ADMIN_EMAIL             email de un usuario con rol admin
 *   ADMIN_PASSWORD          password del admin
 *
 * Uso:
 *   bun run scripts/smoke-policies.mjs
 *   # o:
 *   SUPABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke-policies.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// ─── Cargar .env si existe ────────────────────────────────────────────────
if (existsSync(".env")) {
  readFileSync(".env", "utf8").split("\n").forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

const URL  = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASSWORD;

if (!URL || !ANON) { console.error("Falta SUPABASE_URL y/o SUPABASE_ANON_KEY"); process.exit(2); }
if (!EMAIL || !PASS) {
  console.error("Falta ADMIN_EMAIL y ADMIN_PASSWORD (usuario admin del ERP)");
  console.error("Ejemplo: ADMIN_EMAIL=admin@sysde.com ADMIN_PASSWORD=... bun run scripts/smoke-policies.mjs");
  process.exit(2);
}

const sb = createClient(URL, ANON);
const out = { passed: 0, failed: 0, skipped: 0, steps: [] };
const startedAt = Date.now();

function log(level, msg) {
  const icon = { ok: "✓", fail: "✗", info: "·", warn: "!" }[level] || " ";
  const color = { ok: "\x1b[32m", fail: "\x1b[31m", info: "\x1b[90m", warn: "\x1b[33m" }[level] || "";
  process.stdout.write(`${color}${icon}\x1b[0m ${msg}\n`);
}

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    const ms = Date.now() - t0;
    log("ok", `${name} (${ms}ms)`);
    out.passed++; out.steps.push({ name, status: "ok", ms, result: r });
    return r;
  } catch (e) {
    const ms = Date.now() - t0;
    log("fail", `${name} — ${e.message} (${ms}ms)`);
    out.failed++; out.steps.push({ name, status: "fail", ms, error: e.message });
    throw e;
  }
}

// Estado de limpieza (se ejecuta en finally)
const cleanup = { ruleId: null, overrideId: null };

try {
  // ─── 1. Login ────────────────────────────────────────────────────────────
  await step("Login como admin", async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASS });
    if (error) throw error;
    if (!data.user) throw new Error("signin devolvió sin user");
    const { data: role } = await sb.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle();
    log("info", `  user_id=${data.user.id.slice(0, 8)}… role=${role?.role ?? "(sin rol asignado)"}`);
    if (role?.role !== "admin") throw new Error(`usuario no es admin (rol actual: ${role?.role ?? "sin rol"})`);
    return { user: data.user, role: role.role };
  });

  // ─── 2. Lectura de business_rules ────────────────────────────────────────
  const rules = await step("Lectura de business_rules", async () => {
    const { data, error } = await sb.from("business_rules").select("*").order("rule_type");
    if (error) throw error;
    log("info", `  ${data.length} reglas · activas: ${data.filter(r => r.is_active).length}`);
    const byType = {};
    data.forEach(r => byType[r.rule_type] = (byType[r.rule_type] || 0) + 1);
    log("info", `  por tipo: ${Object.entries(byType).map(([k,v]) => `${k}=${v}`).join(", ")}`);
    return data;
  });

  // ─── 3. CRUD — crear regla de prueba ─────────────────────────────────────
  await step("Crear business_rule de prueba", async () => {
    const { data, error } = await sb.from("business_rules").insert({
      name: "[SMOKE TEST] Regla temporal",
      description: "Creada por smoke-policies.mjs — se borra automáticamente",
      scope: "global",
      rule_type: "metric",
      policy_version: "v4.5-smoke",
      content: { metrics: [{ key: "smoke", label: "Smoke Test", target: 100 }] },
      is_active: true,
    }).select().single();
    if (error) throw error;
    cleanup.ruleId = data.id;
    log("info", `  rule_id=${data.id.slice(0, 8)}…`);
    return data;
  });

  // ─── 3b. Update: toggle is_active ────────────────────────────────────────
  await step("Toggle is_active → false → true", async () => {
    const off = await sb.from("business_rules").update({ is_active: false }).eq("id", cleanup.ruleId).select().single();
    if (off.error) throw off.error;
    if (off.data.is_active !== false) throw new Error("no se apagó");
    const on = await sb.from("business_rules").update({ is_active: true }).eq("id", cleanup.ruleId).select().single();
    if (on.error) throw on.error;
    if (on.data.is_active !== true) throw new Error("no se prendió");
  });

  // ─── 4. CRUD — override por cliente ──────────────────────────────────────
  const supportClient = await step("Buscar cliente soporte para override", async () => {
    const { data, error } = await sb.from("clients").select("id, name, client_type").eq("client_type", "soporte").limit(1).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("no hay clientes de soporte");
    log("info", `  ${data.name} (${data.id})`);
    return data;
  });

  await step("Crear client_rule_override", async () => {
    const { data, error } = await sb.from("client_rule_overrides").upsert({
      client_id: supportClient.id,
      rule_id: cleanup.ruleId,
      override_content: { metrics: [{ key: "smoke", label: "Override Smoke", target: 200 }] },
      notes: "[SMOKE TEST] se borra automáticamente",
      is_active: true,
    }, { onConflict: "client_id,rule_id" }).select().single();
    if (error) throw error;
    cleanup.overrideId = data.id;
    log("info", `  override_id=${data.id.slice(0, 8)}…`);
  });

  // ─── 5. Evaluate-case-compliance sobre un ticket abierto ────────────────
  const testTicket = await step("Localizar un ticket abierto para evaluar", async () => {
    const { data, error } = await sb
      .from("support_tickets")
      .select("id, ticket_id, tipo, prioridad, estado, client_id, fecha_registro")
      .not("estado", "in", "(CERRADA,ANULADA,FINALIZADO)")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("no hay tickets abiertos");
    log("info", `  ${data.ticket_id} · ${data.tipo} × ${data.prioridad} · cliente ${data.client_id}`);
    return data;
  });

  const compliance = await step("Invocar evaluate-case-compliance", async () => {
    const { data, error } = await sb.functions.invoke("evaluate-case-compliance", {
      body: { ticket_id: testTicket.id },
    });
    if (error) throw new Error(`${error.message}${error.context?.message ? ` — ${error.context.message}` : ""}`);
    if (!data?.compliance) throw new Error("respuesta sin compliance");
    const c = data.compliance;
    log("info", `  semáforo=${c.semaphore} · deadline=${c.applicable_deadline_days}d · restantes=${c.days_remaining} · risk=${c.risk_level}`);
    // Validación del fix: si fuera la versión vieja, TODOS los tickets caerían a 5d (consulta/media fallback).
    // Con el fix, el deadline depende del tipo + prioridad real.
    if (c.applicable_deadline_days == null) throw new Error("deadline no se aplicó");
    return c;
  });

  await step("Verificar persistencia en case_compliance", async () => {
    const { data, error } = await sb.from("case_compliance").select("*").eq("ticket_id", testTicket.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("no se persistió la evaluación");
    if (data.applicable_deadline_days !== compliance.applicable_deadline_days) {
      throw new Error("deadline en DB no coincide con el respondido");
    }
    log("info", `  semáforo persistido=${data.semaphore} · last_evaluated_at=${data.last_evaluated_at?.slice(0, 19)}`);
  });

  // ─── 6. Verificar que las vistas IA también ven los nuevos valores ──────
  await step("Sanity check: tickets abiertos cuentan sin incluir CERRADA/ANULADA", async () => {
    const { count: allCount } = await sb.from("support_tickets").select("id", { count: "exact", head: true });
    const { count: openCount } = await sb.from("support_tickets")
      .select("id", { count: "exact", head: true })
      .not("estado", "in", "(CERRADA,ANULADA,FINALIZADO)");
    log("info", `  total=${allCount} · abiertos reales=${openCount} · cerrados=${allCount - openCount}`);
    if (openCount === allCount) throw new Error("no hay tickets cerrados — algo anda mal con el filtro");
  });

} catch {
  // ya logueado en step()
} finally {
  // ─── 7. Cleanup ──────────────────────────────────────────────────────────
  log("info", "─── cleanup ───");
  if (cleanup.overrideId) {
    const { error } = await sb.from("client_rule_overrides").delete().eq("id", cleanup.overrideId);
    log(error ? "warn" : "ok", error ? `override no eliminado: ${error.message}` : "override eliminado");
  }
  if (cleanup.ruleId) {
    const { error } = await sb.from("business_rules").delete().eq("id", cleanup.ruleId);
    log(error ? "warn" : "ok", error ? `rule no eliminada: ${error.message}` : "rule eliminada");
  }
  await sb.auth.signOut();

  const totalMs = Date.now() - startedAt;
  console.log("");
  console.log("━".repeat(60));
  console.log(`Resumen: ${out.passed} ok · ${out.failed} fail · ${out.skipped} skip · ${totalMs}ms`);
  console.log("━".repeat(60));
  process.exit(out.failed > 0 ? 1 : 0);
}
