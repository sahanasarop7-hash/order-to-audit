
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Plus,
  RefreshCw,
  Factory,
  PackageCheck,
  TrendingUp,
  AlertTriangle,
  Eye,
  Pencil,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import {
  getProductionRuns,
  getProductionSummaries,
  calculateYield,
  type ProductionDetails,
  type ProductionSummary,
} from "@/lib/production";

import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/lib/format";

import { Button } from "@/components/ui/button";

import {
  DataTable,
  type Column,
} from "@/components/shared/data-table";

import { StatusBadge } from "@/components/shared/status-badge";

import { ProductionForm } from "@/components/production/production-form";

import { ProductionDetailsDialog } from "@/components/production/production-details";

export default function ProductionPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const role = profile?.role ?? "";

  const allowed = [
    "admin",
    "production",
    "accountant",
    "owner",
  ].includes(role);

  const canManage = [
    "admin",
    "production",
  ].includes(role);

  const [runs, setRuns] =
    useState<ProductionDetails[]>([]);

  const [summaries, setSummaries] =
    useState<ProductionSummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [status, setStatus] = useState("all");
  const [product, setProduct] = useState("all");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [formOpen, setFormOpen] = useState(false);

  const [editingRun, setEditingRun] =
    useState<ProductionDetails | null>(null);

  const [selectedRun, setSelectedRun] =
    useState<ProductionDetails | null>(null);

  // Load production batches and database summaries.

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [runRows, summaryRows] =
        await Promise.all([
          getProductionRuns(),
          getProductionSummaries(),
        ]);

      setRuns(runRows);
      setSummaries(summaryRows);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load production data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void refresh();
  }, [allowed, refresh]);

  function getSummary(runId: number) {
    return summaries.find(
      (summary) =>
        summary.production_run_id === runId
    );
  }

  function openNewRun() {
    setEditingRun(null);
    setFormOpen(true);
  }

  function openEditRun(run: ProductionDetails) {
    setEditingRun(run);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingRun(null);
  }

  function handleSaveSuccess() {
    closeForm();

    toast.success(
      t("Production draft saved successfully.")
    );

    void refresh();
  }

  // Build product filter options.

  const productOptions = Array.from(
    new Map(
      runs
        .filter((run) => run.boms?.products)
        .map((run) => [
          String(run.boms?.products?.id),
          run.boms?.products?.name ?? "—",
        ])
    ).entries()
  );

  // Filter production batches.

  const scopedRuns = runs.filter(
    (run) =>
      (!fromDate ||
        run.production_date >= fromDate) &&
      (!toDate ||
        run.production_date <= toDate) &&
      (
        product === "all" ||
        String(run.boms?.products?.id) === product
      )
  );

  const filteredRuns = scopedRuns.filter(
    (run) =>
      status === "all" ||
      run.status === status
  );

  const postedRuns = scopedRuns.filter(
    (run) => run.status === "posted"
  );

  const draftCount = scopedRuns.filter(
    (run) => run.status === "draft"
  ).length;

  const totalPlanned = postedRuns.reduce(
    (sum, run) => sum + run.planned_output,
    0
  );

  const totalActual = postedRuns.reduce(
    (sum, run) =>
      sum + (run.actual_output ?? 0),
    0
  );

  const overallYield = calculateYield(
    totalPlanned,
    totalActual
  );

  const alertCount = postedRuns.filter(
    (run) => {
      const yieldPercentage = calculateYield(
        run.planned_output,
        run.actual_output ?? 0
      );

      const hasMaterialAlert =
        run.production_consumption.some(
          (item) =>
            item.planned_quantity === 0
              ? item.actual_quantity > 0
              : Math.abs(
                  (
                    (item.actual_quantity -
                      item.planned_quantity) /
                    item.planned_quantity
                  ) * 100
                ) > 3
        );

      return (
        hasMaterialAlert ||
        Math.abs(yieldPercentage - 100) > 3
      );
    }
  ).length;

  const cards = [
    {
      label: "Production batches",
      value: formatNumber(scopedRuns.length),
      detail: `${draftCount} ${t("draft")}`,
      icon: Factory,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Good output",
      value: formatNumber(totalActual),
      detail: t("Posted packets"),
      icon: PackageCheck,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Production yield",
      value:
        totalPlanned > 0
          ? `${overallYield.toFixed(2)}%`
          : "—",
      detail: `${formatNumber(totalPlanned)} ${t("planned packets")}`,
      icon: TrendingUp,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Batches requiring review",
      value: formatNumber(alertCount),
      detail: t("Outside 3% tolerance"),
      icon: AlertTriangle,
      color: "bg-amber-50 text-amber-600",
    },
  ];

  // Production table columns.

  const columns: Column<ProductionDetails>[] = [
    {
      key: "batch",
      header: t("Batch number"),
      render: (row) => (
        <span className="font-semibold text-indigo-700">
          {row.batch_number}
        </span>
      ),
      sortValue: (row) => row.batch_number,
    },
    {
      key: "product",
      header: t("Product"),
      render: (row) => (
        <div>
          <p className="font-medium">
            {row.boms?.products?.name ?? "—"}
          </p>

          <p className="text-xs text-slate-500">
            BOM V{row.boms?.version ?? "—"}
          </p>
        </div>
      ),
      sortValue: (row) =>
        row.boms?.products?.name ?? "",
    },
    {
      key: "date",
      header: t("Date"),
      render: (row) =>
        formatDate(row.production_date),
      sortValue: (row) =>
        row.production_date,
    },
    {
      key: "planned",
      header: t("Planned"),
      render: (row) =>
        formatNumber(row.planned_output),
      sortValue: (row) =>
        row.planned_output,
    },
    {
      key: "actual",
      header: t("Actual"),
      render: (row) =>
        row.actual_output == null
          ? "—"
          : formatNumber(row.actual_output),
      sortValue: (row) =>
        row.actual_output ?? 0,
    },
    {
      key: "yield",
      header: t("Yield"),
      render: (row) => {
        if (row.actual_output == null) {
          return "—";
        }

        const value = calculateYield(
          row.planned_output,
          row.actual_output
        );

        return (
          <span
            className={`font-semibold ${
              Math.abs(value - 100) > 3
                ? "text-amber-600"
                : "text-emerald-600"
            }`}
          >
            {value.toFixed(2)}%
          </span>
        );
      },
      sortValue: (row) =>
        calculateYield(
          row.planned_output,
          row.actual_output ?? 0
        ),
    },
    {
      key: "wastage",
      header: t("Damaged pouches"),
      render: (row) =>
        formatNumber(row.damaged_pouches),
      sortValue: (row) =>
        row.damaged_pouches,
    },
    {
      key: "cost",
      header: t("Cost per packet"),
      render: (row) => {
        const cost =
          getSummary(row.id)?.cost_per_packet;

        return cost == null
          ? "—"
          : formatCurrency(cost);
      },
      sortValue: (row) =>
        getSummary(row.id)?.cost_per_packet ?? 0,
    },
    {
      key: "status",
      header: t("Status"),
      render: (row) => (
        <StatusBadge status={row.status} />
      ),
      sortValue: (row) => row.status,
    },
    {
      key: "actions",
      header: t("Actions"),
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedRun(row)}
          >
            <Eye className="mr-1 h-4 w-4" />
            {t("View")}
          </Button>

          {canManage && row.status === "draft" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openEditRun(row)}
            >
              <Pencil className="mr-1 h-4 w-4" />
              {t("Edit")}
            </Button>
          )}
        </div>
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
            {t("Production")}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {t(
              "Manage production batches, material consumption, yield and costing."
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

          {canManage && (
            <Button onClick={openNewRun}>
              <Plus className="mr-2 h-4 w-4" />
              {t("New production batch")}
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
        <>
          {/* Filters */}

          <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
            <div className="space-y-1">
              <label
                htmlFor="production-from"
                className="text-xs font-medium text-slate-600"
              >
                {t("From")}
              </label>

              <input
                id="production-from"
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
                htmlFor="production-to"
                className="text-xs font-medium text-slate-600"
              >
                {t("To")}
              </label>

              <input
                id="production-to"
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
                htmlFor="production-product"
                className="text-xs font-medium text-slate-600"
              >
                {t("Product")}
              </label>

              <select
                id="production-product"
                value={product}
                onChange={(e) =>
                  setProduct(e.target.value)
                }
                className="block h-10 max-w-[240px] rounded-md border bg-white px-3 text-sm"
              >
                <option value="all">
                  {t("All products")}
                </option>

                {productOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setFromDate("");
                setToDate("");
                setProduct("all");
                setStatus("all");
              }}
            >
              {t("Clear filters")}
            </Button>
          </div>

          {/* Production history */}

          <DataTable
            data={filteredRuns}
            columns={columns}
            rowKey={(row) => row.id}
            searchValue={(row) =>
              [
                row.batch_number,
                row.boms?.products?.name,
                row.boms?.products?.sku,
                row.status,
                ...row.production_consumption.map(
                  (item) =>
                    item.inventory_items?.name ?? ""
                ),
              ].join(" ")
            }
            searchPlaceholder={t(
              "Search production batches..."
            )}
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

                <option value="draft">
                  {t("draft")}
                </option>

                <option value="posted">
                  {t("posted")}
                </option>

                <option value="cancelled">
                  {t("cancelled")}
                </option>
              </select>
            }
          />
        </>
      )}

      {/* Create or edit production */}

      {formOpen && canManage && (
        <ProductionForm
          record={editingRun}
          onSuccess={handleSaveSuccess}
          onCancel={closeForm}
        />
      )}

      {/* Production details */}

      {selectedRun && (
        <ProductionDetailsDialog
          run={selectedRun}
          summary={getSummary(selectedRun.id)}
          role={role}
          onClose={() => setSelectedRun(null)}
          onSuccess={() => {
            setSelectedRun(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
