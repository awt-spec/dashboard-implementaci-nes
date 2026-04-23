#!/usr/bin/env node
/**
 * Verifica que cada usuario cliente puede loguearse, tiene assignment,
 * ve su cliente y su data scoped. Detecta exactamente dónde se rompe.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx bun run scripts/verify-cliente-logins.mjs
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

const CREDS = [
  { label: "Apex",                   email: "cliente.apex@sysde.com",      pw: "ClienteApex2026!",                 expectClient: "apex" },
  { label: "Arkfin",                 email: "cliente.arkfin@sysde.com",    pw: "ClienteArkfin2026!",               expectClient: "arkfin" },
  { label: "Aurum",                  email: "cliente.aurum@sysde.com",     pw: "ClienteAurum2026!",                expectClient: "aurum" },
  { label: "CFE Panamá",             email: "cliente.cfe@sysde.com",       pw: "ClienteCfePanam2026!",             expectClient: "cfe" },
  { label: "CMI",                    email: "cliente.cmi@sysde.com",       pw: "ClienteCmi2026!",                  expectClient: "cmi" },
  { label: "Coopecar",               email: "cliente.coopecar@sysde.com",  pw: "ClienteCoopecar2026!",             expectClient: "coopecar" },
  { label: "Credicefi",              email: "cliente.credicefi@sysde.com", pw: "ClienteCredicefi2026!",            expectClient: "credicefi" },
  { label: "FIACG",                  email: "cliente.fiacg@sysde.com",     pw: "ClienteFiacg2026!",                expectClient: "fiacg" },
  { label: "Fundap",                 email: "cliente.fundap@sysde.com",    pw: "ClienteFundap2026!",               expectClient: "fundap" },
  { label: "Quiero Confianza (ION)", email: "cliente.ion@sysde.com",       pw: "ClienteQuieroConfianzaIon2026!",   expectClient: "ion" },
  { label: "SAF UPV",                email: "cliente.safupv@sysde.com",    pw: "ClienteSafUpv2026!",               expectClient: "saf-upv" },
];

const sbAdmin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const results = [];

for (const c of CREDS) {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const row = { label: c.label, email: c.email, issues: [] };

  // 1. Login
  const { data: session, error: loginErr } = await sb.auth.signInWithPassword({
    email: c.email,
    password: c.pw,
  });
  if (loginErr) { row.issues.push(`LOGIN FAIL: ${loginErr.message}`); results.push(row); continue; }
  const uid = session.user.id;

  // 2. Role check: debe tener SOLO cliente
  const { data: roles } = await sbAdmin.from("user_roles").select("role").eq("user_id", uid);
  const roleList = (roles ?? []).map(r => r.role).sort().join(",");
  if (roleList !== "cliente") row.issues.push(`ROLES: [${roleList}] — debería ser solo "cliente"`);

  // 3. Assignment: el user puede verse a sí mismo
  const { data: ownAssign } = await sb.from("cliente_company_assignments")
    .select("client_id, permission_level").eq("user_id", uid).maybeSingle();
  if (!ownAssign) { row.issues.push("NO VE SU ASSIGNMENT (RLS problem)"); }
  else if (ownAssign.client_id !== c.expectClient) {
    row.issues.push(`ASSIGN CLIENT_ID mismatch: ${ownAssign.client_id} vs expected ${c.expectClient}`);
  }

  // 4. Ver su cliente en clients
  const { data: clientRow } = await sb.from("clients").select("id, name").eq("id", c.expectClient).maybeSingle();
  if (!clientRow) row.issues.push(`NO VE SU CLIENT ROW (RLS sobre clients)`);

  // 5. Ver tickets: sólo los suyos
  const { data: tickets } = await sb.from("support_tickets").select("id, client_id").limit(100);
  const leaky = (tickets ?? []).filter(t => t.client_id !== c.expectClient);
  if (leaky.length > 0) row.issues.push(`RLS LEAK tickets: ve ${leaky.length} de otros clientes`);

  // 6. Ver shared_support_presentations: sólo las suyas
  const { data: minutas } = await sb.from("shared_support_presentations")
    .select("id, client_id").limit(100);
  const leakyMin = (minutas ?? []).filter(m => m.client_id !== c.expectClient);
  if (leakyMin.length > 0) row.issues.push(`RLS LEAK minutas: ve ${leakyMin.length} de otros clientes`);

  row.ticketCount = (tickets ?? []).length;
  row.minutaCount = (minutas ?? []).length;
  row.permission = ownAssign?.permission_level ?? null;

  await sb.auth.signOut();
  results.push(row);
}

// ── Output ──
console.log("\n━━━ LOGIN + RLS POR CLIENTE ━━━\n");
for (const r of results) {
  const status = r.issues.length === 0 ? "✓" : "✗";
  console.log(`${status} ${r.label.padEnd(24)} | ${r.email.padEnd(40)} | perm=${r.permission ?? "?"} | tickets=${r.ticketCount ?? 0} | minutas=${r.minutaCount ?? 0}`);
  for (const iss of r.issues) console.log(`    ⚠ ${iss}`);
}

const pass = results.filter(r => r.issues.length === 0).length;
console.log(`\n${pass}/${results.length} OK`);
