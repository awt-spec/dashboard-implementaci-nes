#!/usr/bin/env node
/**
 * One-shot: crea un usuario con rol "cliente" por cada cliente activo (soporte
 * e implementación) y emite el bloque TS actualizado para pegar en Login.tsx.
 *
 * Convención:
 *   • email:    cliente.{slug}@sysde.com      (reutiliza pattern existente)
 *   • password: Cliente{Slug}2026!
 *   • role:     cliente
 *   • permiso:  admin  (el primer usuario del cliente puede invitar más)
 *   • assign:   cliente_company_assignments ↔ client_id
 *
 * Si el user ya existe (caso típico: cliente.coopecar@sysde.com antes era
 * gerente), create_cliente en la edge function lo promueve a cliente-only.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx bun run scripts/seed-cliente-users.mjs
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
  console.error("Falta SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY");
  process.exit(2);
}

const sbAdmin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const sbClient = createClient(URL, ANON, { auth: { persistSession: false } });

// ── Helpers ────────────────────────────────────────────────────────

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30);
}

function pascal(s) {
  return s
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

// Bootstrap admin para invocar manage-users con JWT (la edge fn requiere auth)
const stamp = Date.now().toString(36);
const BOOT_EMAIL = `seed-admin-${stamp}@sysde.test`;
const BOOT_PASS  = `SeedPass${stamp}!`;

async function bootstrapAdmin() {
  const { data: u, error } = await sbAdmin.auth.admin.createUser({
    email: BOOT_EMAIL,
    password: BOOT_PASS,
    email_confirm: true,
    user_metadata: { full_name: "Seed Admin", role: "admin" },
  });
  if (error) throw error;
  // El trigger handle_new_user ya insertó role=admin via metadata
  const { data: session, error: sErr } = await sbClient.auth.signInWithPassword({
    email: BOOT_EMAIL,
    password: BOOT_PASS,
  });
  if (sErr) throw sErr;
  return { userId: u.user.id, jwt: session.session.access_token };
}

async function cleanupBootstrap(userId) {
  try {
    await sbAdmin.from("user_roles").delete().eq("user_id", userId);
    await sbAdmin.auth.admin.deleteUser(userId);
  } catch {}
}

async function invokeAsAdmin(jwt, body) {
  const res = await fetch(`${URL}/functions/v1/manage-users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// ── Main ────────────────────────────────────────────────────────

(async () => {
  console.log("▶ Fetching clients…");
  const { data: clients, error } = await sbAdmin
    .from("clients")
    .select("id, name, client_type, status")
    .order("name");
  if (error) { console.error(error); process.exit(1); }

  const active = clients.filter((c) => c.status === "activo" || c.status === "en-riesgo");
  const soporte = active.filter((c) => c.client_type === "soporte");
  const impl = active.filter((c) => c.client_type === "implementacion" || c.client_type === "implementación");

  console.log(`  ${soporte.length} clientes soporte · ${impl.length} clientes implementación`);

  console.log("▶ Bootstrapping admin de seed…");
  const boot = await bootstrapAdmin();

  const results = { impl: [], support: [], errors: [] };

  const processClient = async (c, bucket) => {
    const slug = slugify(c.id || c.name);
    const pascalName = pascal(c.name);
    const email = `cliente.${slug}@sysde.com`;
    const password = `Cliente${pascalName}2026!`;

    try {
      await invokeAsAdmin(boot.jwt, {
        action: "create_cliente",
        email,
        password,
        full_name: `Portal ${c.name}`,
        client_id: c.id,
        permission_level: "admin",
      });
      bucket.push({ label: c.name, email, pw: password });
      process.stdout.write(`  ✓ ${c.name.padEnd(28)} → ${email}\n`);
    } catch (err) {
      results.errors.push({ client: c.name, error: err.message });
      process.stdout.write(`  ✗ ${c.name.padEnd(28)} → ${err.message}\n`);
    }
  };

  console.log(`\n▶ Creating cliente users (soporte)…`);
  for (const c of soporte) await processClient(c, results.support);

  console.log(`\n▶ Creating cliente users (implementación)…`);
  for (const c of impl) await processClient(c, results.impl);

  await cleanupBootstrap(boot.userId);

  // ── Output formateado para Login.tsx ─────────────────────────
  const asTs = (arr) => arr
    .map((a) => `  { label: "${a.label.replace(/"/g, '\\"')}", email: "${a.email}", pw: "${a.pw}" },`)
    .join("\n");

  console.log("\n\n━━━ Pegar en Login.tsx (reemplaza IMPLEMENTATION_CLIENTS y SUPPORT_CLIENTS) ━━━\n");

  console.log("const IMPLEMENTATION_CLIENTS: DemoAccount[] = [");
  console.log(asTs(results.impl));
  console.log("];\n");

  console.log("const SUPPORT_CLIENTS: DemoAccount[] = [");
  console.log(asTs(results.support));
  console.log("];\n");

  if (results.errors.length) {
    console.log(`\n⚠ ${results.errors.length} errores:`);
    results.errors.forEach((e) => console.log(`  - ${e.client}: ${e.error}`));
  }

  console.log(`\n━━━ Total: ${results.support.length + results.impl.length} usuarios creados ━━━`);
})().catch((e) => { console.error(e); process.exit(1); });
