
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Boxes,
  Package,
  Wallet,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  ClipboardList,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { useLocalizedStockName } from "@/lib/use-localized-stock-name";
import { useLanguage } from "@/contexts/language-context";

import {
  getMaterialStock,
  getProductStock,
  getStockLedger,
  getReorderAlerts,
  type MaterialStock,
  type ProductStock,
  type StockLedgerRow,
  type ReorderAlert,
} from "@/lib/inventory";

import {
  formatCurrency,
  formatNumber,
  formatDate,
} from "@/lib/format";

import { Button } from "@/components/ui/button";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

import {
  DataTable,
  type Column,
} from "@/components/shared/data-table";

import { StatusBadge } from "@/components/shared/status-badge";

import { StockAdjustmentForm } from "@/components/inventory/stock-adjustment-form";

export default function InventoryPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const localizedName = useLocalizedStockName();

  const role = profile?.role ?? "";

  const allowed = [
    "admin",
    "production",
    "accountant",
    "owner",
  ].includes(role);

  const canAdjust = role === "admin";

  const [materials, setMaterials] =
    useState<MaterialStock[]>([]);

  const [products, setProducts] =
    useState<ProductStock[]>([]);

  const [ledger, setLedger] =
    useState<StockLedgerRow[]>([]);

  const [alerts, setAlerts] =
    useState<ReorderAlert[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [adjustmentOpen, setAdjustmentOpen] =
    useState(false);

  const [category, setCategory] =
    useState("all");

  const [movementType, setMovementType] =
    useState("all");

  const [ledgerCategory, setLedgerCategory] =
    useState("all");

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  // Load inventory balances and movement history.

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        materialRows,
        productRows,
        ledgerRows,
        alertRows,
      ] = await Promise.all([
        getMaterialStock(),
        getProductStock(),
        getStockLedger(),
        getReorderAlerts(),
      ]);

      setMaterials(materialRows);
      setProducts(productRows);
      setLedger(ledgerRows);
      setAlerts(alertRows);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load inventory."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void refresh();
  }, [allowed, refresh]);

  // Inventory summary calculations.

  const totalMaterialValue = materials.reduce(
    (sum, item) =>
      sum + (item.stock_value ?? 0),
    0
  );

  const totalFinishedStock = products.reduce(
    (sum, item) =>
      sum + (item.physical_stock ?? 0),
    0
  );

  const totalReserved = products.reduce(
    (sum, item) =>
      sum + (item.reserved_stock ?? 0),
    0
  );

  const totalAvailable = products.reduce(
    (sum, item) =>
      sum + (item.available_stock ?? 0),
    0
  );

  const rawMaterialCount = materials.filter(
    (item) => item.category === "raw_material"
  ).length;

  const packagingCount = materials.filter(
    (item) => item.category === "packaging"
  ).length;

  const cards = [
    {
      label: "Inventory materials",
      value: formatNumber(materials.length),
      detail:
        `${rawMaterialCount} ${t("raw materials")} · ` +
        `${packagingCount} ${t("packaging items")}`,
      icon: Boxes,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Material stock value",
      value: formatCurrency(totalMaterialValue),
      detail: t("Weighted average valuation"),
      icon: Wallet,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Finished goods stock",
      value: formatNumber(totalFinishedStock),
      detail:
        `${formatNumber(totalAvailable)} ${t("available packets")}`,
      icon: Package,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Reorder alerts",
      value: formatNumber(alerts.length),
      detail: t("Items requiring attention"),
      icon: AlertTriangle,
      color: "bg-amber-50 text-amber-600",
    },
  ];

  // Display friendly category names.

  function categoryLabel(value: string | null) {
    switch (value) {
      case "raw_material":
        return t("Raw material");

      case "packaging":
        return t("Packaging");

      case "finished_goods":
      case "finished_good":
        return t("Finished goods");

      default:
        return t(
          (value ?? "Unknown").replaceAll("_", " ")
        );
    }
  }

  function movementLabel(value: string | null) {
    switch (value) {
      case "opening":
        return t("Opening stock");

      case "purchase":
        return t("Purchase receipt");

      case "production_issue":
        return t("Production issue");

      case "production_receipt":
        return t("Production receipt");

      case "dispatch":
        return t("Sales dispatch");

      case "adjustment":
        return t("Stock adjustment");

      default:
        return value ?? "—";
    }
  }

  function stockStatus(
    quantity: number,
    sku: string | null,
    itemCategory?: string | null
  ) {
    if (quantity <= 0) {
      return "out_of_stock";
    }

    const alert = alerts.find(
      (item) =>
        item.sku === sku &&
        (
          !itemCategory ||
          item.category === itemCategory
        )
    );

    return alert
      ? "low_stock"
      : "in_stock";
  }

  // Filter material inventory.

  const filteredMaterials = materials.filter(
    (item) =>
      category === "all" ||
      item.category === category
  );

  // Filter ledger rows without changing
  // their original running balances.

  const filteredLedger = ledger.filter(
    (item) =>
      (
        movementType === "all" ||
        item.movement_type === movementType
      ) &&
      (
        ledgerCategory === "all" ||
        item.category === ledgerCategory
      ) &&
      (
        !fromDate ||
        (item.movement_date ?? "") >= fromDate
      ) &&
      (
        !toDate ||
        (item.movement_date ?? "") <= toDate
      )
  );

  const ledgerCategories = Array.from(
    new Set(
      ledger
        .map((item) => item.category)
        .filter(
          (value): value is string =>
            value !== null
        )
    )
  );

  // Material inventory table.

  const materialColumns: Column<MaterialStock>[] = [
    {
      key: "sku",
      header: t("SKU"),
      render: (row) => (
        <span className="font-medium text-indigo-700">
          {row.sku}
        </span>
      ),
      sortValue: (row) => row.sku ?? "",
    },
    {
      key: "name",
      header: t("Material"),
      render: (row) => (
        <span className="font-medium">
          {localizedName(row.sku, row.name, "raw_material")}
        </span>
      ),
      sortValue: (row) => row.name ?? "",
    },
    {
      key: "category",
      header: t("Category"),
      render: (row) =>
        categoryLabel(row.category),
      sortValue: (row) =>
        row.category ?? "",
    },
    {
      key: "unit",
      header: t("Unit"),
      render: (row) => t(row.unit ?? "—"),
    },
    {
      key: "stock",
      header: t("Current stock"),
      render: (row) => (
        <span className="font-semibold">
          {formatNumber(row.current_stock ?? 0)}
        </span>
      ),
      sortValue: (row) =>
        row.current_stock ?? 0,
    },
    {
      key: "cost",
      header: t("Average unit cost"),
      render: (row) =>
        formatCurrency(
          row.average_unit_cost ?? 0
        ),
      sortValue: (row) =>
        row.average_unit_cost ?? 0,
    },
    {
      key: "value",
      header: t("Stock value"),
      render: (row) =>
        formatCurrency(row.stock_value ?? 0),
      sortValue: (row) =>
        row.stock_value ?? 0,
    },
    {
      key: "status",
      header: t("Status"),
      render: (row) => {
        const status = stockStatus(
          row.current_stock ?? 0,
          row.sku,
          row.category
        );

        return status === "in_stock" ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            {t("In stock")}
          </span>
        ) : (
          <StatusBadge status={status} />
        );
      },
    },
  ];

  // Finished goods table.

  const productColumns: Column<ProductStock>[] = [
    {
      key: "sku",
      header: t("SKU"),
      render: (row) => (
        <span className="font-medium text-indigo-700">
          {row.sku}
        </span>
      ),
      sortValue: (row) => row.sku ?? "",
    },
    {
      key: "product",
      header: t("Product"),
      render: (row) => (
        <span className="font-medium">
          {localizedName(row.sku, row.name, "finished_goods")}
        </span>
      ),
      sortValue: (row) => row.name ?? "",
    },
    {
      key: "size",
      header: t("Packet size"),
      render: (row) =>
        `${row.packet_size_g ?? 0} g`,
      sortValue: (row) =>
        row.packet_size_g ?? 0,
    },
    {
      key: "physical",
      header: t("Physical stock"),
      render: (row) =>
        formatNumber(row.physical_stock ?? 0),
      sortValue: (row) =>
        row.physical_stock ?? 0,
    },
    {
      key: "reserved",
      header: t("Reserved stock"),
      render: (row) => (
        <span className="font-medium text-amber-600">
          {formatNumber(row.reserved_stock ?? 0)}
        </span>
      ),
      sortValue: (row) =>
        row.reserved_stock ?? 0,
    },
    {
      key: "available",
      header: t("Available stock"),
      render: (row) => (
        <span className="font-semibold text-emerald-700">
          {formatNumber(row.available_stock ?? 0)}
        </span>
      ),
      sortValue: (row) =>
        row.available_stock ?? 0,
    },
    {
      key: "status",
      header: t("Status"),
      render: (row) => {
        const status = stockStatus(
          row.available_stock ?? 0,
          row.sku
        );

        return status === "in_stock" ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            {t("In stock")}
          </span>
        ) : (
          <StatusBadge status={status} />
        );
      },
    },
  ];

  // Stock ledger table.

  const ledgerColumns: Column<StockLedgerRow>[] = [
    {
      key: "date",
      header: t("Date"),
      render: (row) =>
        row.movement_date
          ? formatDate(row.movement_date)
          : "—",
      sortValue: (row) =>
        row.movement_date ?? "",
    },
    {
      key: "item",
      header: t("Inventory item"),
      render: (row) => (
        <div>
          <p className="font-medium">
            {localizedName(row.sku, row.item_name, row.category)}
          </p>

          <p className="text-xs text-slate-500">
            {row.sku}
          </p>
        </div>
      ),
      sortValue: (row) =>
        row.item_name ?? "",
    },
    {
      key: "category",
      header: t("Category"),
      render: (row) =>
        categoryLabel(row.category),
    },
    {
      key: "movement",
      header: t("Movement type"),
      render: (row) =>
        movementLabel(row.movement_type),
      sortValue: (row) =>
        row.movement_type ?? "",
    },
    {
      key: "unit",
      header: t("Unit"),
      render: (row) => t(row.unit ?? "—"),
    },
    {
      key: "in",
      header: t("Stock in"),
      render: (row) => (
        <span className="font-medium text-emerald-700">
          {(row.stock_in ?? 0) > 0
            ? `+${formatNumber(row.stock_in ?? 0)}`
            : "—"}
        </span>
      ),
      sortValue: (row) =>
        row.stock_in ?? 0,
    },
    {
      key: "out",
      header: t("Stock out"),
      render: (row) => (
        <span className="font-medium text-red-600">
          {Math.abs(row.stock_out ?? 0) > 0
            ? `-${formatNumber(
                Math.abs(row.stock_out ?? 0)
              )}`
            : "—"}
        </span>
      ),
      sortValue: (row) =>
        Math.abs(row.stock_out ?? 0),
    },
    {
      key: "balance",
      header: t("Running balance"),
      render: (row) => (
        <span className="font-semibold">
          {formatNumber(row.running_balance ?? 0)}
        </span>
      ),
      sortValue: (row) =>
        row.running_balance ?? 0,
    },
    {
      key: "reference",
      header: t("Reference"),
      render: (row) => (
        <div>
          <p className="text-xs font-medium">
            {t(
              (row.reference_type ?? "—")
                .replaceAll("_", " ")
            )}
          </p>

          <p className="text-xs text-slate-500">
            {row.reference_id == null
              ? "—"
              : `#${row.reference_id}`}
          </p>
        </div>
      ),
    },
  ];

  // Reorder alert table.

  const alertColumns: Column<ReorderAlert>[] = [
    {
      key: "sku",
      header: t("SKU"),
      render: (row) => row.sku,
      sortValue: (row) => row.sku,
    },
    {
      key: "name",
      header: t("Inventory item"),
      render: (row) => (
        <span className="font-medium">
          {localizedName(row.sku, row.item_name, row.category)}
        </span>
      ),
      sortValue: (row) => row.item_name,
    },
    {
      key: "category",
      header: t("Category"),
      render: (row) =>
        categoryLabel(row.category),
    },
    {
      key: "available",
      header: t("Available stock"),
      render: (row) =>
        `${formatNumber(row.available_stock)} ${t(row.unit)}`,
      sortValue: (row) =>
        row.available_stock,
    },
    {
      key: "reorder",
      header: t("Reorder level"),
      render: (row) =>
        `${formatNumber(row.reorder_level)} ${t(row.unit)}`,
      sortValue: (row) =>
        row.reorder_level,
    },
    {
      key: "shortage",
      header: t("Shortage"),
      render: (row) => (
        <span className="font-semibold text-red-600">
          {formatNumber(row.shortage_quantity)}{" "}
          {t(row.unit)}
        </span>
      ),
      sortValue: (row) =>
        row.shortage_quantity,
    },
    {
      key: "status",
      header: t("Status"),
      render: (row) => (
        <StatusBadge status={row.alert_status} />
      ),
    },
  ];

  if (!allowed) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        {t("Access denied.")}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Page header */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("Inventory")}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {t(
              "Monitor stock balances, inventory movements and reorder requirements."
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />

            {t("Refresh")}
          </Button>

          {canAdjust && (
            <Button
              disabled={loading || !!error}
              onClick={() => setAdjustmentOpen(true)}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />

              {t("Stock adjustment")}
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              <div
                className={`mb-3 inline-flex rounded-lg p-2 ${card.color}`}
              >
                <Icon className="h-5 w-5" />
              </div>

              <p className="text-sm text-slate-500">
                {t(card.label)}
              </p>

              <p className="mt-1 text-xl font-semibold text-slate-900">
                {loading || error
                  ? "—"
                  : card.value}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {loading || error
                  ? "—"
                  : card.detail}
              </p>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-slate-500">
          {t("Loading data...")}
        </div>
      ) : error ? (
        <div className="space-y-3 rounded-xl border bg-white p-6">
          <p className="text-sm text-red-600">
            {error}
          </p>

          <Button
            variant="outline"
            onClick={() => void refresh()}
          >
            {t("Retry")}
          </Button>
        </div>
      ) : (
        <Tabs
          defaultValue="materials"
          className="space-y-4"
        >
          <div className="overflow-x-auto">
            <TabsList className="w-max">
              <TabsTrigger value="materials">
                <Boxes className="mr-2 h-4 w-4" />
                {t("Materials")}
              </TabsTrigger>

              <TabsTrigger value="finished">
                <Package className="mr-2 h-4 w-4" />
                {t("Finished goods")}
              </TabsTrigger>

              <TabsTrigger value="ledger">
                <ClipboardList className="mr-2 h-4 w-4" />
                {t("Stock ledger")}
              </TabsTrigger>

              <TabsTrigger value="alerts">
                <AlertTriangle className="mr-2 h-4 w-4" />

                {t("Reorder alerts")}

                {alerts.length > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                    {alerts.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Raw materials and packaging */}

          <TabsContent
            value="materials"
            className="space-y-4"
          >
            <div>
              <h2 className="font-semibold">
                {t("Material inventory")}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {t(
                  "Raw materials and packaging balances derived from recorded stock movements."
                )}
              </p>
            </div>

            <DataTable
              data={filteredMaterials}
              columns={materialColumns}
              rowKey={(row) =>
                row.inventory_item_id ?? row.sku ?? ""
              }
              searchValue={(row) =>
                [
                  row.name,
                  row.sku,
                  row.category,
                  row.unit,
                ].join(" ")
              }
              searchPlaceholder={t(
                "Search materials..."
              )}
              filters={
                <select
                  aria-label={t("Category")}
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value)
                  }
                  className="h-10 rounded-md border bg-white px-3 text-sm"
                >
                  <option value="all">
                    {t("All categories")}
                  </option>

                  <option value="raw_material">
                    {t("Raw materials")}
                  </option>

                  <option value="packaging">
                    {t("Packaging")}
                  </option>
                </select>
              }
            />

            <p className="text-xs text-slate-500">
              {t(
                "Material stock value uses the current weighted average unit cost."
              )}
            </p>
          </TabsContent>

          {/* Finished goods */}

          <TabsContent
            value="finished"
            className="space-y-4"
          >
            <div>
              <h2 className="font-semibold">
                {t("Finished goods inventory")}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {t(
                  "Track physical stock, order reservations and available quantities."
                )}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Physical stock",
                  value: totalFinishedStock,
                  color: "text-slate-900",
                },
                {
                  label: "Reserved stock",
                  value: totalReserved,
                  color: "text-amber-600",
                },
                {
                  label: "Available stock",
                  value: totalAvailable,
                  color: "text-emerald-700",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border bg-white p-4"
                >
                  <p className="text-xs text-slate-500">
                    {t(item.label)}
                  </p>

                  <p
                    className={`mt-2 text-xl font-bold ${item.color}`}
                  >
                    {formatNumber(item.value)}
                  </p>

                  <p className="text-xs text-slate-500">
                    {t("packets")}
                  </p>
                </div>
              ))}
            </div>

            <DataTable
              data={products}
              columns={productColumns}
              rowKey={(row) => row.product_id}
              searchValue={(row) =>
                `${row.name} ${row.sku}`
              }
              searchPlaceholder={t(
                "Search finished goods..."
              )}
            />

            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800">
              <p className="font-semibold">
                {t("How stock reservations work")}
              </p>

              <p className="mt-1">
                {t(
                  "Approved and invoiced orders reserve stock. Dispatch reduces physical stock. Pending orders do not reserve inventory."
                )}
              </p>
            </div>
          </TabsContent>

          {/* Stock movement ledger */}

          <TabsContent
            value="ledger"
            className="space-y-4"
          >
            <div>
              <h2 className="font-semibold">
                {t("Stock movement ledger")}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {t(
                  "Trace every inventory receipt, issue, dispatch and adjustment."
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
              <div className="space-y-1">
                <label
                  htmlFor="ledger-from"
                  className="text-xs font-medium text-slate-600"
                >
                  {t("From")}
                </label>

                <input
                  id="ledger-from"
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) =>
                    setFromDate(e.target.value)
                  }
                  className="block h-10 rounded-md border bg-white px-3 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="ledger-to"
                  className="text-xs font-medium text-slate-600"
                >
                  {t("To")}
                </label>

                <input
                  id="ledger-to"
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) =>
                    setToDate(e.target.value)
                  }
                  className="block h-10 rounded-md border bg-white px-3 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="ledger-category"
                  className="text-xs font-medium text-slate-600"
                >
                  {t("Category")}
                </label>

                <select
                  id="ledger-category"
                  value={ledgerCategory}
                  onChange={(e) =>
                    setLedgerCategory(e.target.value)
                  }
                  className="block h-10 rounded-md border bg-white px-3 text-sm"
                >
                  <option value="all">
                    {t("All categories")}
                  </option>

                  {ledgerCategories.map((value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {categoryLabel(value)}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  setLedgerCategory("all");
                  setMovementType("all");
                }}
              >
                {t("Clear filters")}
              </Button>
            </div>

            <DataTable
              data={filteredLedger}
              columns={ledgerColumns}
              rowKey={(row) =>
                row.movement_id ?? ""
              }
              searchValue={(row) =>
                [
                  row.item_name,
                  row.sku,
                  row.category,
                  row.movement_type,
                  row.reference_type,
                  row.reference_id,
                ].join(" ")
              }
              searchPlaceholder={t(
                "Search stock movements..."
              )}
              filters={
                <select
                  aria-label={t("Movement type")}
                  value={movementType}
                  onChange={(e) =>
                    setMovementType(e.target.value)
                  }
                  className="h-10 rounded-md border bg-white px-3 text-sm"
                >
                  <option value="all">
                    {t("All movements")}
                  </option>

                  {[
                    "opening",
                    "purchase",
                    "production_issue",
                    "production_receipt",
                    "dispatch",
                    "adjustment",
                  ].map((value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {movementLabel(value)}
                    </option>
                  ))}
                </select>
              }
            />

            <p className="text-xs text-slate-500">
              {t(
                "Running balances are calculated from the complete stock history and are not recalculated when filters are applied."
              )}
            </p>
          </TabsContent>

          {/* Reorder alerts */}

          <TabsContent
            value="alerts"
            className="space-y-4"
          >
            <div>
              <h2 className="font-semibold">
                {t("Reorder alerts")}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {t(
                  "Identify materials requiring replenishment and finished goods requiring production."
                )}
              </p>
            </div>

            {alerts.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                <div>
                  <p className="font-semibold text-amber-800">
                    {alerts.length}{" "}
                    {t("items require attention")}
                  </p>

                  <p className="mt-1 text-sm text-amber-700">
                    {t(
                      "Review stock requirements before planning purchases or production."
                    )}
                  </p>
                </div>
              </div>
            )}

            <DataTable
              data={alerts}
              columns={alertColumns}
              rowKey={(row) =>
                `${row.category}-${row.item_id}`
              }
              searchValue={(row) =>
                [
                  row.item_name,
                  row.sku,
                  row.category,
                  row.alert_status,
                ].join(" ")
              }
              searchPlaceholder={t(
                "Search reorder alerts..."
              )}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Admin stock adjustment */}

      {adjustmentOpen && canAdjust && (
        <StockAdjustmentForm
          materials={materials}
          products={products}
          onCancel={() =>
            setAdjustmentOpen(false)
          }
          onSuccess={() => {
            setAdjustmentOpen(false);

            toast.success(
              t("Stock adjustment recorded successfully.")
            );

            void refresh();
          }}
        />
      )}
    </div>
  );
}
