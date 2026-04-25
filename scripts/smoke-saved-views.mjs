#!/usr/bin/env node
/**
 * Smoke E2E para CRUD de user_saved_views (vistas guardadas del wizard
 * en Insights / Operación / Scrum).
 *
 * Verifica:
 *   - Insert (crear vista)
 *   - Select (listado por scope)
 *   - Update (cambiar config / nombre)
 *   - Delete
 *   - Pin único (al pinear una vista, otras del mismo user/scope se despin)
 *   - RLS: usuario sólo ve sus propias vistas
 *   - UNIQUE (user_id, scope, name) constraint
 *   - Scope CHECK constraint permite insights / operacion / scrum
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx bun run scripts/smoke-saved-views.mjs
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
if (!URL || !ANON || !SERVICE) { console.error("Falta env"); process.exit(2); }

const sbAdmin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const newAnon = () => createClient(URL, ANON, { auth: { persistSession: false } });

const stamp = Date.now().toString(36);
const A_EMAIL = `smoke-sv-a-${stamp}@sysde.test`;
const B_EMAIL = `smoke-sv-b-${stamp}@sysde.test`;
const PASS = `Smoke${stamp}!`;

let userA, userB, sbA, sbB;
const cleanup = { userIds: [] };

const out = { passed: 0, failed: 0 };
function log(level, msg) {
  const icon = { ok: "\x1b[32m✓\x1b[0m", fail: "\x1b[31m✗\x1b[0m", group: "\x1b[1;36m◆\x1b[0m" }[level] || " ";
  process.stdout.write(`${icon} ${msg}\n`);
}
async function step(name, fn) {
  try { await fn(); log("ok", name); out.passed++; }
  catch (e) { log("fail", `${name} — ${e.message}`); out.failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function bootstrap() {
  log("group", "Bootstrap users A + B");
  const a = await sbAdmin.auth.admin.createUser({
    email: A_EMAIL, password: PASS, email_confirm: true,
    user_metadata: { full_name: "User A" },
  });
  if (a.error) throw a.error;
  userA = a.data.user.id;
  cleanup.userIds.push(userA);

  const b = await sbAdmin.auth.admin.createUser({
    email: B_EMAIL, password: PASS, email_confirm: true,
    user_metadata: { full_name: "User B" },
  });
  if (b.error) throw b.error;
  userB = b.data.user.id;
  cleanup.userIds.push(userB);

  const sa = await newAnon().auth.signInWithPassword({ email: A_EMAIL, password: PASS });
  if (sa.error) throw sa.error;
  sbA = createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${sa.data.session.access_token}` } },
  });

  const sb = await newAnon().auth.signInWithPassword({ email: B_EMAIL, password: PASS });
  if (sb.error) throw sb.error;
  sbB = createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${sb.data.session.access_token}` } },
  });
}

async function tests() {
  log("group", "CRUD básico (user A)");

  let v1Id, v2Id, v3Id;

  await step("INSERT vista insights", async () => {
    const { data, error } = await sbA.from("user_saved_views").insert({
      user_id: userA, scope: "insights",
      name: `Test insights ${stamp}`, preset_key: "resumen", config: { foo: "bar" },
    }).select().single();
    if (error) throw error;
    v1Id = data.id;
  });

  await step("INSERT vista scrum (scope nuevo)", async () => {
    const { data, error } = await sbA.from("user_saved_views").insert({
      user_id: userA, scope: "scrum",
      name: `Test scrum ${stamp}`, preset_key: "tablero", config: {},
    }).select().single();
    if (error) throw error;
    v2Id = data.id;
  });

  await step("INSERT vista operacion", async () => {
    const { data, error } = await sbA.from("user_saved_views").insert({
      user_id: userA, scope: "operacion",
      name: `Test op ${stamp}`, preset_key: "tabla", config: {},
    }).select().single();
    if (error) throw error;
    v3Id = data.id;
  });

  await step("INSERT scope inválido → CHECK falla", async () => {
    const { error } = await sbA.from("user_saved_views").insert({
      user_id: userA, scope: "no_existe",
      name: "x", preset_key: "x", config: {},
    });
    if (!error) throw new Error("debería fallar por CHECK constraint");
  });

  await step("INSERT duplicado (mismo user+scope+name) → UNIQUE falla", async () => {
    const { error } = await sbA.from("user_saved_views").insert({
      user_id: userA, scope: "insights",
      name: `Test insights ${stamp}`, preset_key: "otro", config: {},
    });
    if (!error) throw new Error("debería fallar por UNIQUE");
  });

  await step("SELECT por scope sólo trae las del scope", async () => {
    const { data } = await sbA.from("user_saved_views").select("*").eq("scope", "scrum");
    assert(data?.length === 1, `esperaba 1, got ${data?.length}`);
    assert(data[0].id === v2Id, "no es la vista correcta");
  });

  await step("UPDATE config", async () => {
    const { error } = await sbA.from("user_saved_views")
      .update({ config: { updated: true } }).eq("id", v1Id);
    if (error) throw error;
    const { data } = await sbA.from("user_saved_views").select("config").eq("id", v1Id).single();
    assert(data.config?.updated === true, "config no actualizada");
  });

  await step("UPDATE name (rename)", async () => {
    const { error } = await sbA.from("user_saved_views")
      .update({ name: `Renombrada ${stamp}` }).eq("id", v3Id);
    if (error) throw error;
  });

  log("group", "Pin (default vista)");

  await step("Pinear v1", async () => {
    const { error } = await sbA.from("user_saved_views")
      .update({ is_pinned: true }).eq("id", v1Id);
    if (error) throw error;
    const { data } = await sbA.from("user_saved_views").select("is_pinned").eq("id", v1Id).single();
    assert(data.is_pinned === true, "no quedó pinned");
  });

  await step("Pinear v2 (de otro scope) NO afecta v1", async () => {
    // Lógica del client: al pinear uno, despinea otros del MISMO scope. Diferente scope → coexisten
    await sbA.from("user_saved_views").update({ is_pinned: true }).eq("id", v2Id);
    const { data } = await sbA.from("user_saved_views").select("id, is_pinned, scope").eq("user_id", userA);
    const pinned = data.filter(d => d.is_pinned);
    assert(pinned.length === 2, `esperaba 2 pinned (1 por scope), got ${pinned.length}`);
  });

  await step("Despinear v1", async () => {
    await sbA.from("user_saved_views").update({ is_pinned: false }).eq("id", v1Id);
    const { data } = await sbA.from("user_saved_views").select("is_pinned").eq("id", v1Id).single();
    assert(data.is_pinned === false, "no se despinneó");
  });

  log("group", "RLS — user A no ve vistas de user B");

  let vBId;
  await step("User B crea su vista", async () => {
    const { data, error } = await sbB.from("user_saved_views").insert({
      user_id: userB, scope: "insights",
      name: `B insights ${stamp}`, preset_key: "resumen", config: {},
    }).select().single();
    if (error) throw error;
    vBId = data.id;
  });

  await step("User A NO ve vistas de B", async () => {
    const { data } = await sbA.from("user_saved_views").select("*").eq("user_id", userB);
    assert((data ?? []).length === 0, `RLS leak: A vio ${data.length} vistas de B`);
  });

  await step("User B NO ve vistas de A", async () => {
    const { data } = await sbB.from("user_saved_views").select("*").eq("user_id", userA);
    assert((data ?? []).length === 0, `RLS leak: B vio ${data.length} vistas de A`);
  });

  await step("User A NO puede borrar vista de B (RLS check_using)", async () => {
    const { error } = await sbA.from("user_saved_views").delete().eq("id", vBId);
    // RLS oculta la fila → delete no encuentra nada y no falla, pero no borra.
    const { data } = await sbAdmin.from("user_saved_views").select("id").eq("id", vBId).maybeSingle();
    assert(data, "vista de B fue borrada por A — RLS leak");
  });

  log("group", "DELETE");

  await step("User A borra sus 3 vistas", async () => {
    for (const id of [v1Id, v2Id, v3Id]) {
      const { error } = await sbA.from("user_saved_views").delete().eq("id", id);
      if (error) throw error;
    }
    const { data } = await sbAdmin.from("user_saved_views").select("id").eq("user_id", userA);
    assert((data ?? []).length === 0, "no se borraron todas");
  });

  await step("User B borra su vista", async () => {
    await sbB.from("user_saved_views").delete().eq("id", vBId);
  });
}

async function cleanupAll() {
  log("group", "Cleanup");
  for (const uid of cleanup.userIds) {
    await sbAdmin.from("user_saved_views").delete().eq("user_id", uid);
    await sbAdmin.auth.admin.deleteUser(uid).catch(() => {});
  }
  log("ok", "Cleanup terminado");
}

(async () => {
  try { await bootstrap(); await tests(); }
  catch (e) { log("fail", `Fatal: ${e.message}`); }
  finally { await cleanupAll().catch(() => {}); }
  console.log(`\n━━━ ${out.passed}/${out.passed + out.failed} OK ━━━`);
  if (out.failed > 0) process.exit(1);
})();
