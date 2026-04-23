# Scripts operativos del SVA

Playbook para desplegar y validar los fixes aplicados al ERP.

## Orden sugerido

```
  1. Instalar supabase CLI + link
  2. ./scripts/deploy-fixes.sh       # deploy funciones + migraciones
  3. bun run scripts/smoke-policies.mjs   # validar E2E
```

---

## 1. Instalar y conectar el CLI

```bash
# macOS
brew install supabase/tap/supabase

# autenticar (abre navegador)
supabase login

# vincular el proyecto
supabase link --project-ref rpiczncifaoxtdidfiqc
```

Confirmar:

```bash
supabase projects list
```

---

## 2. Deploy — `deploy-fixes.sh`

```bash
./scripts/deploy-fixes.sh         # deploy funciones + migraciones
./scripts/deploy-fixes.sh functions   # solo edge functions
./scripts/deploy-fixes.sh db          # solo migraciones
```

El script despliega:

- **20 edge functions** (corregidas con los helpers `_shared/cors`, `_shared/auth`, `_shared/ticketStatus`)
- **Migración `20260422120000_rls_consolidation.sql`** (cierra policies `USING (true)` que quedaban abiertas)

Después del deploy hay que configurar los secrets en Supabase Dashboard → Edge Functions:

```
ALLOWED_ORIGINS  = https://erp.sysde.com,https://staging.sysde.com
LOVABLE_API_KEY  = (el que ya tienen)
AZURE_DEVOPS_PAT = (si usan sync-devops)
```

> **Sobre `ALLOWED_ORIGINS`**: si no lo configuras, las funciones solo aceptarán origen `localhost` (modo dev). En producción es obligatorio listar los dominios reales del ERP.

---

## 3. Smoke test E2E — `smoke-policies.mjs`

Valida la cadena completa de políticas contra la DB de producción con un usuario admin.

```bash
ADMIN_EMAIL=admin@sysde.com \
ADMIN_PASSWORD=... \
bun run scripts/smoke-policies.mjs
```

Los chequeos:

1. **Login** con rol `admin`
2. **Lectura** de `business_rules` (que antes estaban bloqueadas para anon)
3. **CRUD** completo sobre una regla temporal: create → update toggle → delete
4. **Override** por cliente: crea + borra uno contra un cliente de soporte real
5. **Evaluator**: invoca `evaluate-case-compliance` contra un ticket abierto, verifica que `applicable_deadline_days` se setea (no cae al fallback de 5d)
6. **Persistencia**: confirma que la evaluación quedó registrada en `case_compliance`
7. **Filtro de cerrados**: confirma que `CERRADA / ANULADA / FINALIZADO` quedan fuera del conteo de abiertos
8. **Cleanup**: borra todo lo creado en el test

### Output esperado

```
✓ Login como admin (340ms)
  · user_id=abc12345… role=admin
✓ Lectura de business_rules (120ms)
  · 6 reglas · activas: 5
  · por tipo: sla=1, checklist=1, signature=1, metric=1, weekly=1, notice=1
✓ Crear business_rule de prueba (180ms)
✓ Toggle is_active → false → true (220ms)
✓ Buscar cliente soporte para override (90ms)
✓ Crear client_rule_override (150ms)
✓ Localizar un ticket abierto para evaluar (80ms)
✓ Invocar evaluate-case-compliance (1200ms)
  · semáforo=red · deadline=1d · restantes=-3 · risk=critical
✓ Verificar persistencia en case_compliance (70ms)
✓ Sanity check: tickets abiertos cuentan sin incluir CERRADA/ANULADA (100ms)

· cleanup ·
✓ override eliminado
✓ rule eliminada

Resumen: 10 ok · 0 fail · 0 skip · 3200ms
```

Si algo falla, el script sale con código `1` y el paso con `fail`.

---

## Qué hace cada fix desplegado

| Fix | Qué arregla | Archivo |
|---|---|---|
| **#1** | Edge fns leían `ticket.case_type` que NO existe | `evaluate-case-compliance`, `policy-ai-assistant` |
| **#2** | Código filtraba `estado !== "FINALIZADO"` pero el valor real es `CERRADA` | `pm-ai-analysis`, `sva-strategy`, `ClientDashboard`, etc. |
| **#3** | `"Critica, Impacto Negocio"` no matcheaba ninguna regla SLA | `_shared/ticketStatus.ts` (normalización) |
| **#4** | `evaluate-case-compliance` leía `ticket.priority` pero la columna es `prioridad` | `evaluate-case-compliance` |
| **RLS** | Tablas `client_financials`, `phases`, `deliverables`, `action_items`, etc. tenían `USING (true)` abierto a anon | `20260422120000_rls_consolidation.sql` |
| **CORS** | 20 edge fns tenían CORS `*` hardcodeado | `_shared/cors.ts` con `ALLOWED_ORIGINS` |
| **Auth** | 7 edge fns críticas (classify-tickets, sync-devops, etc.) sin JWT | `_shared/auth.ts` (`requireAuth`, `requireRole`) |
| **Passwords** | `reset-passwords` tenía 5 credenciales hardcodeadas | neutralizada (410 Gone) |

---

## Troubleshooting

### `Invalid JWT` al correr smoke-policies

- El admin no existe o la contraseña es incorrecta.
- Verificar en Supabase Dashboard → Authentication → Users.

### `permission denied for table business_rules`

- El usuario no tiene rol `admin` en `user_roles`.
- Insertar manualmente:
  ```sql
  INSERT INTO user_roles (user_id, role) VALUES ('<uuid>', 'admin');
  ```

### `DeploymentError: Function not found`

- Primera vez deployando la función. El script usa `--no-verify-jwt` para poder deployar funciones nuevas; después cada función valida internamente con `requireAuth`.

### `ALLOWED_ORIGINS no configurado` → CORS rechaza desde prod

- Configurar en Supabase Dashboard → Edge Functions → Secrets.
- Después del cambio, las nuevas requests ya toman la env var (no hace falta re-deploy).
