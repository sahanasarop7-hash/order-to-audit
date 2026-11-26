
"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  reversePayment,
  type PaymentDetails,
} from "@/lib/payments";

import {
  formatCurrency,
  formatDate,
} from "@/lib/format";

import { useLanguage } from "@/contexts/language-context";

import { MasterDialog } from "@/components/masters/master-dialog";
import { Textarea } from "@/components/ui/textarea";

export function PaymentReversalDialog({
  payment,
  onSuccess,
  onCancel,
}: {
  payment: PaymentDetails;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState("");

  async function handleSave() {
    if (!reason.trim()) {
      throw new Error(
        "Enter a reason for reversing this payment."
      );
    }

    await reversePayment(payment.id, reason);

    toast.success(
      t("Payment reversed successfully.")
    );
  }

  return (
    <MasterDialog
      title="Reverse payment"
      description="Correct an invalid payment without deleting its history."
      onSave={handleSave}
      onSuccess={onSuccess}
      onCancel={onCancel}
    >
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border bg-slate-50 p-4">
          <div>
            <p className="text-xs text-slate-500">
              {t("Invoice")}
            </p>

            <p className="font-semibold">
              {payment.invoices?.invoice_number ?? "—"}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">
              {t("Customer")}
            </p>

            <p className="font-medium">
              {payment.invoices?.customer_name ?? "—"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">
                {t("Payment date")}
              </p>

              <p className="font-medium">
                {formatDate(payment.payment_date)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                {t("Amount to reverse")}
              </p>

              <p className="text-lg font-bold text-red-600">
                {formatCurrency(payment.amount)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="reversal-reason"
            className="text-sm font-medium"
          >
            {t("Reversal reason")} *
          </label>

          <Textarea
            id="reversal-reason"
            value={reason}
            onChange={(e) =>
              setReason(e.target.value)
            }
            placeholder={t(
              "Explain why this payment must be reversed."
            )}
            required
          />
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">
            {t("Confirm payment reversal")}
          </p>

          <p className="mt-2">
            {t(
              "This payment will be excluded from collections and the invoice outstanding balance will increase. The original payment and reversal reason will remain available for auditing."
            )}
          </p>

          <p className="mt-2 font-medium">
            {t(
              "This action does not initiate a bank refund."
            )}
          </p>
        </div>
      </div>
    </MasterDialog>
  );
}
