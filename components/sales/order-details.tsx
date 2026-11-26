"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import {
  approveSalesOrder,
  reopenSalesOrder,
  closeSalesOrder,
  getProductStock,
  calculateOrderTotals,
  type OrderDetails,
  type ProductStock,
} from "@/lib/sales";

import {
  formatCurrency,
  formatNumber,
  formatDate,
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

type OrderAction =
  | "approve"
  | "reopen"
  | "reject"
  | "cancel";

export function OrderDetailsDialog({
  order,
  role,
  onClose,
  onSuccess,
}: {
  order: OrderDetails;
  role: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();

  const [stock, setStock] = useState<ProductStock[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState("");

  const [action, setAction] =
    useState<OrderAction | null>(null);

  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = role === "admin";
  const isSalesman = role === "salesman";

  const isPending = order.status === "pending";
  const isApproved = order.status === "approved";

  const totals = calculateOrderTotals(
    order.sales_order_items
  );

  useEffect(() => {
    async function loadStock() {
      try {
        setStock(await getProductStock());
      } catch (error) {
        setStockError(
          error instanceof Error
            ? error.message
            : "Unable to load stock."
        );
      } finally {
        setStockLoading(false);
      }
    }

    void loadStock();
  }, []);

  const hasShortage = order.sales_order_items.some(
    (item) => {
      const currentStock = stock.find(
        (row) => row.product_id === item.product_id
      );

      return (
        currentStock !== undefined &&
        item.quantity > currentStock.available_stock
      );
    }
  );

  const requiresReason =
    action === "reject" || action === "cancel";

  const actionLabels: Record<OrderAction, string> = {
    approve: "Approve order",
    reopen: "Reopen order",
    reject: "Reject order",
    cancel: "Cancel order",
  };

  const actionDescriptions: Record<OrderAction, string> = {
    approve:
      "Approving this order will reserve the required stock.",
    reopen:
      "This order will return to pending and its stock reservation will be released.",
    reject:
      "This order will be rejected. The reason will be recorded in the audit history.",
    cancel:
      "This order will be cancelled and any reserved stock will be released.",
  };

  function selectAction(value: OrderAction) {
    setAction(value);
    setReason("");
    setError("");
  }

  async function executeAction() {
    if (!action || processing) return;

    setError("");

    if (requiresReason && !reason.trim()) {
      setError("Enter a reason to continue.");
      return;
    }

    setProcessing(true);

    try {
      switch (action) {
        case "approve":
          await approveSalesOrder(order.id);
          break;

        case "reopen":
          await reopenSalesOrder(order.id);
          break;

        case "reject":
        case "cancel":
          await closeSalesOrder(
            order.id,
            action,
            reason.trim()
          );
          break;
      }

      toast.success(t("Order updated successfully."));
      onSuccess();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update order."
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {order.order_number}
          </DialogTitle>

          <DialogDescription>
            {t("Sales order details and status")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">
                {t("Order date")}
              </p>

              <p className="font-medium">
                {formatDate(order.order_date)}
              </p>
            </div>

            <StatusBadge status={order.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">
                {t("Customer")}
              </p>

              <p className="font-medium">
                {order.customers?.name ?? "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                {t("Salesman")}
              </p>

              <p className="font-medium">
                {order.salesman_name}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                {t("Customer type")}
              </p>

              <p className="font-medium capitalize">
                {t(order.customers?.customer_type ?? "—")}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                {t("State")}
              </p>

              <p className="font-medium">
                {order.customers?.state ?? "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                GSTIN
              </p>

              <p className="break-all font-medium">
                {order.customers?.gstin ||
                  t("Unregistered")}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                {t("Phone")}
              </p>

              <p className="font-medium">
                {order.customers?.phone || "—"}
              </p>
            </div>
          </div>

          <h3 className="font-semibold">
            {t("Order items")}
          </h3>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="p-3">
                    {t("Product")}
                  </th>
                  <th className="p-3 text-right">
                    {t("Quantity")}
                  </th>
                  <th className="p-3 text-right">
                    {t("Unit price")}
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
                {order.sales_order_items.map((item) => {
                  const total = calculateOrderTotals([item]);

                  return (
                    <tr
                      key={item.id}
                      className="border-t"
                    >
                      <td className="p-3">
                        <p className="font-medium">
                          {item.products?.name ?? "—"}
                        </p>

                        <p className="text-xs text-slate-500">
                          {item.products?.sku}
                        </p>
                      </td>

                      <td className="p-3 text-right">
                        {formatNumber(item.quantity)}
                      </td>

                      <td className="p-3 text-right">
                        {formatCurrency(item.unit_price)}
                      </td>

                      <td className="p-3 text-right">
                        {item.gst_rate}%
                      </td>

                      <td className="p-3 text-right font-medium">
                        {formatCurrency(total.totalAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 rounded-lg border bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <span>{t("Taxable amount")}</span>
              <span>
                {formatCurrency(totals.taxableAmount)}
              </span>
            </div>

            <div className="flex justify-between">
              <span>{t("Total GST")}</span>
              <span>
                {formatCurrency(totals.gstAmount)}
              </span>
            </div>

            <div className="flex justify-between border-t pt-3">
              <span className="font-semibold">
                {t("Estimated order total")}
              </span>

              <span className="text-lg font-bold text-indigo-700">
                {formatCurrency(totals.totalAmount)}
              </span>
            </div>
          </div>

          {isPending && (
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold">
                {t("Stock availability")}
              </h3>

              {stockLoading ? (
                <p className="text-sm text-slate-500">
                  {t("Loading data...")}
                </p>
              ) : stockError ? (
                <p className="text-sm text-red-600">
                  {stockError}
                </p>
              ) : (
                order.sales_order_items.map((item) => {
                  const currentStock = stock.find(
                    (row) =>
                      row.product_id === item.product_id
                  );

                  if (!currentStock) {
                    return (
                      <p
                        key={item.id}
                        className="text-sm text-amber-700"
                      >
                        {item.products?.name}:{" "}
                        {t("Stock information unavailable.")}
                      </p>
                    );
                  }

                  const available =
                    currentStock.available_stock;

                  const shortage = Math.max(
                    0,
                    item.quantity - available
                  );

                  return (
                    <div
                      key={item.id}
                      className="space-y-2 rounded-lg bg-slate-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {item.products?.name}
                        </span>

                        {shortage > 0 ? (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">
                            {t("Required")}
                          </p>
                          <p className="font-semibold">
                            {formatNumber(item.quantity)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            {t("Available")}
                          </p>
                          <p className="font-semibold">
                            {formatNumber(available)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            {t("Shortage")}
                          </p>

                          <p
                            className={`font-semibold ${
                              shortage > 0
                                ? "text-red-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {formatNumber(shortage)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {hasShortage && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {t("Insufficient stock. Approval requires sufficient available stock.")}
                </p>
              )}
            </div>
          )}

          {order.closure_reason && (
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                {t("Closure reason")}
              </p>

              <p className="mt-1 text-sm">
                {order.closure_reason}
              </p>
            </div>
          )}

          {!action && (
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={onClose}
              >
                {t("Close")}
              </Button>

              {isPending && (isAdmin || isSalesman) && (
                <Button
                  variant="outline"
                  onClick={() => selectAction("cancel")}
                >
                  {t("Cancel order")}
                </Button>
              )}

              {isPending && isAdmin && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => selectAction("reject")}
                  >
                    {t("Reject")}
                  </Button>

                  <Button
                    onClick={() => selectAction("approve")}
                  >
                    {t("Approve")}
                  </Button>
                </>
              )}

              {isApproved && isAdmin && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => selectAction("cancel")}
                  >
                    {t("Cancel order")}
                  </Button>

                  <Button
                    onClick={() => selectAction("reopen")}
                  >
                    {t("Reopen order")}
                  </Button>
                </>
              )}
            </div>
          )}

          {action && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold">
                {t(actionLabels[action])}
              </h3>

              <p className="text-sm text-slate-700">
                {t(actionDescriptions[action])}
              </p>

              {requiresReason && (
                <Textarea
                  aria-label={t("Reason")}
                  placeholder={t("Enter reason...")}
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value)
                  }
                  disabled={processing}
                />
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-md bg-red-100 p-3 text-sm text-red-700"
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
                    requiresReason
                      ? "destructive"
                      : "default"
                  }
                  onClick={executeAction}
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