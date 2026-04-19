
User wants to add GPT-5.2 (and likely GPT-5) as model options in the agent selector. Currently `AgentConfigDialog.tsx` has only 3 models: Gemini Flash, Gemini Pro, GPT-5 mini. I'll add GPT-5.2 as the premium option, plus GPT-5, and reorder for clarity.

## Plan: Add GPT-5.2 (Premium) to AI Agent model selector

### Changes

**1. `src/components/team/AgentConfigDialog.tsx`**

Update the `MODELS` array to include the new options with clear labels and a "Premium" hint for the most powerful ones:

```ts
const MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (rápido, recomendado)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (razonamiento)" },
  { value: "openai/gpt-5-mini", label: "GPT-5 mini" },
  { value: "openai/gpt-5", label: "GPT-5 ⭐ Premium" },
  { value: "openai/gpt-5.2", label: "GPT-5.2 ⭐ Premium (último)" },
];
```

**2. `supabase/functions/member-agent-chat/index.ts`** — no code change needed; it already passes `model` dynamically from `member_ai_agents.preferred_model`. GPT-5.2 will work out of the box via Lovable AI Gateway.

**3. Memory** — append to `mem://features/ai-agents.md` that GPT-5.2 is the premium model option.

### Notes
- No DB migration needed (the `preferred_model` column already accepts any string).
- No new secrets — `LOVABLE_API_KEY` covers all OpenAI/Gemini models.
- Existing collaborators keep their currently selected model; only those who pick GPT-5.2 in the dialog will use it.
- GPT-5.2 may be slower and consume more credits per message — that's expected for a premium reasoning model.
