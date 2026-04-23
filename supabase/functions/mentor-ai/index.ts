import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, canAccessMember, requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);

    const { member_id, question, conversation_id } = await req.json();
    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: "question required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (typeof question !== "string" || question.length > 4000) {
      return new Response(JSON.stringify({ error: "question must be a string up to 4000 chars" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (member_id && !(await canAccessMember(ctx, member_id))) {
      return new Response(JSON.stringify({ error: "No autorizado a usar el mentor de este miembro" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const supabase = ctx.adminClient;

    // Build context from member skills + career path + courses
    let context = "";
    if (member_id) {
      const [{ data: member }, { data: skills }, { data: career }, { data: enrollments }] = await Promise.all([
        supabase.from("sysde_team_members").select("name, role, department").eq("id", member_id).maybeSingle(),
        supabase.from("team_member_skills").select("skill_name, level, category").eq("member_id", member_id),
        supabase.from("team_career_paths").select("target_role, skills_gap, recommended_certifications").eq("member_id", member_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("learning_enrollments").select("course_id, status, learning_courses(title)").eq("member_id", member_id),
      ]);
      context = `
Colaborador: ${member?.name || "?"} (${member?.role || "?"}, ${member?.department || "?"})
Skills actuales: ${(skills || []).map((s: any) => `${s.skill_name} L${s.level}`).join(", ") || "ninguna"}
Plan de carrera: target ${career?.target_role || "?"}; gaps: ${JSON.stringify(career?.skills_gap || [])}
Cursos en progreso: ${(enrollments || []).map((e: any) => `${e.learning_courses?.title} (${e.status})`).join(", ") || "ninguno"}`;
    }

    const { data: courses } = await supabase.from("learning_courses").select("id, title, related_skills, level, duration_hours, provider").limit(40);

    const systemPrompt = `Eres un mentor IA experto en SAP/IFS, desarrollo de software y carrera profesional en consultoría TI.
Hablas en español, eres directo, accionable y motivador.
${context}

Catálogo de cursos disponibles (id, título, skills, nivel, horas):
${(courses || []).map((c: any) => `- [${c.id}] ${c.title} | ${(c.related_skills || []).join(",")} | ${c.level} | ${c.duration_hours}h`).join("\n")}

Cuando recomiendes un curso del catálogo, menciona su título exactamente. Da pasos concretos, plazos y ejemplos.`;

    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
      }),
    });

    if (r.status === 429) return new Response(JSON.stringify({ error: "Límite de IA alcanzado, intenta más tarde." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA agotados. Añade fondos en Lovable." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
    if (!r.ok) {
      const t = await r.text();
      console.error("AI gateway error:", r.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const data = await r.json();
    const answer = data.choices?.[0]?.message?.content || "Sin respuesta";

    // Save conversation
    let convId = conversation_id;
    const newMsg = [
      { role: "user", content: question, ts: new Date().toISOString() },
      { role: "assistant", content: answer, ts: new Date().toISOString() },
    ];
    if (convId) {
      const { data: existing } = await supabase.from("mentor_conversations").select("messages").eq("id", convId).maybeSingle();
      const merged = [...((existing?.messages as any[]) || []), ...newMsg];
      await supabase.from("mentor_conversations").update({ messages: merged }).eq("id", convId);
    } else {
      const { data: ins } = await supabase.from("mentor_conversations").insert({ member_id: member_id || null, topic: question.slice(0, 80), messages: newMsg }).select("id").maybeSingle();
      convId = ins?.id;
    }

    // Log usage
    await supabase.from("ai_usage_logs").insert({
      function_name: "mentor-ai",
      model: "gemini-2.5-flash-lite",
      prompt_tokens: data.usage?.prompt_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0,
    });

    return new Response(JSON.stringify({ answer, conversation_id: convId }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("mentor-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
