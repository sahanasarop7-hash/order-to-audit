import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Tables = Database["public"]["Tables"];

export type Product = Tables["products"]["Row"];
export type Customer = Tables["customers"]["Row"];
export type Supplier = Tables["suppliers"]["Row"];
export type Material = Tables["inventory_items"]["Row"];
export type BOM = Tables["boms"]["Row"];
export type BOMItem = Tables["bom_items"]["Row"];

export type ProductInput = Tables["products"]["Insert"];
export type CustomerInput = Tables["customers"]["Insert"];
export type SupplierInput = Tables["suppliers"]["Insert"];
export type MaterialInput = Tables["inventory_items"]["Insert"];

// Products

export async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function saveProduct(
  values: ProductInput,
  id?: number
) {
  const query = id
    ? supabase.from("products").update(values).eq("id", id)
    : supabase.from("products").insert(values);

  const { error } = await query.select("id").single();

  if (error) throw new Error(error.message);
}

// Customers

export async function getCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function saveCustomer(
  values: CustomerInput,
  id?: number
) {
  const query = id
    ? supabase.from("customers").update(values).eq("id", id)
    : supabase.from("customers").insert(values);

  const { error } = await query.select("id").single();

  if (error) throw new Error(error.message);
}

// Suppliers

export async function getSuppliers() {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function saveSupplier(
  values: SupplierInput,
  id?: number
) {
  const query = id
    ? supabase.from("suppliers").update(values).eq("id", id)
    : supabase.from("suppliers").insert(values);

  const { error } = await query.select("id").single();

  if (error) throw new Error(error.message);
}

// Raw materials and packaging

export async function getMaterials() {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function saveMaterial(
  values: MaterialInput,
  id?: number
) {
  const payload = {
    name: values.name,
    name_ta: values.name_ta,
    name_hi: values.name_hi,
    sku: values.sku,
    category: values.category,
    unit: values.unit,
    reorder_level: values.reorder_level,
    is_active: values.is_active,
  };

  const query = id
    ? supabase
        .from("inventory_items")
        .update(payload)
        .eq("id", id)
    : supabase
        .from("inventory_items")
        .insert(payload);

  const { error } = await query.select("id").single();

  if (error) throw new Error(error.message);
}

// Bill of materials

export async function getBOMs() {
  const { data, error } = await supabase
    .from("boms")
    .select(`
      *,
      products(name, name_ta, name_hi, sku),
      bom_items(
        *,
        inventory_items(name, name_ta, name_hi, sku, unit)
      )
    `)
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function createBOMVersion(id: number) {
  const { data, error } = await supabase.rpc(
    "secure_create_bom_version",
    {
      p_bom_id: id,
    }
  );

  if (error) throw new Error(error.message);

  return data;
}
export type BOMDetails =
  Awaited<ReturnType<typeof getBOMs>>[number];

export type BOMMaterialInput = {
  inventory_item_id: number;
  planned_quantity: number;
};

export async function saveBOM(values: {
  productId: number;
  expectedOutput: number;
  items: BOMMaterialInput[];
  isActive: boolean;
  bomId?: number;
}) {
  const { data, error } = await supabase.rpc(
    "secure_save_bom",
    {
      p_product_id: values.productId,
      p_expected_output: values.expectedOutput,
      p_items: values.items,
      p_is_active: values.isActive,
      ...(values.bomId !== undefined
        ? { p_bom_id: values.bomId }
        : {}),
    }
  );

  if (error) throw new Error(error.message);

  return data;
}

export async function setBOMActive(
  id: number,
  active: boolean
) {
  const { error } = await supabase.rpc(
    "secure_set_bom_active",
    {
      p_bom_id: id,
      p_is_active: active,
    }
  );

  if (error) throw new Error(error.message);
}

export async function isBOMUsed(id: number) {
  const { count, error } = await supabase
    .from("production_runs")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("bom_id", id);

  if (error) throw new Error(error.message);

  return (count ?? 0) > 0;
}