"use client";
import { getLocalizedName } from "@/lib/localized-name";

import {
  useState,
  useEffect,
} from "react";

import {
  Plus,
  Trash2,
  Copy,
  LockKeyhole,
  Loader2,
} from "lucide-react";

import { toast } from "sonner";

import {
  getBOMs,
  getProducts,
  getMaterials,
  saveBOM,
  setBOMActive,
  isBOMUsed,
  createBOMVersion,
  type BOMDetails,
  type Product,
  type Material,
} from "@/lib/masters";

import { useLanguage } from "@/contexts/language-context";
import { formatNumber } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";

import { MasterSection } from "./master-section";
import { MasterDialog } from "./master-dialog";

import {
  MasterField,
  MasterSelect,
  ActiveField,
} from "./master-form-fields";

type RecipeRow = {
  key: number;
  materialId: string;
  quantity: string;
};

function BOMForm({
  record,
  onSuccess,
  onCancel,
}: {
  record: BOMDetails | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t, language } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const [productId, setProductId] = useState(
    String(record?.product_id ?? "")
  );

  const [output, setOutput] = useState(
    String(record?.expected_output ?? "")
  );

  const [active, setActive] = useState(
    record?.is_active ?? true
  );

  const [rows, setRows] = useState<RecipeRow[]>(
    record?.bom_items.length
      ? record.bom_items.map((item, index) => ({
          key: index + 1,
          materialId: String(item.inventory_item_id),
          quantity: String(item.planned_quantity),
        }))
      : [
          {
            key: 1,
            materialId: "",
            quantity: "",
          },
        ]
  );

  const [nextKey, setNextKey] = useState(
    (record?.bom_items.length ?? 1) + 1
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [used, setUsed] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [productRows, materialRows, usedStatus] =
          await Promise.all([
            getProducts(),
            getMaterials(),
            record
              ? isBOMUsed(record.id)
              : Promise.resolve(false),
          ]);

        setProducts(productRows);
        setMaterials(materialRows);
        setUsed(usedStatus);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load recipe details."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [record]);

  function addRow() {
    setRows((previous) => [
      ...previous,
      {
        key: nextKey,
        materialId: "",
        quantity: "",
      },
    ]);

    setNextKey((previous) => previous + 1);
  }

  function updateRow(
    key: number,
    field: "materialId" | "quantity",
    value: string
  ) {
    setRows((previous) =>
      previous.map((row) =>
        row.key === key
          ? { ...row, [field]: value }
          : row
      )
    );
  }

  function removeRow(key: number) {
    setRows((previous) =>
      previous.filter((row) => row.key !== key)
    );
  }

  async function handleCopy() {
    if (!record || copying) return;

    setCopying(true);

    try {
      const id = await createBOMVersion(record.id);

      toast.success(
        `New BOM version created (ID: ${id}).`
      );

      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to create BOM version."
      );
    } finally {
      setCopying(false);
    }
  }

  async function handleSave() {
    if (loading || copying || loadError) {
      throw new Error(
        "Recipe details are not ready."
      );
    }

    // Used recipes permit status changes only.

    if (used && record) {
      await setBOMActive(record.id, active);
      return;
    }

    const expectedOutput = Number(output);

    if (!productId) {
      throw new Error("Select a product.");
    }

    if (
      !Number.isInteger(expectedOutput) ||
      expectedOutput <= 0
    ) {
      throw new Error(
        "Expected output must be a positive whole number."
      );
    }

    if (rows.length === 0) {
      throw new Error(
        "Add at least one material."
      );
    }

    const selectedIds = rows.map(
      (row) => row.materialId
    );

    if (
      new Set(selectedIds).size !== selectedIds.length
    ) {
      throw new Error(
        "Duplicate materials are not allowed."
      );
    }

    const items = rows.map((row) => {
      const material = materials.find(
        (item) =>
          String(item.id) === row.materialId
      );

      const quantity = Number(row.quantity);

      if (!material || !material.is_active) {
        throw new Error(
          "Select an active material for every row."
        );
      }

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        throw new Error(
          `Enter a valid quantity for ${material.name}.`
        );
      }

      if (
        material.unit === "piece" &&
        !Number.isInteger(quantity)
      ) {
        throw new Error(
          `${material.name} requires a whole number.`
        );
      }

      return {
        inventory_item_id: material.id,
        planned_quantity: quantity,
      };
    });

    await saveBOM({
      productId: Number(productId),
      expectedOutput,
      items,
      isActive: active,
      bomId: record?.id,
    });
  }

  return (
    <MasterDialog
      title={
        record
          ? `BOM — Version ${record.version}`
          : "Create bill of materials"
      }
      description="Define the materials required for a production batch."
      onSave={handleSave}
      onSuccess={onSuccess}
      onCancel={onCancel}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("Loading data...")}
        </div>
      ) : loadError ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </p>
      ) : (
        <>
          {used && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 font-medium text-amber-900">
                <LockKeyhole size={17} />
                {t("Protected recipe")}
              </div>

              <p className="text-sm text-amber-800">
                {t(
                  "This BOM has been used in production. Create a new version to modify its recipe."
                )}
              </p>

              <Button
                type="button"
                variant="outline"
                disabled={copying}
                onClick={handleCopy}
              >
                <Copy className="mr-2 h-4 w-4" />

                {t(
                  copying
                    ? "Creating..."
                    : "Create new version"
                )}
              </Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <MasterSelect
              label="Product"
              value={productId}
              onChange={setProductId}
              disabled={!!record}
              required
            >
              <option value="">
                {t("Select product")}
              </option>

              {products
                .filter(
                  (product) =>
                    product.is_active ||
                    String(product.id) === productId
                )
                .map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product ? getLocalizedName(product, language) : "—"} — {product.sku}
                  </option>
                ))}
            </MasterSelect>

            <MasterField
              label="Expected output (packets)"
              value={output}
              onChange={setOutput}
              type="number"
              min={1}
              step="1"
              disabled={used}
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                {t("Recipe materials")}
              </h3>

              {!used && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addRow}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {t("Add material")}
                </Button>
              )}
            </div>

            {rows.map((row, index) => {
              const material = materials.find(
                (item) =>
                  String(item.id) === row.materialId
              );

              return (
                <div
                  key={row.key}
                  className="space-y-3 rounded-lg border bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      {t("Material")} {index + 1}
                    </span>

                    {!used && rows.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t("Remove material")}
                        onClick={() => removeRow(row.key)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MasterSelect
                      label="Material"
                      value={row.materialId}
                      onChange={(value) =>
                        updateRow(
                          row.key,
                          "materialId",
                          value
                        )
                      }
                      disabled={used}
                      required
                    >
                      <option value="">
                        {t("Select material")}
                      </option>

                      {materials
                        .filter(
                          (item) =>
                            String(item.id) ===
                              row.materialId ||
                            (item.is_active &&
                              !rows.some(
                                (other) =>
                                  other.key !== row.key &&
                                  other.materialId ===
                                    String(item.id)
                              ))
                        )
                        .map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            {item ? getLocalizedName(item, language) : "—"} ({t(item.unit ?? "—")})
                          </option>
                        ))}
                    </MasterSelect>

                    <MasterField
                      label={
                        material
                          ? `${t("Planned quantity")} (${t(material.unit ?? "—")})`
                          : "Planned quantity"
                      }
                      value={row.quantity}
                      onChange={(value) =>
                        updateRow(
                          row.key,
                          "quantity",
                          value
                        )
                      }
                      type="number"
                      min={
                        material?.unit === "piece"
                          ? 1
                          : 0.001
                      }
                      step={
                        material?.unit === "piece"
                          ? "1"
                          : "0.001"
                      }
                      disabled={used}
                      required
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <ActiveField
            value={active}
            onChange={setActive}
          />
        </>
      )}
    </MasterDialog>
  );
}

export function BOMsTab({
  canEdit,
}: {
  canEdit: boolean;
}) {
  const { t, language } = useLanguage();

  const [status, setStatus] = useState("all");

  return (
    <MasterSection<BOMDetails>
      title="Bill of materials"
      description="Manage production recipes and BOM versions."
      addLabel="Create BOM"
      canEdit={canEdit}
      load={getBOMs}
      searchValue={(row) =>
        `${row.products?.name ?? ""} ${
          row.products?.sku ?? ""
        } ${row.version} ${row.bom_items
          .map(
            (item) =>
              item.inventory_items?.name ?? ""
          )
          .join(" ")}`
      }
      filterRow={(row) =>
        status === "all" ||
        row.is_active === (status === "active")
      }
      filters={
        <select
          aria-label={t("Status")}
          value={status}
          onChange={(e) =>
            setStatus(e.target.value)
          }
          className="h-10 rounded-md border bg-white px-3 text-sm"
        >
          <option value="all">
            {t("All statuses")}
          </option>
          <option value="active">
            {t("active")}
          </option>
          <option value="inactive">
            {t("inactive")}
          </option>
        </select>
      }
      columns={[
        {
          key: "product",
          header: t("Product"),
          render: (row) => (
            <div>
              <p className="font-medium text-slate-900">
                {row.products ? getLocalizedName(row.products, language) : "—"}
              </p>
              <p className="text-xs text-slate-500">
                {row.products?.sku}
              </p>
            </div>
          ),
          sortValue: (row) =>
            row.products?.name ?? "",
        },
        {
          key: "version",
          header: t("Version"),
          render: (row) => (
            <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
              V{row.version}
            </span>
          ),
          sortValue: (row) => row.version,
        },
        {
          key: "output",
          header: t("Expected output"),
          render: (row) =>
            `${formatNumber(row.expected_output)} ${t("packets")}`,
          sortValue: (row) =>
            row.expected_output,
        },
        {
          key: "materials",
          header: t("Recipe materials"),
          render: (row) => (
            <div className="min-w-48 space-y-1">
              {row.bom_items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 text-xs"
                >
                  <span>
                    {item.inventory_items ? getLocalizedName(item.inventory_items, language) : "—"}
                  </span>

                  <span className="font-medium">
                    {formatNumber(
                      item.planned_quantity
                    )}{" "}
                    {t(item.inventory_items?.unit ?? "—")}
                  </span>
                </div>
              ))}
            </div>
          ),
          sortValue: (row) =>
            row.bom_items.length,
        },
        {
          key: "status",
          header: t("Status"),
          render: (row) => (
            <StatusBadge
              status={
                row.is_active
                  ? "active"
                  : "inactive"
              }
            />
          ),
        },
      ]}
      renderForm={(record, onSuccess, onCancel) => (
        <BOMForm
          record={record}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )}
    />
  );
}