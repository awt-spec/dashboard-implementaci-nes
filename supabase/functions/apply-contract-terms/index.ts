import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, requireAuth, getUserRole } from "../_shared/auth.ts";

// ─────────────────────────────────────────────────────────────────────────────
// apply-contract-terms — "Aplicar todo al sistema" desde la KB de contratos.
// Aplica los términos extraídos (contrato + SLAs + suscripción de facturación)
// usando service_role. Antes esto se hacía desde el navegador y fallaba la RLS
// de client_contracts para cualquier usuario que no fuera admin/pm. Aquí se
// valida la autorización server-side (replicando la RLS: admin, pm, o el permiso
// cliente.gestionar_datos) y se escribe con service_role.
// ─────────────────────────────────────────────────────────────────────────────

const FUNCTION_NAME = "apply-contract-terms";

function nextPaymentFrom(start?: string, cycle?: string, explicit?: string): string | null {
  if (explicit) return explicit;
  if (!start) return null;
  const months = cycle === "anual" ? 12 : cycle === "semestral" ? 6 : cycle === "trimestral" ? 3 : 1;
  const d = new Date(start); const now = new Date();
  if (isNaN(d.getTime())) return null;
  let guard = 0;
  while (d <= now && guard < 240) { d.setMonth(d.getMonth() + months); guard++; }
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);
  try {
    const ctx = await requireAuth(req);
    const admin = ctx.adminClient;

    // Autorización = misma que la RLS de client_contracts.
    const role = await getUserRole(admin, ctx.userId);
    let authorized = role === "admin" || role === "pm";
    if (!authorized) {
      const { data: perm } = await admin.rpc("has_permission", { _user_id: ctx.userId, _permission_key: "cliente.gestionar_datos" });
      authorized = perm === true;
    }
    if (!authorized) throw new AuthError(403, "No tenés permisos para aplicar contratos (requiere admin, PM o el permiso de gestión de datos de cliente).");

    const { clientId, terms } = await req.json().catch(() => ({}));
    if (!clientId || !terms) {
      return new Response(JSON.stringify({ error: "clientId y terms son requeridos." }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const ct = terms.contrato || {};

    // 1) Contrato — crea si no existe el activo; si existe, lo actualiza (merge).
    const { data: contracts } = await admin
      .from("client_contracts").select("*").eq("client_id", clientId)
      .order("is_active", { ascending: false }).order("included_hours", { ascending: false });
    const active = (contracts as any[])?.[0] ?? null;
    const contractRow: any = {
      client_id: clientId,
      contract_type: ct.tipo || active?.contract_type || "fee_mensual",
      monthly_value: ct.valor_mensual ?? active?.monthly_value ?? 0,
      hourly_rate: ct.tarifa_hora ?? active?.hourly_rate ?? 0,
      included_hours: ct.horas_incluidas ?? terms.paquetes_horas?.[0]?.horas_incluidas ?? active?.included_hours ?? 0,
      currency: ct.moneda || active?.currency || "USD",
      start_date: ct.fecha_inicio || active?.start_date || null,
      end_date: ct.fecha_fin || active?.end_date || null,
      auto_renewal: ct.renovacion_automatica ?? active?.auto_renewal ?? false,
      payment_terms: ct.terminos_pago || active?.payment_terms || null,
      is_active: true,
    };
    let contractId = active?.id as string | undefined;
    if (contractId) {
      const { error } = await admin.from("client_contracts").update(contractRow).eq("id", contractId);
      if (error) throw new Error(`contrato: ${error.message}`);
    } else {
      const { data, error } = await admin.from("client_contracts").insert(contractRow).select("id").single();
      if (error) throw new Error(`contrato: ${error.message}`);
      contractId = (data as any)?.id;
    }

    // 2) SLAs → client_slas (upsert por prioridad + tipo de caso).
    const { data: existingSLAs } = await admin
      .from("client_slas").select("id, priority_level, case_type").eq("client_id", clientId);
    let slaCount = 0;
    for (const s of (terms.slas ?? []) as any[]) {
      const caseType = s.tipo_caso || "all";
      const match = (existingSLAs as any[])?.find((e) => e.priority_level === s.prioridad && (e.case_type || "all") === caseType);
      const slaRow: any = {
        client_id: clientId,
        priority_level: s.prioridad,
        case_type: caseType,
        response_time_hours: s.tiempo_respuesta_horas ?? 0,
        resolution_time_hours: s.tiempo_resolucion_horas ?? 0,
        business_hours_only: s.horario_habil_solo ?? true,
        penalty_amount: s.penalidad_monto ?? null,
        penalty_description: s.penalidad_descripcion ?? null,
        is_active: true,
      };
      if (match?.id) {
        const { error } = await admin.from("client_slas").update(slaRow).eq("id", match.id);
        if (error) throw new Error(`sla: ${error.message}`);
      } else {
        const { error } = await admin.from("client_slas").insert(slaRow);
        if (error) throw new Error(`sla: ${error.message}`);
      }
      slaCount++;
    }

    // 3) Suscripción de facturación (si es recurrente).
    let subscription = false;
    if (ct.es_suscripcion || ct.tipo === "fee_mensual") {
      const next = nextPaymentFrom(ct.fecha_inicio, ct.ciclo_facturacion, ct.proxima_fecha_pago);
      const { data: existingSub } = await admin
        .from("billed_packages").select("id").eq("client_id", clientId).eq("is_subscription", true).limit(1).maybeSingle();
      // package_type ∈ {horas,servicio,licencia,proyecto,otro}; status ∈
      // {pendiente,facturado,pagado,anulado}; total_amount es columna generada.
      const subRow: any = {
        client_id: clientId, contract_id: contractId ?? null,
        name: terms.servicio_contratado?.slice(0, 120) || "Suscripción de servicio",
        package_type: "servicio", is_subscription: true,
        billing_cycle: ct.ciclo_facturacion || "mensual",
        next_payment_date: next,
        quantity: 1, unit_price: ct.valor_mensual ?? 0,
        currency: ct.moneda || "USD", status: "pendiente",
      };
      if ((existingSub as any)?.id) {
        const { error } = await admin.from("billed_packages").update(subRow).eq("id", (existingSub as any).id);
        if (error) throw new Error(`suscripción: ${error.message}`);
      } else {
        const { error } = await admin.from("billed_packages").insert(subRow);
        if (error) throw new Error(`suscripción: ${error.message}`);
      }
      subscription = true;
    }

    return new Response(JSON.stringify({ success: true, contractId, slas: slaCount, subscription }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return new Response(JSON.stringify({ error: e.message }), { status: e.status ?? 401, headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: e?.message ?? `Error en ${FUNCTION_NAME}` }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
