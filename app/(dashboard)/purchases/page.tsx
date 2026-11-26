"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Plus,
  RefreshCw,
  ShoppingCart,
  FileClock,
  CheckCircle,
  Wallet,
  Eye,
  Pencil,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import {
  getPurchases,
  calculatePurchaseTotal,
  type PurchaseDetails,
} from "@/lib/purchases";

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

import { PurchaseForm } from "@/components/purchases/purchase-form";

import { PurchaseDetailsDialog } from "@/components/purchases/purchase-details";

export default function PurchasesPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const role = profile?.role ?? "";

  const allowed = [
    "admin",
    "accountant",
    "production",
    "owner",
  ].includes(role);

  const canManage = [
    "admin",
    "accountant",
  ].includes(role);

  const [purchases, setPurchases] =
    useState<PurchaseDetails[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [status, setStatus] = useState("all");
  const [supplier, setSupplier] = useState("all");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [formOpen, setFormOpen] = useState(false);

  const [editingPurchase, setEditingPurchase] =
    useState<PurchaseDetails | null>(null);

  const [selectedPurchase, setSelectedPurchase] =
    useState<PurchaseDetails | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getPurchases();

      setPurchases(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load purchases."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void refresh();
  }, [allowed, refresh]);

  function openNewPurchase() {
    setEditingPurchase(null);
    setFormOpen(true);
  }

  function openEditPurchase(
    purchase: PurchaseDetails
  ) {
    setEditingPurchase(purchase);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingPurchase(null);
  }

  function handleSaveSuccess() {
    closeForm();

    toast.success(
      t("Purchase draft saved successfully.")
    );

    void refresh();
  }

  const supplierOptions = Array.from(
    new Set(
      purchases.map(
        (purchase) => purchase.supplier_name
      )
    )
  ).sort();

  const dateFilteredPurchases = purchases.filter(
    (purchase) =>
      (!fromDate ||
        purchase.purchase_date >= fromDate) &&
      (!toDate ||
        purchase.purchase_date <= toDate)
  );

  const supplierFilteredPurchases =
    dateFilteredPurchases.filter(
      (purchase) =>
        supplier === "all" ||
        purchase.supplier_name === supplier
    );

  const filteredPurchases =
    supplierFilteredPurchases.filter(
      (purchase) =>
        status === "all" ||
        purchase.status === status
    );

  const postedPurchases =
    supplierFilteredPurchases.filter(
      (purchase) => purchase.status === "posted"
    );

  const totalPurchaseValue =
    calculatePurchaseTotal(
      postedPurchases.flatMap(
        (purchase) => purchase.purchase_items
      )
    );

  const summary = [
    {
      label: "Total purchases",
      value: formatNumber(
        supplierFilteredPurchases.length
      ),
      icon: ShoppingCart,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Draft purchases",
      value: formatNumber(
        supplierFilteredPurchases.filter(
          (purchase) =>
            purchase.status === "draft"
        ).length
      ),
      icon: FileClock,
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "Posted purchases",
      value: formatNumber(
        postedPurchases.length
      ),
      icon: CheckCircle,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Posted purchase value",
      value: formatCurrency(totalPurchaseValue),
      icon: Wallet,
      color: "bg-blue-50 text-blue-600",
    },
  ];

  const columns: Column<PurchaseDetails>[] = [
    {
      key: "invoice",
      header: t("Invoice number"),
      render: (row) => (
        <span className="font-semibold text-indigo-700">
          {row.invoice_number}
        </span>
      ),
      sortValue: (row) => row.invoice_number,
    },
    {
      key: "supplier",
      header: t("Supplier"),
      render: (row) => (
        <div>
          <p className="font-medium">
            {row.supplier_name}
          </p>

          <p className="text-xs text-slate-500">
            {row.suppliers?.supplier_code}
          </p>
        </div>
      ),
      sortValue: (row) => row.supplier_name,
    },
    {
      key: "date",
      header: t("Date"),
      render: (row) =>
        formatDate(row.purchase_date),
      sortValue: (row) => row.purchase_date,
    },
    {
      key: "materials",
      header: t("Materials"),
      render: (row) => (
        <div className="max-w-[220px] space-y-1">
          {row.purchase_items
            .slice(0, 2)
            .map((item) => (
              <p
                key={item.id}
                className="text-sm text-slate-600"
              >
                {item.inventory_items?.name ??
                  "—"}
              </p>
            ))}

          {row.purchase_items.length > 2 && (
            <p className="text-xs text-indigo-600">
              +{row.purchase_items.length - 2}{" "}
              {t("more")}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "items",
      header: t("Items"),
      render: (row) =>
        row.purchase_items.length,
      sortValue: (row) =>
        row.purchase_items.length,
    },
    {
      key: "amount",
      header: t("Purchase value"),
      render: (row) => (
        <span className="whitespace-nowrap font-semibold">
          {formatCurrency(
            calculatePurchaseTotal(
              row.purchase_items
            )
          )}
        </span>
      ),
      sortValue: (row) =>
        calculatePurchaseTotal(
          row.purchase_items
        ),
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
            onClick={() =>
              setSelectedPurchase(row)
            }
          >
            <Eye className="mr-1 h-4 w-4" />
            {t("View")}
          </Button>

          {canManage &&
            row.status === "draft" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  openEditPurchase(row)
                }
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("Purchases")}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {t(
              "Manage supplier purchases, material receipts and inventory costs."
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
            <Button onClick={openNewPurchase}>
              <Plus className="mr-2 h-4 w-4" />
              {t("New purchase")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summary.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              <div
                className={`mb-3 inline-flex rounded-lg p-2 ${item.color}`}
              >
                <Icon className="h-5 w-5" />
              </div>

              <p className="text-sm text-slate-500">
                {t(item.label)}
              </p>

              <p className="mt-1 text-xl font-semibold text-slate-900">
                {loading ? "—" : item.value}
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
          <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
            <div className="space-y-1">
              <label
                htmlFor="purchase-from"
                className="text-xs font-medium text-slate-600"
              >
                {t("From")}
              </label>

              <input
                id="purchase-from"
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
                htmlFor="purchase-to"
                className="text-xs font-medium text-slate-600"
              >
                {t("To")}
              </label>

              <input
                id="purchase-to"
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
                htmlFor="purchase-supplier"
                className="text-xs font-medium text-slate-600"
              >
                {t("Supplier")}
              </label>

              <select
                id="purchase-supplier"
                value={supplier}
                onChange={(e) =>
                  setSupplier(e.target.value)
                }
                className="block h-10 max-w-[240px] rounded-md border bg-white px-3 text-sm"
              >
                <option value="all">
                  {t("All suppliers")}
                </option>

                {supplierOptions.map((name) => (
                  <option key={name} value={name}>
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
                setSupplier("all");
                setStatus("all");
              }}
            >
              {t("Clear filters")}
            </Button>
          </div>

          <DataTable
            data={filteredPurchases}
            columns={columns}
            rowKey={(row) => row.id}
            searchValue={(row) =>
              [
                row.invoice_number,
                row.supplier_name,
                row.suppliers?.supplier_code,
                row.status,
                ...row.purchase_items.map(
                  (item) =>
                    `${item.inventory_items?.name ?? ""} ${
                      item.inventory_items?.sku ?? ""
                    }`
                ),
              ].join(" ")
            }
            searchPlaceholder={t(
              "Search purchases..."
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

      {formOpen && canManage && (
        <PurchaseForm
          record={editingPurchase}
          onSuccess={handleSaveSuccess}
          onCancel={closeForm}
        />
      )}

      {selectedPurchase && (
        <PurchaseDetailsDialog
          purchase={selectedPurchase}
          role={role}
          onClose={() =>
            setSelectedPurchase(null)
          }
          onSuccess={() => {
            setSelectedPurchase(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}