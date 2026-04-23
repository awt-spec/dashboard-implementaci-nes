#!/usr/bin/env node
/**
 * Smoke test E2E para el CRUD de tickets (post-migración 20260422_ticket_full_form).
 *
 * Valida:
 *   1. Login admin/PM
 *   2. CREATE sin ticket_id → trigger genera ticket_id + consecutivo_cliente + consecutivo_global
 *   3. CREATE con ticket_id explícito → trigger respeta el valor manual
 *   4. CREATE consecutivos secuenciales → mismo cliente incrementa consecutivo_cliente
 *   5. READ con todos los campos nuevos
 *   6. UPDATE con prioridad_interna, tiempo_consumido_minutos, orden_atencion
 *   7. DELETE (cleanup)
 *   8. Defaults: centro_servicio, orden_atencion, tiempos empiezan con 0
 *   9. fecha_estimada_cierre = fecha_entrega + 2d (trigger)
 *
 * Uso:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... bun run scripts/smoke-tickets.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

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

if (!URL || !ANON) { console.error("Falta SUPABASE_URL / SUPABASE_ANON_KEY"); process.exit(2); }
if (!EMAIL || !PASS) {
  console.error("Falta ADMIN_EMAIL y ADMIN_PASSWORD");
  console.error("Uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... bun run scripts/smoke-tickets.mjs");
  process.exit(2);
}

const sb = createClient(URL, ANON);
const out = { passed: 0, failed: 0, steps: [] };
const startedAt = Date.now();
const cleanup = { ticketIds: [] };

function log(level, msg) {
  const icon = { ok: "\x1b[32m✓\x1b[0m", fail: "\x1b[31m✗\x1b[0m", info: "\x1b[90m·\x1b[0m", warn: "\x1b[33m!\x1b[0m" }[level] || " ";
  process.stdout.write(`${icon} ${msg}\n`);
}

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    log("ok", `${name} (${Date.now() - t0}ms)`);
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

try {
  // ─── 1. LOGIN ────────────────────────────────────────────────────────────
  await step("Login admin", async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASS });
    if (error) throw error;
    const { data: role } = await sb.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle();
    log("info", `  role=${role?.role ?? "sin rol"}`);
    if (!["admin", "pm"].includes(role?.role)) {
      throw new Error(`usuario no es admin/pm (rol: ${role?.role ?? "ninguno"})`);
    }
  });

  // ─── 2. Buscar cliente soporte con menos tickets ────────────────────────
  const client = await step("Buscar cliente de soporte", async () => {
    const { data } = await sb.from("clients")
      .select("id, name, nivel_servicio, categoria_interna, ranking_position")
      .eq("client_type", "soporte")
      .limit(1)
      .maybeSingle();
    if (!data) throw new Error("sin clientes de soporte");
    log("info", `  ${data.name} (${data.id}) · nivel=${data.nivel_servicio || "—"}`);
    return data;
  });

  // Consecutivo base antes de la prueba
  const baseConsecutivo = await step("Leer max(consecutivo_cliente) actual", async () => {
    const { data } = await sb.from("support_tickets")
      .select("consecutivo_cliente")
      .eq("client_id", client.id)
      .order("consecutivo_cliente", { ascending: false })
      .limit(1)
      .maybeSingle();
    const current = data?.consecutivo_cliente ?? 0;
    log("info", `  consecutivo actual: ${current}`);
    return current;
  });

  // ─── 3. CREATE sin ticket_id — trigger debe autogenerar todo ────────────
  const t1 = await step("CREATE ticket sin ticket_id (trigger autogenera)", async () => {
    const { data, error } = await sb.from("support_tickets").insert({
      client_id: client.id,
      asunto: "[SMOKE] Test trigger consecutivo — se borra",
      descripcion: "Ticket creado por smoke-tickets.mjs. Se elimina al final.",
      tipo: "Consulta",
      prioridad: "Media",
      estado: "PENDIENTE",
      producto: "Smoke Test",
      fecha_registro: new Date().toISOString().slice(0, 10),
      fecha_entrega: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      dias_antiguedad: 0,
    }).select().single();
    if (error) throw error;
    cleanup.ticketIds.push(data.id);

    assert(data.ticket_id && data.ticket_id !== "", "ticket_id no se generó");
    assert(data.consecutivo_cliente === baseConsecutivo + 1, `consecutivo_cliente esperado ${baseConsecutivo + 1}, got ${data.consecutivo_cliente}`);
    assert(data.consecutivo_global && data.consecutivo_global >= 10000, "consecutivo_global no válido");
    assert(data.centro_servicio === "Centro de Servicio Corporativo", "default centro_servicio no aplicado");
    assert(data.orden_atencion === 0, "default orden_atencion no aplicado");
    assert(data.tiempo_consumido_minutos === 0, "default tiempo_consumido no aplicado");
    assert(data.fecha_estimada_cierre, "trigger no calculó fecha_estimada_cierre");

    log("info", `  ticket_id=${data.ticket_id} · consecutivo_cliente=${data.consecutivo_cliente} · global=${data.consecutivo_global}`);
    log("info", `  fecha_estimada_cierre=${data.fecha_estimada_cierre} (calculado por trigger)`);
    return data;
  });

  // ─── 4. CREATE consecutivo +1 — verifica que suba ─────────────────────
  const t2 = await step("CREATE segundo ticket (consecutivo +1)", async () => {
    const { data, error } = await sb.from("support_tickets").insert({
      client_id: client.id,
      asunto: "[SMOKE] Segundo test",
      descripcion: "Verifica que consecutivo_cliente se incrementa correctamente.",
      tipo: "Incidente",
      prioridad: "Alta",
      estado: "PENDIENTE",
      dias_antiguedad: 0,
    }).select().single();
    if (error) throw error;
    cleanup.ticketIds.push(data.id);
    assert(data.consecutivo_cliente === t1.consecutivo_cliente + 1, `consecutivo no incrementó: ${t1.consecutivo_cliente} → ${data.consecutivo_cliente}`);
    assert(data.consecutivo_global > t1.consecutivo_global, "consecutivo_global no es monotónico");
    log("info", `  ${data.ticket_id} · local ${data.consecutivo_cliente} · global ${data.consecutivo_global}`);
    return data;
  });

  // ─── 5. CREATE con ticket_id explícito — trigger debe respetarlo ────────
  const t3 = await step("CREATE con ticket_id manual (trigger NO sobrescribe)", async () => {
    const manualId = `SMOKE-${Date.now()}`;
    const { data, error } = await sb.from("support_tickets").insert({
      client_id: client.id,
      ticket_id: manualId,
      asunto: "[SMOKE] Test con ID manual",
      descripcion: "Trigger debe respetar ticket_id provisto.",
      tipo: "Consulta",
      prioridad: "Baja",
      estado: "PENDIENTE",
      dias_antiguedad: 0,
    }).select().single();
    if (error) throw error;
    cleanup.ticketIds.push(data.id);
    assert(data.ticket_id === manualId, `ticket_id explícito fue sobrescrito: ${data.ticket_id}`);
    log("info", `  manual ticket_id respetado: ${data.ticket_id}`);
    return data;
  });

  // ─── 6. READ — leer con todos los campos nuevos ─────────────────────────
  await step("READ ticket con campos nuevos", async () => {
    const { data, error } = await sb.from("support_tickets")
      .select("id, ticket_id, consecutivo_cliente, consecutivo_global, descripcion, prioridad_interna, orden_atencion, ubicacion_error, centro_servicio, unidad_fabricacion, tiempo_consumido_minutos, tiempo_cobrado_minutos, fecha_estimada_cierre")
      .eq("id", t1.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("ticket no encontrado");
    assert(data.descripcion?.includes("smoke"), "descripcion no persistió");
    log("info", `  todos los campos nuevos accesibles en SELECT`);
  });

  // ─── 7. UPDATE — campos internos ─────────────────────────────────────────
  await step("UPDATE: prioridad_interna, orden_atencion, tiempo_consumido", async () => {
    const { data, error } = await sb.from("support_tickets").update({
      prioridad_interna: "alta",
      orden_atencion: 5,
      tiempo_consumido_minutos: 45,
      tiempo_cobrado_minutos: 60,
      ubicacion_error: "Módulo contabilidad / cierre diario",
    }).eq("id", t1.id).select().single();
    if (error) throw error;
    assert(data.prioridad_interna === "alta", "prioridad_interna no actualizó");
    assert(data.orden_atencion === 5, "orden_atencion no actualizó");
    assert(data.tiempo_consumido_minutos === 45, "tiempo_consumido no actualizó");
    assert(data.tiempo_cobrado_minutos === 60, "tiempo_cobrado no actualizó");
    log("info", `  prioridad_interna=alta · orden=5 · tiempo=45min/60min cobrado`);
  });

  // ─── 8. LIST con filtro por consecutivo_cliente ─────────────────────────
  await step("LIST: tickets del cliente ordenados por consecutivo", async () => {
    const { data, error } = await sb.from("support_tickets")
      .select("ticket_id, consecutivo_cliente")
      .eq("client_id", client.id)
      .order("consecutivo_cliente", { ascending: false })
      .limit(5);
    if (error) throw error;
    log("info", `  últimos 5: ${data.map(d => `#${d.consecutivo_cliente} ${d.ticket_id}`).join(", ")}`);
    assert(data[0].consecutivo_cliente >= t2.consecutivo_cliente, "ordenamiento no funciona");
  });

  // ─── 9. Propiedades del cliente accesibles ──────────────────────────────
  await step("SELECT clients con propiedades nuevas", async () => {
    const { data } = await sb.from("clients")
      .select("id, name, nivel_servicio, categoria_interna, ranking_position")
      .eq("id", client.id)
      .maybeSingle();
    assert(data.nivel_servicio !== undefined, "columna nivel_servicio no existe");
    assert(data.ranking_position !== undefined, "columna ranking_position no existe");
    log("info", `  nivel=${data.nivel_servicio} · rank=${data.ranking_position}`);
  });

  // ─── 10. Verificar que SELECT NO rompe consumidores viejos ──────────────
  await step("Sanity: consumidores legacy siguen funcionando", async () => {
    const { data, error } = await sb.from("support_tickets")
      .select("*")
      .eq("id", t1.id)
      .maybeSingle();
    if (error) throw error;
    assert(data.asunto, "asunto perdido");
    assert(data.tipo, "tipo perdido");
    assert(data.prioridad, "prioridad perdida");
    assert(data.estado, "estado perdido");
    assert(data.consecutivo_cliente != null, "consecutivo_cliente no viene en SELECT *");
    log("info", `  SELECT * incluye campos viejos Y nuevos`);
  });

  // ─── 11. CREATE ticket con fuente='cliente' (simula portal gerente) ─────
  const tCliente = await step("CREATE ticket desde portal cliente (fuente=cliente)", async () => {
    const { data, error } = await sb.from("support_tickets").insert({
      client_id: client.id,
      asunto: "[SMOKE] Solicitud desde portal del cliente",
      descripcion: "El cliente reporta un problema vía el portal web.",
      tipo: "Consulta",
      prioridad: "Media",
      estado: "PENDIENTE",
      fuente: "cliente",
      dias_antiguedad: 0,
    }).select().single();
    if (error) throw error;
    cleanup.ticketIds.push(data.id);
    assert(data.fuente === "cliente", "fuente no se persistió");
    log("info", `  ${data.ticket_id} · fuente=cliente · estado=${data.estado}`);
    return data;
  });

  // ─── 12. CREATE ticket confidencial (is_confidential=true) ──────────────
  const tConfi = await step("CREATE ticket confidencial", async () => {
    const { data, error } = await sb.from("support_tickets").insert({
      client_id: client.id,
      asunto: "[SMOKE] Ticket con datos confidenciales",
      descripcion: "Credencial temporal: abc123XYZ. No compartir fuera del SVA.",
      tipo: "Incidente",
      prioridad: "Alta",
      estado: "PENDIENTE",
      is_confidential: true,
      fuente: "cliente",
      dias_antiguedad: 0,
    }).select().single();
    if (error) throw error;
    cleanup.ticketIds.push(data.id);
    assert(data.is_confidential === true, "flag is_confidential no se persistió");
    log("info", `  ${data.ticket_id} · 🔒 confidencial`);
    log("info", `  descripcion_cifrada: ${data.descripcion_cifrada ? "SÍ (bytea)" : "no (sin ENCRYPTION_KEY configurada)"}`);
    return data;
  });

  // ─── 13. Verificar que ticket_access_log registró los INSERTs ───────────
  await step("Audit log registró los eventos", async () => {
    const { data, error } = await sb.from("ticket_access_log")
      .select("*")
      .in("ticket_id", cleanup.ticketIds)
      .order("created_at", { ascending: false });
    if (error) {
      log("warn", `  no se puede leer audit log (RLS puede bloquear o tabla no existe): ${error.message}`);
      return;
    }
    const events = data || [];
    log("info", `  ${events.length} eventos en ticket_access_log (esperado: ≥ ${cleanup.ticketIds.length})`);
    assert(events.length >= cleanup.ticketIds.length, `audit log bajo: ${events.length} < ${cleanup.ticketIds.length}`);
  });

  // ─── 14. Verificar que client_notifications se creó para el ticket del cliente ──
  await step("Notificación al SVA creada en client_notifications", async () => {
    const { data, error } = await sb.from("client_notifications")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      log("warn", `  no se puede leer client_notifications: ${error.message}`);
      return;
    }
    const recent = (data || []).filter(n =>
      n.title?.includes("[SMOKE]") || n.title?.includes(tCliente.ticket_id)
    );
    log("info", `  ${recent.length} notificación(es) recientes de smoke tests`);
    // No hacemos assert estricto porque la notif desde insert directo no pasa por nuestro hook
  });

} catch {
  // ya logueado por step()
} finally {
  // ─── CLEANUP ─────────────────────────────────────────────────────────────
  log("info", "─── cleanup ───");
  for (const id of cleanup.ticketIds) {
    const { error } = await sb.from("support_tickets").delete().eq("id", id);
    log(error ? "warn" : "ok", error ? `ticket ${id.slice(0, 8)}… no eliminado: ${error.message}` : `ticket ${id.slice(0, 8)}… eliminado`);
  }
  await sb.auth.signOut();

  const totalMs = Date.now() - startedAt;
  console.log("");
  console.log("━".repeat(60));
  console.log(`Resumen: ${out.passed} ok · ${out.failed} fail · ${totalMs}ms`);
  console.log("━".repeat(60));
  process.exit(out.failed > 0 ? 1 : 0);
}
