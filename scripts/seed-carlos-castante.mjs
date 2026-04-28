#!/usr/bin/env node
/**
 * One-shot: crea el usuario Carlos Castante con rol gerente_soporte.
 *
 * El rol "gerente_soporte" debe existir en el enum app_role
 * (migración 20260428100000).
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx bun run scripts/seed-carlos-castante.mjs
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

const EMAIL    = "carlos.castante@sysde.com";
const PASSWORD = "CarlosCastante2026!";
const FULLNAME = "Carlos Castante";

console.log(`→ Buscando usuario ${EMAIL}...`);
const { data: existing } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
let user = existing?.users?.find((u) => u.email === EMAIL);

if (user) {
  console.log(`  ✓ Usuario existe: ${user.id}`);
  await sb.auth.admin.updateUserById(user.id, { password: PASSWORD });
  console.log(`  ✓ Password actualizada`);
} else {
  console.log(`  → Creando usuario nuevo...`);
  const { data: created, error } = await sb.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULLNAME, role: "gerente_soporte" },
  });
  if (error) {
    console.error(`  ✗ Error creando user:`, error.message);
    process.exit(1);
  }
  user = created.user;
  console.log(`  ✓ Usuario creado: ${user.id}`);
}

// Profile
const { error: profErr } = await sb
  .from("profiles")
  .upsert({ user_id: user.id, full_name: FULLNAME, email: EMAIL });
if (profErr) console.error(`  ⚠ Profile:`, profErr.message);
else console.log(`  ✓ Profile upsert ok`);

// Limpiar otros roles (para que prioridad del useAuth funcione bien)
await sb.from("user_roles").delete().eq("user_id", user.id);

// Asignar rol gerente_soporte
const { error: roleErr } = await sb
  .from("user_roles")
  .insert({ user_id: user.id, role: "gerente_soporte" });
if (roleErr) {
  console.error(`  ✗ Error rol:`, roleErr.message);
  console.error(`     Verifica que la migración 20260428100000_add_gerente_soporte_role.sql esté aplicada.`);
  process.exit(1);
}
console.log(`  ✓ Rol "gerente_soporte" asignado`);

console.log(`\n══════════════════════════════════════════════════════════`);
console.log(` ✓ Usuario Carlos Castante listo`);
console.log(`══════════════════════════════════════════════════════════`);
console.log(` Email:    ${EMAIL}`);
console.log(` Password: ${PASSWORD}`);
console.log(` Rol:      gerente_soporte`);
console.log(` Acceso:   Resumen + Soporte (todos los clientes) + Config`);
console.log(`══════════════════════════════════════════════════════════\n`);
