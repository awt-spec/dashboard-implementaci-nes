# SVA ERP

Plataforma interna de **SYSDE Internacional** para gestión unificada de soporte
de clientes (tickets/SLA/reincidencias), implementación de proyectos
(sprints/scrum/time tracking) y gestión ejecutiva (dashboards CEO/PM, IA
assistants, reportes compartidos).

> **Estado:** producción. Backend en `qorixnxlaiuyxoentrfa.supabase.co`,
> frontend en Vercel. ~30 clientes activos, ~150 tickets soporte vivos +
> 2099 tasks de implementación, 30+ usuarios.
>
> **Documentación técnica completa:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)
> (1500 líneas — onboarding maestro: stack, RLS, edge functions, hooks,
> flujos críticos, seguridad, devops).
>
> **Levantamiento histórico:** [`docs/PLAN-LEVANTAMIENTO-2026-04-30.md`](./docs/PLAN-LEVANTAMIENTO-2026-04-30.md)
> (snapshot del 2026-04-30, no se actualiza).

---

## Stack

- **Frontend:** React 18 + Vite 5 + TypeScript 5 + Tailwind 3 + shadcn-ui (49 componentes UI sobre Radix)
- **State server:** TanStack Query 5 (`staleTime: 5min`)
- **Backend:** Supabase (PostgreSQL 15 + Auth + Storage + 27 Edge Functions Deno)
- **Auth:** GoTrue, JWT, 7 roles con jerarquía (`ceo > admin > pm > gerente_soporte > gerente > colaborador > cliente`)
- **IA:** Google Gemini 2.5 Flash Lite (vía endpoint OpenAI-compat)
- **Deploy:** Vercel (frontend) + Supabase Cloud (backend)
- **Package manager:** Bun (no npm — Vercel requiere `bun install --linker=hoisted`)

---

## Setup local

### Prerequisitos

- **Bun** ≥ 1.0 (`curl -fsSL https://bun.sh/install | bash`)
- **Git** ≥ 2.30
- (Opcional, para edge functions y migraciones) **Supabase CLI**:
  `brew install supabase/tap/supabase`

### Pasos

```bash
# 1. Clonar
git clone https://github.com/awt-spec/dashboard-implementaci-nes.git sva-erp-deploy
cd sva-erp-deploy

# 2. Instalar dependencias
#    IMPORTANTE: usar bun + --linker=hoisted (espejo de Vercel)
bun install --linker=hoisted

# 3. (Opcional) Si vas a correr scripts contra producción:
echo 'SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."' >> .env
# (las keys públicas anon ya vienen versionadas en .env)

# 4. Verificar que TS compila
node ./node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit

# 5. Correr tests
bun run test         # vitest run (35 tests)

# 6. Servidor dev
bun run dev          # http://localhost:8080
```

### Cuentas de prueba

Las credenciales **no viven en el repositorio**. Están en el gestor de secretos
del equipo; pedilas a un administrador.

Los correos siguen el patrón `<rol>@sysde.com` para staff y
`cliente.<client_id>@sysde.com` para los portales de cliente. Los roles
disponibles son `ceo`, `admin`, `pm`, `gerente_soporte`, `colaborador` y
`cliente`; la lista viva está en `src/pages/Login.tsx`.

Para recrear un usuario de prueba, los seeds toman la contraseña del entorno:

```bash
CEO_PASSWORD='...'      node scripts/seed-ceo-user.mjs
SEED_PASSWORD='...'     node scripts/seed-carlos-castante.mjs
node scripts/seed-cliente-users.mjs      # genera una aleatoria por cliente
```

> Ninguno de los scripts trae un valor por defecto, y es a propósito: una
> contraseña por defecto en el código es una contraseña publicada.
