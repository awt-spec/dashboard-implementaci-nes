---
name: SYSDE Team Engagement (Phase 4)
description: Gamificación (kudos+badges+leaderboard), time-off (calendario+aprobaciones+alertas cobertura), Learning Hub (cursos+inscripciones+tracking horas) + Mentor IA personalizado
type: feature
---
**TeamHub.tsx tabs añadidos**: Reconocimientos, Time-off, Learning (más los previos: Directorio, Skills, Onboarding, Administrar).

**Gamificación** (RecognitionWall.tsx):
- team_kudos: from/to_member_id, category (teamwork/innovation/delivery/mentor/quality), message, emoji, is_public
- team_badges: catálogo seedeado con 6 (velocity_hero, mentor, innovation, quality, teamplayer, cert_master)
- team_member_badges: UNIQUE(member_id, badge_id)
- Leaderboard: kudos + badges*3 puntos, top 8

**Time-off** (TimeOffCalendar.tsx):
- team_time_off: type (vacation/sick/personal/training), start/end_date, status (pending/approved/rejected)
- Vista grid 30 días con heatmap por % team OOO (verde<15%, ámbar<30%, rojo>30% = alerta)
- Aprobación inline desde panel "Pendientes"

**Learning** (LearningHub.tsx):
- learning_courses: title, provider, url, related_skills[], level, duration_hours, cost, category, is_internal
- learning_enrollments: status (enrolled/in_progress/completed/dropped), progress_pct, hours_logged, rating
- Catálogo filtrable + inscripción inline + edición progress/hours
- Mentor IA: chat con contexto del colaborador (skills, gaps, cursos en progreso) que recomienda cursos del catálogo

**Edge function mentor-ai**: Gemini 2.5 Flash; carga contexto desde team_member_skills + team_career_paths + learning_enrollments + catálogo cursos; persiste en mentor_conversations.

**useTeamEngagement.ts**: hooks useKudos/useGiveKudo, useBadges/useMemberBadges/useAwardBadge, useTimeOff/useRequestTimeOff/useUpdateTimeOff, useCourses/useEnrollments/useUpsertCourse/useEnroll/useUpdateEnrollment.
