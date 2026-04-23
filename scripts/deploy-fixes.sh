#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Deploy de los fixes críticos del SVA a Supabase producción.
#
# Despliega:
#   1. Edge functions modificadas (6) + la nueva sva-strategy
#   2. Migración de consolidación RLS
#
# Requiere:
#   - supabase CLI (https://supabase.com/docs/guides/cli)
#   - Autenticación previa: `supabase login`
#   - Link del proyecto: `supabase link --project-ref rpiczncifaoxtdidfiqc`
#
# Uso:
#   ./scripts/deploy-fixes.sh            # deploy todo
#   ./scripts/deploy-fixes.sh functions  # solo edge functions
#   ./scripts/deploy-fixes.sh db         # solo migraciones
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

STAGE="${1:-all}"

# ─── Sanity checks ───
if ! command -v supabase >/dev/null 2>&1; then
  echo "✗ supabase CLI no encontrado."
  echo "  Instala: brew install supabase/tap/supabase"
  echo "  O via bun: bun add -g supabase"
  exit 127
fi

PROJECT_REF="$(cat supabase/config.toml 2>/dev/null | awk -F'"' '/project_id/{print $2}')"
if [ -z "$PROJECT_REF" ]; then
  PROJECT_REF="rpiczncifaoxtdidfiqc"
  echo "! project_id no encontrado en config.toml — usando por defecto: $PROJECT_REF"
fi

echo "━━━ Deploying fixes del SVA ━━━"
echo "  proyecto: $PROJECT_REF"
echo "  stage:    $STAGE"
echo ""

# ─── Edge functions ───
if [ "$STAGE" = "all" ] || [ "$STAGE" = "functions" ]; then
  echo "━━━ Edge functions ━━━"
  FUNCS=(
    evaluate-case-compliance
    policy-ai-assistant
    pm-ai-analysis
    sva-strategy
    classify-tickets
    recommend-team-for-client
    sync-devops
    member-agent-chat
    analyze-cv
    mentor-ai
    analyze-career-path
    analyze-team-activity
    analyze-team-level
    analyze-team-scrum
    forecast-sprint
    member-agent-weekly-digest
    summarize-transcript
    manage-users
    parse-time-entry
    reset-passwords
    decrypt-ticket
    notify-critical-ticket
  )
  for fn in "${FUNCS[@]}"; do
    echo "  · deploying $fn"
    supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt 2>&1 | tail -2
  done
  echo ""
  echo "  ⚠ Configura los secrets en Supabase Dashboard → Edge Functions → Secrets:"
  echo "     ALLOWED_ORIGINS=https://erp.sysde.com,https://staging.sysde.com"
  echo "     LOVABLE_API_KEY=..."
  echo "     AZURE_DEVOPS_PAT=...        (si usan sync-devops)"
  echo "     ENCRYPTION_KEY=...          (≥16 chars, para descifrar tickets confidenciales)"
  echo "     SLACK_WEBHOOK_URL=...       (opcional, alerta tickets críticos)"
  echo "     RESEND_API_KEY=...          (opcional, email tickets críticos)"
  echo "     ONCALL_EMAILS=...           (comma-separated, recipients de email)"
  echo "     ERP_BASE_URL=...            (usado en deep-links de Slack/email)"
fi

# ─── Migraciones ───
if [ "$STAGE" = "all" ] || [ "$STAGE" = "db" ]; then
  echo ""
  echo "━━━ Migraciones DB ━━━"
  echo "  Aplicando pendientes..."
  supabase db push --project-ref "$PROJECT_REF"
fi

echo ""
echo "━━━ ✓ Deploy terminado ━━━"
echo ""
echo "Siguiente paso — smoke test E2E:"
echo "  ADMIN_EMAIL=admin@sysde.com ADMIN_PASSWORD=... bun run scripts/smoke-policies.mjs"
