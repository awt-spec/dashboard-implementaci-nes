
The user wants to improve the SYSDE collaborators section. Phases 1-4 are done. Let me check what currently exists and identify gaps to propose meaningful improvements.

Key existing pieces:
- `MemberProfile.tsx` (/team/:memberId) — 360° profile with overview, performance, career, capacity
- `TeamHub.tsx` — Directory, Skill Matrix, Onboarding, Recognition, Time-off, Learning
- `TeamDirectoryCards.tsx` — visual cards
- `SysdeTeamManager.tsx` — admin CRUD

Likely improvement areas (without re-asking too much):
- Profile page can feel scattered, lacking visual identity (cover, avatar upload, bio, social links)
- No comparison view between collaborators
- No "my profile" quick access for the logged-in user
- Directory cards lack workload/availability indicators (we have capacity data!)
- No quick actions from directory (kudos, message, assign)
- Missing collaborator analytics overview (team-wide health, top performers, at-risk)
- Profile lacks activity timeline (recent kudos received, courses completed, sprints participated)

Let me check current state quickly to be precise.
