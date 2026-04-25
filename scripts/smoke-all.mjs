#!/usr/bin/env node
/**
 * Runner que ejecuta TODOS los smoke tests en secuencia y resume.
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx bun run scripts/smoke-all.mjs
 */

import { spawnSync } from "node:child_process";

const SUITES = [
  { name: "CRUD full (clients/tickets/cliente users/minutas/feedback)", file: "scripts/smoke-crud-full.mjs" },
  { name: "Cliente logins + RLS aislada por cliente",                   file: "scripts/verify-cliente-logins.mjs" },
  { name: "Saved views CRUD (insights/operacion/scrum)",                file: "scripts/smoke-saved-views.mjs" },
  { name: "AI functions (case/client-strategy + classify)",             file: "scripts/smoke-ai-functions.mjs" },
];

const results = [];
const t0 = Date.now();

for (const s of SUITES) {
  console.log(`\n\x1b[1;36m━━━ ${s.name} ━━━\x1b[0m`);
  const start = Date.now();
  const res = spawnSync("bun", ["run", s.file], {
    stdio: "inherit",
    env: { ...process.env, PATH: process.env.PATH },
  });
  const ms = Date.now() - start;
  results.push({ name: s.name, ok: res.status === 0, ms });
}

const totalMs = Date.now() - t0;
console.log("\n\x1b[1m━━━━━━━━━━━━━━━━━━━━━━━ RESUMEN ━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
results.forEach((r) => {
  const icon = r.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  console.log(`  ${icon} ${r.name.padEnd(58)} ${(r.ms / 1000).toFixed(1)}s`);
});
const passed = results.filter((r) => r.ok).length;
const total = results.length;
console.log(`\n  ${passed}/${total} suites OK · ${(totalMs / 1000).toFixed(1)}s totales`);
if (passed < total) process.exit(1);
