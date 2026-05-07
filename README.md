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

Listadas en `src/pages/Login.tsx`. Para tocar todos los rol-paths:

| Email | Password | Rol |
|---|---|---|
| `ceo@sysde.com` | `CeoSysde2026!` | ceo |
| `admin@sysde.com` | `AdminSysde2026!` | admin |
| `pm@sysde.com` | `PmFernando2026!` | pm |
| `carlos.castante@sysde.com` | `CarlosCastante2026!` | gerente_soporte |
| `lalfaro-contratista@sysde.com` | `Sysde2026!` | colaborador (Dos Pinos, 56 tasks) |
| `cliente.apex@sysde.com` | `ClienteApex2026!` | cliente (Apex) |

---

## Comandos disponibles

```bash
bun run dev           # Vite dev server (puerto 8080, HMR)
bun run build         # Build de producción → dist/
bun run build:dev     # Build dev mode (sourcemaps)
bun run lint          # ESLint
bun run preview       # Sirve dist/ localmente
bun run test          # Vitest run (CI)
bun run test:watch    # Vitest watch
```

---

## Estructura

```
sva-erp-deploy/
├── src/
│   ├── App.tsx                 # Router + providers + lazy routes
│   ├── pages/                  # 12 pages (Index = hub principal)
│   ├── components/             # 200+ componentes organizados por dominio
│   │   ├── ui/                 # shadcn-ui (49)
│   │   ├── support/            # Tickets (41)
│   │   ├── scrum/              # Sprints + backlog (17)
│   │   ├── clients/            # Implementación + minutas (21)
│   │   └── ...
│   ├── hooks/                  # 38 hooks (useAuth, useSupportTickets, ...)
│   ├── integrations/supabase/  # client + types generados
│   └── lib/                    # utils, exporters, status helpers
├── supabase/
│   ├── migrations/             # 98 migraciones SQL
│   └── functions/              # 27 edge functions Deno + _shared/
├── scripts/                    # Imports, smoke tests, QA, stress test
├── ARCHITECTURE.md             # Doc técnica maestra (este archivo es el TL;DR)
└── docs/                       # Plans históricos
```

---

## Operaciones

### Deploy

**Frontend** (auto): cualquier push a `main` dispara build en Vercel.

**Backend** (manual):

```bash
./scripts/deploy-fixes.sh            # edge fns + migraciones
./scripts/deploy-fixes.sh functions  # solo edge fns
./scripts/deploy-fixes.sh db         # solo migraciones
```

### Health check

```bash
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx bun run scripts/qa-database.mjs
# Esperado: score ≥ 92/100
```

### Stress test

```bash
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx bun run scripts/stress-test.mjs
# 7 tests: reads concurrentes, race conditions, p50/p95/p99
```

### Smoke E2E

```bash
ADMIN_EMAIL=admin@sysde.com ADMIN_PASSWORD=... \
  bun run scripts/smoke-policies.mjs
```

Ver `scripts/README.md` para el catálogo completo.

---

## Troubleshooting

| Síntoma | Solución |
|---|---|
| `Cannot find package vite/node_modules/esbuild/index.js` | `bun install --linker=hoisted` |
| `Invalid JWT` en smoke tests | Usuario no existe / password mal — Supabase Dashboard → Authentication → Users |
| `permission denied for table X` | Usuario no tiene rol — `INSERT INTO user_roles (user_id, role) VALUES (...)` con admin |
| Build local OK pero Vercel falla | Replicar entorno: `bun install --linker=hoisted && bun run build` |
| `ALLOWED_ORIGINS no configurado` (CORS rechaza prod) | Set en Supabase Dashboard → Edge Functions → Secrets |
| Migración rechazada con "column already exists" | Las migraciones son idempotentes — verificar `IF NOT EXISTS` / `OR REPLACE` |

---

## Variables de entorno

### `.env` (frontend, versionado — **anon keys son públicas**)

```
VITE_SUPABASE_URL="https://qorixnxlaiuyxoentrfa.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."   # rol "anon", protegido por RLS
SUPABASE_URL="https://qorixnxlaiuyxoentrfa.supabase.co"
SUPABASE_PUBLISHABLE_KEY="eyJ..."        # duplicado para scripts
VITE_SUPABASE_PROJECT_ID="qorixnxlaiuyxoentrfa"
```

### Edge Functions (Supabase Dashboard → Project Settings → Edge Functions → Secrets)

```
ALLOWED_ORIGINS         = https://erp.sysde.com,...
GEMINI_API_KEY          = AIza...                  # IA principal
RESEND_API_KEY          = re_...                   # email transaccional
SLACK_WEBHOOK_URL       = https://hooks.slack.com/...
ONCALL_EMAILS           = email1@sysde.com,...
AZURE_DEVOPS_PAT        = (opcional)
ENCRYPTION_KEY          = (opcional, para pgcrypto en tickets confidenciales)
```

`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` y `SUPABASE_URL` los inyecta
Supabase automáticamente.

---

## Contribuir

1. Crear branch desde `main`: `git checkout -b feat/mi-feature`
2. Verificar antes de commitear:
   ```bash
   node ./node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit
   bun run test
   ```
3. Commit con mensaje descriptivo (preferimos español + body explicativo)
4. PR contra `main`. Auto-deploy a Vercel cuando se mergea.

**No hay pre-commit hooks** — disciplina manual.

**No hay GitHub Actions** — verificar localmente antes de empujar.

---

## Repo

- **GitHub:** https://github.com/awt-spec/dashboard-implementaci-nes
- **Branch productiva:** `main`
- **Deploy:** Vercel (auto desde `main`)
- **Backend prod:** Supabase project `qorixnxlaiuyxoentrfa`

---

*Para el deep dive técnico (arquitectura completa, RLS, flujos, deuda
técnica, decisiones), leer [`ARCHITECTURE.md`](./ARCHITECTURE.md).*
