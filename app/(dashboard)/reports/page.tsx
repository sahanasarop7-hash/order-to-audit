
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FileSpreadsheet,
  FileText,
  Download,
  RefreshCw,
  BarChart3,
  CalendarDays,
  Database,
  Search,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import {
  REPORTS,
  loadReport,
  getReportColumns,
  reportColumnLabel,
  type ReportRow,
} from "@/lib/reports";

import {
  exportReportCSV,
  exportReportExcel,
  exportReportPDF,
  type ReportExportInput,
} from "@/lib/report-export";

import {
  formatDate,
  formatNumber,
} from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  DataTable,
  type Column,
} from "@/components/shared/data-table";

type ExportFormat = "csv" | "xlsx" | "pdf";

type LoadedReport = {
  reportId: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  rows: ReportRow[];
};

// Get the current business date in India.

function getToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getMonthStart() {
  return `${getToday().slice(0, 7)}-01`;
}

// Format values for the report preview.
// Export files retain the original values.

function displayValue(
  key: string,
  value: ReportRow[string]
) {
  if (value == null || value === "") {
    return "—";
  }

  if (
    typeof value === "string" &&
    key.endsWith("_date") &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return formatDate(value);
  }

  if (typeof value === "number") {
    if (
      key.endsWith("_percentage") ||
      key === "gst_rate"
    ) {
      return `${value.toFixed(2)}%`;
    }

    return value.toLocaleString("en-IN", {
      maximumFractionDigits: 6,
    });
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

export default function ReportsPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const role = profile?.role ?? "";

  const availableReports = useMemo(
    () =>
      REPORTS.filter((report) =>
        report.roles.includes(role)
      ),
    [role]
  );

  const allowed = availableReports.length > 0;

  const [reportId, setReportId] =
    useState("");

  const [startDate, setStartDate] =
    useState(getMonthStart);

  const [endDate, setEndDate] =
    useState(getToday);

  const [loadedReport, setLoadedReport] =
    useState<LoadedReport | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [exporting, setExporting] =
    useState<ExportFormat | null>(null);

  // Select the first permitted report.

  useEffect(() => {
    if (
      availableReports.length > 0 &&
      !availableReports.some(
        (report) => report.id === reportId
      )
    ) {
      setReportId(availableReports[0].id);
      setLoadedReport(null);
      setSearch("");
    }
  }, [availableReports, reportId]);

  const selectedReport = availableReports.find(
    (report) => report.id === reportId
  );

  const categories = Array.from(
    new Set(
      availableReports.map(
        (report) => report.category
      )
    )
  );

  // Prevent exports from using an old report
  // after the report selection or dates change.

  const reportIsCurrent =
    loadedReport !== null &&
    selectedReport !== undefined &&
    loadedReport.reportId === reportId &&
    (
      !selectedReport.periodBased ||
      (
        loadedReport.startDate === startDate &&
        loadedReport.endDate === endDate
      )
    );

  const rows =
    reportIsCurrent && loadedReport
      ? loadedReport.rows
      : [];

  // Retrieve the selected report.

  const generateReport = useCallback(async () => {
    const report = availableReports.find(
      (item) => item.id === reportId
    );

    if (!report) return;

    if (
      report.periodBased &&
      (
        !startDate ||
        !endDate ||
        startDate > endDate
      )
    ) {
      setError("Select a valid date range.");
      return;
    }

    setLoading(true);
    setError("");
    setLoadedReport(null);
    setSearch("");

    try {
      const data = await loadReport(
        report.id,
        startDate,
        endDate
      );

      setLoadedReport({
        reportId: report.id,
        startDate,
        endDate,
        generatedAt: new Date().toISOString(),
        rows: data,
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to generate report."
      );
    } finally {
      setLoading(false);
    }
  }, [
    availableReports,
    reportId,
    startDate,
    endDate,
  ]);

  // Report column definitions.

  const columnKeys = selectedReport
    ? getReportColumns(selectedReport, rows)
    : [];

  // Search across all displayed report columns.

  const searchTerm = search.trim().toLowerCase();

  const filteredRows = rows.filter((row) => {
    if (!searchTerm) return true;

    return columnKeys.some((key) =>
      String(row[key] ?? "")
        .toLowerCase()
        .includes(searchTerm)
    );
  });

  // Add a local key for table rendering.
  // This key is not included in exported files.

  const tableRows = filteredRows.map(
    (row, index) => ({
      ...row,
      _row_key: index,
    })
  );

  type TableRow = ReportRow & {
    _row_key: number;
  };

  const columns: Column<TableRow>[] =
    columnKeys.map((key) => ({
      key,

      header: t(reportColumnLabel(key)),

      render: (row) => {
        const value = row[key];

        const isAlert =
          typeof value === "string" &&
          (
            value === "alert" ||
            value === "unplanned_consumption" ||
            value === "overdue"
          );

        return (
          <span
            className={
              isAlert
                ? "font-semibold text-amber-700"
                : typeof value === "number"
                  ? "tabular-nums"
                  : ""
            }
          >
            {displayValue(key, value)}
          </span>
        );
      },

      sortValue: (row) => {
        const value = row[key];

        return typeof value === "number"
          ? value
          : String(value ?? "");
      },
    }));

  // Export only the currently loaded report.

  async function handleExport(
    format: ExportFormat
  ) {
    if (
      !selectedReport ||
      !loadedReport ||
      !reportIsCurrent ||
      filteredRows.length === 0
    ) {
      toast.error(
        t("Generate a report before exporting.")
      );

      return;
    }

    setExporting(format);

    try {
      const period = selectedReport.periodBased
        ? `${formatDate(loadedReport.startDate)} to ${formatDate(loadedReport.endDate)}`
        : `Current balances | Generated ${new Date(
            loadedReport.generatedAt
          ).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })}`;

      const filename = selectedReport.periodBased
        ? `${reportId}_${loadedReport.startDate}_${loadedReport.endDate}`
        : `${reportId}_${getToday()}`;

      const input: ReportExportInput = {
        title: selectedReport.title,
        period,
        filename,
        columns: columnKeys,
        rows: filteredRows,
      };

      switch (format) {
        case "csv":
          exportReportCSV(input);
          break;

        case "xlsx":
          await exportReportExcel(input);
          break;

        case "pdf":
          await exportReportPDF(input);
          break;
      }

      toast.success(
        t("Report export generated successfully.")
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("Unable to export report.")
      );
    } finally {
      setExporting(null);
    }
  }

  const canExport =
    reportIsCurrent &&
    filteredRows.length > 0 &&
    !loading &&
    !exporting;

  const busy = loading || exporting !== null;

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

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("Reports")}
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {t(
            "Generate business reports, reconcile transactions and export auditor-ready records."
          )}
        </p>
      </div>

      {/* Reporting overview */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: "Available reports",
            value: availableReports.length,
            detail: "Role-based report access",
            icon: BarChart3,
            color: "bg-indigo-50 text-indigo-600",
          },
          {
            label: "Report categories",
            value: categories.length,
            detail: "Business reporting areas",
            icon: Database,
            color: "bg-blue-50 text-blue-600",
          },
          {
            label: "Export formats",
            value: 3,
            detail: "Excel, CSV and PDF",
            icon: Download,
            color: "bg-emerald-50 text-emerald-600",
          },
        ].map((card) => {
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
                {card.value}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {t(card.detail)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Report configuration */}

      <div className="space-y-5 rounded-xl border bg-white p-5 shadow-sm">
        <div>
          <h2 className="font-semibold">
            {t("Report configuration")}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {t(
              "Choose a report and its reporting period."
            )}
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="report-type"
            className="text-sm font-medium"
          >
            {t("Report type")}
          </label>

          <select
            id="report-type"
            value={reportId}
            disabled={busy}
            onChange={(event) => {
              setReportId(event.target.value);
              setLoadedReport(null);
              setSearch("");
              setError("");
            }}
            className="block h-11 w-full rounded-md border bg-white px-3 text-sm sm:max-w-lg"
          >
            {categories.map((category) => (
              <optgroup
                key={category}
                label={t(category)}
              >
                {availableReports
                  .filter(
                    (report) =>
                      report.category === category
                  )
                  .map((report) => (
                    <option
                      key={report.id}
                      value={report.id}
                    >
                      {t(report.title)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>

          {selectedReport && (
            <p className="text-xs text-slate-500">
              {t(selectedReport.description)}
            </p>
          )}
        </div>

        {selectedReport?.periodBased ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label
                htmlFor="report-from"
                className="text-xs font-medium text-slate-600"
              >
                {t("From")}
              </label>

              <input
                id="report-from"
                type="date"
                value={startDate}
                max={endDate}
                disabled={busy}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setError("");
                }}
                className="block h-10 rounded-md border bg-white px-3 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="report-to"
                className="text-xs font-medium text-slate-600"
              >
                {t("To")}
              </label>

              <input
                id="report-to"
                type="date"
                value={endDate}
                min={startDate}
                max={getToday()}
                disabled={busy}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setError("");
                }}
                className="block h-10 rounded-md border bg-white px-3 text-sm"
              />
            </div>

            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setStartDate(getMonthStart());
                setEndDate(getToday());
                setError("");
              }}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              {t("This month")}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800">
            {t(
              "This report displays current balances rather than historical period balances."
            )}
          </div>
        )}

        <Button
          disabled={busy || !selectedReport}
          onClick={() => void generateReport()}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />

          {loading
            ? t("Generating report...")
            : t("Generate report")}
        </Button>
      </div>

      {/* Report loading state */}

      {loading && (
        <div className="rounded-xl border bg-white p-12 text-center">
          <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-indigo-600" />

          <p className="text-sm text-slate-500">
            {t("Generating report...")}
          </p>
        </div>
      )}

      {/* Error state */}

      {error && !loading && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-white p-5">
          <p className="text-sm text-red-600">
            {error}
          </p>

          <Button
            variant="outline"
            onClick={() => void generateReport()}
          >
            {t("Retry")}
          </Button>
        </div>
      )}

      {/* Initial state */}

      {!loading &&
        !error &&
        !reportIsCurrent && (
          <div className="rounded-xl border border-dashed bg-white p-12 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />

            <h3 className="font-semibold">
              {t("Generate your report")}
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              {t(
                "Select a report and click Generate report to view and export records."
              )}
            </p>
          </div>
        )}

      {/* Generated report preview */}

      {!loading &&
        !error &&
        reportIsCurrent &&
        selectedReport &&
        loadedReport && (
          <div className="space-y-4">

            {/* Report heading and exports */}

            <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-white p-5">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-indigo-600">
                  {t(selectedReport.category)}
                </p>

                <h2 className="text-lg font-semibold">
                  {t(selectedReport.title)}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedReport.periodBased
                    ? `${formatDate(loadedReport.startDate)} — ${formatDate(loadedReport.endDate)}`
                    : t("Current balances")}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {t("Generated at")}:{" "}
                  {new Date(
                    loadedReport.generatedAt
                  ).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!canExport}
                  onClick={() =>
                    void handleExport("xlsx")
                  }
                  className="text-emerald-700"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />

                  {exporting === "xlsx"
                    ? t("Exporting...")
                    : t("Excel")}
                </Button>

                <Button
                  variant="outline"
                  disabled={!canExport}
                  onClick={() =>
                    void handleExport("csv")
                  }
                >
                  <Download className="mr-2 h-4 w-4" />

                  {exporting === "csv"
                    ? t("Exporting...")
                    : t("CSV")}
                </Button>

                <Button
                  variant="outline"
                  disabled={!canExport}
                  onClick={() =>
                    void handleExport("pdf")
                  }
                  className="text-red-600"
                >
                  <FileText className="mr-2 h-4 w-4" />

                  {exporting === "pdf"
                    ? t("Exporting...")
                    : t("PDF")}
                </Button>
              </div>
            </div>

            {/* Search and record count */}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />

                <Input
                  aria-label={t("Search report records")}
                  value={search}
                  disabled={busy}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder={t(
                    "Search report records..."
                  )}
                  className="pl-9"
                />
              </div>

              <p className="text-sm text-slate-500">
                {formatNumber(filteredRows.length)}{" "}
                {t("of")}{" "}
                {formatNumber(rows.length)}{" "}
                {t("records")}
              </p>
            </div>

            {/* Report data */}

            {rows.length === 0 ? (
              <div className="rounded-xl border bg-white p-10 text-center">
                <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />

                <p className="font-medium">
                  {t("No report records found.")}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {t(
                    "Try a different reporting period."
                  )}
                </p>
              </div>
            ) : (
              <DataTable
                key={`${reportId}-${loadedReport.generatedAt}-${search}`}
                data={tableRows}
                columns={columns}
                rowKey={(row) => row._row_key}
                pageSize={10}
              />
            )}

            <p className="text-xs text-slate-500">
              {t(
                "Exports include all matching records, not just the current table page. Values are retrieved from database reports."
              )}
            </p>

            {selectedReport.category === "GST" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {t(
                  "GST reports are intended for reconciliation and accountant review, not direct statutory filing."
                )}
              </div>
            )}
          </div>
        )}
    </div>
  );
}
