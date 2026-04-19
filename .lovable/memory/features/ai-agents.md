---
name: AI Agents per member
description: Personal AI agent per collaborator, role-based templates, weekly digest, FAB and tab in profile
type: feature
---
Each member has a personal AI agent specialized by role.

Tables:
- `member_ai_agents` (1 per member): role_template, custom_instructions, tone, enabled, preferred_model
- `member_ai_conversations`: messages JSONB, context_snapshot
- `member_ai_digests`: weekly summary + suggestions, UNIQUE(member_id, week_start)

Edge functions:
- `member-agent-chat`: builds system prompt from role template + tone + custom + context (skills, goal, optional task/ticket). Persists conversation. Logs to ai_usage_logs. Handles 429/402.
- `member-agent-weekly-digest`: computes week metrics, asks Gemini for JSON {summary, suggestions[]}, upserts into member_ai_digests.

Role templates: developer, qa, pm, consultant (SAP/IFS), support, designer, default. Auto-detected from `sysde_team_members.role` if config = "auto".

UI:
- `MemberAIAgentPanel.tsx` — sidebar history + chat + quick prompts (common + role-specific)
- `AgentConfigDialog.tsx` — edit template/tone/model/instructions/enabled
- `WeeklyDigestCard.tsx` — shown in MyProductivityDashboard
- `FloatingAgentButton.tsx` — FAB in ColaboradorDashboard, opens panel in Sheet
- New tab "Mi Agente IA" in MemberProfile (only for owner)

Hook: `useMyTeamMember` resolves the member record from auth profile email.

RLS: owner + admin/pm can read; admin can delete. Uses `LOVABLE_API_KEY` (no new secrets).
