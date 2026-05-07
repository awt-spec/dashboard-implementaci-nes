import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireAuth, AuthError, authErrorResponse } from "../_shared/auth.ts";

// ─────────────────────────────────────────────────────────────────────────────
// manage-users — endpoint con múltiples acciones para CRUD de usuarios.
//
// Modelo de autorización: distinto al patrón `requireRole(ctx, [...])` porque
// este endpoint expone DOS niveles de acción según `body.action`:
//   • CLIENTE_ACTIONS (admin OR pm) — gestión de usuarios externos cliente
//   • Resto             (admin only) — staff CRUD, passwords, emails
// Por eso resolvemos el rol UNA sola vez y bifurcamos por action.
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);

    const { data: callerRoles } = await ctx.adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userId);
    const callerRoleSet = new Set((callerRoles ?? []).map((r: any) => r.role));
    const isAdmin = callerRoleSet.has("admin");
    const isPM = callerRoleSet.has("pm");

    const body = await req.json();
    const { action } = body;

    // Acciones sobre clientes (crear usuario cliente, cambiar permiso, revocar)
    // permitidas para admin y pm. El resto sólo admin.
    const CLIENTE_ACTIONS = new Set([
      "create_cliente",
      "update_cliente_permission",
      "remove_cliente_assignment",
      "list_cliente_users",
    ]);
    if (CLIENTE_ACTIONS.has(action)) {
      if (!isAdmin && !isPM) {
        throw new AuthError(403, "Solo admin o pm pueden gestionar usuarios cliente");
      }
    } else if (!isAdmin) {
      throw new AuthError(403, "Solo administradores pueden gestionar usuarios");
    }

    if (action === "create") {
      const { email, password, full_name, role } = body;

      const { data: newUser, error: createErr } = await ctx.adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) throw createErr;

      const { error: roleErr } = await ctx.adminClient
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role });
      if (roleErr) throw roleErr;

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Crear acceso para un miembro existente del Equipo SYSDE
    if (action === "create_team_access") {
      const { team_member_id, password } = body;
      if (!team_member_id || !password || password.length < 6) {
        throw new Error("team_member_id y password (>=6 chars) son requeridos");
      }

      const { data: member, error: memberErr } = await ctx.adminClient
        .from("sysde_team_members")
        .select("id, name, email, user_id")
        .eq("id", team_member_id)
        .maybeSingle();
      if (memberErr) throw memberErr;
      if (!member) throw new Error("Miembro no encontrado");
      if (!member.email) throw new Error("El miembro no tiene email asignado");
      if (member.user_id) throw new Error("Este miembro ya tiene un acceso creado");

      const { data: newUser, error: createErr } = await ctx.adminClient.auth.admin.createUser({
        email: member.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: member.name },
      });
      if (createErr) throw createErr;

      // Asignar rol colaborador
      const { error: roleErr } = await ctx.adminClient
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "colaborador" });
      if (roleErr) throw roleErr;

      // Vincular miembro <-> usuario
      const { error: linkErr } = await ctx.adminClient
        .from("sysde_team_members")
        .update({ user_id: newUser.user.id })
        .eq("id", team_member_id);
      if (linkErr) throw linkErr;

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Crear accesos en bloque para TODOS los miembros activos sin user_id
    if (action === "create_bulk_team_access") {
      const { password } = body;
      if (!password || password.length < 6) {
        throw new Error("password (>=6 chars) es requerido");
      }

      const { data: members, error: membersErr } = await ctx.adminClient
        .from("sysde_team_members")
        .select("id, name, email, user_id, is_active")
        .eq("is_active", true);
      if (membersErr) throw membersErr;

      const results: any[] = [];
      for (const m of members || []) {
        if (m.user_id || !m.email) {
          results.push({ name: m.name, email: m.email, skipped: true, reason: m.user_id ? "ya tiene acceso" : "sin email" });
          continue;
        }
        try {
          const { data: newUser, error: createErr } = await ctx.adminClient.auth.admin.createUser({
            email: m.email,
            password,
            email_confirm: true,
            user_metadata: { full_name: m.name },
          });
          if (createErr) throw createErr;

          await ctx.adminClient.from("user_roles").insert({ user_id: newUser.user.id, role: "colaborador" });
          await ctx.adminClient.from("sysde_team_members").update({ user_id: newUser.user.id }).eq("id", m.id);

          results.push({ name: m.name, email: m.email, success: true });
        } catch (err: any) {
          results.push({ name: m.name, email: m.email, error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      const { user_id, role } = body;
      await ctx.adminClient.from("user_roles").delete().eq("user_id", user_id);
      const { error: insErr } = await ctx.adminClient.from("user_roles").insert({ user_id, role });
      if (insErr) throw insErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = body;
      // Desvincular del equipo si aplica
      await ctx.adminClient.from("sysde_team_members").update({ user_id: null }).eq("user_id", user_id);
      const { error } = await ctx.adminClient.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "update_password") {
      const { user_id, password } = body;
      const { error } = await ctx.adminClient.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "update_email") {
      const { user_id, email } = body;
      const { error } = await ctx.adminClient.auth.admin.updateUserById(user_id, { email, email_confirm: true });
      if (error) throw error;

      await ctx.adminClient.from("profiles").update({ email }).eq("user_id", user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // CLIENTE ACTIONS — gestión de usuarios externos vinculados a un cliente
    // ─────────────────────────────────────────────────────────────────

    if (action === "create_cliente") {
      const { email, password, full_name, client_id, permission_level } = body;
      if (!email || !password || password.length < 8) {
        throw new Error("email y password (>=8 chars) son requeridos");
      }
      if (!client_id) throw new Error("client_id es requerido");
      const perm = permission_level ?? "viewer";
      if (!["viewer", "editor", "admin"].includes(perm)) {
        throw new Error("permission_level inválido (viewer | editor | admin)");
      }

      // Ver si ya existe el user por email (para no duplicar)
      const { data: existingProfile } = await ctx.adminClient
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      let userId: string;
      if (existingProfile?.user_id) {
        userId = existingProfile.user_id;
        // Reset password + confirm email para que el password que venga en el
        // request sea el password real del user (útil para seed scripts y
        // para resetear cuando el admin re-invita a un user existente).
        const { error: updErr } = await ctx.adminClient.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name ?? email.split("@")[0], role: "cliente" },
        });
        if (updErr) throw updErr;
      } else {
        // Crear auth user con role=cliente en metadata (para que el trigger
        // handle_new_user inserte el rol correcto en vez del default gerente).
        const { data: newUser, error: createErr } = await ctx.adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: full_name ?? email.split("@")[0],
            role: "cliente",
          },
        });
        if (createErr) throw createErr;
        userId = newUser.user.id;
      }

      // Cliente users deben tener SOLO rol cliente, para que useAuth en el
      // frontend los rutee al ClientPortalDashboard y no al dashboard interno.
      // Si había un rol default (ej: gerente) del trigger o asignaciones previas,
      // se borra acá y se asegura que quede sólo cliente.
      await ctx.adminClient.from("user_roles").delete().eq("user_id", userId).neq("role", "cliente");

      // Idempotente: si el trigger ya insertó cliente, ignora el duplicado.
      const { error: roleErr } = await ctx.adminClient
        .from("user_roles")
        .upsert({ user_id: userId, role: "cliente" }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (roleErr) throw roleErr;

      // Upsert assignment (si ya existía para este client_id, actualiza permiso)
      const { error: assignErr } = await ctx.adminClient
        .from("cliente_company_assignments")
        .upsert(
          {
            user_id: userId,
            client_id,
            permission_level: perm,
            created_by: ctx.userId,
          },
          { onConflict: "user_id,client_id" }
        );
      if (assignErr) throw assignErr;

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "update_cliente_permission") {
      const { user_id, client_id, permission_level } = body;
      if (!user_id || !client_id) throw new Error("user_id y client_id son requeridos");
      if (!["viewer", "editor", "admin"].includes(permission_level)) {
        throw new Error("permission_level inválido");
      }
      const { error } = await ctx.adminClient
        .from("cliente_company_assignments")
        .update({ permission_level })
        .eq("user_id", user_id)
        .eq("client_id", client_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "remove_cliente_assignment") {
      const { user_id, client_id, delete_user } = body;
      if (!user_id || !client_id) throw new Error("user_id y client_id son requeridos");

      const { error: delAssignErr } = await ctx.adminClient
        .from("cliente_company_assignments")
        .delete()
        .eq("user_id", user_id)
        .eq("client_id", client_id);
      if (delAssignErr) throw delAssignErr;

      if (delete_user) {
        // Sólo borra el auth user si no quedan otras asignaciones
        const { data: remaining } = await ctx.adminClient
          .from("cliente_company_assignments")
          .select("id")
          .eq("user_id", user_id);
        if (!remaining || remaining.length === 0) {
          await ctx.adminClient.auth.admin.deleteUser(user_id);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "list_cliente_users") {
      const { client_id } = body;
      if (!client_id) throw new Error("client_id es requerido");

      const { data: assignments, error } = await ctx.adminClient
        .from("cliente_company_assignments")
        .select("id, user_id, permission_level, created_at, created_by")
        .eq("client_id", client_id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = (assignments ?? []).map((a: any) => a.user_id);
      const { data: profiles } = await ctx.adminClient
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const result = (assignments ?? []).map((a: any) => ({
        assignment_id: a.id,
        user_id: a.user_id,
        permission_level: a.permission_level,
        created_at: a.created_at,
        profile: profileMap.get(a.user_id) ?? null,
      }));

      return new Response(JSON.stringify({ success: true, users: result }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (err: any) {
    // AuthError → response 401/403 limpio. Otros errores → 400 con mensaje.
    if (err instanceof AuthError) return authErrorResponse(err, cors);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
