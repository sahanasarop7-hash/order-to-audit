"use client";
import { getLocalizedName } from "@/lib/localized-name";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Undo2,
} from "lucide-react";

import { toast } from "sonner";

import {
  postPurchase,
  cancelPurchase,
  reversePurchase,
  calculatePurchaseTotal,
  type PurchaseDetails,
} from "@/lib/purchases";

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

type PurchaseAction = "post" | "cancel" | "reverse";

const actionDetails = {
  post: {
    title: "Post purchase",
    description:
      "This will increase material stock and recalculate weighted average costs. The purchase will no longer be editable.",
  },
  cancel: {
    title: "Cancel purchase",
    description:
      "This draft will be cancelled. Inventory will not be affected.",
  },
  reverse: {
    title: "Reverse purchase",
    description:
      "This will reverse the purchase stock movements and restore previous material costs if the purchase is eligible.",
  },
};

export function PurchaseDetailsDialog({
  purchase,
  role,
  onClose,
  onSuccess,
}: {
  purchase: PurchaseDetails;
  role: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t, language } = useLanguage();

  const [action, setAction] =
    useState<PurchaseAction | null>(null);

  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const canManage = [
    "admin",
    "accountant",
  ].includes(role);

  const canPost =
    canManage && purchase.status === "draft";

  const canCancel = canPost;

  const canReverse =
    role === "admin" &&
    purchase.status === "posted";

  const total = calculatePurchaseTotal(
    purchase.purchase_items
  );

  function selectAction(nextAction: PurchaseAction) {
    setAction(nextAction);
    setReason("");
    setError("");
  }

  async function handleConfirm() {
    if (!action || processing) return;

    setError("");

    if (
      action !== "post" &&
      !reason.trim()
    ) {
      setError("Enter a reason to continue.");
      return;
    }

    setProcessing(true);

    try {
      switch (action) {
        case "post":
          await postPurchase(purchase.id);

          toast.success(
            t("Purchase posted successfully.")
          );
          break;

        case "cancel":
          await cancelPurchase(
            purchase.id,
            reason
          );

          toast.success(
            t("Purchase cancelled successfully.")
          );
          break;

        case "reverse":
          await reversePurchase(
            purchase.id,
            reason
          );

          toast.success(
            t("Purchase reversed successfully.")
          );
          break;
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
            {purchase.invoice_number}
          </DialogTitle>

          <DialogDescription>
            {t("Purchase details")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">
                {t("Purchase date")}
              </p>

              <p className="font-semibold">
                {formatDate(purchase.purchase_date)}
              </p>
            </div>

            <StatusBadge status={purchase.status} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                {t("Supplier")}
              </p>

              <p className="font-semibold">
                {purchase.supplier_name}
              </p>

              <p className="text-sm text-slate-500">
                {purchase.suppliers?.supplier_code ??
                  "—"}
              </p>

              <p className="text-sm">
                GSTIN:{" "}
                {purchase.suppliers?.gstin ||
                  t("Unregistered")}
              </p>

              <p className="text-sm text-slate-600">
                {purchase.suppliers?.state ?? "—"}
              </p>
            </div>

            <div className="space-y-3 rounded-xl border p-4">
              <div>
                <p className="text-xs text-slate-500">
                  {t("Supplier invoice number")}
                </p>

                <p className="font-medium">
                  {purchase.invoice_number}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  {t("Total items")}
                </p>

                <p className="font-medium">
                  {purchase.purchase_items.length}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="p-3">
                    {t("Material")}
                  </th>

                  <th className="p-3">
                    {t("Category")}
                  </th>

                  <th className="p-3 text-right">
                    {t("Quantity")}
                  </th>

                  <th className="p-3">
                    {t("Unit")}
                  </th>

                  <th className="p-3 text-right">
                    {t("Unit price")}
                  </th>

                  <th className="p-3 text-right">
                    {t("Total")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {purchase.purchase_items.map(
                  (item) => (
                    <tr
                      key={item.id}
                      className="border-t"
                    >
                      <td className="p-3">
                        <p className="font-medium">
                          {item.inventory_items ? getLocalizedName(item.inventory_items, language) : "—"}
                        </p>

                        <p className="text-xs text-slate-500">
                          {item.inventory_items?.sku}
                        </p>
                      </td>

                      <td className="p-3">
                        {t(
                          item.inventory_items?.category ??
                            "—"
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {formatNumber(item.quantity)}
                      </td>

                      <td className="p-3">
                        {t(item.inventory_items?.unit ?? "—")}
                      </td>

                      <td className="p-3 text-right">
                        {formatCurrency(item.unit_price)}
                      </td>

                      <td className="p-3 text-right font-medium">
                        {formatCurrency(
                          calculatePurchaseTotal([item])
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="ml-auto flex w-full items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 p-4 sm:max-w-sm">
            <span className="font-semibold">
              {t("Purchase total")}
            </span>

            <span className="text-xl font-bold text-indigo-700">
              {formatCurrency(total)}
            </span>
          </div>

          {purchase.status === "posted" && (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">
                {t("Inventory updated")}
              </p>

              <p className="text-sm text-emerald-700">
                {t(
                  "This purchase has been recorded in the stock ledger and included in material costing."
                )}
              </p>
            </div>
          )}

          {purchase.status === "cancelled" && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                {t("Cancellation reason")}
              </p>

              <p className="whitespace-pre-wrap text-sm text-red-700">
                {purchase.cancellation_reason || "—"}
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

              {canCancel && (
                <Button
                  variant="destructive"
                  onClick={() =>
                    selectAction("cancel")
                  }
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {t("Cancel purchase")}
                </Button>
              )}

              {canReverse && (
                <Button
                  variant="destructive"
                  onClick={() =>
                    selectAction("reverse")
                  }
                >
                  <Undo2 className="mr-2 h-4 w-4" />
                  {t("Reverse purchase")}
                </Button>
              )}

              {canPost && (
                <Button
                  onClick={() =>
                    selectAction("post")
                  }
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t("Post purchase")}
                </Button>
              )}
            </div>
          )}

          {action && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold">
                {t(actionDetails[action].title)}
              </h3>

              <p className="text-sm text-slate-700">
                {t(
                  actionDetails[action].description
                )}
              </p>

              {action !== "post" && (
                <Textarea
                  aria-label={t("Reason")}
                  placeholder={t("Enter reason...")}
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
                    action === "post"
                      ? "default"
                      : "destructive"
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