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
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const results: string[] = [];

    // 1. Delete María Gerente
    const mariaId = "ef2dfaec-2524-4e0f-8458-21cf39deb4fa";
    await admin.from("user_roles").delete().eq("user_id", mariaId);
    await admin.from("profiles").delete().eq("user_id", mariaId);
    const { error: delErr } = await admin.auth.admin.deleteUser(mariaId);
    results.push(delErr ? `Delete María error: ${delErr.message}` : "María deleted");

    // 2. Create 3 gerente users, one per client
    const gerentes = [
      { email: "gerente.aurum@sysde.com", full_name: "Juan Carlos Marín", password: "Gerente123!" },
      { email: "gerente.arkfin@sysde.com", full_name: "Nelly Arkfin", password: "Gerente123!" },
      { email: "gerente.apex@sysde.com", full_name: "Walter de León", password: "Gerente123!" },
    ];

    for (const g of gerentes) {
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: g.email,
        password: g.password,
        email_confirm: true,
        user_metadata: { full_name: g.full_name },
      });
      if (createErr) {
        results.push(`Create ${g.email} error: ${createErr.message}`);
        continue;
      }
      const { error: roleErr } = await admin.from("user_roles").insert({ user_id: newUser.user.id, role: "gerente" });
      results.push(roleErr ? `Role ${g.email} error: ${roleErr.message}` : `Created ${g.email} (${newUser.user.id})`);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
