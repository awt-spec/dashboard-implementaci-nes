import { corsHeaders, corsPreflight, lovableCompatFetch } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, canAccessMember, requireAuth } from "../_shared/auth.ts";

const ROLE_TEMPLATES: Record<string, string> = {
  developer: `Eres un mentor técnico senior especializado en desarrollo de software. Ayudas con:
- Code review constructivo (legibilidad, performance, seguridad, testing)
- Debugging guiado (haz preguntas para acotar el problema antes de proponer fix)
- Sugerencias de arquitectura y patrones (SOLID, DDD, hexagonal cuando aplique)
- Generación de tests unitarios e integración
- Best practices de Git, CI/CD, observabilidad
Estilo: directo, con ejemplos de código en bloques markdown. Cuestiona decisiones arriesgadas con respeto.`,

  qa: `Eres un Test Engineer senior. Ayudas con:
- Diseño de planes de prueba (funcional, regresión, smoke, E2E)
- Casos de prueba con criterios de aceptación claros (Given/When/Then)
- Triage y reproducción de bugs (pasos, severidad, prioridad)
- Estrategias de automatización (qué SI y qué NO automatizar)
Estilo: estructurado, en tablas o checklists.`,

  pm: `Eres un PM/Project Manager senior con experiencia en proyectos de implementación TI. Ayudas con:
- Resúmenes ejecutivos de estado (logros, próximos pasos, riesgos, bloqueos)
- Detección de riesgos y planes de mitigación
- Drafts de minutas de reunión y updates a stakeholders
- Priorización (RICE, WSJF, MoSCoW)
- Gestión de expectativas con clientes
Estilo: claro, accionable, orientado a outcomes. Usa bullets y secciones.`,

  consultant: `Eres un consultor senior funcional/técnico SAP/IFS. Ayudas con:
- Configuración de módulos (parametrización, customizing)
- Troubleshooting funcional con enfoque en raíz del problema
- Búsqueda y referencia a documentación oficial
- Mejores prácticas de implementación y migración
- Comunicación con usuarios clave del cliente
Estilo: técnico-funcional, con referencias a t-codes, IFS Apps, módulos específicos.`,

  support: `Eres un Support Engineer senior. Ayudas con:
- Diagnóstico estructurado de tickets (síntomas, evidencia, hipótesis, validación)
- Sugerencias de KB y artículos relevantes
- Drafts de respuestas al cliente (empáticas, claras, con próximos pasos)
- Identificación de patrones para crear KB nueva o automatizar
Estilo: empático con clientes, técnico con el equipo. SLA-aware.`,

  designer: `Eres un Senior Product Designer / UX. Ayudas con:
- Feedback UX (jerarquía visual, accesibilidad WCAG, microinteracciones)
- Revisión de copy (tono, claridad, longitud)
- Sugerencias de patrones (Material, HIG, Carbon)
- Críticas constructivas a flujos y wireframes
Estilo: visual y crítico-constructivo. Justifica con principios de diseño.`,

  default: `Eres un asistente de productividad personal. Ayudas con organización del día, priorización, comunicación profesional, aprendizaje continuo y bienestar laboral. Estilo cercano, motivador y accionable.`,
};

function detectTemplate(role?: string): string {
  if (!role) return "default";
  const r = role.toLowerCase();
  if (/(dev|developer|engineer|programador|tech\s*lead|backend|frontend|fullstack)/.test(r)) return "developer";
  if (/(qa|tester|quality)/.test(r)) return "qa";
  if (/(pm|project|gerente|manager|scrum master)/.test(r)) return "pm";
  if (/(consult|sap|ifs|funcional)/.test(r)) return "consultant";
  if (/(support|soporte|help\s*desk)/.test(r)) return "support";
  if (/(design|ux|ui)/.test(r)) return "designer";
  return "default";
}

const TONES: Record<string, string> = {
  friendly: "Tono cercano, cálido, motivador. Usa primera persona del plural ('vamos a...').",
  formal: "Tono profesional y formal. Sin emojis, sin coloquialismos.",
  direct: "Tono directo, sin rodeos. Máximo valor por palabra.",
  coaching: "Tono de coach: haz preguntas reflexivas antes de dar respuestas.",
};

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);

    const { member_id, message, conversation_id, task_id, ticket_id } = await req.json();
    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (typeof message !== "string" || message.length > 4000) {
      return new Response(JSON.stringify({ error: "message must be a string up to 4000 chars" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (member_id && !(await canAccessMember(ctx, member_id))) {
      return new Response(JSON.stringify({ error: "No autorizado a usar el agente de este miembro" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = ctx.adminClient;

    // Load member + agent config + context
    let context = "";
    let template = "default";
    let tone = "friendly";
    let custom = "";
    let model = "gemini-2.5-flash-lite";

    if (member_id) {
      const [
        { data: member },
        { data: agent },
        { data: skills },
        { data: goal },
      ] = await Promise.all([
        supabase.from("sysde_team_members").select("name, role, department, cv_seniority").eq("id", member_id).maybeSingle(),
        supabase.from("member_ai_agents").select("*").eq("member_id", member_id).maybeSingle(),
        supabase.from("team_member_skills").select("skill_name, level, category").eq("member_id", member_id).limit(20),
        supabase.from("time_tracking_goals").select("*").eq("user_id", member_id).maybeSingle(),
      ]);

      template = agent?.role_template && agent.role_template !== "auto"
        ? agent.role_template
        : detectTemplate(member?.role || undefined);
      tone = agent?.tone || "friendly";
      custom = agent?.custom_instructions || "";
      model = agent?.preferred_model || "gemini-2.5-flash-lite";

      // Optional task / ticket context
      let taskCtx = "";
      if (task_id) {
        const { data: t } = await supabase.from("tasks").select("title, description, status, priority, due_date").eq("id", task_id).maybeSingle();
        if (t) taskCtx = `\nTarea actual: ${t.title} | estado ${t.status} | prioridad ${t.priority}${t.due_date ? ` | due ${t.due_date}` : ""}\n${t.description || ""}`;
      }
      if (ticket_id) {
        const { data: tk } = await supabase.from("support_tickets").select("asunto, notas, estado, prioridad, fecha_entrega").eq("id", ticket_id).maybeSingle();
        if (tk) taskCtx = `\nTicket actual: ${tk.asunto} | estado ${tk.estado} | prioridad ${tk.prioridad}\n${tk.notas || ""}`;
      }

      context = `Información del colaborador:
- Nombre: ${member?.name || "?"}
- Rol: ${member?.role || "?"} (${member?.cv_seniority || "?"})
- Departamento: ${member?.department || "?"}
- Skills top: ${(skills || []).slice(0, 10).map((s: any) => `${s.skill_name} L${s.level}`).join(", ") || "ninguna registrada"}
- Meta semanal: ${goal?.weekly_target_hours ?? 40}h, ${goal?.billable_target_pct ?? 80}% facturable${taskCtx}`;
    }

    const systemPrompt = `${ROLE_TEMPLATES[template] || ROLE_TEMPLATES.default}

${TONES[tone] || TONES.friendly}

${custom ? `Instrucciones personales del colaborador:\n${custom}\n` : ""}
${context}

═══════════════════════════════════════════
REGLAS DE FORMATO (OBLIGATORIAS)
═══════════════════════════════════════════
Responde SIEMPRE en español, con markdown bien estructurado y escaneable. Sigue estas reglas SIN EXCEPCIÓN:

1. **Estructura jerárquica**: Empieza con una frase de 1 línea con la idea clave (en **negrita** si aplica). Luego desarrolla.
2. **Encabezados**: Usa \`##\` para secciones principales y \`###\` para subsecciones. NUNCA uses \`#\` (h1).
3. **Listas**: Prefiere bullets (\`-\`) sobre párrafos largos. Usa listas numeradas SOLO cuando el orden importa (pasos secuenciales).
4. **Negritas**: Resalta términos clave, nombres propios, decisiones y métricas con \`**negrita**\`. No abuses (máx 2-3 por párrafo).
5. **Código**: Bloques con \`\`\`lenguaje siempre con el lenguaje declarado (\`\`\`ts, \`\`\`bash, \`\`\`sql). Inline con \`backticks\` para nombres de variables, funciones, archivos o comandos.
6. **Tablas**: Úsalas cuando compares 3+ items con 2+ atributos. Markdown estándar.
7. **Citas/notas**: Usa \`>\` para advertencias, notas o tips importantes.
8. **Espaciado**: Una línea en blanco entre secciones. Nada de paredes de texto.
9. **Longitud**: Sé conciso. Si la respuesta es simple, da SOLO la respuesta sin estructura forzada. Si es compleja, estructura.
10. **Cierre accionable**: Termina con un mini bloque "**Próximos pasos**" o "**Acción sugerida**" cuando aplique (1-3 bullets).
11. **Emojis**: Máximo 1 por sección (en encabezados o como bullet visual). Nada de spam.

❌ NUNCA: respuestas en un solo bloque sin estructura, párrafos de >5 líneas, listas de 1 solo item, abrir con disclaimers ("Como IA..."), repetir la pregunta del usuario.
✅ SIEMPRE: ir al grano, ser accionable, dejar al usuario con claridad sobre qué hacer.`;

    // Load existing conversation messages
    let history: any[] = [];
    let convId = conversation_id;
    if (convId) {
      const { data: existing } = await supabase.from("member_ai_conversations").select("messages").eq("id", convId).maybeSingle();
      history = ((existing?.messages as any[]) || []).map((m) => ({ role: m.role, content: m.content }));
    }

    const r = await lovableCompatFetch({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message },
      ],
    }, { timeoutMs: 30000 });

    if (r.status === 429) return new Response(JSON.stringify({ error: "Límite de IA alcanzado, intenta en un minuto." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA agotados. Añade fondos en Lovable." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
    if (!r.ok) {
      const t = await r.text();
      console.error("AI gateway error:", r.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const data = await r.json();
    const answer = data.choices?.[0]?.message?.content || "Sin respuesta";

    // Persist conversation
    const newMsgs = [
      { role: "user", content: message, ts: new Date().toISOString() },
      { role: "assistant", content: answer, ts: new Date().toISOString() },
    ];

    if (convId) {
      const { data: existing } = await supabase.from("member_ai_conversations").select("messages").eq("id", convId).maybeSingle();
      const merged = [...((existing?.messages as any[]) || []), ...newMsgs];
      await supabase.from("member_ai_conversations").update({ messages: merged }).eq("id", convId);
    } else {
      const { data: ins } = await supabase
        .from("member_ai_conversations")
        .insert({
          member_id: member_id || null,
          title: message.slice(0, 80),
          messages: newMsgs,
          context_snapshot: { template, tone, has_task: !!task_id, has_ticket: !!ticket_id },
        })
        .select("id")
        .maybeSingle();
      convId = ins?.id;
    }

    await supabase.from("ai_usage_logs").insert({
      function_name: "member-agent-chat",
      model,
      prompt_tokens: data.usage?.prompt_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0,
      metadata: { template, member_id },
    });

    return new Response(JSON.stringify({ answer, conversation_id: convId, template }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("member-agent-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
