

The user wants a detailed architecture and application structure document. This is a documentation/artifact task, not a code change. I'll generate a comprehensive Mermaid diagram + a detailed Markdown document covering:

1. **High-level architecture** (frontend, Lovable Cloud/Supabase, edge functions, AI Gateway)
2. **RBAC & roles** (admin, pm, gerente, colaborador)
3. **Module map** (Implementación, Soporte, Equipo Scrum, Team Hub, Time Tracking, AI Agents)
4. **Data model** (key tables grouped by domain)
5. **Edge functions catalog** (15+ functions with purpose)
6. **AI integration** (Lovable AI Gateway, models in use, agents)
7. **Routing & pages**
8. **Key flows** (auth, sprint lifecycle, AI agent chat, time tracking)

## Plan: documentación completa de arquitectura

Voy a generar **dos artefactos descargables** en `/mnt/documents/`:

### 1. Diagrama Mermaid (`Sysde_Architecture.mmd`)
Diagrama de capas mostrando:
- **Cliente** (React 18 + Vite + Tailwind + shadcn) con sus rutas y dashboards por rol
- **Lovable Cloud** (Supabase: Auth + Postgres + Storage + Realtime + Edge Functions)
- **AI Gateway** (Gemini 2.5/3 + GPT-5/5.2) consumido por edge functions
- Flujo de datos entre componentes y hooks → Supabase client → DB/Functions

### 2. Documento Markdown (`Sysde_Architecture.md`) — ~8 secciones:

**A. Stack tecnológico**
- Frontend: React 18, Vite 5, TS 5, Tailwind v3, shadcn/ui, TanStack Query, React Router, Recharts, framer-motion, react-markdown+remark-gfm
- Backend: Lovable Cloud (Supabase Postgres + Auth + Storage + Edge Functions Deno)
- IA: Lovable AI Gateway

**B. RBAC y roles** (4 roles, qué ve cada uno, tabla `user_roles` + `has_role()` SECURITY DEFINER)

**C. Mapa de módulos**
- Implementación (clientes, minutas, deliverables, presentaciones)
- Soporte (tickets, SLAs, DevOps sync)
- Equipo Scrum unificado (sprints, WSJF backlog, Active Sprint Hub, Kanban, ceremonias)
- Team Hub (directorio, skills matrix, onboarding, career path, recommender)
- Time Tracking (timer, timesheet, aprobaciones, audit)
- AI Agents (agente personal por colaborador, weekly digest)
- Engagement (kudos, badges, time-off, learning hub, mentor IA)
- Admin (usuarios, RBAC, auditoría, Nivel IA del equipo)

**D. Modelo de datos** (tablas agrupadas por dominio con propósito breve)

**E. Edge functions** (catálogo de las ~17 funciones con input/output y modelo IA)

**F. Páginas y rutas** (App.tsx routing + dashboards condicionados por rol)

**G. Flujos clave** (auth+session, sprint lifecycle, agent chat con contexto, time entry desde timer)

**H. Convenciones** (Supabase SSOT, `.maybeSingle()`, `null` not `undefined`, "Progreso", terminología comercial, slide editing bloqueado, etc.)

### Tareas
1. Leer rápido `App.tsx`, `AppSidebar.tsx`, `AdminUsers.tsx`, lista de edge functions y schema clave para confirmar nombres exactos
2. Generar `.mmd` y `.md` en `/mnt/documents/`
3. QA visual del Mermaid (renderizar a PNG y revisar)
4. Emitir tags `<lov-artifact>` para descarga

No hay cambios de código ni DB.

