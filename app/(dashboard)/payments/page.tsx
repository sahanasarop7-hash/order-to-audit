
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Wallet,
  Receipt,
  AlertTriangle,
  Users,
  Plus,
  RefreshCw,
  Undo2,
  Clock,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import {
  getPayments,
  getReceivables,
  getReceivablesAgeing,
  getCustomerOutstanding,
  type PaymentDetails,
  type Receivable,
  type AgeingRow,
  type CustomerOutstanding,
} from "@/lib/payments";

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
  DataTable,
  type Column,
} from "@/components/shared/data-table";

import { StatusBadge } from "@/components/shared/status-badge";

import { PaymentForm } from "@/components/payments/payment-form";

import { PaymentReversalDialog } from "@/components/payments/payment-reversal";

export default function PaymentsPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const role = profile?.role ?? "";

  const allowed = [
    "admin",
    "accountant",
    "owner",
  ].includes(role);

  const canRecord = [
    "admin",
    "accountant",
  ].includes(role);

  const canReverse = role === "admin";

  const [payments, setPayments] =
    useState<PaymentDetails[]>([]);

  const [receivables, setReceivables] =
    useState<Receivable[]>([]);

  const [ageing, setAgeing] =
    useState<AgeingRow[]>([]);

  const [customers, setCustomers] =
    useState<CustomerOutstanding[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);

  const [initialInvoiceId, setInitialInvoiceId] =
    useState<number | undefined>(undefined);

  const [selectedPayment, setSelectedPayment] =
    useState<PaymentDetails | null>(null);

  const [paymentStatus, setPaymentStatus] =
    useState("all");

  const [paymentMethod, setPaymentMethod] =
    useState("all");

  const [receivableStatus, setReceivableStatus] =
    useState("all");

  const [ageingBucket, setAgeingBucket] =
    useState("all");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Load payment history and financial reports.

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        paymentRows,
        receivableRows,
        ageingRows,
        customerRows,
      ] = await Promise.all([
        getPayments(),
        getReceivables(),
        getReceivablesAgeing(),
        getCustomerOutstanding(),
      ]);

      setPayments(paymentRows);
      setReceivables(receivableRows);
      setAgeing(ageingRows);
      setCustomers(customerRows);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load payment data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void refresh();
  }, [allowed, refresh]);

  // Calculate financial overview.

  const totalCollected =
    receivables.reduce(
      (sum, invoice) =>
        sum + Math.round(invoice.amount_paid * 100),
      0
    ) / 100;

  const totalOutstanding =
    receivables.reduce(
      (sum, invoice) =>
        sum +
        Math.round(
          invoice.outstanding_amount * 100
        ),
      0
    ) / 100;

  const overdueAmount =
    receivables
      .filter(
        (invoice) =>
          invoice.overdue_days > 0 &&
          invoice.outstanding_amount > 0
      )
      .reduce(
        (sum, invoice) =>
          sum +
          Math.round(
            invoice.outstanding_amount * 100
          ),
        0
      ) / 100;

  const outstandingInvoices =
    receivables.filter(
      (invoice) =>
        invoice.outstanding_amount > 0
    );

  const outstandingCustomers =
    customers.filter(
      (customer) =>
        customer.total_outstanding > 0
    ).length;

  const cards = [
    {
      label: "Total collected",
      value: formatCurrency(totalCollected),
      detail: t("Valid invoice payments"),
      icon: Wallet,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Total outstanding",
      value: formatCurrency(totalOutstanding),
      detail:
        `${outstandingInvoices.length} ` +
        t("outstanding invoices"),
      icon: Receipt,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Overdue amount",
      value: formatCurrency(overdueAmount),
      detail: t("Past payment due date"),
      icon: AlertTriangle,
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "Outstanding customers",
      value: formatNumber(outstandingCustomers),
      detail: t("Customers with unpaid balances"),
      icon: Users,
      color: "bg-blue-50 text-blue-600",
    },
  ];

  // Open payment form.

  function openPaymentForm(invoiceId?: number) {
    setInitialInvoiceId(invoiceId);
    setFormOpen(true);
  }

  function closePaymentForm() {
    setFormOpen(false);
    setInitialInvoiceId(undefined);
  }

  function handlePaymentSuccess() {
    closePaymentForm();

    toast.success(
      t("Payment recorded successfully.")
    );

    void refresh();
  }

  function paymentMethodLabel(
    method: string | null
  ) {
    switch (method) {
      case "cash":
        return t("Cash");

      case "upi":
        return t("UPI");

      case "bank_transfer":
        return t("Bank transfer");

      case "cheque":
        return t("Cheque");

      default:
        return method ?? "—";
    }
  }

  // Derive a consistent payment status for display.

  function invoicePaymentStatus(
    invoice: Receivable
  ) {
    if (invoice.outstanding_amount <= 0) {
      return "paid";
    }

    if (invoice.amount_paid > 0) {
      return "partially_paid";
    }

    return "unpaid";
  }

  // Apply payment history filters.

  const filteredPayments = payments.filter(
    (payment) =>
      (
        paymentStatus === "all" ||
        payment.status === paymentStatus
      ) &&
      (
        paymentMethod === "all" ||
        payment.payment_method === paymentMethod
      ) &&
      (
        !fromDate ||
        payment.payment_date >= fromDate
      ) &&
      (
        !toDate ||
        payment.payment_date <= toDate
      )
  );

  const filteredReceivables =
    receivables.filter((invoice) => {
      if (receivableStatus === "all") {
        return true;
      }

      if (receivableStatus === "overdue") {
        return (
          invoice.overdue_days > 0 &&
          invoice.outstanding_amount > 0
        );
      }

      return (
        invoicePaymentStatus(invoice) ===
        receivableStatus
      );
    });

  // Group ageing rows using database buckets.

  const ageingGroups = Array.from(
    ageing.reduce((groups, row) => {
      const bucket = row.ageing_bucket;

      const current = groups.get(bucket) ?? {
        count: 0,
        amountPaise: 0,
      };

      groups.set(bucket, {
        count: current.count + 1,
        amountPaise:
          current.amountPaise +
          Math.round(
            row.outstanding_amount * 100
          ),
      });

      return groups;
    }, new Map<
      string,
      {
        count: number;
        amountPaise: number;
      }
    >())
  );

  const filteredAgeing = ageing.filter(
    (row) =>
      ageingBucket === "all" ||
      row.ageing_bucket === ageingBucket
  );

  // Payment history table.

  const paymentColumns: Column<PaymentDetails>[] = [
    {
      key: "date",
      header: t("Payment date"),
      render: (row) =>
        formatDate(row.payment_date),
      sortValue: (row) => row.payment_date,
    },
    {
      key: "invoice",
      header: t("Invoice number"),
      render: (row) => (
        <span className="font-medium text-indigo-700">
          {row.invoices?.invoice_number ?? "—"}
        </span>
      ),
      sortValue: (row) =>
        row.invoices?.invoice_number ?? "",
    },
    {
      key: "customer",
      header: t("Customer"),
      render: (row) =>
        row.invoices?.customer_name ?? "—",
      sortValue: (row) =>
        row.invoices?.customer_name ?? "",
    },
    {
      key: "amount",
      header: t("Amount"),
      render: (row) => (
        <span
          className={
            row.status === "reversed"
              ? "font-medium text-slate-400 line-through"
              : "font-semibold text-emerald-700"
          }
        >
          {formatCurrency(row.amount)}
        </span>
      ),
      sortValue: (row) => row.amount,
    },
    {
      key: "method",
      header: t("Payment method"),
      render: (row) =>
        paymentMethodLabel(row.payment_method),
      sortValue: (row) =>
        row.payment_method,
    },
    {
      key: "reference",
      header: t("Reference"),
      render: (row) =>
        row.reference_number || "—",
    },
    {
      key: "status",
      header: t("Status"),
      render: (row) => (
        <StatusBadge status={row.status} />
      ),
      sortValue: (row) => row.status ?? "",
    },
    {
      key: "reason",
      header: t("Reversal reason"),
      render: (row) => (
        <span className="block max-w-[220px] whitespace-normal break-words text-xs text-slate-500">
          {row.reversal_reason || "—"}
        </span>
      ),
    },
    ...(canReverse
      ? [
          {
            key: "actions",
            header: t("Actions"),
            render: (row: PaymentDetails) =>
              row.status === "recorded" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  onClick={() =>
                    setSelectedPayment(row)
                  }
                >
                  <Undo2 className="mr-1 h-4 w-4" />
                  {t("Reverse")}
                </Button>
              ) : (
                "—"
              ),
          },
        ]
      : []),
  ];

  // Invoice receivables table.

  const receivableColumns: Column<Receivable>[] = [
    {
      key: "invoice",
      header: t("Invoice number"),
      render: (row) => (
        <span className="font-medium text-indigo-700">
          {row.invoice_number}
        </span>
      ),
      sortValue: (row) =>
        row.invoice_number,
    },
    {
      key: "customer",
      header: t("Customer"),
      render: (row) => row.customer_name,
      sortValue: (row) =>
        row.customer_name,
    },
    {
      key: "date",
      header: t("Invoice date"),
      render: (row) =>
        formatDate(row.invoice_date),
      sortValue: (row) =>
        row.invoice_date,
    },
    {
      key: "due",
      header: t("Due date"),
      render: (row) =>
        row.due_date
          ? formatDate(row.due_date)
          : "—",
      sortValue: (row) =>
        row.due_date ?? "",
    },
    {
      key: "total",
      header: t("Invoice total"),
      render: (row) =>
        formatCurrency(row.total_amount),
      sortValue: (row) =>
        row.total_amount,
    },
    {
      key: "paid",
      header: t("Amount paid"),
      render: (row) => (
        <span className="font-medium text-emerald-700">
          {formatCurrency(row.amount_paid)}
        </span>
      ),
      sortValue: (row) => row.amount_paid,
    },
    {
      key: "outstanding",
      header: t("Outstanding"),
      render: (row) => (
        <span
          className={`font-semibold ${
            row.outstanding_amount > 0
              ? "text-amber-600"
              : "text-emerald-700"
          }`}
        >
          {formatCurrency(
            row.outstanding_amount
          )}
        </span>
      ),
      sortValue: (row) =>
        row.outstanding_amount,
    },
    {
      key: "status",
      header: t("Status"),
      render: (row) => (
        <div className="space-y-1">
          <StatusBadge
            status={invoicePaymentStatus(row)}
          />

          {row.overdue_days > 0 &&
            row.outstanding_amount > 0 && (
              <p className="text-xs font-medium text-red-600">
                {row.overdue_days}{" "}
                {t("days overdue")}
              </p>
            )}
        </div>
      ),
    },
    ...(canRecord
      ? [
          {
            key: "actions",
            header: t("Actions"),
            render: (row: Receivable) =>
              row.outstanding_amount > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openPaymentForm(
                      row.invoice_id
                    )
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {t("Record payment")}
                </Button>
              ) : (
                "—"
              ),
          },
        ]
      : []),
  ];

  // Customer outstanding table.

  const customerColumns: Column<CustomerOutstanding>[] = [
    {
      key: "customer",
      header: t("Customer"),
      render: (row) => (
        <span className="font-medium">
          {row.customer_name}
        </span>
      ),
      sortValue: (row) =>
        row.customer_name,
    },
    {
      key: "type",
      header: t("Customer type"),
      render: (row) =>
        t(row.customer_type ?? "—"),
    },
    {
      key: "invoices",
      header: t("Invoices"),
      render: (row) =>
        formatNumber(row.total_invoices),
      sortValue: (row) =>
        row.total_invoices,
    },
    {
      key: "invoiced",
      header: t("Total invoiced"),
      render: (row) =>
        formatCurrency(row.total_invoiced),
      sortValue: (row) =>
        row.total_invoiced,
    },
    {
      key: "collected",
      header: t("Total collected"),
      render: (row) => (
        <span className="text-emerald-700">
          {formatCurrency(
            row.total_collected
          )}
        </span>
      ),
      sortValue: (row) =>
        row.total_collected,
    },
    {
      key: "outstanding",
      header: t("Outstanding"),
      render: (row) => (
        <span className="font-semibold text-amber-600">
          {formatCurrency(
            row.total_outstanding
          )}
        </span>
      ),
      sortValue: (row) =>
        row.total_outstanding,
    },
    {
      key: "overdue",
      header: t("Overdue amount"),
      render: (row) => (
        <span
          className={
            row.overdue_amount > 0
              ? "font-medium text-red-600"
              : "text-slate-500"
          }
        >
          {formatCurrency(row.overdue_amount)}
        </span>
      ),
      sortValue: (row) =>
        row.overdue_amount,
    },
  ];

  // Receivables ageing table.

  const ageingColumns: Column<AgeingRow>[] = [
    {
      key: "invoice",
      header: t("Invoice number"),
      render: (row) => (
        <span className="font-medium text-indigo-700">
          {row.invoice_number}
        </span>
      ),
      sortValue: (row) =>
        row.invoice_number,
    },
    {
      key: "customer",
      header: t("Customer"),
      render: (row) =>
        row.customer_name,
      sortValue: (row) =>
        row.customer_name,
    },
    {
      key: "due",
      header: t("Due date"),
      render: (row) =>
        row.due_date
          ? formatDate(row.due_date)
          : "—",
      sortValue: (row) =>
        row.due_date ?? "",
    },
    {
      key: "outstanding",
      header: t("Outstanding"),
      render: (row) => (
        <span className="font-semibold">
          {formatCurrency(
            row.outstanding_amount
          )}
        </span>
      ),
      sortValue: (row) =>
        row.outstanding_amount,
    },
    {
      key: "days",
      header: t("Overdue days"),
      render: (row) => (
        <span
          className={
            row.overdue_days > 0
              ? "font-semibold text-red-600"
              : "text-emerald-700"
          }
        >
          {formatNumber(row.overdue_days)}
        </span>
      ),
      sortValue: (row) =>
        row.overdue_days,
    },
    {
      key: "bucket",
      header: t("Ageing category"),
      render: (row) => (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            row.overdue_days > 0
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {t(row.ageing_bucket)}
        </span>
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
            {t("Payments")}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {t(
              "Manage customer collections, outstanding invoices and receivables ageing."
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

          {canRecord && (
            <Button
              disabled={
                loading ||
                !!error ||
                outstandingInvoices.length === 0
              }
              onClick={() => openPaymentForm()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("Record payment")}
            </Button>
          )}
        </div>
      </div>

      {/* Financial summary cards */}

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
          defaultValue="history"
          className="space-y-4"
        >
          <div className="overflow-x-auto">
            <TabsList className="w-max">
              <TabsTrigger value="history">
                <Wallet className="mr-2 h-4 w-4" />
                {t("Payment history")}
              </TabsTrigger>

              <TabsTrigger value="receivables">
                <Receipt className="mr-2 h-4 w-4" />
                {t("Invoice receivables")}
              </TabsTrigger>

              <TabsTrigger value="customers">
                <Users className="mr-2 h-4 w-4" />
                {t("Customer outstanding")}
              </TabsTrigger>

              <TabsTrigger value="ageing">
                <Clock className="mr-2 h-4 w-4" />
                {t("Receivables ageing")}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Payment history */}

          <TabsContent
            value="history"
            className="space-y-4"
          >
            <div>
              <h2 className="font-semibold">
                {t("Payment history")}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {t(
                  "Review recorded collections and payment reversals."
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
              <div className="space-y-1">
                <label
                  htmlFor="payment-from"
                  className="text-xs font-medium text-slate-600"
                >
                  {t("From")}
                </label>

                <input
                  id="payment-from"
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
                  htmlFor="payment-to"
                  className="text-xs font-medium text-slate-600"
                >
                  {t("To")}
                </label>

                <input
                  id="payment-to"
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
                  htmlFor="payment-method"
                  className="text-xs font-medium text-slate-600"
                >
                  {t("Payment method")}
                </label>

                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value)
                  }
                  className="block h-10 rounded-md border bg-white px-3 text-sm"
                >
                  <option value="all">
                    {t("All methods")}
                  </option>

                  {[
                    "cash",
                    "upi",
                    "bank_transfer",
                    "cheque",
                  ].map((method) => (
                    <option
                      key={method}
                      value={method}
                    >
                      {paymentMethodLabel(method)}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  setPaymentMethod("all");
                  setPaymentStatus("all");
                }}
              >
                {t("Clear filters")}
              </Button>
            </div>

            <DataTable
              data={filteredPayments}
              columns={paymentColumns}
              rowKey={(row) => row.id}
              searchValue={(row) =>
                [
                  row.invoices?.invoice_number,
                  row.invoices?.customer_name,
                  row.payment_method,
                  row.reference_number,
                  row.status,
                  row.reversal_reason,
                ].join(" ")
              }
              searchPlaceholder={t(
                "Search payments..."
              )}
              filters={
                <select
                  aria-label={t("Status")}
                  value={paymentStatus}
                  onChange={(e) =>
                    setPaymentStatus(e.target.value)
                  }
                  className="h-10 rounded-md border bg-white px-3 text-sm"
                >
                  <option value="all">
                    {t("All statuses")}
                  </option>

                  <option value="recorded">
                    {t("recorded")}
                  </option>

                  <option value="reversed">
                    {t("reversed")}
                  </option>
                </select>
              }
            />
          </TabsContent>

          {/* Invoice receivables */}

          <TabsContent
            value="receivables"
            className="space-y-4"
          >
            <div>
              <h2 className="font-semibold">
                {t("Invoice receivables")}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {t(
                  "Track invoice totals, collections and remaining balances."
                )}
              </p>
            </div>

            <DataTable
              data={filteredReceivables}
              columns={receivableColumns}
              rowKey={(row) => row.invoice_id}
              searchValue={(row) =>
                [
                  row.invoice_number,
                  row.customer_name,
                  invoicePaymentStatus(row),
                ].join(" ")
              }
              searchPlaceholder={t(
                "Search invoice receivables..."
              )}
              filters={
                <select
                  aria-label={t("Payment status")}
                  value={receivableStatus}
                  onChange={(e) =>
                    setReceivableStatus(e.target.value)
                  }
                  className="h-10 rounded-md border bg-white px-3 text-sm"
                >
                  <option value="all">
                    {t("All statuses")}
                  </option>

                  <option value="paid">
                    {t("paid")}
                  </option>

                  <option value="partially_paid">
                    {t("partially_paid")}
                  </option>

                  <option value="unpaid">
                    {t("unpaid")}
                  </option>

                  <option value="overdue">
                    {t("overdue")}
                  </option>
                </select>
              }
            />
          </TabsContent>

          {/* Customer outstanding */}

          <TabsContent
            value="customers"
            className="space-y-4"
          >
            <div>
              <h2 className="font-semibold">
                {t("Customer outstanding")}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {t(
                  "Review total invoiced amounts, collections and unpaid balances for each customer."
                )}
              </p>
            </div>

            <DataTable
              data={customers}
              columns={customerColumns}
              rowKey={(row) => row.customer_id}
              searchValue={(row) =>
                `${row.customer_name} ${row.customer_type}`
              }
              searchPlaceholder={t(
                "Search customers..."
              )}
            />
          </TabsContent>

          {/* Receivables ageing */}

          <TabsContent
            value="ageing"
            className="space-y-4"
          >
            <div>
              <h2 className="font-semibold">
                {t("Receivables ageing")}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {t(
                  "Monitor outstanding balances by payment due date and overdue duration."
                )}
              </p>
            </div>

            {ageingGroups.length > 0 && (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                {ageingGroups.map(
                  ([bucket, group]) => (
                    <div
                      key={bucket}
                      className="rounded-xl border bg-white p-4"
                    >
                      <p className="text-sm text-slate-500">
                        {t(bucket)}
                      </p>

                      <p className="mt-2 text-lg font-bold">
                        {formatCurrency(
                          group.amountPaise / 100
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {group.count}{" "}
                        {t("invoices")}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}

            <DataTable
              data={filteredAgeing}
              columns={ageingColumns}
              rowKey={(row) => row.invoice_id}
              searchValue={(row) =>
                [
                  row.invoice_number,
                  row.customer_name,
                  row.ageing_bucket,
                ].join(" ")
              }
              searchPlaceholder={t(
                "Search ageing records..."
              )}
              filters={
                <select
                  aria-label={t("Ageing category")}
                  value={ageingBucket}
                  onChange={(e) =>
                    setAgeingBucket(e.target.value)
                  }
                  className="h-10 rounded-md border bg-white px-3 text-sm"
                >
                  <option value="all">
                    {t("All categories")}
                  </option>

                  {ageingGroups.map(([bucket]) => (
                    <option
                      key={bucket}
                      value={bucket}
                    >
                      {t(bucket)}
                    </option>
                  ))}
                </select>
              }
            />

            <p className="text-xs text-slate-500">
              {t(
                "Ageing balances are calculated using current outstanding amounts and invoice due dates."
              )}
            </p>
          </TabsContent>
        </Tabs>
      )}

      {/* Record payment */}

      {formOpen && canRecord && (
        <PaymentForm
          receivables={receivables}
          initialInvoiceId={initialInvoiceId}
          onSuccess={handlePaymentSuccess}
          onCancel={closePaymentForm}
        />
      )}

      {/* Reverse payment */}

      {selectedPayment && canReverse && (
        <PaymentReversalDialog
          payment={selectedPayment}
          onCancel={() =>
            setSelectedPayment(null)
          }
          onSuccess={() => {
            setSelectedPayment(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
