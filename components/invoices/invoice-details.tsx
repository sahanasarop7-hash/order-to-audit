"use client";

import { useState } from "react";
import { Download, Truck, FileX } from "lucide-react";
import { toast } from "sonner";

import {
  dispatchOrder,
  issueCreditNote,
  type InvoiceDetails,
} from "@/lib/invoices";

import { downloadInvoicePDF } from "@/lib/invoice-pdf";

import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/lib/format";

import { useLanguage } from "@/contexts/language-context";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";

export function InvoiceDetailsDialog({
  invoice,
  canManage,
  onClose,
  onSuccess,
}: {
  invoice: InvoiceDetails;
  canManage: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();

  const [action, setAction] = useState<
    "dispatch" | "credit" | null
  >(null);

  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const canDispatch =
    canManage &&
    invoice.status === "issued" &&
    invoice.sales_orders?.status === "invoiced";

  const canCancel = canDispatch;

  const totals = [
    {
      label: "Taxable amount",
      value: invoice.taxable_amount,
    },
    {
      label: "CGST",
      value: invoice.cgst_amount,
    },
    {
      label: "SGST",
      value: invoice.sgst_amount,
    },
    {
      label: "IGST",
      value: invoice.igst_amount,
    },
  ];

  function handleDownload() {
    try {
      downloadInvoicePDF(invoice);
      toast.success(t("Invoice PDF generated."));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to generate PDF."
      );
    }
  }

  async function handleConfirm() {
    if (!action || processing) return;

    setError("");

    if (action === "credit" && !reason.trim()) {
      setError("Enter a cancellation reason.");
      return;
    }

    setProcessing(true);

    try {
      if (action === "dispatch") {
        await dispatchOrder(invoice.order_id);

        toast.success(
          t("Order dispatched successfully.")
        );
      } else {
        await issueCreditNote(
          invoice.id,
          reason.trim()
        );

        toast.success(
          t("Credit note issued successfully.")
        );
      }

      onSuccess();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to complete transaction."
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !processing) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {invoice.invoice_number}
          </DialogTitle>

          <DialogDescription>
            {t("GST invoice details")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">
                {t("Invoice date")}
              </p>

              <p className="font-semibold">
                {formatDate(invoice.invoice_date)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge status={invoice.status} />

              <StatusBadge
                status={invoice.sales_orders?.status}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border p-4">
              <h3 className="text-xs font-semibold uppercase text-slate-500">
                {t("Bill to")}
              </h3>

              <p className="font-semibold">
                {invoice.customer_name}
              </p>

              <p className="whitespace-pre-wrap text-sm text-slate-600">
                {invoice.customer_address || "—"}
              </p>

              <p className="break-all text-sm">
                GSTIN:{" "}
                {invoice.customer_gstin ||
                  t("Unregistered")}
              </p>
            </div>

            <div className="space-y-3 rounded-xl border p-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">
                  {t("Order number")}
                </p>

                <p className="font-medium">
                  {invoice.sales_orders?.order_number ??
                    "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  {t("Place of supply")}
                </p>

                <p className="font-medium">
                  {invoice.place_of_supply} (
                  {invoice.state_code})
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  {t("Due date")}
                </p>

                <p className="font-medium">
                  {invoice.due_date
                    ? formatDate(invoice.due_date)
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="p-3">
                    {t("Product")}
                  </th>
                  <th className="p-3">HSN</th>
                  <th className="p-3 text-right">
                    {t("Quantity")}
                  </th>
                  <th className="p-3 text-right">
                    {t("Unit price")}
                  </th>
                  <th className="p-3 text-right">
                    {t("Taxable amount")}
                  </th>
                  <th className="p-3 text-right">
                    GST
                  </th>
                  <th className="p-3 text-right">
                    {t("Total")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {invoice.invoice_items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3 font-medium">
                      {item.product_name}
                    </td>

                    <td className="p-3">
                      {item.hsn_code || "—"}
                    </td>

                    <td className="p-3 text-right">
                      {formatNumber(item.quantity)}
                    </td>

                    <td className="p-3 text-right">
                      {formatCurrency(item.unit_price)}
                    </td>

                    <td className="p-3 text-right">
                      {formatCurrency(item.taxable_amount)}
                    </td>

                    <td className="p-3 text-right">
                      {item.gst_rate}%
                    </td>

                    <td className="p-3 text-right font-medium">
                      {formatCurrency(item.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full space-y-3 rounded-xl border bg-slate-50 p-4 sm:max-w-sm">
            {totals.map((item) => (
              <div
                key={item.label}
                className="flex justify-between text-sm"
              >
                <span className="text-slate-600">
                  {t(item.label)}
                </span>

                <span className="font-medium">
                  {formatCurrency(item.value)}
                </span>
              </div>
            ))}

            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-semibold">
                {t("Grand total")}
              </span>

              <span className="text-xl font-bold text-indigo-700">
                {formatCurrency(invoice.total_amount)}
              </span>
            </div>
          </div>

          {!action && (
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={onClose}
              >
                {t("Close")}
              </Button>

              <Button
                variant="outline"
                onClick={handleDownload}
              >
                <Download className="mr-2 h-4 w-4" />
                {t("Download PDF")}
              </Button>

              {canCancel && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setError("");
                    setReason("");
                    setAction("credit");
                  }}
                >
                  <FileX className="mr-2 h-4 w-4" />
                  {t("Issue credit note")}
                </Button>
              )}

              {canDispatch && (
                <Button
                  onClick={() => {
                    setError("");
                    setAction("dispatch");
                  }}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  {t("Confirm dispatch")}
                </Button>
              )}
            </div>
          )}

          {action && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold">
                {t(
                  action === "dispatch"
                    ? "Confirm dispatch"
                    : "Issue credit note"
                )}
              </h3>

              <p className="text-sm text-slate-700">
                {t(
                  action === "dispatch"
                    ? "Confirm that the goods have been dispatched. Finished goods stock will be deducted automatically."
                    : "This will cancel the invoice and release its stock reservation. Only unpaid, undispatched invoices are eligible."
                )}
              </p>

              {action === "credit" && (
                <Textarea
                  aria-label={t("Cancellation reason")}
                  placeholder={t("Enter cancellation reason...")}
                  value={reason}
                  disabled={processing}
                  onChange={(e) =>
                    setReason(e.target.value)
                  }
                />
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-100 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={processing}
                  onClick={() => {
                    setAction(null);
                    setError("");
                  }}
                >
                  {t("Back")}
                </Button>

                <Button
                  disabled={processing}
                  variant={
                    action === "credit"
                      ? "destructive"
                      : "default"
                  }
                  onClick={handleConfirm}
                >
                  {t(
                    processing
                      ? "Processing..."
                      : "Confirm"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}