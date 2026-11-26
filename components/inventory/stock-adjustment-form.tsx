
"use client";

import { useState } from "react";

import {
  adjustStock,
  type MaterialStock,
  type ProductStock,
} from "@/lib/inventory";

import { formatNumber } from "@/lib/format";
import { useLanguage } from "@/contexts/language-context";

import { MasterDialog } from "@/components/masters/master-dialog";

import {
  MasterField,
  MasterSelect,
} from "@/components/masters/master-form-fields";

import { Textarea } from "@/components/ui/textarea";

export function StockAdjustmentForm({
  materials,
  products,
  onSuccess,
  onCancel,
}: {
  materials: MaterialStock[];
  products: ProductStock[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();

  const [itemType, setItemType] =
    useState<"material" | "product">("material");

  const [itemId, setItemId] = useState("");

  const [direction, setDirection] =
    useState("increase");

  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const options =
    itemType === "material"
      ? materials.map((item) => ({
          id: item.inventory_item_id,
          name: item.name,
          sku: item.sku,
          unit: item.unit ?? "",
          physical: item.current_stock ?? 0,
          available: item.current_stock ?? 0,
        }))
      : products.map((item) => ({
          id: item.product_id,
          name: item.name,
          sku: item.sku,
          unit: "packet",
          physical: item.physical_stock ?? 0,
          available: item.available_stock ?? 0,
        }));

  const selectedItem = options.find(
    (item) => String(item.id) === itemId
  );

  const enteredQuantity = Number(quantity);

  const signedQuantity =
    direction === "increase"
      ? enteredQuantity
      : -enteredQuantity;

  const projectedStock =
    (selectedItem?.physical ?? 0) +
    signedQuantity;

  async function handleSave() {
    if (!selectedItem || selectedItem.id == null) {
      throw new Error("Select an inventory item.");
    }

    if (
      !quantity.trim() ||
      !Number.isFinite(enteredQuantity) ||
      enteredQuantity <= 0
    ) {
      throw new Error(
        "Enter a positive adjustment quantity."
      );
    }

    if (
      (
        itemType === "product" ||
        selectedItem.unit === "piece"
      ) &&
      !Number.isInteger(enteredQuantity)
    ) {
      throw new Error(
        "This item requires a whole number quantity."
      );
    }

    if (
      Math.abs(
        enteredQuantity * 1000 -
        Math.round(enteredQuantity * 1000)
      ) > 0.000001
    ) {
      throw new Error(
        "Quantity supports up to three decimal places."
      );
    }

    if (
      direction === "decrease" &&
      enteredQuantity > selectedItem.available
    ) {
      throw new Error(
        "Adjustment exceeds available stock."
      );
    }

    if (!reason.trim()) {
      throw new Error(
        "Enter the reason for this adjustment."
      );
    }

    await adjustStock({
      itemType,
      itemId: selectedItem.id,
      quantity: signedQuantity,
      reason,
    });
  }

  return (
    <MasterDialog
      title="Stock adjustment"
      description="Record a documented inventory correction."
      onSave={handleSave}
      onSuccess={onSuccess}
      onCancel={onCancel}
    >
      <div className="space-y-4">
        <MasterSelect
          label="Inventory type"
          value={itemType}
          onChange={(value) => {
            setItemType(
              value as "material" | "product"
            );
            setItemId("");
            setQuantity("");
          }}
        >
          <option value="material">
            {t("Raw materials and packaging")}
          </option>

          <option value="product">
            {t("Finished goods")}
          </option>
        </MasterSelect>

        <MasterSelect
          label="Inventory item"
          value={itemId}
          onChange={setItemId}
          required
        >
          <option value="">
            {t("Select item")}
          </option>

          {options.map((item) => (
            <option
              key={item.id}
              value={item.id ?? ""}
            >
              {item.name} ({item.sku})
            </option>
          ))}
        </MasterSelect>

        {selectedItem && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">
                {t("Physical stock")}
              </p>

              <p className="font-semibold">
                {formatNumber(selectedItem.physical)}{" "}
                {selectedItem.unit}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                {t("Available stock")}
              </p>

              <p className="font-semibold">
                {formatNumber(selectedItem.available)}{" "}
                {selectedItem.unit}
              </p>
            </div>
          </div>
        )}

        <MasterSelect
          label="Adjustment type"
          value={direction}
          onChange={setDirection}
        >
          <option value="increase">
            {t("Increase stock")}
          </option>

          <option value="decrease">
            {t("Decrease stock")}
          </option>
        </MasterSelect>

        <MasterField
          label={`Quantity (${selectedItem?.unit ?? "unit"})`}
          type="number"
          value={quantity}
          onChange={setQuantity}
          min={0}
          step="any"
          required
        />

        <div className="space-y-2">
          <label
            htmlFor="adjustment-reason"
            className="text-sm font-medium"
          >
            {t("Adjustment reason")} *
          </label>

          <Textarea
            id="adjustment-reason"
            value={reason}
            onChange={(e) =>
              setReason(e.target.value)
            }
            placeholder={t(
              "Explain why this stock correction is necessary."
            )}
            required
          />
        </div>

        {selectedItem &&
          quantity.trim() &&
          Number.isFinite(enteredQuantity) &&
          enteredQuantity > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <span className="text-sm font-medium">
                {t("Projected physical stock")}
              </span>

              <span
                className={`text-xl font-bold ${
                  projectedStock < 0
                    ? "text-red-600"
                    : "text-indigo-700"
                }`}
              >
                {formatNumber(projectedStock)}{" "}
                {selectedItem.unit}
              </span>
            </div>
          )}

        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          {t(
            "Saving this adjustment immediately changes inventory and creates an auditable stock movement. Verify the quantity and reason before saving."
          )}
        </p>
      </div>
    </MasterDialog>
  );
}
