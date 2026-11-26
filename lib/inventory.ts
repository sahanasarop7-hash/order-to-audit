import { supabase } from "@/lib/supabase";

export { getMaterialStock } from "@/lib/production";
export { getProductStock } from "@/lib/sales";

export type { MaterialStock } from "@/lib/production";
export type { ProductStock } from "@/lib/sales";

// Retrieve traceable stock movements.

export async function getStockLedger() {
  const { data, error } = await supabase
    .from("stock_ledger_report")
    .select("*")
    .order("movement_date", {
      ascending: false,
    })
    .order("movement_id", {
      ascending: false,
    });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type StockLedgerRow =
  Awaited<ReturnType<typeof getStockLedger>>[number];

// Retrieve stock balances for a selected period.

export async function getStockPeriodReport(
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase.rpc(
    "secure_stock_period_report",
    {
      p_start_date: startDate,
      p_end_date: endDate,
    }
  );

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type StockPeriodRow =
  Awaited<
    ReturnType<typeof getStockPeriodReport>
  >[number];

// Reorder alerts returned by the database.

export type ReorderAlert = {
  item_id: number;
  sku: string;
  item_name: string;
  category: string;
  unit: string;
  available_stock: number;
  reorder_level: number;
  shortage_quantity: number;
  alert_status: string;
};

export async function getReorderAlerts() {
  const { data, error } = await supabase.rpc(
    "secure_reorder_alerts"
  );

  if (error) throw new Error(error.message);

  return Array.isArray(data)
    ? (data as unknown as ReorderAlert[])
    : [];
}

// Controlled inventory correction.

export type StockAdjustmentInput = {
  itemType: "material" | "product";
  itemId: number;
  quantity: number;
  reason: string;
};

export async function adjustStock(
  input: StockAdjustmentInput
) {
  if (
    !Number.isFinite(input.quantity) ||
    input.quantity === 0
  ) {
    throw new Error(
      "Adjustment quantity must be non-zero."
    );
  }

  if (!input.reason.trim()) {
    throw new Error(
      "An adjustment reason is required."
    );
  }

  const { error } = await supabase.rpc(
    "secure_adjust_stock",
    {
      p_quantity: input.quantity,
      p_reason: input.reason.trim(),

      ...(input.itemType === "material"
        ? {
            p_inventory_item_id: input.itemId,
          }
        : {
            p_product_id: input.itemId,
          }),
    }
  );

  if (error) throw new Error(error.message);
}