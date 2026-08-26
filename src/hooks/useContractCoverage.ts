/**
 * ¿La fecha de un caso cae dentro de la vigencia de algún contrato del cliente?
 *
 * La regla NO vive acá: vive en contract_coverage_for() (migración
 * 20260826110000) y la comparten el formulario de alta, la ficha del caso, el
 * portal del cliente y get_tickets_sla_status(). Recalcularla en el navegador
 * sería reintroducir la segunda fuente de verdad que ya nos costó cara con el
 * SLA — dos pantallas mostrando dos respuestas a la misma pregunta.
 *
 * Lo importante de la regla, para no perderlo de vista al leer esto: se juzga
 * contra la fecha DEL CASO, no contra hoy. Un caso de marzo bajo un contrato
 * que corrió de enero a junio sigue cubierto aunque ese contrato ya venció.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CoverageKind = "cubierto" | "fuera_de_vigencia" | "sin_contrato";

export interface ContractCoverage {
  coverage: CoverageKind;
  contract_id: string | null;
  contract_type: string | null;
  start_date: string | null;
  end_date: string | null;
}

export function useContractCoverage(clientId?: string, atIso?: string) {
  // Sin fecha explícita se pregunta por ahora, que es el caso del alta.
  const at = atIso ?? new Date().toISOString();
  return useQuery({
    queryKey: ["contract-coverage", clientId, at.slice(0, 10)],
    enabled: !!clientId,
    queryFn: async (): Promise<ContractCoverage | null> => {
      const { data, error } = await supabase.rpc("contract_coverage_for" as never, {
        _client_id: clientId, _at: at,
      } as never);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ContractCoverage[];
      return rows[0] ?? null;
    },
    staleTime: 5 * 60 * 1000,
    // Si la migración todavía no se aplicó, la pantalla no muestra el aviso en
    // vez de reventar. Nunca inventa un "cubierto" que no comprobó.
    retry: false,
  });
}

/** Texto listo para pantalla. Un solo lugar para que los cuatro consumidores no diverjan. */
export function coverageLabel(c: ContractCoverage | null | undefined): {
  tone: "success" | "warning" | "destructive" | "muted";
  title: string;
  detail: string;
} | null {
  if (!c) return null;
  const fin = c.end_date ? new Date(c.end_date + "T12:00:00").toLocaleDateString("es-CR") : null;
  const ini = c.start_date ? new Date(c.start_date + "T12:00:00").toLocaleDateString("es-CR") : null;

  if (c.coverage === "cubierto") {
    return {
      tone: "success",
      title: "Dentro de contrato",
      detail: fin ? `Vigencia hasta el ${fin}.` : "Contrato sin fecha de vencimiento.",
    };
  }
  if (c.coverage === "fuera_de_vigencia") {
    return {
      tone: "destructive",
      title: "Fuera de vigencia",
      detail: fin
        ? `El contrato del cliente corrió ${ini ? `del ${ini} ` : ""}hasta el ${fin}.`
        : "La fecha del caso no cae dentro de ningún contrato del cliente.",
    };
  }
  return {
    tone: "warning",
    title: "Sin contrato",
    detail: "Este cliente no tiene un contrato registrado que respalde el caso.",
  };
}
