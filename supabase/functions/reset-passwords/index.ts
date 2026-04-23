import { corsHeaders, corsPreflight, jsonResponse } from "../_shared/cors.ts";

// Deprecated: este endpoint contenía contraseñas hardcodeadas y se neutralizó.
// Para resetear contraseñas usa la función `manage-users` con action `update_password`,
// que valida JWT + rol admin.
Deno.serve((req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  return jsonResponse(
    req,
    {
      error: "Gone",
      detail: "Endpoint deprecado. Usa manage-users con action=update_password.",
    },
    410,
  );
});
