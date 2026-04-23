import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CaseAgreementItem {
  text: string;
  responsible: string;
  date: string;
  priority: string;
}

export interface SupportTicket {
  id: string;
  client_id: string;
  ticket_id: string;
  producto: string;
  asunto: string;
  tipo: string;
  prioridad: string;
  estado: string;
  fecha_registro: string | null;
  fecha_entrega: string | null;
  dias_antiguedad: number;
  ai_classification: string | null;
  ai_risk_level: string | null;
  ai_summary: string | null;
  responsable: string | null;
  notas: string | null;
  case_agreements: CaseAgreementItem[];
  case_actions: CaseAgreementItem[];
  created_at: string;
  updated_at: string;
  // Campos agregados por la migración 20260422150000 (formulario legacy completo).
  // Todos opcionales para no romper consumidores existentes — el trigger backfillea.
  consecutivo_global?: number | null;
  consecutivo_cliente?: number | null;
  descripcion?: string | null;
  prioridad_interna?: string | null;
  orden_atencion?: number | null;
  ubicacion_error?: string | null;
  unidad_fabricacion?: string | null;
  tiempo_consumido_minutos?: number | null;
  tiempo_cobrado_minutos?: number | null;
  fecha_estimada_cierre?: string | null;
  // Seguridad (migración 20260422160000)
  is_confidential?: boolean | null;
  descripcion_cifrada?: string | null;   // BYTEA en BD, pero base64 en TS
  fuente?: "cliente" | "interno" | "email" | "api" | "devops" | null;
  // Asignación granular (existe en la tabla desde migración 20260416193142)
  assigned_user_id?: string | null;
}

export interface SupportClient {
  id: string;
  name: string;
  country: string;
  industry: string;
  status: string;
  progress: number;
  contact_name: string;
  contact_email: string;
  team_assigned: string[];
  client_type: string;
  // Propiedades del cliente que se muestran en la vista de ticket legacy
  categoria_interna?: string | null;
  nivel_servicio?: "Base" | "Premium" | "Platinum" | null;
  ranking_position?: number | null;
}

export function useSupportClients() {
  return useQuery({
    queryKey: ["support-clients"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("clients")
        .select("*") as any)
        .eq("client_type", "soporte")
        .order("name");
      if (error) throw error;
      return (data || []) as SupportClient[];
    },
  });
}

export function useSupportTickets(clientId?: string) {
  return useQuery({
    queryKey: ["support-tickets", clientId],
    queryFn: async () => {
      let query = supabase.from("support_tickets").select("*").order("dias_antiguedad", { ascending: false });
      if (clientId) {
        query = query.eq("client_id", clientId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return ((data || []) as any[]).map(normTicket);
    },
  });
}

function normTicket(t: any): SupportTicket {
  return {
    ...t,
    case_agreements: normalizeItems(t.case_agreements),
    case_actions: normalizeItems(t.case_actions),
  };
}

function normalizeItems(val: any): CaseAgreementItem[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((v: any) => {
      if (typeof v === "string") return { text: v, responsible: "", date: "", priority: "Media" };
      return { text: v.text || "", responsible: v.responsible || "", date: v.date || "", priority: v.priority || "Media" };
    });
  }
  return [];
}

export function useAllSupportTickets() {
  return useQuery({
    queryKey: ["support-tickets-all"],
    queryFn: async () => {
      const { data: clients } = await (supabase
        .from("clients")
        .select("id") as any)
        .eq("client_type", "soporte");
      const ids = (clients || []).map((c: any) => c.id);
      if (ids.length === 0) return [];
      
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .in("client_id", ids)
        .order("dias_antiguedad", { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map(normTicket);
    },
  });
}

export function useUpdateSupportTicket() {
  const qc = useQueryClient();

  const LIST_KEYS = [
    ["support-tickets"],
    ["support-tickets-all"],
    ["support-inbox"],
  ];

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from("support_tickets")
        .update(updates as any)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // Optimistic update: el TicketDetailSheet y todas las listas reflejan el
    // cambio (estado/prioridad/responsable/etc) al instante sin esperar refetch.
    onMutate: async ({ id, updates }) => {
      const snapshots: Array<[readonly unknown[], unknown]> = [];
      for (const key of LIST_KEYS) {
        await qc.cancelQueries({ queryKey: key });
        // Recorrer TODAS las entries que matcheen ese prefix (pueden haber varias
        // por filtros distintos: por cliente, por rol, etc.)
        const matches = qc.getQueriesData({ queryKey: key });
        for (const [qkey, data] of matches) {
          snapshots.push([qkey, data]);
          if (Array.isArray(data)) {
            qc.setQueryData(
              qkey,
              (data as any[]).map((t) => t?.id === id ? { ...t, ...updates } : t),
            );
          }
        }
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      // Revertir todos los snapshots si falla
      if (ctx?.snapshots) {
        for (const [qkey, data] of ctx.snapshots) {
          qc.setQueryData(qkey as any, data);
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-tickets-all"] });
      qc.invalidateQueries({ queryKey: ["support-inbox"] });
      qc.invalidateQueries({ queryKey: ["ticket-history"] });
    },
  });
}

/**
 * Campos conocidos de la tabla `support_tickets`. Si la migración
 * `20260422150000_ticket_full_form.sql` no se aplicó aún, algunos campos
 * no existen y Supabase rechaza el insert con "column not found in schema cache".
 *
 * Esta lista se usa para filtrar el payload: solo se envían campos que
 * tengan valor (no undefined ni null, salvo que sean explícitamente `false`
 * o `0`). Así mantenemos backward-compat con BDs antes de migrar.
 */
const CORE_FIELDS = new Set([
  "client_id", "ticket_id", "asunto", "tipo", "prioridad", "estado",
  "fecha_registro", "fecha_entrega", "producto", "notas", "responsable",
  "dias_antiguedad", "visibility", "case_agreements", "case_actions",
]);
const POST_MIGRATION_FIELDS = new Set([
  "descripcion", "prioridad_interna", "orden_atencion", "ubicacion_error",
  "unidad_fabricacion", "tiempo_consumido_minutos", "tiempo_cobrado_minutos",
  "fecha_estimada_cierre", "is_confidential", "fuente",
  "assigned_user_id", "story_points", "business_value", "effort",
  "backlog_rank", "scrum_status", "sprint_id",
]);

// Defaults del schema BD para los campos post-migración. Si el payload trae
// estos valores, significa que el usuario no los tocó y no deberían enviarse
// (la BD los rellena sola con el default del schema).
const POST_MIGRATION_DEFAULTS: Record<string, any> = {
  orden_atencion: 0,
  tiempo_consumido_minutos: 0,
  tiempo_cobrado_minutos: 0,
  is_confidential: false,
  fuente: "interno",
  prioridad_interna: "pendiente",
};

function sanitizeTicketPayload(data: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;

    if (POST_MIGRATION_FIELDS.has(k)) {
      // Omitir valores vacíos
      if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      // Omitir valores que coinciden con el default del schema (no-op para la BD)
      if (k in POST_MIGRATION_DEFAULTS && v === POST_MIGRATION_DEFAULTS[k]) continue;
    }
    clean[k] = v;

    if (!CORE_FIELDS.has(k) && !POST_MIGRATION_FIELDS.has(k)) {
      if (typeof window !== "undefined" && (window as any).location?.hostname === "localhost") {
        console.warn(`[useCreateSupportTicket] campo desconocido "${k}" — revisar si existe en BD`);
      }
    }
  }

  // Fallback: si la BD no tiene la columna `descripcion` (migración no aplicada),
  // el campo se pierde. Copiamos a `notas` para que el contenido quede registrado.
  // Después de aplicar la migración, ambos campos tendrán el texto (inofensivo).
  if (clean.descripcion && !clean.notas) {
    clean.notas = clean.descripcion;
  }

  return clean;
}

const SCHEMA_COLUMN_MISSING = /Could not find the '([^']+)' column/;
const NULL_CONSTRAINT = /null value in column "([^"]+)"/;
const DUPLICATE_KEY = /duplicate key value violates unique constraint/;

/** Genera un ticket_id fallback desde el frontend (usado cuando el trigger de BD no existe). */
function generateFallbackTicketId(clientId: string): string {
  const prefix = (clientId || "TKT").slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "") || "TKT";
  const short = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return `${prefix}-${short}${rand}`;
}

/**
 * Intenta insertar un ticket. Maneja múltiples errores del schema:
 *  - Columna inexistente (migración no aplicada) → elimina el campo y reintenta
 *  - null constraint en ticket_id (trigger no existe) → genera ticket_id fallback
 *  - duplicate key en ticket_id (poco probable) → regenera ticket_id
 *
 * El `.select()` del insert también puede fallar si el schema cache no conoce
 * columnas nuevas; por eso primero hacemos insert sin select, y después leemos
 * el ticket recién creado con los campos que sabemos que existen.
 */
async function insertTicketWithRetry(payload: Record<string, any>) {
  let working = { ...payload };
  const removedFields: string[] = [];
  const patches: string[] = [];
  const maxRetries = 10;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 1) INSERT sin select — minimiza colisión con schema cache
    const { error: insertErr } = await supabase
      .from("support_tickets")
      .insert([working] as any);

    if (insertErr) {
      const msg = insertErr.message || "";

      // Caso 1: columna inexistente (pre-migración) → quitar y reintentar
      const mCol = msg.match(SCHEMA_COLUMN_MISSING);
      if (mCol && attempt < maxRetries && mCol[1] in working) {
        removedFields.push(mCol[1]);
        delete working[mCol[1]];
        continue;
      }

      // Caso 2: null constraint en ticket_id (trigger de BD no existe)
      const mNull = msg.match(NULL_CONSTRAINT);
      if (mNull && mNull[1] === "ticket_id" && !working.ticket_id && attempt < maxRetries) {
        working.ticket_id = generateFallbackTicketId(working.client_id);
        patches.push(`ticket_id=${working.ticket_id} (generado en frontend)`);
        continue;
      }

      // Caso 3: duplicate key en ticket_id → regenerar
      if (DUPLICATE_KEY.test(msg) && working.ticket_id && attempt < maxRetries) {
        working.ticket_id = generateFallbackTicketId(working.client_id);
        patches.push(`ticket_id=${working.ticket_id} (regenerado por colisión)`);
        continue;
      }

      throw insertErr;
    }

    // 2) SELECT por (client_id, ticket_id) — usa columnas básicas que SIEMPRE existen.
    //    Si no pasamos ticket_id, buscamos el último del cliente (acabado de insertar).
    let readQuery = supabase
      .from("support_tickets")
      .select("*")
      .eq("client_id", working.client_id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (working.ticket_id) {
      readQuery = supabase
        .from("support_tickets")
        .select("*")
        .eq("ticket_id", working.ticket_id)
        .maybeSingle() as any;
    }

    const { data: inserted, error: readErr } = await (readQuery as any);
    if (readErr) {
      // El INSERT pasó pero no pudimos leer — retornamos el payload original
      // como fallback para que el toast pueda mostrar algo.
      console.warn("[useCreateSupportTicket] insert OK pero read falló:", readErr.message);
      return working as any;
    }

    if ((removedFields.length > 0 || patches.length > 0) && typeof window !== "undefined") {
      if (removedFields.length > 0) {
        console.warn(`[useCreateSupportTicket] campos omitidos por schema desactualizado: ${removedFields.join(", ")}`);
      }
      if (patches.length > 0) {
        console.warn(`[useCreateSupportTicket] parches aplicados: ${patches.join(" | ")}`);
      }
      console.warn(`[useCreateSupportTicket] Aplicá las migraciones pendientes de BD para que los triggers generen consecutivos correctamente.`);
    }

    return (Array.isArray(inserted) ? inserted[0] : inserted) ?? working;
  }
  throw new Error("No se pudo insertar el ticket tras varios reintentos");
}

/**
 * Crea un ticket. `ticket_id` es OPCIONAL: si no se provee, el trigger
 * `assign_ticket_consecutivos` lo genera automáticamente con el patrón
 * `{PREFIJO_CLIENTE}-{0000}` (ej: "CRD-0376").
 * El mismo trigger asigna `consecutivo_cliente` y `consecutivo_global`.
 * Además, si el ticket es `fuente='cliente'`, inserta una notificación al SVA
 * en `client_notifications` para que el equipo reciba el aviso en tiempo real.
 *
 * El payload se sanitiza antes del insert: campos post-migración sin valor se omiten,
 * para evitar errores "schema cache" si la migración no está aplicada aún.
 */
export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<SupportTicket> & { client_id: string; asunto: string }) => {
      const payload = sanitizeTicketPayload(data);
      const inserted = await insertTicketWithRetry(payload);

      const esCritico = /critica/i.test((data.prioridad as string) || "");

      // 1. Notificación al buzón del SVA (y al cliente que confirma recepción)
      try {
        const tipoNotif = esCritico ? "error" : data.fuente === "cliente" ? "info" : "warning";
        const origen = data.fuente === "cliente" ? "portal del cliente" : "equipo SVA";
        await (supabase.from("client_notifications") as any).insert({
          client_id: data.client_id,
          type: tipoNotif,
          title: `Nuevo caso ${inserted.ticket_id}: ${String(data.asunto).slice(0, 60)}`,
          message: `${data.tipo || "Solicitud"} · prioridad ${data.prioridad || "Media"} · creado desde ${origen}${
            data.is_confidential ? " · 🔒 confidencial" : ""
          }`,
        });
      } catch {
        // la notif es best-effort, no rompe la creación si falla
      }

      // 2. Si es crítico, disparar notificación urgente (Slack + email on-call)
      //    No bloqueamos la respuesta al usuario — el ticket ya se creó.
      if (esCritico) {
        supabase.functions
          .invoke("notify-critical-ticket", { body: { ticket_id: inserted.id } })
          .catch((err) => console.warn("notify-critical-ticket falló (best-effort):", err));
      }

      return inserted as SupportTicket;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-tickets-all"] });
      qc.invalidateQueries({ queryKey: ["client-notifications"] });
      qc.invalidateQueries({ queryKey: ["support-inbox"] });
    },
  });
}

/**
 * Descifra la descripción de un ticket confidencial invocando la edge function.
 * Requiere rol admin/pm + secret ENCRYPTION_KEY configurado en Supabase.
 * El acceso queda registrado en ticket_access_log automáticamente.
 */
export function useDecryptTicket() {
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const { data, error } = await supabase.functions.invoke("decrypt-ticket", {
        body: { ticket_id: ticketId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        ticket_id: string;
        ticket_id_legible: string;
        descripcion: string;
        decrypted_at: string;
        decrypted_by: string;
      };
    },
  });
}

export function useDeleteSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("support_tickets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-tickets-all"] });
      qc.invalidateQueries({ queryKey: ["support-inbox"] });
    },
  });
}
