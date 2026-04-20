---
name: Performance optimizations
description: TanStack Query global cache defaults, useClients filtering, edge function timeouts
type: preference
---
TanStack Query global defaults in `src/App.tsx`: `staleTime: 5min`, `gcTime: 10min`, `refetchOnWindowFocus: false`, `retry: 1`. Applies to ALL hooks automatically — do NOT add per-hook duplicates unless overriding.

`useClients` only fetches clients where `status != 'completado'` and uses explicit column projections (no `select("*")`). Related tables filtered by `.in("client_id", activeIds)` to limit dataset size.

All 14 AI edge functions (analyze-*, classify-tickets, summarize-transcript, parse-time-entry, pm-ai-analysis, mentor-ai, member-agent-*, recommend-team-for-client, forecast-sprint) include `signal: AbortSignal.timeout(30000)` on the Lovable AI Gateway fetch. Prevents indefinite hangs on Gemini slow responses.
