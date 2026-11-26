import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type Purchase =
  Database["public"]["Tables"]["purchases"]["Row"];

export type PurchaseItem =
  Database["public"]["Tables"]["purchase_items"]["Row"];

export type PurchaseItemInput = {
  inventory_item_id: number;
  quantity: number;
  unit_price: number;
};

export type PurchaseInput = {
  supplierId: number;
  invoiceNumber: string;
  purchaseDate: string;
  items: PurchaseItemInput[];
  purchaseId?: number;
};

// Retrieve purchases with supplier and material details.

export async function getPurchases() {
  const { data, error } = await supabase
    .from("purchases")
    .select(`
      *,
      suppliers (
        name,
        supplier_code,
        gstin,
        state
      ),
      purchase_items (
        *,
        inventory_items (
          name,
          sku,
          category,
          unit
        )
      )
    `)
    .order("purchase_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type PurchaseDetails =
  Awaited<ReturnType<typeof getPurchases>>[number];

// Create or update a draft purchase.

export async function savePurchase(
  input: PurchaseInput
) {
  const { data, error } = await supabase.rpc(
    "secure_save_purchase",
    {
      p_supplier_id: input.supplierId,
      p_invoice_number: input.invoiceNumber.trim(),
      p_purchase_date: input.purchaseDate,
      p_items: input.items,
      ...(input.purchaseId !== undefined
        ? { p_purchase_id: input.purchaseId }
        : {}),
    }
  );

  if (error) throw new Error(error.message);

  return data;
}

// Post a purchase and update inventory.

export async function postPurchase(
  purchaseId: number
) {
  const { error } = await supabase.rpc(
    "secure_post_purchase",
    {
      p_purchase_id: purchaseId,
    }
  );

  if (error) throw new Error(error.message);
}

// Cancel a draft without changing stock.

export async function cancelPurchase(
  purchaseId: number,
  reason: string
) {
  if (!reason.trim()) {
    throw new Error(
      "A cancellation reason is required."
    );
  }

  const { error } = await supabase.rpc(
    "secure_cancel_purchase",
    {
      p_purchase_id: purchaseId,
      p_reason: reason.trim(),
    }
  );

  if (error) throw new Error(error.message);
}

// Reverse an eligible posted purchase.

export async function reversePurchase(
  purchaseId: number,
  reason: string
) {
  if (!reason.trim()) {
    throw new Error(
      "A reversal reason is required."
    );
  }

  const { error } = await supabase.rpc(
    "secure_reverse_purchase",
    {
      p_purchase_id: purchaseId,
      p_reason: reason.trim(),
    }
  );

  if (error) throw new Error(error.message);
}

// Calculate the displayed purchase value.
// Round each line to paise before adding.

export function calculatePurchaseTotal(
  items: {
    quantity: number;
    unit_price: number;
  }[]
) {
  const totalPaise = items.reduce(
    (sum, item) =>
      sum +
      Math.round(
        item.quantity * item.unit_price * 100
      ),
    0
  );

  return totalPaise / 100;
}