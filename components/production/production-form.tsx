"use client";

import { getLocalizedName } from "@/lib/localized-name";



import { useEffect, useState } from "react";
import { Calculator, AlertTriangle } from "lucide-react";

import {
  getBOMs,
  getProducts,
  type BOMDetails,
  type Product,
} from "@/lib/masters";

import {
  getMaterialStock,
  saveProduction,
  scaleBOMQuantity,
  calculateVariance,
  calculateYield,
  calculateProductionCost,
  toBaseQuantity,
  type MaterialStock,
  type ProductionDetails,
} from "@/lib/production";

import {
  formatCurrency,
  formatNumber,
} from "@/lib/format";

import { useLanguage } from "@/contexts/language-context";

import { Button } from "@/components/ui/button";
import { MasterDialog } from "@/components/masters/master-dialog";

import {
  MasterField,
  MasterSelect,
} from "@/components/masters/master-form-fields";

type ConsumptionLine = {
  materialId: number;
  actualQuantity: string;
  entryUnit: string;
};

function today() {
  return new Date().toLocaleDateString(
    "en-CA",
    { timeZone: "Asia/Kolkata" }
  );
}

function validInteger(
  value: string,
  minimum: number
) {
  return (
    value.trim() !== "" &&
    Number.isInteger(Number(value)) &&
    Number(value) >= minimum
  );
}

function validMoney(value: string) {
  const number = Number(value);

  return (
    value.trim() !== "" &&
    Number.isFinite(number) &&
    number >= 0 &&
    Math.abs(
      number * 100 -
      Math.round(number * 100)
    ) < 0.000001
  );
}

export function ProductionForm({
  record,
  onSuccess,
  onCancel,
}: {
  record: ProductionDetails | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t, language } = useLanguage();

  const [boms, setBoms] =
    useState<BOMDetails[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [stock, setStock] =
    useState<MaterialStock[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [batchNumber, setBatchNumber] =
    useState(record?.batch_number ?? "");

  const [productionDate, setProductionDate] =
    useState(record?.production_date ?? today());

  const [productId, setProductId] = useState(
    String(record?.boms?.products?.id ?? "")
  );

  const [bomId, setBomId] = useState(
    String(record?.bom_id ?? "")
  );

  const [plannedOutput, setPlannedOutput] =
    useState(String(record?.planned_output ?? ""));

  const [actualOutput, setActualOutput] =
    useState(String(record?.actual_output ?? ""));

  const [damagedPouches, setDamagedPouches] =
    useState(String(record?.damaged_pouches ?? 0));

  const [labourCost, setLabourCost] =
    useState(String(record?.labour_cost ?? 0));

  const [utilityCost, setUtilityCost] =
    useState(String(record?.utility_cost ?? 0));

  const [lines, setLines] =
    useState<ConsumptionLine[]>(
      record?.production_consumption.map(
        (item) => ({
          materialId: item.inventory_item_id,
          actualQuantity: String(
            item.actual_quantity
          ),
          entryUnit:
            item.inventory_items?.unit ?? "",
        })
      ) ?? []
    );

  // Load BOM recipes, products and inventory.

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [bomRows, stockRows, productRows] =
          await Promise.all([
            getBOMs(),
            getMaterialStock(),
            getProducts(),
          ]);

        if (!active) return;

        setBoms(bomRows);
        setStock(stockRows);
        setProducts(productRows);
      } catch (error) {
        if (!active) return;

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load production data."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  // Only active BOMs belonging to active products
  // are available for new production batches.

  const availableBoms = boms.filter(
    (bom) =>
      (
        bom.is_active &&
        products.some(
          (product) =>
            product.id === bom.product_id &&
            product.is_active
        )
      ) ||
      String(bom.id) === bomId
  );

  const productOptions = products.filter(
    (product) =>
      availableBoms.some(
        (bom) => bom.product_id === product.id
      )
  );

  const selectedProduct = products.find(
    (product) =>
      String(product.id) === productId
  );

  const sellingPrice =
    selectedProduct?.selling_price ?? 0;

  const selectedBOM = boms.find(
    (bom) => String(bom.id) === bomId
  );

  const productBoms = availableBoms.filter(
    (bom) =>
      String(bom.product_id) === productId
  );

  function selectProduct(value: string) {
    setProductId(value);
    setBomId("");
    setLines([]);
  }

  function selectBOM(value: string) {
    setBomId(value);

    const bom = boms.find(
      (item) => String(item.id) === value
    );

    if (!bom) {
      setLines([]);
      return;
    }

    setPlannedOutput(
      String(bom.expected_output)
    );

    setActualOutput("");

    setLines(
      bom.bom_items.map((item) => ({
        materialId: item.inventory_item_id,
        actualQuantity: "",
        entryUnit:
          item.inventory_items?.unit ?? "",
      }))
    );
  }

  function updateLine(
    materialId: number,
    values: Partial<ConsumptionLine>
  ) {
    setLines((current) =>
      current.map((line) =>
        line.materialId === materialId
          ? { ...line, ...values }
          : line
      )
    );
  }

  // Calculate planned quantities, actual consumption,
  // current stock and material variance.

  const materialRows =
    selectedBOM?.bom_items.map((item) => {
      const material = item.inventory_items;

      const line = lines.find(
        (entry) =>
          entry.materialId ===
          item.inventory_item_id
      );

      const stockItem = stock.find(
        (entry) =>
          entry.inventory_item_id ===
          item.inventory_item_id
      );

      const baseUnit = material?.unit ?? "";

      const planned = scaleBOMQuantity(
        item.planned_quantity,
        selectedBOM.expected_output,
        Number(plannedOutput) || 0,
        baseUnit
      );

      const actual = toBaseQuantity(
        Number(line?.actualQuantity ?? ""),
        line?.entryUnit ?? baseUnit
      );

      const available =
        stockItem?.current_stock ?? 0;

      const unitCost =
        stockItem?.average_unit_cost ?? 0;

      const hasActual =
        (line?.actualQuantity ?? "").trim() !== "";

      const validActual =
        hasActual &&
        Number.isFinite(actual) &&
        actual >= 0;

      const variance = calculateVariance(
        planned,
        validActual ? actual : 0
      );

      return {
        materialId: item.inventory_item_id,
        name: material ? getLocalizedName(material, language) : t("Unknown material"),
        sku: material?.sku ?? "",
        baseUnit,
        planned,
        actual,
        available,
        unitCost,
        hasActual,
        validActual,
        variance,
        line,
        plannedShortage: planned > available,
        actualShortage:
          validActual && actual > available,
      };
    }) ?? [];

  // Copy planned quantities into actual consumption.

  function usePlannedConsumption() {
    setLines(
      materialRows.map((row) => ({
        materialId: row.materialId,
        actualQuantity: String(row.planned),
        entryUnit: row.baseUnit,
      }))
    );
  }

  const allActualEntered =
    materialRows.length > 0 &&
    materialRows.every((row) => row.validActual);

  const yieldPercentage = calculateYield(
    Number(plannedOutput) || 0,
    Number(actualOutput) || 0
  );

  const hasOutput =
    validInteger(actualOutput, 0) &&
    validInteger(plannedOutput, 1);

  const yieldAlert =
    hasOutput &&
    Math.abs(yieldPercentage - 100) > 3;

  const varianceAlerts = materialRows.filter(
    (row) =>
      row.validActual &&
      row.variance.isAlert
  ).length;

  const shortages = materialRows.filter(
    (row) =>
      row.plannedShortage ||
      row.actualShortage
  ).length;

  // Estimate production costs using current material
  // costs and the selected product selling price.

  const costing = calculateProductionCost(
    materialRows.map((row) => ({
      quantity: row.validActual ? row.actual : 0,
      unitCost: row.unitCost,
    })),
    Number(labourCost) || 0,
    Number(utilityCost) || 0,
    Number(actualOutput) || 0,
    sellingPrice
  );

  // Validate and save the production draft.

  async function handleSave() {
    if (loading || loadError) {
      throw new Error(
        "Production master data is unavailable."
      );
    }

    if (!batchNumber.trim()) {
      throw new Error("Enter a batch number.");
    }

    if (
      !productionDate ||
      productionDate > today()
    ) {
      throw new Error(
        "Enter a valid production date."
      );
    }

    if (!selectedProduct?.is_active) {
      throw new Error(
        "Select an active product."
      );
    }

    if (
      !selectedBOM?.is_active ||
      selectedBOM.product_id !== selectedProduct.id
    ) {
      throw new Error(
        "Select an active BOM for the selected product."
      );
    }

    if (!validInteger(plannedOutput, 1)) {
      throw new Error(
        "Planned output must be a positive whole number."
      );
    }

    if (!validInteger(actualOutput, 0)) {
      throw new Error(
        "Actual output must be a non-negative whole number."
      );
    }

    if (!validInteger(damagedPouches, 0)) {
      throw new Error(
        "Damaged pouches must be a non-negative whole number."
      );
    }

    if (
      !validMoney(labourCost) ||
      !validMoney(utilityCost)
    ) {
      throw new Error(
        "Enter valid labour and utility costs."
      );
    }

    if (!materialRows.length) {
      throw new Error(
        "The selected BOM has no materials."
      );
    }

    const items = materialRows.map((row) => {
      if (!row.validActual) {
        throw new Error(
          `Enter valid actual consumption for ${row.name}.`
        );
      }

      if (
        row.baseUnit === "piece" &&
        !Number.isInteger(row.actual)
      ) {
        throw new Error(
          `${row.name} requires whole pieces.`
        );
      }

      if (
        Math.abs(
          row.actual * 1000 -
          Math.round(row.actual * 1000)
        ) > 0.000001
      ) {
        throw new Error(
          `${row.name} supports up to three decimal places in its base unit.`
        );
      }

      return {
        inventory_item_id: row.materialId,
        actual_quantity: Number(
          row.actual.toFixed(3)
        ),
      };
    });

    await saveProduction({
      batchNumber,
      bomId: Number(bomId),
      productionDate,
      plannedOutput: Number(plannedOutput),
      actualOutput: Number(actualOutput),
      damagedPouches: Number(damagedPouches),
      labourCost: Number(labourCost),
      utilityCost: Number(utilityCost),
      items,
      runId: record?.id,
    });
  }

  return (
    <MasterDialog
      title={
        record
          ? "Edit production draft"
          : "New production batch"
      }
      description="Plan production and record actual material consumption."
      onSave={handleSave}
      onSuccess={onSuccess}
      onCancel={onCancel}
    >
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {t("Loading data...")}
        </p>
      ) : loadError ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </p>
      ) : (
        <div className="space-y-6">

          {/* Batch information */}

          <div className="grid gap-4 sm:grid-cols-2">
            <MasterField
              label="Batch number"
              value={batchNumber}
              onChange={setBatchNumber}
              placeholder="BATCH-002"
              required
            />

            <MasterField
              label="Production date"
              type="date"
              value={productionDate}
              onChange={setProductionDate}
              required
            />
          </div>

          {/* Product and BOM selection */}

          <MasterSelect
            label="Product"
            value={productId}
            onChange={selectProduct}
            required
          >
            <option value="">
              {t("Select product")}
            </option>

            {productOptions.map((product) => (
              <option
                key={product.id}
                value={product.id}
              >
                {product ? getLocalizedName(product, language) : "—"} ({product.sku})
              </option>
            ))}
          </MasterSelect>

          <MasterSelect
            label="BOM version"
            value={bomId}
            onChange={selectBOM}
            required
            disabled={!productId}
          >
            <option value="">
              {t("Select BOM")}
            </option>

            {productBoms.map((bom) => (
              <option key={bom.id} value={bom.id}>
                V{bom.version} —{" "}
                {bom.expected_output}{" "}
                {t("packets")}
                {!bom.is_active
                  ? " - Inactive"
                  : ""}
              </option>
            ))}
          </MasterSelect>

          {selectedBOM && (
            <>
              {/* Production output */}

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">
                  {t("Production output")}
                </h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MasterField
                    label="Planned output (packets)"
                    type="number"
                    value={plannedOutput}
                    onChange={setPlannedOutput}
                    min={1}
                    step="1"
                    required
                  />

                  <MasterField
                    label="Actual good output (packets)"
                    type="number"
                    value={actualOutput}
                    onChange={setActualOutput}
                    min={0}
                    step="1"
                    required
                  />
                </div>

                <MasterField
                  label="Damaged pouches"
                  type="number"
                  value={damagedPouches}
                  onChange={setDamagedPouches}
                  min={0}
                  step="1"
                  required
                />

                {hasOutput && (
                  <div
                    className={`flex items-center justify-between rounded-xl border p-4 ${
                      yieldAlert
                        ? "border-amber-200 bg-amber-50"
                        : "border-emerald-200 bg-emerald-50"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {t("Production yield")}
                      </p>

                      <p className="text-xs text-slate-600">
                        {yieldAlert
                          ? t("Outside 3% tolerance")
                          : t("Within tolerance")}
                      </p>
                    </div>

                    <span className="text-xl font-bold">
                      {yieldPercentage.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Material consumption */}

              <div className="space-y-3 border-t pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {t("Material consumption")}
                  </h3>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={usePlannedConsumption}
                    disabled={
                      !validInteger(plannedOutput, 1)
                    }
                  >
                    <Calculator className="mr-1 h-4 w-4" />
                    {t("Use planned quantities")}
                  </Button>
                </div>

                <p className="text-xs text-slate-500">
                  {t(
                    "Planned quantities are automatically scaled from the selected BOM."
                  )}
                </p>

                {shortages > 0 && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                    <p>
                      {shortages}{" "}
                      {t(
                        "material(s) have insufficient stock. Check availability before posting."
                      )}
                    </p>
                  </div>
                )}

                {materialRows.map((row) => {
                  const units =
                    row.baseUnit === "kg"
                      ? ["kg", "g"]
                      : row.baseUnit === "litre"
                        ? ["litre", "ml"]
                        : [row.baseUnit];

                  return (
                    <div
                      key={row.materialId}
                      className="space-y-3 rounded-xl border bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {row.name}
                          </p>

                          <p className="text-xs text-slate-500">
                            {row.sku}
                          </p>
                        </div>

                        {row.validActual && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              row.variance.isAlert
                                ? "bg-red-100 text-red-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {row.variance.percentage === null
                              ? row.actual > 0
                                ? t("Unplanned consumption")
                                : "—"
                              : `${
                                  row.variance.percentage > 0
                                    ? "+"
                                    : ""
                                }${row.variance.percentage.toFixed(2)}%`}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">
                            {t("Planned")}
                          </p>

                          <p className="font-semibold">
                            {formatNumber(row.planned)}{" "}
                            {row.baseUnit}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            {t("Available stock")}
                          </p>

                          <p
                            className={`font-semibold ${
                              row.plannedShortage ||
                              row.actualShortage
                                ? "text-red-600"
                                : "text-emerald-700"
                            }`}
                          >
                            {formatNumber(row.available)}{" "}
                            {row.baseUnit}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <MasterField
                          label="Actual consumption"
                          type="number"
                          value={
                            row.line?.actualQuantity ?? ""
                          }
                          onChange={(value) =>
                            updateLine(row.materialId, {
                              actualQuantity: value,
                            })
                          }
                          min={0}
                          step="any"
                          required
                        />

                        <MasterSelect
                          label="Unit"
                          value={
                            row.line?.entryUnit ??
                            row.baseUnit
                          }
                          onChange={(value) =>
                            updateLine(row.materialId, {
                              entryUnit: value,
                            })
                          }
                          required
                        >
                          {units.map((unit) => (
                            <option
                              key={unit}
                              value={unit}
                            >
                              {unit}
                            </option>
                          ))}
                        </MasterSelect>
                      </div>

                      {row.validActual && (
                        <div className="space-y-1 text-xs text-slate-600">
                          <p>
                            {t("Base quantity")}:{" "}
                            {row.actual.toFixed(3)}{" "}
                            {row.baseUnit}
                          </p>

                          <p>
                            {t("Quantity variance")}:{" "}
                            {row.variance.difference > 0
                              ? "+"
                              : ""}
                            {row.variance.difference}{" "}
                            {row.baseUnit}
                          </p>

                          <p>
                            {t("Estimated material cost")}:{" "}
                            {formatCurrency(
                              row.actual * row.unitCost
                            )}
                          </p>
                        </div>
                      )}

                      {row.actualShortage && (
                        <p className="text-xs font-medium text-red-600">
                          {t("Actual consumption shortage")}:{" "}
                          {(
                            row.actual - row.available
                          ).toFixed(3)}{" "}
                          {row.baseUnit}
                        </p>
                      )}
                    </div>
                  );
                })}

                {allActualEntered && (
                  <div className="rounded-lg border bg-white p-3 text-sm">
                    {t("Material variance alerts")}:{" "}
                    <strong
                      className={
                        varianceAlerts > 0
                          ? "text-red-600"
                          : "text-emerald-600"
                      }
                    >
                      {varianceAlerts}
                    </strong>
                  </div>
                )}
              </div>

              {/* Production expenses */}

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">
                  {t("Production expenses")}
                </h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MasterField
                    label="Labour cost (INR)"
                    type="number"
                    value={labourCost}
                    onChange={setLabourCost}
                    min={0}
                    step="0.01"
                    required
                  />

                  <MasterField
                    label="Utility cost (INR)"
                    type="number"
                    value={utilityCost}
                    onChange={setUtilityCost}
                    min={0}
                    step="0.01"
                    required
                  />
                </div>
              </div>

              {/* Estimated production costing */}

              <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                <h3 className="font-semibold text-indigo-900">
                  {t("Estimated production costing")}
                </h3>

                {!allActualEntered && (
                  <p className="text-xs text-amber-700">
                    {t(
                      "Enter all actual quantities for a complete cost estimate."
                    )}
                  </p>
                )}

                <div className="flex justify-between text-sm">
                  <span>{t("Material cost")}</span>

                  <strong>
                    {formatCurrency(costing.materialCost)}
                  </strong>
                </div>

                <div className="flex justify-between text-sm">
                  <span>{t("Labour cost")}</span>

                  <strong>
                    {formatCurrency(
                      Number(labourCost) || 0
                    )}
                  </strong>
                </div>

                <div className="flex justify-between text-sm">
                  <span>{t("Utility cost")}</span>

                  <strong>
                    {formatCurrency(
                      Number(utilityCost) || 0
                    )}
                  </strong>
                </div>

                <div className="flex justify-between border-t border-indigo-200 pt-3">
                  <span className="font-semibold">
                    {t("Total production cost")}
                  </span>

                  <strong className="text-lg text-indigo-700">
                    {formatCurrency(costing.totalCost)}
                  </strong>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-indigo-200 pt-3">
                  <div>
                    <p className="text-xs text-slate-600">
                      {t("Cost per packet")}
                    </p>

                    <p className="text-lg font-bold">
                      {allActualEntered &&
                      hasOutput &&
                      costing.costPerPacket !== null
                        ? formatCurrency(
                            costing.costPerPacket
                          )
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600">
                      {t("Selling price")}
                    </p>

                    <p className="text-lg font-bold">
                      {formatCurrency(sellingPrice)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600">
                      {t("Margin per packet")}
                    </p>

                    <p
                      className={`text-lg font-bold ${
                        (costing.marginPerPacket ?? 0) < 0
                          ? "text-red-600"
                          : "text-emerald-700"
                      }`}
                    >
                      {allActualEntered &&
                      hasOutput &&
                      costing.marginPerPacket !== null
                        ? formatCurrency(
                            costing.marginPerPacket
                          )
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600">
                      {t("Margin percentage")}
                    </p>

                    <p className="text-lg font-bold">
                      {allActualEntered &&
                      hasOutput &&
                      costing.marginPercentage !== null
                        ? `${costing.marginPercentage.toFixed(2)}%`
                        : "—"}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-indigo-700">
                  {t(
                    "Estimated using current weighted average material costs. Final costs are captured when production is posted."
                  )}
                </p>
              </div>
            </>
          )}

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            {t(
              "Saving this draft will not change inventory. Stock movements occur only after posting production."
            )}
          </p>
        </div>
      )}
    </MasterDialog>
  );
}
