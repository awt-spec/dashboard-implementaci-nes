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

    const passwords: Record<string, string> = {
      "704ca2cf-85ed-4283-8317-10874cd43b51": "Adm!n$ysde2026#",
      "5fac295b-833f-4972-bb23-9c4edfd08ad1": "Pm@Fern4ndo!2026",
      "9b682208-c910-4128-831e-1ea497abdaab": "Aurum#Ger3nte!26",
      "67deb6be-154b-437d-99f8-115d4b701489": "Arkf!n#Ger3nte26",
      "154e6669-7bbc-4b19-b4c2-8dcf37fe9dbd": "Ap3x#Ger3nte!26",
    };

    const results: Record<string, string> = {};
    for (const [uid, pw] of Object.entries(passwords)) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, { password: pw });
      results[uid] = error ? error.message : "ok";
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
