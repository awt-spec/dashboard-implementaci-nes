import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ServicePackage {
  id: string;
  client_id: string;
  policy_number: number;
  package_number: number;
  product: string | null;
  hours_contracted: number;
  start_date: string;
  end_date: string;
}

export function useServicePackages(clientId?: string) {
  return useQuery({
    queryKey: ["service-packages", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("service_packages" as any)
        .select("*")
        .eq("client_id", clientId)
        .order("start_date") as any);
      if (error) throw error;
      return (data ?? []) as ServicePackage[];
    },
  });
}

/** Detalle de tickets (para la tabla "Solicitudes de servicio"). */
export interface TicketDetailRow {
  id: string;
  ticket_id: string;
  consecutivo_cliente: number | null;
  producto: string | null;
  asunto: string | null;
  fecha_registro: string | null;
  tipo: string | null;
}

export function useTicketsByIds(ids: string[]) {
  const key = ids.slice().sort().join(",");
  return useQuery({
    queryKey: ["tickets-by-ids", key],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, ticket_id, consecutivo_cliente, producto, asunto, fecha_registro, tipo")
        .in("id", ids);
      if (error) throw error;
      const map = new Map<string, TicketDetailRow>();
      (data ?? []).forEach((t: any) => map.set(t.id, t));
      return map;
    },
  });
}
