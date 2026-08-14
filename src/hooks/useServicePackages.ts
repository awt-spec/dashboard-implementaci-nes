import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  /** Contrato que originó la póliza. NULL = histórica, sin contrato asociado. */
  contract_id: string | null;
}

export type ServicePackageInput = Omit<ServicePackage, "id"> & { id?: string };

export function useUpsertServicePackage(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pkg: ServicePackageInput) => {
      const row = {
        client_id: pkg.client_id,
        policy_number: pkg.policy_number,
        package_number: pkg.package_number,
        product: pkg.product,
        hours_contracted: pkg.hours_contracted,
        start_date: pkg.start_date,
        end_date: pkg.end_date,
        // contract_id sólo se envía cuando hay uno elegido. El repo no aplica
        // migraciones automáticamente (Vercel sólo compila el front), así que
        // este campo puede llegar a una base donde la columna todavía no existe:
        // omitirlo deja intacto el alta/edición de pólizas de siempre, y el
        // vínculo con el contrato empieza a funcionar en cuanto se aplique
        // supabase/migrations/20260814100000_link_service_packages_to_contracts.sql
        ...(pkg.contract_id ? { contract_id: pkg.contract_id } : {}),
      };
      const q = pkg.id
        ? (supabase.from("service_packages").update(row).eq("id", pkg.id) as any)
        : (supabase.from("service_packages").insert(row) as any);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-packages", clientId] }),
  });
}

export function useDeleteServicePackage(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("service_packages").delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-packages", clientId] }),
  });
}

export function useServicePackages(clientId?: string) {
  return useQuery({
    queryKey: ["service-packages", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("service_packages")
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
