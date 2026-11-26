import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type ProductionRun =
  Database["public"]["Tables"]["production_runs"]["Row"];

export type ProductionConsumption =
  Database["public"]["Tables"]["production_consumption"]["Row"];

export type ProductionItemInput = {
  inventory_item_id: number;
  actual_quantity: number;
};

export type ProductionInput = {
  batchNumber: string;
  bomId: number;
  productionDate: string;
  plannedOutput: number;
  actualOutput: number;
  damagedPouches: number;
  labourCost: number;
  utilityCost: number;
  items: ProductionItemInput[];
  runId?: number;
};

// Retrieve production batches and material consumption.

export async function getProductionRuns() {
  const { data, error } = await supabase
    .from("production_runs")
    .select(`
      *,
      boms (
        id,
        version,
        expected_output,
        products (
          id,
          name,
          sku,
          selling_price,
          packet_size_g
        )
      ),
      production_consumption (
        *,
        inventory_items (
          id,
          name,
          sku,
          category,
          unit,
          average_unit_cost
        )
      )
    `)
    .order("production_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type ProductionDetails =
  Awaited<ReturnType<typeof getProductionRuns>>[number];

// Retrieve current material stock and average costs.

export async function getMaterialStock() {
  const { data, error } = await supabase
    .from("material_stock")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type MaterialStock =
  Awaited<ReturnType<typeof getMaterialStock>>[number];

// Retrieve posted production summaries.

export async function getProductionSummaries() {
  const { data, error } = await supabase
    .from("production_summary_report")
    .select("*")
    .order("production_date", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type ProductionSummary =
  Awaited<
    ReturnType<typeof getProductionSummaries>
  >[number];

// Retrieve planned versus actual material variance.

export async function getProductionVariances() {
  const { data, error } = await supabase
    .from("production_variance_report")
    .select("*")
    .order("production_date", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type ProductionVariance =
  Awaited<
    ReturnType<typeof getProductionVariances>
  >[number];

// Create or edit a production draft.

export async function saveProduction(
  input: ProductionInput
) {
  const { data, error } = await supabase.rpc(
    "secure_save_production",
    {
      p_batch_number: input.batchNumber.trim(),
      p_bom_id: input.bomId,
      p_production_date: input.productionDate,
      p_planned_output: input.plannedOutput,
      p_actual_output: input.actualOutput,
      p_damaged_pouches: input.damagedPouches,
      p_labour_cost: input.labourCost,
      p_utility_cost: input.utilityCost,
      p_items: input.items,
      ...(input.runId !== undefined
        ? { p_run_id: input.runId }
        : {}),
    }
  );

  if (error) throw new Error(error.message);

  return data;
}

// Post production and update stock atomically.

export async function postProduction(
  runId: number
) {
  const { error } = await supabase.rpc(
    "secure_post_production",
    {
      p_run_id: runId,
    }
  );

  if (error) throw new Error(error.message);
}

// Cancel an unposted production draft.

export async function cancelProduction(
  runId: number,
  reason: string
) {
  if (!reason.trim()) {
    throw new Error(
      "A cancellation reason is required."
    );
  }

  const { error } = await supabase.rpc(
    "secure_cancel_production",
    {
      p_run_id: runId,
      p_reason: reason.trim(),
    }
  );

  if (error) throw new Error(error.message);
}

// Reverse an eligible posted production batch.

export async function reverseProduction(
  runId: number,
  reason: string
) {
  if (!reason.trim()) {
    throw new Error(
      "A reversal reason is required."
    );
  }

  const { error } = await supabase.rpc(
    "secure_reverse_production",
    {
      p_run_id: runId,
      p_reason: reason.trim(),
    }
  );

  if (error) throw new Error(error.message);
}
export const VARIANCE_TOLERANCE = 3;

// Scale a BOM quantity for the planned output.

export function scaleBOMQuantity(
  standardQuantity: number,
  standardOutput: number,
  plannedOutput: number,
  unit: string
) {
  if (
    standardOutput <= 0 ||
    plannedOutput <= 0
  ) {
    return 0;
  }

  const quantity =
    (standardQuantity * plannedOutput) /
    standardOutput;

  // Packaging pieces cannot be fractional.

  if (unit === "piece") {
    return Math.ceil(quantity);
  }

  // Weight and volume support three decimal places.

  return Number(quantity.toFixed(3));
}

// Calculate actual minus planned consumption.

export function calculateVariance(
  planned: number,
  actual: number
) {
  const difference = Number(
    (actual - planned).toFixed(3)
  );

  const percentage =
    planned > 0
      ? (difference / planned) * 100
      : null;

  const isAlert =
    planned === 0
      ? actual > 0
      : Math.abs(percentage ?? 0) >
        VARIANCE_TOLERANCE;

  return {
    difference,
    percentage,
    isAlert,
  };
}

// Calculate production yield.

export function calculateYield(
  plannedOutput: number,
  actualOutput: number
) {
  if (plannedOutput <= 0) return 0;

  return (
    (actualOutput / plannedOutput) * 100
  );
}

// Calculate estimated production costing.

export function calculateProductionCost(
  items: {
    quantity: number;
    unitCost: number;
  }[],
  labourCost: number,
  utilityCost: number,
  actualOutput: number,
  sellingPrice: number
) {
  const materialCost = items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unitCost,
    0
  );

  const totalCost =
    materialCost +
    labourCost +
    utilityCost;

  const costPerPacket =
    actualOutput > 0
      ? totalCost / actualOutput
      : null;

  const marginPerPacket =
    costPerPacket !== null
      ? sellingPrice - costPerPacket
      : null;

  const marginPercentage =
    sellingPrice > 0 &&
    marginPerPacket !== null
      ? (marginPerPacket / sellingPrice) * 100
      : null;

  return {
    materialCost,
    totalCost,
    costPerPacket,
    marginPerPacket,
    marginPercentage,
  };
}

// Convert entered quantities into inventory base units.

export function toBaseQuantity(
  quantity: number,
  entryUnit: string
) {
  if (
    entryUnit === "g" ||
    entryUnit === "ml"
  ) {
    return quantity / 1000;
  }

  return quantity;
}