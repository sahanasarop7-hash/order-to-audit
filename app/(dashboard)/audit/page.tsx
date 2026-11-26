
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ShieldCheck,
  PlusCircle,
  Pencil,
  Trash2,
  Eye,
  RefreshCw,
  Download,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import {
  getAuditLogs,
  auditTableLabel,
  formatAuditTime,
  type AuditLog,
  type AuditFilters,
} from "@/lib/audit";

import {
  exportReportCSV,
} from "@/lib/report-export";

import { Button } from "@/components/ui/button";

import {
  DataTable,
  type Column,
} from "@/components/shared/data-table";

import {
  AuditDetailsDialog,
} from "@/components/audit/audit-details";

const TABLES = [
  "products",
  "customers",
  "suppliers",
  "inventory_items",
  "boms",
  "bom_items",
  "sales_orders",
  "sales_order_items",
  "purchases",
  "purchase_items",
  "production_runs",
  "production_consumption",
  "stock_movements",
  "invoices",
  "invoice_items",
  "dispatches",
  "payments",
  "credit_notes",
  "credit_note_items",
  "company_settings",
  "profiles",
];

const DEFAULT_FILTERS: AuditFilters = {
  startDate: "",
  endDate: "",
  table: "all",
  action: "all",
};

export default function AuditPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const allowed = [
    "admin",
    "accountant",
    "owner",
  ].includes(profile?.role ?? "");

  const [logs, setLogs] =
    useState<AuditLog[]>([]);

  const [filters, setFilters] =
    useState<AuditFilters>(DEFAULT_FILTERS);

  const [appliedFilters, setAppliedFilters] =
    useState<AuditFilters>(DEFAULT_FILTERS);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [selected, setSelected] =
    useState<AuditLog | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setLogs(
        await getAuditLogs(appliedFilters)
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load audit logs."
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    if (allowed) void refresh();
  }, [allowed, refresh]);

  function applyFilters() {
    if (
      filters.startDate &&
      filters.endDate &&
      filters.startDate > filters.endDate
    ) {
      toast.error(
        t("Select a valid date range.")
      );

      return;
    }

    setAppliedFilters({ ...filters });
  }

  function clearFilters() {
    setFilters({ ...DEFAULT_FILTERS });
    setAppliedFilters({ ...DEFAULT_FILTERS });
  }

  function downloadAuditCSV() {
    exportReportCSV({
      title: "Audit logs",

      period:
        `${appliedFilters.startDate || "All dates"} to ${appliedFilters.endDate || "Present"}`,

      filename: "audit_logs",

      columns: [
        "id",
        "changed_at",
        "table_name",
        "record_id",
        "action",
        "changed_by_name",
        "changed_by_role",
        "correction_reason",
        "old_data",
        "new_data",
      ],

      rows: logs.map((log) => ({
        id: log.id,
        changed_at: log.changed_at,
        table_name: log.table_name,
        record_id: log.record_id,
        action: log.action,
        changed_by_name: log.changed_by_name,
        changed_by_role: log.changed_by_role,
        correction_reason:
          log.correction_reason,
        old_data: JSON.stringify(
          log.old_data
        ),
        new_data: JSON.stringify(
          log.new_data
        ),
      })),
    });

    toast.success(
      t("Audit export generated.")
    );
  }

  const cards = [
    {
      label: "Audit entries",
      value: logs.length,
      icon: ShieldCheck,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Created records",
      value: logs.filter(
        (log) => log.action === "INSERT"
      ).length,
      icon: PlusCircle,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Updated records",
      value: logs.filter(
        (log) => log.action === "UPDATE"
      ).length,
      icon: Pencil,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Deleted records",
      value: logs.filter(
        (log) => log.action === "DELETE"
      ).length,
      icon: Trash2,
      color: "bg-red-50 text-red-600",
    },
  ];

  const columns: Column<AuditLog>[] = [
    {
      key: "time",
      header: t("Changed at"),
      render: (row) =>
        formatAuditTime(row.changed_at),
      sortValue: (row) => row.changed_at,
    },
    {
      key: "table",
      header: t("Table"),
      render: (row) => (
        <span className="font-medium">
          {t(auditTableLabel(row.table_name))}
        </span>
      ),
      sortValue: (row) => row.table_name,
    },
    {
      key: "record",
      header: t("Record ID"),
      render: (row) => row.record_id,
      sortValue: (row) => row.record_id,
    },
    {
      key: "action",
      header: t("Action"),
      render: (row) => (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            row.action === "INSERT"
              ? "bg-emerald-50 text-emerald-700"
              : row.action === "UPDATE"
                ? "bg-blue-50 text-blue-700"
                : "bg-red-50 text-red-700"
          }`}
        >
          {t(row.action)}
        </span>
      ),
      sortValue: (row) => row.action,
    },
    {
      key: "user",
      header: t("Changed by"),
      render: (row) =>
        row.changed_by_name ??
        row.changed_by ??
        t("System / migration"),
      sortValue: (row) =>
        row.changed_by_name ?? "",
    },
    {
      key: "role",
      header: t("Role"),
      render: (row) =>
        t(row.changed_by_role ?? "—"),
    },
    {
      key: "reason",
      header: t("Correction reason"),
      render: (row) => (
        <span className="block max-w-[200px] whitespace-normal break-words text-xs text-slate-500">
          {row.correction_reason || "—"}
        </span>
      ),
    },
    {
      key: "details",
      header: t("Actions"),
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelected(row)}
        >
          <Eye className="mr-1 h-4 w-4" />
          {t("View")}
        </Button>
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
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("Audit Logs")}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {t(
              "Track business record changes, users and correction history."
            )}
          </p>
        </div>

        <div className="flex gap-2">
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

          <Button
            variant="outline"
            disabled={
              loading ||
              !!error ||
              logs.length === 0
            }
            onClick={downloadAuditCSV}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("Export CSV")}
          </Button>
        </div>
      </div>

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

              <p className="mt-1 text-xl font-semibold">
                {loading || error
                  ? "—"
                  : card.value}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {t("Matching audit records")}
              </p>
            </div>
          );
        })}
      </div>

      <fieldset
        disabled={loading}
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4"
      >
        <div className="space-y-1">
          <label
            htmlFor="audit-from"
            className="text-xs font-medium"
          >
            {t("From")}
          </label>

          <input
            id="audit-from"
            type="date"
            value={filters.startDate}
            max={filters.endDate || undefined}
            onChange={(event) =>
              setFilters({
                ...filters,
                startDate: event.target.value,
              })
            }
            className="block h-10 rounded-md border px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="audit-to"
            className="text-xs font-medium"
          >
            {t("To")}
          </label>

          <input
            id="audit-to"
            type="date"
            value={filters.endDate}
            min={filters.startDate || undefined}
            onChange={(event) =>
              setFilters({
                ...filters,
                endDate: event.target.value,
              })
            }
            className="block h-10 rounded-md border px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="audit-table"
            className="text-xs font-medium"
          >
            {t("Table")}
          </label>

          <select
            id="audit-table"
            value={filters.table}
            onChange={(event) =>
              setFilters({
                ...filters,
                table: event.target.value,
              })
            }
            className="block h-10 rounded-md border bg-white px-3 text-sm"
          >
            <option value="all">
              {t("All tables")}
            </option>

            {TABLES.map((table) => (
              <option
                key={table}
                value={table}
              >
                {t(auditTableLabel(table))}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="audit-action"
            className="text-xs font-medium"
          >
            {t("Action")}
          </label>

          <select
            id="audit-action"
            value={filters.action}
            onChange={(event) =>
              setFilters({
                ...filters,
                action: event.target.value,
              })
            }
            className="block h-10 rounded-md border bg-white px-3 text-sm"
          >
            <option value="all">
              {t("All actions")}
            </option>

            <option value="INSERT">
              {t("INSERT")}
            </option>

            <option value="UPDATE">
              {t("UPDATE")}
            </option>

            <option value="DELETE">
              {t("DELETE")}
            </option>
          </select>
        </div>

        <Button onClick={applyFilters}>
          {t("Apply filters")}
        </Button>

        <Button
          variant="outline"
          onClick={clearFilters}
        >
          {t("Clear filters")}
        </Button>
      </fieldset>

      {loading ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">
          {t("Loading data...")}
        </div>
      ) : error ? (
        <div className="space-y-3 rounded-xl border bg-white p-5">
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
          data={logs}
          columns={columns}
          rowKey={(row) => row.id}
          searchValue={(row) =>
            [
              row.table_name,
              auditTableLabel(row.table_name),
              row.record_id,
              row.action,
              row.changed_by_name,
              row.changed_by_role,
              row.correction_reason,
            ].join(" ")
          }
          searchPlaceholder={t(
            "Search audit records..."
          )}
        />
      )}

      <div className="flex items-start gap-3 rounded-xl border bg-slate-50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />

        <div>
          <p className="text-sm font-semibold">
            {t("Protected audit history")}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {t(
              "Audit entries are generated by database triggers. They cannot be edited or deleted through this workspace."
            )}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {t(
              "CSV exports include all records matching the applied date, table and action filters."
            )}
          </p>
        </div>
      </div>

      {selected && (
        <AuditDetailsDialog
          log={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
