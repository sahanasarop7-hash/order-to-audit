"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Receipt,
  Clock,
  Truck,
  FileX,
  Eye,
  Download,
  RefreshCw,
  FilePlus,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import {
  getInvoices,
  getInvoiceEligibleOrders,
  getCreditNotes,
  generateInvoice,
  type InvoiceDetails,
  type InvoiceEligibleOrder,
  type CreditNoteDetails,
} from "@/lib/invoices";

import { downloadInvoicePDF } from "@/lib/invoice-pdf";
import { calculateOrderTotals } from "@/lib/sales";

import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/lib/format";

import { Button } from "@/components/ui/button";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  DataTable,
  type Column,
} from "@/components/shared/data-table";

import { StatusBadge } from "@/components/shared/status-badge";

import { InvoiceDetailsDialog } from "@/components/invoices/invoice-details";

export default function InvoicesPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const role = profile?.role ?? "";

  const allowed = [
    "admin",
    "salesman",
    "accountant",
    "owner",
  ].includes(role);

  const isAdmin = role === "admin";

  const [invoices, setInvoices] =
    useState<InvoiceDetails[]>([]);

  const [eligibleOrders, setEligibleOrders] =
    useState<InvoiceEligibleOrder[]>([]);

  const [creditNotes, setCreditNotes] =
    useState<CreditNoteDetails[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [selectedInvoice, setSelectedInvoice] =
    useState<InvoiceDetails | null>(null);

  const [billingOrder, setBillingOrder] =
    useState<InvoiceEligibleOrder | null>(null);

  const [generating, setGenerating] =
    useState(false);

  const [generationError, setGenerationError] =
    useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [invoiceRows, orderRows, noteRows] =
        await Promise.all([
          getInvoices(),
          isAdmin
            ? getInvoiceEligibleOrders()
            : Promise.resolve([]),
          getCreditNotes(),
        ]);

      setInvoices(invoiceRows);
      setEligibleOrders(orderRows);
      setCreditNotes(noteRows);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load invoices."
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (allowed) void refresh();
  }, [allowed, refresh]);

  function handleDownload(invoice: InvoiceDetails) {
    try {
      downloadInvoicePDF(invoice);

      toast.success(
        t("Invoice PDF generated.")
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to generate PDF."
      );
    }
  }

  async function handleGenerate() {
    if (!billingOrder || generating) return;

    setGenerating(true);
    setGenerationError("");

    try {
      await generateInvoice(billingOrder.id);

      toast.success(
        t("Invoice generated successfully.")
      );

      setBillingOrder(null);

      await refresh();
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Unable to generate invoice."
      );
    } finally {
      setGenerating(false);
    }
  }

  function inDateRange(date: string) {
    return (
      (!fromDate || date >= fromDate) &&
      (!toDate || date <= toDate)
    );
  }

  const dateFilteredInvoices = invoices.filter(
    (invoice) => inDateRange(invoice.invoice_date)
  );

  const filteredInvoices =
    dateFilteredInvoices.filter(
      (invoice) =>
        status === "all" ||
        invoice.status === status
    );

  const issuedInvoices =
    dateFilteredInvoices.filter(
      (invoice) => invoice.status === "issued"
    );

  const summary = [
    {
      label: "Issued invoices",
      value: formatNumber(issuedInvoices.length),
      icon: Receipt,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Invoice value",
      value: formatCurrency(
        issuedInvoices.reduce(
          (sum, invoice) =>
            sum + invoice.total_amount,
          0
        )
      ),
      icon: Receipt,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Awaiting dispatch",
      value: formatNumber(
        issuedInvoices.filter(
          (invoice) =>
            invoice.sales_orders?.status === "invoiced"
        ).length
      ),
      icon: Truck,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Cancelled invoices",
      value: formatNumber(
        dateFilteredInvoices.filter(
          (invoice) =>
            invoice.status === "cancelled"
        ).length
      ),
      icon: FileX,
      color: "bg-amber-50 text-amber-600",
    },
  ];

  const invoiceColumns: Column<InvoiceDetails>[] = [
    {
      key: "number",
      header: t("Invoice number"),
      render: (row) => (
        <div>
          <p className="font-semibold text-indigo-700">
            {row.invoice_number}
          </p>

          <p className="text-xs text-slate-500">
            {row.sales_orders?.order_number}
          </p>
        </div>
      ),
      sortValue: (row) => row.invoice_number,
    },
    {
      key: "customer",
      header: t("Customer"),
      render: (row) => (
        <div>
          <p className="font-medium">
            {row.customer_name}
          </p>

          <p className="text-xs text-slate-500">
            {row.place_of_supply}
          </p>
        </div>
      ),
      sortValue: (row) => row.customer_name,
    },
    {
      key: "date",
      header: t("Date"),
      render: (row) =>
        formatDate(row.invoice_date),
      sortValue: (row) => row.invoice_date,
    },
    {
      key: "taxable",
      header: t("Taxable amount"),
      render: (row) =>
        formatCurrency(row.taxable_amount),
      sortValue: (row) => row.taxable_amount,
    },
    {
      key: "gst",
      header: "GST",
      render: (row) =>
        formatCurrency(
          row.cgst_amount +
          row.sgst_amount +
          row.igst_amount
        ),
      sortValue: (row) =>
        row.cgst_amount +
        row.sgst_amount +
        row.igst_amount,
    },
    {
      key: "total",
      header: t("Total"),
      render: (row) => (
        <span className="whitespace-nowrap font-semibold">
          {formatCurrency(row.total_amount)}
        </span>
      ),
      sortValue: (row) => row.total_amount,
    },
    {
      key: "status",
      header: t("Status"),
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={row.status} />

          <StatusBadge
            status={row.sales_orders?.status}
          />
        </div>
      ),
    },
    {
      key: "actions",
      header: t("Actions"),
      render: (row) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedInvoice(row)}
          >
            <Eye className="mr-1 h-4 w-4" />
            {t("View")}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDownload(row)}
          >
            <Download className="mr-1 h-4 w-4" />
            PDF
          </Button>
        </div>
      ),
    },
  ];

  const orderColumns: Column<InvoiceEligibleOrder>[] = [
    {
      key: "order",
      header: t("Order number"),
      render: (row) => (
        <span className="font-semibold text-indigo-700">
          {row.order_number}
        </span>
      ),
    },
    {
      key: "customer",
      header: t("Customer"),
      render: (row) =>
        row.customers?.name ?? "—",
    },
    {
      key: "date",
      header: t("Date"),
      render: (row) =>
        formatDate(row.order_date),
    },
    {
      key: "salesman",
      header: t("Salesman"),
      render: (row) => row.salesman_name,
    },
    {
      key: "amount",
      header: t("Estimated total"),
      render: (row) =>
        formatCurrency(
          calculateOrderTotals(
            row.sales_order_items
          ).totalAmount
        ),
    },
    {
      key: "status",
      header: t("Status"),
      render: (row) => (
        <StatusBadge status={row.status} />
      ),
    },
    {
      key: "actions",
      header: t("Actions"),
      render: (row) => (
        <Button
          size="sm"
          onClick={() => {
            setGenerationError("");
            setBillingOrder(row);
          }}
        >
          <FilePlus className="mr-2 h-4 w-4" />
          {t("Generate invoice")}
        </Button>
      ),
    },
  ];

  const creditColumns: Column<CreditNoteDetails>[] = [
    {
      key: "id",
      header: t("Record ID"),
      render: (row) => row.id,
      sortValue: (row) => row.id,
    },
    {
      key: "details",
      header: t("Credit note details"),
      render: (row) => {
        const details = Object.entries(row).filter(
          ([key, value]) =>
            key !== "id" &&
            key !== "credit_note_items" &&
            key !== "created_at" &&
            key !== "created_by" &&
            value !== null &&
            typeof value !== "object"
        );

        return (
          <div className="grid gap-2 sm:grid-cols-2">
            {details.map(([key, value]) => (
              <div key={key}>
                <p className="text-xs capitalize text-slate-500">
                  {t(key.replaceAll("_", " "))}
                </p>

                <p className="text-sm font-medium">
                  {key.endsWith("_amount") &&
                  typeof value === "number"
                    ? formatCurrency(value)
                    : String(value)}
                </p>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: "items",
      header: t("Items"),
      render: (row) =>
        row.credit_note_items.length,
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
            {t("Invoices")}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {t("Manage GST billing, dispatch and credit notes.")}
          </p>
        </div>

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
        <Tabs
          defaultValue="invoices"
          className="space-y-5"
        >
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-auto min-w-max gap-1 rounded-xl border bg-white p-1.5">
              <TabsTrigger
                value="invoices"
                className="gap-2 px-4 py-2.5"
              >
                <Receipt size={16} />
                {t("Invoices")}
              </TabsTrigger>

              {isAdmin && (
                <TabsTrigger
                  value="billing"
                  className="gap-2 px-4 py-2.5"
                >
                  <Clock size={16} />
                  {t("Awaiting billing")}

                  <span className="rounded-full bg-indigo-50 px-2 text-xs text-indigo-700">
                    {eligibleOrders.length}
                  </span>
                </TabsTrigger>
              )}

              <TabsTrigger
                value="credits"
                className="gap-2 px-4 py-2.5"
              >
                <FileX size={16} />
                {t("Credit notes")}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="invoices"
            className="space-y-4"
          >
            <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
              <div className="space-y-1">
                <label
                  htmlFor="invoice-from"
                  className="text-xs font-medium text-slate-600"
                >
                  {t("From")}
                </label>

                <input
                  id="invoice-from"
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
                  htmlFor="invoice-to"
                  className="text-xs font-medium text-slate-600"
                >
                  {t("To")}
                </label>

                <input
                  id="invoice-to"
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

            <DataTable
              data={filteredInvoices}
              columns={invoiceColumns}
              rowKey={(row) => row.id}
              searchValue={(row) =>
                [
                  row.invoice_number,
                  row.customer_name,
                  row.customer_gstin,
                  row.place_of_supply,
                  row.sales_orders?.order_number,
                  row.status,
                ].join(" ")
              }
              searchPlaceholder={t("Search invoices...")}
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

                  <option value="issued">
                    {t("issued")}
                  </option>

                  <option value="cancelled">
                    {t("cancelled")}
                  </option>
                </select>
              }
            />
          </TabsContent>

          {isAdmin && (
            <TabsContent
              value="billing"
              className="space-y-4"
            >
              <div className="rounded-xl border bg-white p-4">
                <h2 className="font-semibold">
                  {t("Approved orders")}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {t("Generate GST invoices for approved sales orders.")}
                </p>
              </div>

              <DataTable
                data={eligibleOrders}
                columns={orderColumns}
                rowKey={(row) => row.id}
                searchValue={(row) =>
                  [
                    row.order_number,
                    row.customers?.name,
                    row.salesman_name,
                  ].join(" ")
                }
                searchPlaceholder={t("Search orders...")}
              />
            </TabsContent>
          )}

          <TabsContent value="credits">
            <DataTable
              data={creditNotes}
              columns={creditColumns}
              rowKey={(row) => row.id}
              searchValue={(row) =>
                JSON.stringify(row)
              }
              searchPlaceholder={t("Search credit notes...")}
            />
          </TabsContent>
        </Tabs>
      )}

      {selectedInvoice && (
        <InvoiceDetailsDialog
          invoice={selectedInvoice}
          canManage={isAdmin}
          onClose={() => setSelectedInvoice(null)}
          onSuccess={() => {
            setSelectedInvoice(null);
            void refresh();
          }}
        />
      )}

      {billingOrder && isAdmin && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !generating) {
              setBillingOrder(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("Generate GST invoice")}
              </DialogTitle>

              <DialogDescription>
                {t("Confirm the order details before generating the invoice.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-xl border bg-slate-50 p-4 text-sm">
              <div className="flex justify-between">
                <span>{t("Order number")}</span>
                <strong>
                  {billingOrder.order_number}
                </strong>
              </div>

              <div className="flex justify-between">
                <span>{t("Customer")}</span>
                <strong>
                  {billingOrder.customers?.name}
                </strong>
              </div>

              <div className="flex justify-between border-t pt-3">
                <span>{t("Estimated total")}</span>

                <strong className="text-indigo-700">
                  {formatCurrency(
                    calculateOrderTotals(
                      billingOrder.sales_order_items
                    ).totalAmount
                  )}
                </strong>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              {t("Invoice numbering and final tax calculations are handled automatically by the system.")}
            </p>

            {generationError && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {generationError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={generating}
                onClick={() => setBillingOrder(null)}
              >
                {t("Cancel")}
              </Button>

              <Button
                disabled={generating}
                onClick={handleGenerate}
              >
                {t(
                  generating
                    ? "Generating..."
                    : "Generate invoice"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}