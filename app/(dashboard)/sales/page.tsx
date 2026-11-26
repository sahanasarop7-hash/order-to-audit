"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Plus,
  RefreshCw,
  Eye,
  Pencil,
  ShoppingCart,
  Clock,
  PackageCheck,
  Truck,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import {
  getSalesOrders,
  calculateOrderTotals,
  type OrderDetails,
} from "@/lib/sales";

import {
  formatCurrency,
  formatNumber,
  formatDate,
} from "@/lib/format";

import { Button } from "@/components/ui/button";

import {
  DataTable,
  type Column,
} from "@/components/shared/data-table";

import { StatusBadge } from "@/components/shared/status-badge";

import { OrderForm } from "@/components/sales/order-form";

import { OrderDetailsDialog } from "@/components/sales/order-details";

const STATUSES = [
  "pending",
  "approved",
  "invoiced",
  "dispatched",
  "rejected",
  "cancelled",
];

export default function SalesPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const role = profile?.role ?? "";

  const allowed = [
    "admin",
    "salesman",
    "accountant",
    "owner",
  ].includes(role);

  const canCreate =
    role === "admin" || role === "salesman";

  const [orders, setOrders] =
    useState<OrderDetails[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [formOpen, setFormOpen] = useState(false);

  const [editingOrder, setEditingOrder] =
    useState<OrderDetails | null>(null);

  const [viewingOrder, setViewingOrder] =
    useState<OrderDetails | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setOrders(await getSalesOrders());
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load sales orders."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void refresh();
  }, [allowed, refresh]);

  function openCreate() {
    setEditingOrder(null);
    setFormOpen(true);
  }

  function openEdit(order: OrderDetails) {
    setEditingOrder(order);
    setFormOpen(true);
  }

  function handleFormSuccess() {
    setFormOpen(false);
    setEditingOrder(null);

    toast.success(t("Sales order saved successfully."));

    void refresh();
  }

  function handleActionSuccess() {
    setViewingOrder(null);
    void refresh();
  }

  const dateFilteredOrders = orders.filter((order) => {
    if (fromDate && order.order_date < fromDate) {
      return false;
    }

    if (toDate && order.order_date > toDate) {
      return false;
    }

    return true;
  });

  const filteredOrders = dateFilteredOrders.filter(
    (order) =>
      status === "all" || order.status === status
  );

  const summary = [
    {
      label: "Total orders",
      value: dateFilteredOrders.length,
      icon: ShoppingCart,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Pending approval",
      value: dateFilteredOrders.filter(
        (order) => order.status === "pending"
      ).length,
      icon: Clock,
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "Awaiting fulfilment",
      value: dateFilteredOrders.filter(
        (order) =>
          order.status === "approved" ||
          order.status === "invoiced"
      ).length,
      icon: PackageCheck,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Dispatched",
      value: dateFilteredOrders.filter(
        (order) => order.status === "dispatched"
      ).length,
      icon: Truck,
      color: "bg-emerald-50 text-emerald-600",
    },
  ];

  const columns: Column<OrderDetails>[] = [
    {
      key: "order_number",
      header: t("Order number"),
      render: (order) => (
        <span className="font-semibold text-indigo-700">
          {order.order_number}
        </span>
      ),
      sortValue: (order) => order.order_number,
    },
    {
      key: "customer",
      header: t("Customer"),
      render: (order) => (
        <div>
          <p className="font-medium">
            {order.customers?.name ?? "—"}
          </p>

          <p className="text-xs text-slate-500">
            {order.customers?.state}
          </p>
        </div>
      ),
      sortValue: (order) =>
        order.customers?.name ?? "",
    },
    {
      key: "salesman",
      header: t("Salesman"),
      render: (order) => order.salesman_name,
      sortValue: (order) => order.salesman_name,
    },
    {
      key: "date",
      header: t("Date"),
      render: (order) =>
        formatDate(order.order_date),
      sortValue: (order) => order.order_date,
    },
    {
      key: "quantity",
      header: t("Packets"),
      render: (order) =>
        formatNumber(
          order.sales_order_items.reduce(
            (sum, item) => sum + item.quantity,
            0
          )
        ),
      sortValue: (order) =>
        order.sales_order_items.reduce(
          (sum, item) => sum + item.quantity,
          0
        ),
    },
    {
      key: "amount",
      header: t("Order amount"),
      render: (order) => (
        <span className="whitespace-nowrap font-medium">
          {formatCurrency(
            calculateOrderTotals(
              order.sales_order_items
            ).totalAmount
          )}
        </span>
      ),
      sortValue: (order) =>
        calculateOrderTotals(
          order.sales_order_items
        ).totalAmount,
    },
    {
      key: "status",
      header: t("Status"),
      render: (order) => (
        <StatusBadge status={order.status} />
      ),
      sortValue: (order) => order.status,
    },
    {
      key: "actions",
      header: t("Actions"),
      render: (order) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setViewingOrder(order)}
          >
            <Eye className="mr-1 h-4 w-4" />
            {t("View")}
          </Button>

          {canCreate &&
            order.status === "pending" &&
            (
              role === "admin" ||
              order.salesman_id === profile?.id
            ) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openEdit(order)}
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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("Sales Orders")}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {t("Manage customer orders, stock availability and approvals.")}
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

          {canCreate && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("Create order")}
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

              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {loading ? "—" : formatNumber(item.value)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <div className="space-y-1">
          <label
            htmlFor="sales-from"
            className="text-xs font-medium text-slate-600"
          >
            {t("From")}
          </label>

          <input
            id="sales-from"
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
            htmlFor="sales-to"
            className="text-xs font-medium text-slate-600"
          >
            {t("To")}
          </label>

          <input
            id="sales-to"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) =>
              setToDate(e.target.value)
            }
            className="block h-10 rounded-md border bg-white px-3 text-sm"
          />
        </div>

        <Button
          variant="outline"
          onClick={() => {
            setFromDate("");
            setToDate("");
            setStatus("all");
          }}
        >
          {t("Clear filters")}
        </Button>
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
        <DataTable
          data={filteredOrders}
          columns={columns}
          rowKey={(order) => order.id}
          searchValue={(order) =>
            [
              order.order_number,
              order.customers?.name,
              order.customers?.state,
              order.salesman_name,
              order.status,
              ...order.sales_order_items.map(
                (item) =>
                  `${item.products?.name ?? ""} ${
                    item.products?.sku ?? ""
                  }`
              ),
            ].join(" ")
          }
          searchPlaceholder={t("Search orders...")}
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

              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          }
        />
      )}

      {formOpen && canCreate && (
        <OrderForm
          record={editingOrder}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setFormOpen(false);
            setEditingOrder(null);
          }}
        />
      )}

      {viewingOrder && (
        <OrderDetailsDialog
          order={viewingOrder}
          role={role}
          onClose={() => setViewingOrder(null)}
          onSuccess={handleActionSuccess}
        />
      )}
    </div>
  );
}