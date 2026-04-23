#!/usr/bin/env node
/**
 * Smoke test E2E — CRUD completo de los recursos críticos del ERP.
 *
 * Recursos cubiertos:
 *   1. clients             — Create/Read/Update/Delete
 *   2. support_tickets     — Create/Read/Update/Delete (usa trigger de consecutivos)
 *   3. cliente users       — Create/Read/Update/Delete via edge fn manage-users
 *                            (rol cliente + cliente_company_assignments)
 *   4. shared_support_presentations — Create/Read/Delete
 *   5. support_minutes_feedback     — Create/Read (feedback asociado a minuta)
 *
 * Requiere SERVICE ROLE KEY (para crear el admin de prueba + bypass RLS en cleanup).
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx bun run scripts/smoke-crud-full.mjs
 *
 * Cada test deja IDs registrados en `cleanup` y se borran al final incluso si algo falla.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// ─── Carga de env ────────────────────────────────────────────────────────

if (existsSync(".env")) {
  readFileSync(".env", "utf8").split("\n").forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON) {
  console.error("Falta SUPABASE_URL / SUPABASE_ANON_KEY");
  process.exit(2);
}
if (!SERVICE) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY (requerido para crear admin y cleanup)");
  console.error("Uso: SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx bun run scripts/smoke-crud-full.mjs");
  process.exit(2);
}

const sbAdmin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const sbClient = createClient(URL, ANON, { auth: { persistSession: false } });

// ─── Framework mínimo de tests ───────────────────────────────────────────

const out = { passed: 0, failed: 0, steps: [] };
const cleanup = {
  testClientId: null,
  testTicketIds: [],
  testUserIds: [],
  testMinutaIds: [],
  testFeedbackIds: [],
  testAdminUserId: null,
};

function log(level, msg) {
  const icon = {
    ok: "\x1b[32m✓\x1b[0m",
    fail: "\x1b[31m✗\x1b[0m",
    info: "\x1b[90m·\x1b[0m",
    warn: "\x1b[33m!\x1b[0m",
    group: "\x1b[1;36m◆\x1b[0m",
  }[level] || " ";
  process.stdout.write(`${icon} ${msg}\n`);
}

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    log("ok", `${name} \x1b[90m(${Date.now() - t0}ms)\x1b[0m`);
    out.passed++;
    out.steps.push({ name, status: "ok" });
    return r;
  } catch (e) {
    log("fail", `${name} — ${e.message}`);
    out.failed++;
    out.steps.push({ name, status: "fail", error: e.message });
    throw e;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ─── IDs únicos por run ──────────────────────────────────────────────────

const stamp = Date.now().toString(36);
const TEST_CLIENT_ID = `smoke-${stamp}`;
const TEST_CLIENT_NAME = `Smoke Test Client ${stamp}`;
const TEST_ADMIN_EMAIL = `smoke-admin-${stamp}@sysde.test`;
const TEST_ADMIN_PASS = `SmokePass${stamp}!`;
const TEST_CLIENTE_EMAIL = `smoke-cliente-${stamp}@sysde.test`;
const TEST_CLIENTE_PASS = `SmokeCliente${stamp}!`;

// ─── Bootstrap admin ─────────────────────────────────────────────────────

async function bootstrapAdmin() {
  log("group", "Bootstrap: admin de prueba");
  const { data: u, error: uErr } = await sbAdmin.auth.admin.createUser({
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASS,
    email_confirm: true,
    user_metadata: { full_name: "Smoke Admin" },
  });
  if (uErr) throw uErr;
  cleanup.testAdminUserId = u.user.id;

  const { error: rErr } = await sbAdmin.from("user_roles").insert({ user_id: u.user.id, role: "admin" });
  if (rErr) throw rErr;

  const { data: session, error: sErr } = await sbClient.auth.signInWithPassword({
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASS,
  });
  if (sErr) throw sErr;
  assert(session?.session?.access_token, "No se obtuvo token de admin");
  return session.session.access_token;
}

// ─── Tests: CLIENTS ──────────────────────────────────────────────────────

async function testClients() {
  log("group", "CRUD: clients");

  await step("CREATE cliente", async () => {
    const { error } = await sbAdmin.from("clients").insert({
      id: TEST_CLIENT_ID,
      name: TEST_CLIENT_NAME,
      country: "Costa Rica",
      industry: "Test",
      contact_name: "Smoke Tester",
      contact_email: "tester@test.test",
      contract_start: "2026-01-01",
      contract_end: "2027-01-01",
      status: "activo",
      progress: 0,
      core_version: "2026.1",
      client_type: "soporte",
      nivel_servicio: "Base",
    });
    if (error) throw error;
    cleanup.testClientId = TEST_CLIENT_ID;
  });

  await step("READ cliente creado", async () => {
    const { data, error } = await sbAdmin.from("clients").select("*").eq("id", TEST_CLIENT_ID).maybeSingle();
    if (error) throw error;
    assert(data, "No se encontró el cliente recién creado");
    assert(data.name === TEST_CLIENT_NAME, "Nombre no coincide");
  });

  await step("UPDATE cliente (status → en-riesgo)", async () => {
    const { error } = await sbAdmin.from("clients").update({ status: "en-riesgo" }).eq("id", TEST_CLIENT_ID);
    if (error) throw error;
    const { data } = await sbAdmin.from("clients").select("status").eq("id", TEST_CLIENT_ID).single();
    assert(data.status === "en-riesgo", "Status no se actualizó");
  });

  // DELETE queda al cleanup final
}

// ─── Tests: SUPPORT_TICKETS ──────────────────────────────────────────────

async function testTickets() {
  log("group", "CRUD: support_tickets");

  const ticketRow = await step("CREATE ticket (trigger genera consecutivos)", async () => {
    const { data, error } = await sbAdmin.from("support_tickets").insert({
      client_id: TEST_CLIENT_ID,
      producto: "Test",
      asunto: `Smoke caso ${stamp}`,
      tipo: "Requerimiento",
      prioridad: "Media",
      estado: "EN ATENCIÓN",
      dias_antiguedad: 0,
    }).select().single();
    if (error) throw error;
    cleanup.testTicketIds.push(data.id);
    assert(data.ticket_id, "Trigger no generó ticket_id");
    return data;
  });

  await step("READ ticket por ID", async () => {
    const { data, error } = await sbAdmin.from("support_tickets").select("*").eq("id", ticketRow.id).single();
    if (error) throw error;
    assert(data.asunto.startsWith("Smoke caso"), "Asunto no coincide");
  });

  await step("UPDATE ticket (estado → POR CERRAR)", async () => {
    const { error } = await sbAdmin.from("support_tickets")
      .update({ estado: "POR CERRAR" })
      .eq("id", ticketRow.id);
    if (error) throw error;
    const { data } = await sbAdmin.from("support_tickets").select("estado").eq("id", ticketRow.id).single();
    assert(data.estado === "POR CERRAR", "Estado no se actualizó");
  });

  // Un segundo ticket para verificar consecutivos incrementales
  await step("CREATE segundo ticket (consecutivo debe incrementar)", async () => {
    const { data: t2, error } = await sbAdmin.from("support_tickets").insert({
      client_id: TEST_CLIENT_ID,
      producto: "Test",
      asunto: `Smoke caso 2 ${stamp}`,
      tipo: "Incidente",
      prioridad: "Alta",
      estado: "PENDIENTE",
      dias_antiguedad: 0,
    }).select().single();
    if (error) throw error;
    cleanup.testTicketIds.push(t2.id);
    assert(t2.ticket_id !== ticketRow.ticket_id, "ticket_id se repitió entre 2 tickets del mismo cliente");
  });

  // DELETE en cleanup
}

// ─── Tests: CLIENTE USERS (último cambio) ────────────────────────────────

async function testClienteUsers(adminJwt) {
  log("group", "CRUD: cliente users (vía edge fn manage-users)");

  // Invoker con JWT de admin
  const invokeAsAdmin = async (body) => {
    const res = await fetch(`${URL}/functions/v1/manage-users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminJwt}`,
        apikey: ANON,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data?.error) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    return data;
  };

  let userId;

  await step("CREATE usuario cliente (create_cliente)", async () => {
    const res = await invokeAsAdmin({
      action: "create_cliente",
      email: TEST_CLIENTE_EMAIL,
      password: TEST_CLIENTE_PASS,
      full_name: "Smoke Cliente",
      client_id: TEST_CLIENT_ID,
      permission_level: "viewer",
    });
    assert(res?.user_id, "create_cliente no devolvió user_id");
    userId = res.user_id;
    cleanup.testUserIds.push(userId);
  });

  await step("READ: list_cliente_users contiene el nuevo usuario", async () => {
    const res = await invokeAsAdmin({
      action: "list_cliente_users",
      client_id: TEST_CLIENT_ID,
    });
    assert(Array.isArray(res?.users), "list_cliente_users no devolvió users[]");
    const found = res.users.find((u) => u.user_id === userId);
    assert(found, "Usuario recién creado no aparece en la lista");
    assert(found.permission_level === "viewer", "Permiso inicial no es viewer");
  });

  await step("READ: user_roles tiene role=cliente para el nuevo usuario", async () => {
    const { data } = await sbAdmin.from("user_roles")
      .select("role").eq("user_id", userId).eq("role", "cliente").maybeSingle();
    assert(data?.role === "cliente", "El rol cliente no se asignó en user_roles");
  });

  await step("READ: cliente_company_assignments tiene el row correcto", async () => {
    const { data } = await sbAdmin.from("cliente_company_assignments")
      .select("*").eq("user_id", userId).eq("client_id", TEST_CLIENT_ID).maybeSingle();
    assert(data, "Falta row en cliente_company_assignments");
    assert(data.permission_level === "viewer", "permission_level no es viewer");
  });

  await step("UPDATE permiso viewer → editor", async () => {
    await invokeAsAdmin({
      action: "update_cliente_permission",
      user_id: userId,
      client_id: TEST_CLIENT_ID,
      permission_level: "editor",
    });
    const { data } = await sbAdmin.from("cliente_company_assignments")
      .select("permission_level").eq("user_id", userId).eq("client_id", TEST_CLIENT_ID).single();
    assert(data.permission_level === "editor", "permission_level no se actualizó");
  });

  await step("LOGIN como cliente y verificar RLS (ve su cliente, no otros)", async () => {
    const sbCliente = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data: session, error } = await sbCliente.auth.signInWithPassword({
      email: TEST_CLIENTE_EMAIL,
      password: TEST_CLIENTE_PASS,
    });
    if (error) throw error;
    assert(session?.session?.access_token, "No pudo loguearse el cliente");

    // Ver tickets: debe ver los del TEST_CLIENT_ID
    const { data: tickets, error: tErr } = await sbCliente.from("support_tickets").select("id, client_id").limit(50);
    if (tErr) throw tErr;
    assert(tickets.every((t) => t.client_id === TEST_CLIENT_ID),
      `RLS leak: cliente ve tickets de otros clientes (${tickets.map(t => t.client_id).join(",")})`);

    // Ver horas: debe ver sólo las de su cliente (si hay)
    const { data: hours } = await sbCliente.from("work_time_entries").select("id, client_id").limit(50);
    assert((hours || []).every((h) => h.client_id === TEST_CLIENT_ID),
      "RLS leak: cliente ve horas de otros clientes");

    await sbCliente.auth.signOut();
  });

  await step("DELETE (revoke assignment + auth user)", async () => {
    await invokeAsAdmin({
      action: "remove_cliente_assignment",
      user_id: userId,
      client_id: TEST_CLIENT_ID,
      delete_user: true,
    });
    const { data: assign } = await sbAdmin.from("cliente_company_assignments")
      .select("id").eq("user_id", userId).eq("client_id", TEST_CLIENT_ID).maybeSingle();
    assert(!assign, "Assignment no se borró");
    // El user auth puede haber sido borrado o no dependiendo de si tenía otros assignments; ignoramos.
    cleanup.testUserIds = cleanup.testUserIds.filter((id) => id !== userId); // ya borrado
  });
}

// ─── Tests: MINUTAS + FEEDBACK ───────────────────────────────────────────

async function testMinutas() {
  log("group", "CRUD: shared_support_presentations + feedback");

  let minutaId;

  await step("CREATE minuta publicada al perfil", async () => {
    const { data, error } = await sbAdmin.from("shared_support_presentations").insert({
      client_id: TEST_CLIENT_ID,
      title: `Smoke minuta ${stamp}`,
      selected_slides: [0, 1, 2, 3, 4, 5, 6],
      presentation_snapshot: {
        minuta: {
          title: "Minuta smoke",
          date: new Date().toISOString(),
          summary: "Test",
          attendees: [],
          agreements: [],
          action_items: [],
          cases_referenced: [],
        },
        tickets: [],
        clientName: TEST_CLIENT_NAME,
      },
    }).select("id, token").single();
    if (error) throw error;
    minutaId = data.id;
    cleanup.testMinutaIds.push(minutaId);
    assert(data.token, "Token no se generó por default");
  });

  await step("READ minuta por client_id", async () => {
    const { data, error } = await sbAdmin.from("shared_support_presentations")
      .select("*").eq("client_id", TEST_CLIENT_ID);
    if (error) throw error;
    assert(data.some((m) => m.id === minutaId), "Minuta no aparece en fetch por client_id");
  });

  await step("CREATE feedback de minuta", async () => {
    const { data, error } = await sbAdmin.from("support_minutes_feedback").insert({
      shared_presentation_id: minutaId,
      client_id: TEST_CLIENT_ID,
      sentiment: "positivo",
      text_comment: "Smoke feedback",
      author_name: "Smoke Tester",
    }).select("id").single();
    if (error) throw error;
    cleanup.testFeedbackIds.push(data.id);
  });

  await step("READ feedback filtrado por client_id", async () => {
    const { data, error } = await sbAdmin.from("support_minutes_feedback")
      .select("*").eq("client_id", TEST_CLIENT_ID);
    if (error) throw error;
    assert(data.length >= 1, "No se encontró feedback creado");
  });
}

// ─── Cleanup ─────────────────────────────────────────────────────────────

async function cleanupAll() {
  log("group", "Cleanup");

  // Feedback primero (FK a minutas)
  for (const id of cleanup.testFeedbackIds) {
    await sbAdmin.from("support_minutes_feedback").delete().eq("id", id);
  }
  for (const id of cleanup.testMinutaIds) {
    await sbAdmin.from("shared_support_presentations").delete().eq("id", id);
  }

  // Cliente users restantes (los que no se borraron en test)
  for (const userId of cleanup.testUserIds) {
    await sbAdmin.from("cliente_company_assignments").delete().eq("user_id", userId);
    await sbAdmin.auth.admin.deleteUser(userId).catch(() => {});
  }

  // Tickets
  for (const id of cleanup.testTicketIds) {
    await sbAdmin.from("support_tickets").delete().eq("id", id);
  }

  // Cliente
  if (cleanup.testClientId) {
    await sbAdmin.from("clients").delete().eq("id", cleanup.testClientId);
  }

  // Admin de prueba
  if (cleanup.testAdminUserId) {
    await sbAdmin.from("user_roles").delete().eq("user_id", cleanup.testAdminUserId);
    await sbAdmin.auth.admin.deleteUser(cleanup.testAdminUserId).catch(() => {});
  }

  log("ok", "Cleanup terminado");
}

// ─── Main ────────────────────────────────────────────────────────────────

(async () => {
  const startedAt = Date.now();
  try {
    const adminJwt = await bootstrapAdmin();
    await testClients();
    await testTickets();
    await testClienteUsers(adminJwt);
    await testMinutas();
  } catch (err) {
    log("fail", `Smoke interrumpido: ${err.message}`);
  } finally {
    try { await cleanupAll(); } catch (e) { log("warn", `Cleanup parcial: ${e.message}`); }
  }

  const durMs = Date.now() - startedAt;
  const total = out.passed + out.failed;
  console.log(`\n━━━ Resultado: ${out.passed}/${total} pasaron · ${durMs}ms ━━━`);
  if (out.failed > 0) {
    console.log("\nFallos:");
    out.steps.filter((s) => s.status === "fail").forEach((s) => console.log(`  ✗ ${s.name}: ${s.error}`));
    process.exit(1);
  }
})();
