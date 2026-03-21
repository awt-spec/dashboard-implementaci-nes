import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to load/save presentation customization data per client from DB.
 * Each data_key is a separate row in presentation_data table.
 */
export function usePresentationData<T>(clientId: string, dataKey: string, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  // Load from DB on mount / client change
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    supabase
      .from("presentation_data")
      .select("data")
      .eq("client_id", clientId)
      .eq("data_key", dataKey)
      .maybeSingle()
      .then(({ data: row }) => {
        if (cancelled) return;
        if (row?.data != null) {
          setData(row.data as T);
        } else {
          setData(fallback);
        }
        setLoaded(true);
      });

    return () => { cancelled = true; };
  }, [clientId, dataKey]);

  // Save to DB (upsert)
  const save = useCallback(async (newData: T) => {
    setData(newData);
    await supabase
      .from("presentation_data")
      .upsert(
        { client_id: clientId, data_key: dataKey, data: newData as any },
        { onConflict: "client_id,data_key" }
      );
  }, [clientId, dataKey]);

  return { data, save, loaded };
}

/**
 * Load all presentation data keys for a client in one query.
 */
export function useAllPresentationData(clientId: string) {
  const [dataMap, setDataMap] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    supabase
      .from("presentation_data")
      .select("data_key, data")
      .eq("client_id", clientId)
      .then(({ data: rows }) => {
        if (cancelled) return;
        const map: Record<string, any> = {};
        for (const row of rows || []) {
          map[row.data_key] = row.data;
        }
        setDataMap(map);
        setLoaded(true);
      });

    return () => { cancelled = true; };
  }, [clientId]);

  const save = useCallback(async (dataKey: string, newData: any) => {
    setDataMap(prev => ({ ...prev, [dataKey]: newData }));
    await supabase
      .from("presentation_data")
      .upsert(
        { client_id: clientId, data_key: dataKey, data: newData },
        { onConflict: "client_id,data_key" }
      );
  }, [clientId]);

  return { dataMap, save, loaded };
}
