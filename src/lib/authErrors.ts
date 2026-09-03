/**
 * Traducción de los errores de autenticación de Supabase.
 *
 * Dos criterios que no son cosméticos:
 *
 *  - Credencial inválida y usuario inexistente devuelven el MISMO texto. La
 *    diferencia entre "esa contraseña no es" y "ese correo no existe" no le
 *    sirve a quien se equivocó de tecla; le sirve a quien prueba correos para
 *    ver cuáles tienen cuenta.
 *  - Nunca se muestra el mensaje crudo. Vienen en inglés y hablan de la API
 *    ("Invalid login credentials"), no de lo que la persona tiene que hacer.
 */
export function mensajeDeError(raw: string | null | undefined): string {
  const m = (raw || "").toLowerCase();
  if (/invalid login credentials|invalid credentials|user not found|invalid email or password/.test(m)) {
    return "Correo o contraseña incorrectos.";
  }
  if (/email not confirmed|not confirmed/.test(m)) {
    return "La cuenta todavía no está confirmada. Revisá el correo de activación.";
  }
  if (/too many requests|rate limit|over_request_rate/.test(m)) {
    return "Demasiados intentos seguidos. Esperá un momento y volvé a probar.";
  }
  if (/failed to fetch|network|timeout|networkerror/.test(m)) {
    return "No se pudo contactar el servidor. Revisá tu conexión e intentá de nuevo.";
  }
  if (/banned|blocked|disabled/.test(m)) {
    return "La cuenta está deshabilitada. Escribinos a soporte para reactivarla.";
  }
  return "No se pudo iniciar sesión. Si sigue pasando, escribinos a soporte.";
}
