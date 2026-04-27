#!/usr/bin/env node
/**
 * One-shot: crea el usuario demo CEO (ceo@sysde.com) con rol "ceo".
 *
 * El rol "ceo" debe existir en el enum app_role (migración 20260427130000).
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx bun run scripts/seed-ceo-user.mjs
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

const sbAdmin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const CEO_EMAIL = "ceo@sysde.com";
const CEO_PASSWORD = "CeoSysde2026!";
const CEO_FULL_NAME = "Director Ejecutivo (Demo)";

// ── 1) Buscar si ya existe el usuario por email ────────────────────
console.log(`→ Buscando usuario ${CEO_EMAIL}...`);
const { data: existing } = await sbAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
let user = existing?.users?.find((u) => u.email === CEO_EMAIL);

if (user) {
  console.log(`  ✓ Usuario existe: ${user.id}`);
  // Reset de password por si cambió
  await sbAdmin.auth.admin.updateUserById(user.id, { password: CEO_PASSWORD });
  console.log(`  ✓ Password actualizada`);
} else {
  console.log(`  → Creando usuario nuevo...`);
  const { data: created, error: createErr } = await sbAdmin.auth.admin.createUser({
    email: CEO_EMAIL,
    password: CEO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: CEO_FULL_NAME,
      role: "ceo",
    },
  });
  if (createErr) {
    console.error(`  ✗ Error creando user:`, createErr.message);
    process.exit(1);
  }
  user = created.user;
  console.log(`  ✓ Usuario creado: ${user.id}`);
}

// ── 2) Asegurar profile ────────────────────────────────────────────
const { error: profErr } = await sbAdmin
  .from("profiles")
  .upsert({
    user_id: user.id,
    full_name: CEO_FULL_NAME,
    email: CEO_EMAIL,
  });
if (profErr) {
  console.error(`  ✗ Error en profile:`, profErr.message);
} else {
  console.log(`  ✓ Profile upsert ok`);
}

// ── 3) Quitar otros roles (CEO debe ser solo CEO para que prioridad funcione bien) ──
const { error: delErr } = await sbAdmin
  .from("user_roles")
  .delete()
  .eq("user_id", user.id);
if (delErr) {
  console.error(`  ✗ Error limpiando roles:`, delErr.message);
}

// ── 4) Insertar rol CEO ───────────────────────────────────────────
const { error: roleErr } = await sbAdmin
  .from("user_roles")
  .insert({ user_id: user.id, role: "ceo" });
if (roleErr) {
  console.error(`  ✗ Error insertando rol ceo:`, roleErr.message);
  console.error(`     Verifica que la migración 20260427130000_add_ceo_role.sql ya esté aplicada.`);
  process.exit(1);
}
console.log(`  ✓ Rol "ceo" asignado`);

console.log(`\n══════════════════════════════════════════════════════════`);
console.log(` ✓ Usuario demo CEO listo`);
console.log(`══════════════════════════════════════════════════════════`);
console.log(` Email:    ${CEO_EMAIL}`);
console.log(` Password: ${CEO_PASSWORD}`);
console.log(` Rol:      ceo`);
console.log(` URL:      https://sva-erp-deploy.vercel.app/login`);
console.log(`══════════════════════════════════════════════════════════\n`);
