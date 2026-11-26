"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/language-context";
import { supabase } from "@/lib/supabase";
import { getLocalizedName, type LocalizedName } from "@/lib/localized-name";

export function useLocalizedStockName() {
  const { language } = useLanguage();
  const [names, setNames] = useState<{ products: Map<string, LocalizedName>; materials: Map<string, LocalizedName> }>({ products: new Map(), materials: new Map() });
  useEffect(() => {
    let active = true;
    async function load() {
      const [products, materials] = await Promise.all([
        supabase.from("products").select("sku,name,name_ta,name_hi"),
        supabase.from("inventory_items").select("sku,name,name_ta,name_hi"),
      ]);
      if (active) setNames({
        products: new Map((products.data ?? []).map(row => [row.sku, row])),
        materials: new Map((materials.data ?? []).map(row => [row.sku, row])),
      });
    }
    void load();
    return () => { active = false; };
  }, []);
  return (sku: string | null, original: string | null, category: string | null) => {
    const map = category === "finished_goods" || category === "finished_good" ? names.products : names.materials;
    const record = sku ? map.get(sku) : undefined;
    return record && record.name === original ? getLocalizedName(record, language) : original ?? "—";
  };
}
