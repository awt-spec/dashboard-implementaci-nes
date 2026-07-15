import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductModule {
  id: string;
  product_id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProductVersion {
  id: string;
  product_id: string;
  version_label: string;
  release_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

// ── Products ───────────────────────────────────────────────────────────────
export function useProducts(includeInactive = false) {
  return useQuery({
    queryKey: ["products", includeInactive],
    queryFn: async () => {
      let q = (supabase.from("products").select("*") as any);
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q.order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as Product[];
    },
  });
}

export function useUpsertProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Product> & { code: string; name: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const payload: any = {
        code: input.code.trim(), name: input.name.trim(),
        description: input.description ?? null, is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      };
      if (input.id) {
        const { error } = await (supabase.from("products").update(payload).eq("id", input.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("products").insert([{ ...payload, created_by: userData?.user?.id }]) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("products").delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

// ── Modules ──────────────────────────────────────────────────────────────
export function useProductModules(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-modules", productId],
    enabled: !!productId,
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await (
        supabase.from("product_modules").select("*").eq("product_id", productId).order("sort_order", { ascending: true }) as any
      );
      if (error) throw error;
      return (data || []) as ProductModule[];
    },
  });
}

export function useUpsertProductModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ProductModule> & { product_id: string; code: string; name: string }) => {
      const payload: any = {
        product_id: input.product_id, code: input.code.trim(), name: input.name.trim(),
        description: input.description ?? null, is_active: input.is_active ?? true, sort_order: input.sort_order ?? 0,
      };
      if (input.id) {
        const { error } = await (supabase.from("product_modules").update(payload).eq("id", input.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("product_modules").insert([payload]) as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["product-modules", vars.product_id] }),
  });
}

export function useDeleteProductModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; productId: string }) => {
      const { error } = await (supabase.from("product_modules").delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["product-modules", vars.productId] }),
  });
}

// ── Versions ───────────────────────────────────────────────────────────────
export function useProductVersions(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-versions", productId],
    enabled: !!productId,
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await (
        supabase.from("product_versions").select("*").eq("product_id", productId).order("release_date", { ascending: false }) as any
      );
      if (error) throw error;
      return (data || []) as ProductVersion[];
    },
  });
}

export function useUpsertProductVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ProductVersion> & { product_id: string; version_label: string }) => {
      const payload: any = {
        product_id: input.product_id, version_label: input.version_label.trim(),
        release_date: input.release_date ?? null, notes: input.notes ?? null, is_active: input.is_active ?? true,
      };
      if (input.id) {
        const { error } = await (supabase.from("product_versions").update(payload).eq("id", input.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("product_versions").insert([payload]) as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["product-versions", vars.product_id] }),
  });
}

export function useDeleteProductVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; productId: string }) => {
      const { error } = await (supabase.from("product_versions").delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["product-versions", vars.productId] }),
  });
}

// ── Version ↔ Modules (N:M) ─────────────────────────────────────────────────
export function useVersionModules(versionId: string | undefined) {
  return useQuery({
    queryKey: ["version-modules", versionId],
    enabled: !!versionId,
    queryFn: async () => {
      if (!versionId) return [];
      const { data, error } = await (
        supabase.from("version_modules").select("module_id").eq("version_id", versionId) as any
      );
      if (error) throw error;
      return ((data || []) as Array<{ module_id: string }>).map(r => r.module_id);
    },
  });
}

export function useSetVersionModules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId, moduleIds }: { versionId: string; moduleIds: string[] }) => {
      const { data: current, error: readErr } = await (
        supabase.from("version_modules").select("module_id").eq("version_id", versionId) as any
      );
      if (readErr) throw readErr;
      const currentIds = new Set(((current ?? []) as Array<{ module_id: string }>).map(r => r.module_id));
      const incoming = new Set(moduleIds);
      const toAdd = moduleIds.filter(id => !currentIds.has(id));
      const toRemove = Array.from(currentIds).filter(id => !incoming.has(id));
      if (toRemove.length > 0) {
        const { error } = await (supabase.from("version_modules").delete().eq("version_id", versionId).in("module_id", toRemove) as any);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const { error } = await (supabase.from("version_modules").insert(toAdd.map(m => ({ version_id: versionId, module_id: m }))) as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["version-modules", vars.versionId] }),
  });
}
