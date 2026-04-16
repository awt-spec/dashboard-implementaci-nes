import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error("Invalid token");

    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (callerRole?.role !== "admin") {
      throw new Error("Solo administradores pueden gestionar usuarios");
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, password, full_name, role } = body;

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) throw createErr;

      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role });
      if (roleErr) throw roleErr;

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Crear acceso para un miembro existente del Equipo SYSDE
    if (action === "create_team_access") {
      const { team_member_id, password } = body;
      if (!team_member_id || !password || password.length < 6) {
        throw new Error("team_member_id y password (>=6 chars) son requeridos");
      }

      const { data: member, error: memberErr } = await supabaseAdmin
        .from("sysde_team_members")
        .select("id, name, email, user_id")
        .eq("id", team_member_id)
        .maybeSingle();
      if (memberErr) throw memberErr;
      if (!member) throw new Error("Miembro no encontrado");
      if (!member.email) throw new Error("El miembro no tiene email asignado");
      if (member.user_id) throw new Error("Este miembro ya tiene un acceso creado");

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: member.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: member.name },
      });
      if (createErr) throw createErr;

      // Asignar rol colaborador
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "colaborador" });
      if (roleErr) throw roleErr;

      // Vincular miembro <-> usuario
      const { error: linkErr } = await supabaseAdmin
        .from("sysde_team_members")
        .update({ user_id: newUser.user.id })
        .eq("id", team_member_id);
      if (linkErr) throw linkErr;

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      const { user_id, role } = body;
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      const { error: insErr } = await supabaseAdmin.from("user_roles").insert({ user_id, role });
      if (insErr) throw insErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = body;
      // Desvincular del equipo si aplica
      await supabaseAdmin.from("sysde_team_members").update({ user_id: null }).eq("user_id", user_id);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_password") {
      const { user_id, password } = body;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_email") {
      const { user_id, email } = body;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { email, email_confirm: true });
      if (error) throw error;

      await supabaseAdmin.from("profiles").update({ email }).eq("user_id", user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
