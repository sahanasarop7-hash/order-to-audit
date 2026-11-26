"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  getSuppliers,
  getMaterials,
  type Supplier,
  type Material,
} from "@/lib/masters";

import {
  savePurchase,
  calculatePurchaseTotal,
  type PurchaseDetails,
  type PurchaseItemInput,
} from "@/lib/purchases";

import { formatCurrency } from "@/lib/format";
import { useLanguage } from "@/contexts/language-context";

import { Button } from "@/components/ui/button";

import { MasterDialog } from "@/components/masters/master-dialog";

import {
  MasterField,
  MasterSelect,
} from "@/components/masters/master-form-fields";

type PurchaseLine = {
  materialId: string;
  quantity: string;
  entryUnit: string;
  unitPrice: string;
};

function emptyLine(): PurchaseLine {
  return {
    materialId: "",
    quantity: "",
    entryUnit: "",
    unitPrice: "",
  };
}

function today() {
  return new Date().toLocaleDateString(
    "en-CA",
    { timeZone: "Asia/Kolkata" }
  );
}

function convertToBaseQuantity(
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

export function PurchaseForm({
  record,
  onSuccess,
  onCancel,
}: {
  record: PurchaseDetails | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [materials, setMaterials] =
    useState<Material[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [supplierId, setSupplierId] = useState(
    record?.supplier_id?.toString() ?? ""
  );

  const [invoiceNumber, setInvoiceNumber] =
    useState(record?.invoice_number ?? "");

  const [purchaseDate, setPurchaseDate] =
    useState(record?.purchase_date ?? today());

  const [lines, setLines] = useState<PurchaseLine[]>(
    record?.purchase_items.length
      ? record.purchase_items.map((item) => ({
          materialId: String(item.inventory_item_id),
          quantity: String(item.quantity),
          entryUnit:
            item.inventory_items?.unit ?? "",
          unitPrice: String(item.unit_price),
        }))
      : [emptyLine()]
  );

  useEffect(() => {
    let active = true;

    async function loadMasters() {
      try {
        const [supplierRows, materialRows] =
          await Promise.all([
            getSuppliers(),
            getMaterials(),
          ]);

        if (!active) return;

        setSuppliers(supplierRows);
        setMaterials(materialRows);
      } catch (error) {
        if (!active) return;

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load master data."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMasters();

    return () => {
      active = false;
    };
  }, []);

  function updateLine(
    index: number,
    values: Partial<PurchaseLine>
  ) {
    setLines((current) =>
      current.map((line, i) =>
        i === index
          ? { ...line, ...values }
          : line
      )
    );
  }

  function selectMaterial(
    index: number,
    materialId: string
  ) {
    const material = materials.find(
      (item) => String(item.id) === materialId
    );

    updateLine(index, {
      materialId,
      entryUnit: material?.unit ?? "",
      quantity: "",
      unitPrice: "",
    });
  }

  function removeLine(index: number) {
    setLines((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  function getLineQuantity(line: PurchaseLine) {
    return convertToBaseQuantity(
      Number(line.quantity) || 0,
      line.entryUnit
    );
  }

  const total = calculatePurchaseTotal(
    lines.map((line) => ({
      quantity: getLineQuantity(line),
      unit_price: Number(line.unitPrice) || 0,
    }))
  );

  async function handleSave() {
    if (loading || loadError) {
      throw new Error(
        "Master data is not available."
      );
    }

    if (!supplierId) {
      throw new Error("Select a supplier.");
    }

    if (!invoiceNumber.trim()) {
      throw new Error(
        "Enter the supplier invoice number."
      );
    }

    if (!purchaseDate || purchaseDate > today()) {
      throw new Error(
        "Enter a valid purchase date."
      );
    }

    if (!lines.length) {
      throw new Error(
        "Add at least one purchase item."
      );
    }

    const selectedSupplier = suppliers.find(
      (supplier) =>
        String(supplier.id) === supplierId
    );

    if (!selectedSupplier?.is_active) {
      throw new Error(
        "Select an active supplier."
      );
    }

    const usedMaterials = new Set<number>();

    const items: PurchaseItemInput[] =
      lines.map((line, index) => {
        const material = materials.find(
          (item) =>
            String(item.id) === line.materialId
        );

        if (!material?.is_active) {
          throw new Error(
            `Select an active material in row ${index + 1}.`
          );
        }

        if (usedMaterials.has(material.id)) {
          throw new Error(
            `${material.name} is listed more than once.`
          );
        }

        usedMaterials.add(material.id);

        const quantity = getLineQuantity(line);
        const unitPrice = Number(line.unitPrice);

        if (
          !line.quantity.trim() ||
          !Number.isFinite(quantity) ||
          quantity <= 0
        ) {
          throw new Error(
            `Enter a valid quantity for ${material.name}.`
          );
        }

        if (
          Math.abs(
            quantity * 1000 -
            Math.round(quantity * 1000)
          ) > 0.000001
        ) {
          throw new Error(
            `${material.name} supports up to three decimal places in its base unit.`
          );
        }

        if (
          material.unit === "piece" &&
          !Number.isInteger(quantity)
        ) {
          throw new Error(
            `${material.name} requires a whole number of pieces.`
          );
        }

        if (
          !line.unitPrice.trim() ||
          !Number.isFinite(unitPrice) ||
          unitPrice < 0
        ) {
          throw new Error(
            `Enter a valid unit price for ${material.name}.`
          );
        }

        if (
          Math.abs(
            unitPrice * 100 -
            Math.round(unitPrice * 100)
          ) > 0.000001
        ) {
          throw new Error(
            `Unit price for ${material.name} must have at most two decimal places.`
          );
        }

        return {
          inventory_item_id: material.id,
          quantity: Number(quantity.toFixed(3)),
          unit_price: unitPrice,
        };
      });

    await savePurchase({
      supplierId: Number(supplierId),
      invoiceNumber,
      purchaseDate,
      items,
      purchaseId: record?.id,
    });
  }

  return (
    <MasterDialog
      title={
        record
          ? "Edit purchase draft"
          : "New purchase"
      }
      description="Enter supplier invoice and material receipt details."
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
        <div className="space-y-5">
          <MasterSelect
            label="Supplier"
            value={supplierId}
            onChange={setSupplierId}
            required
          >
            <option value="">
              {t("Select supplier")}
            </option>

            {suppliers
              .filter(
                (supplier) =>
                  supplier.is_active ||
                  String(supplier.id) === supplierId
              )
              .map((supplier) => (
                <option
                  key={supplier.id}
                  value={supplier.id}
                >
                  {supplier.name} (
                  {supplier.supplier_code})
                  {!supplier.is_active
                    ? " - Inactive"
                    : ""}
                </option>
              ))}
          </MasterSelect>

          <div className="grid gap-4 sm:grid-cols-2">
            <MasterField
              label="Supplier invoice number"
              value={invoiceNumber}
              onChange={setInvoiceNumber}
              required
            />

            <MasterField
              label="Purchase date"
              type="date"
              value={purchaseDate}
              onChange={setPurchaseDate}
              required
            />
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <h3 className="font-semibold">
              {t("Purchase items")}
            </h3>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  emptyLine(),
                ])
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("Add item")}
            </Button>
          </div>

          {lines.map((line, index) => {
            const material = materials.find(
              (item) =>
                String(item.id) === line.materialId
            );

            const baseQuantity =
              getLineQuantity(line);

            const lineTotal =
              calculatePurchaseTotal([
                {
                  quantity: baseQuantity,
                  unit_price:
                    Number(line.unitPrice) || 0,
                },
              ]);

            const units =
              material?.unit === "kg"
                ? ["kg", "g"]
                : material?.unit === "litre"
                  ? ["litre", "ml"]
                  : material?.unit === "piece"
                    ? ["piece"]
                    : [];

            return (
              <div
                key={index}
                className="space-y-3 rounded-xl border bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {t("Item")} {index + 1}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={lines.length === 1}
                    onClick={() => removeLine(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>

                <MasterSelect
                  label="Material"
                  value={line.materialId}
                  onChange={(value) =>
                    selectMaterial(index, value)
                  }
                  required
                >
                  <option value="">
                    {t("Select material")}
                  </option>

                  {materials
                    .filter(
                      (item) =>
                        item.is_active ||
                        String(item.id) ===
                          line.materialId
                    )
                    .map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={lines.some(
                          (other, otherIndex) =>
                            otherIndex !== index &&
                            other.materialId ===
                              String(item.id)
                        )}
                      >
                        {item.name} ({item.sku})
                      </option>
                    ))}
                </MasterSelect>

                <div className="grid grid-cols-2 gap-3">
                  <MasterField
                    label="Quantity"
                    type="number"
                    value={line.quantity}
                    onChange={(value) =>
                      updateLine(index, {
                        quantity: value,
                      })
                    }
                    min={0}
                    step="any"
                    required
                  />

                  <MasterSelect
                    label="Unit"
                    value={line.entryUnit}
                    onChange={(value) =>
                      updateLine(index, {
                        entryUnit: value,
                      })
                    }
                    required
                  >
                    <option value="">
                      {t("Select unit")}
                    </option>

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

                <MasterField
                  label={`Unit price (INR/${material?.unit ?? "unit"})`}
                  type="number"
                  value={line.unitPrice}
                  onChange={(value) =>
                    updateLine(index, {
                      unitPrice: value,
                    })
                  }
                  min={0}
                  step="0.01"
                  required
                />

                {material && (
                  <div className="space-y-1 text-xs text-slate-500">
                    <p>
                      {t("Base quantity")}:{" "}
                      {baseQuantity.toFixed(3)}{" "}
                      {material.unit}
                    </p>

                    <p>
                      {t("Current average cost")}:{" "}
                      {Number(
                        material.average_unit_cost
                      ).toFixed(3)}{" "}
                      INR/{material.unit}
                    </p>
                  </div>
                )}

                <div className="flex justify-between border-t pt-3 text-sm">
                  <span className="text-slate-600">
                    {t("Line total")}
                  </span>

                  <span className="font-semibold">
                    {formatCurrency(lineTotal)}
                  </span>
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <span className="font-medium">
              {t("Purchase total")}
            </span>

            <span className="text-xl font-bold text-indigo-700">
              {formatCurrency(total)}
            </span>
          </div>

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            {t(
              "This purchase will be saved as a draft. Inventory and average material costs will update only after posting."
            )}
          </p>
        </div>
      )}
    </MasterDialog>
  );
}