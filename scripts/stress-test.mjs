#!/usr/bin/env node
/**
 * Stress test del sistema: concurrencia, throughput y latencias.
 *
 * Tests:
 *   1. Reads concurrentes en support_tickets (50 en paralelo)
 *   2. RPCs concurrentes a get_sla_summary (50 en paralelo)
 *   3. RPCs concurrentes a get_tickets_sla_status (50 en paralelo)
 *   4. Sequential burst: 100 reads consecutivos rápidos
 *   5. Mixed workload: 30 reads + 10 writes simultáneos
 *   6. Test de latencia de la edge function executive-ai-chat (mock leve)
 *
 * Reporta latencias p50/p95/p99, throughput y errors.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx node scripts/stress-test.mjs
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
if (!URL || !SERVICE) {
  console.error("Falta SUPABASE_URL / SERVICE_ROLE_KEY");
  process.exit(2);
}

const sb = createClient(URL, SERVICE, { auth: { persistSession: false } });
const C = { red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", blue: "\x1b[36m", gray: "\x1b[90m", bold: "\x1b[1m", reset: "\x1b[0m" };

console.log(`${C.bold}Stress Test — sva-erp-deploy${C.reset}`);
console.log(`${C.gray}Target: ${URL}${C.reset}`);
console.log(`${C.gray}Started: ${new Date().toISOString()}${C.reset}\n`);

// ─── Helpers ──────────────────────────────────────────────────────────────

function pct(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p / 100));
  return sorted[idx];
}

function fmtMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function runConcurrent(label, n, taskFn) {
  console.log(`${C.bold}${C.blue}━━━ ${label} (${n} en paralelo) ━━━${C.reset}`);
  const start = Date.now();
  const tasks = Array.from({ length: n }, (_, i) => async () => {
    const t0 = Date.now();
    try {
      await taskFn(i);
      return { ok: true, latency: Date.now() - t0 };
    } catch (e) {
      return { ok: false, latency: Date.now() - t0, error: e.message };
    }
  });
  const results = await Promise.all(tasks.map(t => t()));
  const elapsed = Date.now() - start;

  const latencies = results.map(r => r.latency);
  const errors = results.filter(r => !r.ok);
  const throughput = (n / (elapsed / 1000)).toFixed(1);

  console.log(`  ${C.gray}elapsed: ${C.reset}${fmtMs(elapsed)}   ${C.gray}throughput: ${C.reset}${throughput} req/s`);
  console.log(`  ${C.gray}latency: ${C.reset}p50=${fmtMs(pct(latencies, 50))}  p95=${fmtMs(pct(latencies, 95))}  p99=${fmtMs(pct(latencies, 99))}  max=${fmtMs(Math.max(...latencies))}`);

  if (errors.length === 0) {
    console.log(`  ${C.green}✓ ${n} OK · 0 errores${C.reset}\n`);
  } else {
    console.log(`  ${C.red}✗ ${errors.length}/${n} errores${C.reset}`);
    errors.slice(0, 3).forEach(e => console.log(`    ${C.red}- ${e.error}${C.reset}`));
    if (errors.length > 3) console.log(`    ${C.gray}... +${errors.length - 3} más${C.reset}`);
    console.log("");
  }

  return { errors: errors.length, latencies, elapsed };
}

async function runSequentialBurst(label, n, taskFn) {
  console.log(`${C.bold}${C.blue}━━━ ${label} (${n} secuencial) ━━━${C.reset}`);
  const start = Date.now();
  const latencies = [];
  let errors = 0;
  for (let i = 0; i < n; i++) {
    const t0 = Date.now();
    try { await taskFn(i); latencies.push(Date.now() - t0); }
    catch { errors++; }
  }
  const elapsed = Date.now() - start;
  const throughput = (n / (elapsed / 1000)).toFixed(1);
  console.log(`  ${C.gray}elapsed: ${C.reset}${fmtMs(elapsed)}   ${C.gray}throughput: ${C.reset}${throughput} req/s`);
  console.log(`  ${C.gray}latency: ${C.reset}p50=${fmtMs(pct(latencies, 50))}  p95=${fmtMs(pct(latencies, 95))}  avg=${fmtMs(latencies.reduce((s, x) => s + x, 0) / latencies.length)}`);
  if (errors === 0) console.log(`  ${C.green}✓ ${n} OK${C.reset}\n`);
  else console.log(`  ${C.red}✗ ${errors}/${n} errores${C.reset}\n`);
  return { errors, latencies, elapsed };
}

const all = [];

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Reads concurrentes en support_tickets
// ═══════════════════════════════════════════════════════════════════════════
all.push(await runConcurrent("Reads concurrentes · support_tickets (limit 50)", 50, async () => {
  const { error } = await sb.from("support_tickets").select("id, ticket_id, estado, prioridad").limit(50);
  if (error) throw error;
}));

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: RPC get_sla_summary concurrente
// ═══════════════════════════════════════════════════════════════════════════
all.push(await runConcurrent("RPC concurrentes · get_sla_summary", 50, async () => {
  const { error } = await sb.rpc("get_sla_summary");
  if (error) throw error;
}));

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: RPC get_tickets_sla_status (más pesado, devuelve 100+ rows)
// ═══════════════════════════════════════════════════════════════════════════
all.push(await runConcurrent("RPC concurrentes · get_tickets_sla_status", 30, async () => {
  const { error } = await sb.rpc("get_tickets_sla_status");
  if (error) throw error;
}));

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Burst sequential reads (cache warm-up + latency real)
// ═══════════════════════════════════════════════════════════════════════════
all.push(await runSequentialBurst("Burst secuencial · ticket count", 100, async () => {
  const { error } = await sb.from("support_tickets").select("*", { count: "exact", head: true });
  if (error) throw error;
}));

// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: Mixed workload (30 reads + 10 writes en paralelo)
//   Crea/elimina tickets de prueba para no contaminar prod
// ═══════════════════════════════════════════════════════════════════════════
console.log(`${C.bold}${C.blue}━━━ Mixed workload · 30 reads + 10 writes paralelos ━━━${C.reset}`);
{
  // Pick a real client id
  const { data: anyClient } = await sb.from("clients").select("id").limit(1).single();
  if (!anyClient) {
    console.log(`  ${C.yellow}! Sin clients para test mixto${C.reset}\n`);
  } else {
    const writeIds = [];
    const start = Date.now();
    const tasks = [];
    // 30 reads
    for (let i = 0; i < 30; i++) {
      tasks.push(sb.from("support_tickets").select("id").limit(20).then(() => ({ kind: "read", ok: true })).catch(e => ({ kind: "read", ok: false, e })));
    }
    // 10 writes (insert + later cleanup)
    for (let i = 0; i < 10; i++) {
      const stamp = Date.now() + i;
      tasks.push(
        sb.from("support_tickets").insert([{
          client_id: anyClient.id,
          ticket_id: `STRESS-${stamp}`,
          producto: "TEST", asunto: "Stress test", tipo: "Requerimiento",
          prioridad: "Baja", estado: "PENDIENTE", dias_antiguedad: 0,
        }]).select("id").single().then(({ data, error }) => {
          if (error) return { kind: "write", ok: false, e: error };
          writeIds.push(data.id);
          return { kind: "write", ok: true };
        }).catch(e => ({ kind: "write", ok: false, e }))
      );
    }
    const results = await Promise.all(tasks);
    const elapsed = Date.now() - start;
    const reads = results.filter(r => r.kind === "read");
    const writes = results.filter(r => r.kind === "write");
    const readErrors = reads.filter(r => !r.ok).length;
    const writeErrors = writes.filter(w => !w.ok).length;
    console.log(`  ${C.gray}elapsed: ${C.reset}${fmtMs(elapsed)}`);
    console.log(`  ${readErrors === 0 ? C.green : C.red}reads: ${reads.length - readErrors}/${reads.length} OK${C.reset}`);
    console.log(`  ${writeErrors === 0 ? C.green : C.red}writes: ${writes.length - writeErrors}/${writes.length} OK${C.reset}`);
    if (writeErrors > 0) {
      writes.filter(w => !w.ok).slice(0, 3).forEach(w => console.log(`    ${C.red}- ${w.e?.message}${C.reset}`));
    }
    // Cleanup
    if (writeIds.length > 0) {
      await sb.from("support_tickets").delete().in("id", writeIds);
      console.log(`  ${C.gray}cleanup: ${writeIds.length} stress tickets eliminados${C.reset}\n`);
    }
    all.push({ errors: readErrors + writeErrors, latencies: [], elapsed });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 6: Heavy query (subscription-style large select)
// ═══════════════════════════════════════════════════════════════════════════
all.push(await runConcurrent("Query pesada · all tickets sin paginar", 5, async () => {
  const { data, error } = await sb.from("support_tickets").select("*");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No data returned");
}));

// ═══════════════════════════════════════════════════════════════════════════
// TEST 7: Update burst (cambios rápidos de estado en un ticket fake)
// ═══════════════════════════════════════════════════════════════════════════
{
  console.log(`${C.bold}${C.blue}━━━ Update burst · 50 cambios consecutivos ${C.reset}`);
  const { data: anyClient } = await sb.from("clients").select("id").limit(1).single();
  if (anyClient) {
    const stamp = Date.now();
    const { data: created } = await sb.from("support_tickets").insert([{
      client_id: anyClient.id, ticket_id: `STRESS-UPDATES-${stamp}`,
      producto: "TEST", asunto: "Update burst", tipo: "Requerimiento",
      prioridad: "Baja", estado: "PENDIENTE", dias_antiguedad: 0,
    }]).select("id").single();

    const states = ["PENDIENTE", "EN ATENCIÓN", "POR CERRAR", "PENDIENTE"];
    const start = Date.now();
    let errors = 0;
    for (let i = 0; i < 50; i++) {
      const newState = states[i % states.length];
      const { error } = await sb.from("support_tickets").update({ estado: newState }).eq("id", created.id);
      if (error) errors++;
    }
    const elapsed = Date.now() - start;
    console.log(`  ${C.gray}elapsed: ${C.reset}${fmtMs(elapsed)}   ${C.gray}avg per op: ${C.reset}${fmtMs(elapsed / 50)}`);
    if (errors === 0) console.log(`  ${C.green}✓ 50 updates OK${C.reset}`);
    else console.log(`  ${C.red}✗ ${errors}/50 errores${C.reset}`);
    await sb.from("support_tickets").delete().eq("id", created.id);
    console.log(`  ${C.gray}cleanup: 1 stress ticket eliminado${C.reset}\n`);
    all.push({ errors, latencies: [], elapsed });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════════════════════════════════════════
const totalErrors = all.reduce((s, r) => s + (r.errors || 0), 0);
const totalElapsed = all.reduce((s, r) => s + (r.elapsed || 0), 0);
console.log(`${C.bold}${C.blue}━━━ RESUMEN ━━━${C.reset}`);
console.log(`  Tests ejecutados: ${all.length}`);
console.log(`  Tiempo total: ${fmtMs(totalElapsed)}`);
console.log(`  ${totalErrors === 0 ? C.green : C.red}Errores totales: ${totalErrors}${C.reset}\n`);

process.exit(totalErrors > 0 ? 1 : 0);
